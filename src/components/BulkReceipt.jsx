import { useState, useEffect } from 'react';
import { Layers, Calculator, FileStack } from 'lucide-react';
import { API_BASE_URL } from '../utils/apiConfig';

export default function BulkReceipt() {
    const [policies, setPolicies] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    const today = new Date();
    const [selectedMonth, setSelectedMonth] = useState(today.getMonth()); // 0-11
    const [selectedYear, setSelectedYear] = useState(today.getFullYear());

    const [aggregatedData, setAggregatedData] = useState([]);
    const [detailedData, setDetailedData] = useState([]);

    const fetchPolicies = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/api/policies`);
            if (response.ok) {
                const result = await response.json();
                setPolicies(result.data);
            }
        } catch (error) {
            console.error("Poliçeler yüklenemedi:", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchPolicies();
    }, []);

    useEffect(() => {
        if (policies.length === 0) return;

        let total180 = 0;
        let total770 = 0;
        let totalKKEG = 0;

        const details = [];

        // Find all policy numbers that have a cancellation record
        const cancelledPolicyNumbers = policies.filter(p => p.isCancelled === true).map(p => p.policyNumber);

        policies.forEach(policy => {
            // If this policy is cancelled, or if its original version is cancelled, skip it entirely in Bulk Receipt
            if (policy.isCancelled || cancelledPolicyNumbers.includes(policy.policyNumber)) {
                return;
            }

            let premiumNum = 0;
            if (policy.premiumAmount && policy.premiumAmount !== 'Bulunamadı') {
                let cleanedStr = policy.premiumAmount.replace(/[^\d.,]/g, '');
                const lastComma = cleanedStr.lastIndexOf(',');
                const lastDot = cleanedStr.lastIndexOf('.');

                if (lastDot > lastComma && lastDot !== -1) {
                    cleanedStr = cleanedStr.replace(/,/g, '');
                } else if (lastComma > lastDot && lastComma !== -1) {
                    cleanedStr = cleanedStr.replace(/\./g, '').replace(',', '.');
                }

                premiumNum = parseFloat(cleanedStr);
            }

            if (isNaN(premiumNum) || premiumNum <= 0) return;

            const isBinek = policy.vehicleType !== 'Ticari';

            let startDate = new Date(policy.startDate.split('/').reverse().join('-'));
            startDate.setHours(0, 0, 0, 0);

            let endDate = new Date(policy.endDate.split('/').reverse().join('-'));
            endDate.setHours(0, 0, 0, 0);

            const totalDays = 365;
            const dailyAmount = premiumNum / totalDays;

            const monthBreakdown = [];
            let firstMonthDone = false;

            // NORMAL POLICY: Forward Loop
            let remainingPremium = premiumNum;
            let currentDate = new Date(startDate);
            while (currentDate.getTime() <= endDate.getTime()) {
                const year = currentDate.getFullYear();
                const month = currentDate.getMonth();
                const daysInMonth = new Date(year, month + 1, 0).getDate();

                const isStartMonth = startDate.getFullYear() === year && startDate.getMonth() === month;
                const isEndMonth = endDate.getFullYear() === year && endDate.getMonth() === month;

                let daysInThisMonthForPolicy = 0;
                if (isStartMonth && isEndMonth) {
                    daysInThisMonthForPolicy = endDate.getDate() - startDate.getDate();
                } else if (isStartMonth) {
                    daysInThisMonthForPolicy = daysInMonth - startDate.getDate();
                } else if (isEndMonth) {
                    daysInThisMonthForPolicy = endDate.getDate();
                } else {
                    daysInThisMonthForPolicy = daysInMonth;
                }

                if (daysInThisMonthForPolicy > 0) {
                    let monthlyAmount = daysInThisMonthForPolicy * dailyAmount;

                    const isLastMonth = (year === endDate.getFullYear() && month === endDate.getMonth());
                    if (isLastMonth) {
                        monthlyAmount = remainingPremium;
                    } else {
                        remainingPremium -= monthlyAmount;
                    }

                    if (!firstMonthDone) {
                        firstMonthDone = true;
                    } else {
                        monthBreakdown.push({
                            year: year,
                            monthIndex: month,
                            amount: monthlyAmount,
                            days: daysInThisMonthForPolicy
                        });
                    }
                }
                currentDate = new Date(year, month + 1, 1, 0, 0, 0, 0);
            }


            // Sadece seçili aya uyan kısmı dahil et
            const matchedMonth = monthBreakdown.find(mb => mb.year === selectedYear && mb.monthIndex === selectedMonth);

            if (matchedMonth) {
                const amount = matchedMonth.amount;
                let t770 = 0;
                let tKkeg = 0;

                total180 += amount;

                if (isBinek) {
                    t770 = amount * 0.7;
                    tKkeg = amount * 0.3;
                    total770 += t770;
                    totalKKEG += tKkeg;
                } else {
                    t770 = amount;
                    total770 += t770;
                }

                details.push({
                    plate: policy.plateInfo,
                    policyNo: policy.policyNumber,
                    type: isBinek ? 'Binek' : 'Ticari',
                    isCancel: policy.isCancelled === true,
                    totalShare: amount,
                    giderShare: t770,
                    kkegShare: tKkeg
                });
            }
        });

        const agRecords = [];

        // We need to separate normal policies from canceled ones
        const normalDetails = details.filter(d => !d.isCancel);
        const canceledDetails = details.filter(d => d.isCancel);

        const buildRecords = (list, isCancel) => {
            if (list.length === 0) return;

            let sum180 = 0;
            let sum770 = 0;
            let sumKKEG = 0;

            list.forEach(item => {
                sum180 += item.totalShare;
                sum770 += item.giderShare;
                sumKKEG += item.kkegShare;
            });

            if (sum180 > 0) {
                const formattedMonth = new Date(selectedYear, selectedMonth, 1).toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });
                const docDate = new Date(selectedYear, selectedMonth + 1, 0).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });

                const createRecord = (type, account, defaultDebit, defaultCredit) => {
                    agRecords.push({
                        type: isCancel ? `${type} (İPTAL)` : type,
                        date: docDate,
                        account,
                        debit: isCancel ? defaultCredit : defaultDebit,
                        credit: isCancel ? defaultDebit : defaultCredit
                    });
                };

                createRecord(
                    `Toplu Gider Kaydı - ${formattedMonth}`,
                    '770 Genel Yönetim Giderleri',
                    sum770,
                    null
                );

                if (sumKKEG > 0) {
                    createRecord(
                        `Toplu KKEG Kaydı - ${formattedMonth}`,
                        '689 Diğer Olağandışı Gider/Zararlar',
                        sumKKEG,
                        null
                    );
                }

                createRecord(
                    `Toplam 180 Kapatılması - ${formattedMonth}`,
                    `180 Gelecek Aylara Ait Giderler - ${formattedMonth.split(' ')[0]}`,
                    null,
                    sum180
                );
            }
        };

        buildRecords(normalDetails, false);
        buildRecords(canceledDetails, true);

        setAggregatedData(agRecords);
        setDetailedData(details);

    }, [policies, selectedMonth, selectedYear]);

    const formatCurrency = (val) => {
        return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(val);
    };

    // Ayın son gününü fiş tarihi yapmak için hesapla
    const selectedMonthName = new Date(selectedYear, selectedMonth, 1).toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });

    // Generate year options from past few years to future
    const yOpts = [];
    const baseYear = today.getFullYear() - 2;
    for (let i = 0; i < 5; i++) {
        yOpts.push(baseYear + i);
    }
    const mOpts = [
        "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
        "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"
    ];

    if (isLoading) {
        return <div style={{ textAlign: 'center', padding: '2rem' }}>Yükleniyor...</div>;
    }

    return (
        <div style={{ padding: '0 2rem 2rem 2rem' }}>
            <div className="glass-panel" style={{ marginBottom: '2rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
                    <div style={{ background: 'var(--accent)', padding: '0.4rem', borderRadius: 'var(--radius-sm)', color: 'white' }}>
                        <Layers size={20} />
                    </div>
                    <div>
                        <h2 style={{ fontSize: '1.25rem', fontWeight: '600' }}>Toplu Tahakkuk Fişi (2. Adım)</h2>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                            Seçilen ayda giderleşmesi (180'den 770'e) gereken <strong>tüm</strong> araç poliçelerinin toplu fişi.
                        </p>
                    </div>

                    <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <select
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                            style={{ padding: '0.5rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--background)' }}
                        >
                            {mOpts.map((mName, i) => (
                                <option key={i} value={i}>{mName}</option>
                            ))}
                        </select>
                        <select
                            value={selectedYear}
                            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                            style={{ padding: '0.5rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--background)' }}
                        >
                            {yOpts.map(y => (
                                <option key={y} value={y}>{y}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {aggregatedData.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '3rem', background: 'rgba(0,0,0,0.02)', borderRadius: 'var(--radius-sm)' }}>
                        <FileStack size={48} style={{ margin: '0 auto 1rem auto', color: 'var(--text-muted)' }} />
                        <h3 style={{ fontSize: '1.1rem', color: 'var(--text-main)', marginBottom: '0.5rem' }}>Tahakkuk Bulunamadı</h3>
                        <p style={{ color: 'var(--text-muted)' }}>{selectedMonthName} dönemi için sistemdeki poliçelerden 180 hesabından devri gerçekleşen hiçbir kayıt bulunamadı.</p>
                    </div>
                ) : (
                    <>
                        {/* Unified Toplu Fiş Tablosu */}
                        <div style={{ marginBottom: '2.5rem' }}>
                            <h3 style={{ fontSize: '1rem', color: 'var(--primary)', marginBottom: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>Mali Müşavir Toplu Fiş İcmali</h3>
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                                    <thead style={{ background: 'var(--background)' }}>
                                        <tr style={{ borderBottom: '2px solid var(--border)', color: 'var(--text-muted)' }}>
                                            <th style={{ padding: '0.75rem' }}>Dönem / İşlem</th>
                                            <th style={{ padding: '0.75rem' }}>Hesap</th>
                                            <th style={{ padding: '0.75rem', textAlign: 'right' }}>Borç</th>
                                            <th style={{ padding: '0.75rem', textAlign: 'right' }}>Alacak</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {aggregatedData.map((row, i) => (
                                            <tr key={i} style={{ borderBottom: '1px solid var(--border)', background: 'rgba(79, 70, 229, 0.05)' }}>
                                                <td style={{ padding: '1rem 0.75rem' }}>
                                                    <div style={{ fontWeight: '600', color: 'var(--text-main)' }}>{row.type}</div>
                                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{row.date}</div>
                                                </td>
                                                <td style={{ padding: '1rem 0.75rem', color: 'var(--text-main)', fontWeight: '500' }}>{row.account}</td>
                                                <td style={{ padding: '1rem 0.75rem', textAlign: 'right', fontWeight: '500', color: 'var(--secondary)' }}>
                                                    {row.debit !== null ? formatCurrency(row.debit) : '-'}
                                                </td>
                                                <td style={{ padding: '1rem 0.75rem', textAlign: 'right', fontWeight: '500', color: 'var(--danger)' }}>
                                                    {row.credit !== null ? formatCurrency(row.credit) : '-'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot>
                                        <tr style={{ fontWeight: 'bold', background: 'var(--background)' }}>
                                            <td colSpan="2" style={{ padding: '1rem 0.75rem', textAlign: 'right' }}>TOPLAM:</td>
                                            <td style={{ padding: '1rem 0.75rem', textAlign: 'right', color: 'var(--text-main)' }}>
                                                {formatCurrency(aggregatedData.reduce((acc, curr) => acc + (curr.debit || 0), 0))}
                                            </td>
                                            <td style={{ padding: '1rem 0.75rem', textAlign: 'right', color: 'var(--text-main)' }}>
                                                {formatCurrency(aggregatedData.reduce((acc, curr) => acc + (curr.credit || 0), 0))}
                                            </td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </div>

                        {/* Detay Dökümü (Kırılım) */}
                        <div>
                            <h3 style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>Bu Döneme Ait Araç Bazlı Detay Dökümü</h3>
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                                    <thead style={{ background: 'rgba(0,0,0,0.02)' }}>
                                        <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                                            <th style={{ padding: '0.5rem' }}>Plaka</th>
                                            <th style={{ padding: '0.5rem' }}>Poliçe No</th>
                                            <th style={{ padding: '0.5rem' }}>Araç Türü</th>
                                            <th style={{ padding: '0.5rem', textAlign: 'right' }}>Toplam Pay (180)</th>
                                            <th style={{ padding: '0.5rem', textAlign: 'right' }}>Gider (770)</th>
                                            <th style={{ padding: '0.5rem', textAlign: 'right' }}>KKEG (689)</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {detailedData.map((d, i) => (
                                            <tr key={i} style={{ borderBottom: '1px solid rgba(0,0,0,0.05)', opacity: d.isCancel ? 0.7 : 1 }}>
                                                <td style={{ padding: '0.75rem 0.5rem', fontWeight: '600' }}>
                                                    {d.plate}
                                                    {d.isCancel && <span style={{ marginLeft: '0.5rem', fontSize: '0.7rem', color: 'red', border: '1px solid red', padding: '0.1rem 0.3rem', borderRadius: '4px' }}>İPTAL</span>}
                                                </td>
                                                <td style={{ padding: '0.75rem 0.5rem', color: 'var(--text-muted)' }}>{d.policyNo}</td>
                                                <td style={{ padding: '0.75rem 0.5rem' }}>
                                                    <span style={{
                                                        background: d.type === 'Ticari' ? 'rgba(56, 189, 248, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                                                        color: d.type === 'Ticari' ? '#38bdf8' : '#f59e0b',
                                                        padding: '0.2rem 0.5rem',
                                                        borderRadius: '4px',
                                                        fontWeight: '500'
                                                    }}>{d.type}</span>
                                                </td>
                                                <td style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>{d.isCancel && '-'}{formatCurrency(d.totalShare)}</td>
                                                <td style={{ padding: '0.75rem 0.5rem', textAlign: 'right', color: 'var(--secondary)' }}>{d.isCancel && '-'}{formatCurrency(d.giderShare)}</td>
                                                <td style={{ padding: '0.75rem 0.5rem', textAlign: 'right', color: 'var(--accent)' }}>{d.kkegShare > 0 ? (d.isCancel ? '-' : '') + formatCurrency(d.kkegShare) : '-'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
