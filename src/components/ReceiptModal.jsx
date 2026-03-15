import { useState, useEffect } from 'react';
import { X, Calendar } from 'lucide-react';

export default function ReceiptModal({ policy, onClose }) {
    const [receiptData, setReceiptData] = useState([]);

    // Varsayılan olarak bugünün ayı ve yılı seçili gelir
    const today = new Date();
    const [selectedMonth, setSelectedMonth] = useState(today.getMonth()); // 0-11
    const [selectedYear, setSelectedYear] = useState(today.getFullYear());
    const [availableMonths, setAvailableMonths] = useState([]);

    useEffect(() => {
        if (!policy) return;

        try {
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

            if (isNaN(premiumNum)) premiumNum = 0;

            const records = [];
            const isBinek = policy.vehicleType !== 'Ticari';

            // Proportional calculation for months
            // Proportional calculation for months
            let startDate = new Date(policy.startDate.split('/').reverse().join('-'));
            startDate.setHours(0, 0, 0, 0);

            let endDate = new Date(policy.endDate.split('/').reverse().join('-'));
            endDate.setHours(0, 0, 0, 0);

            const totalDays = 365;
            const dailyAmount = premiumNum / totalDays;

            const monthBreakdown = [];
            let firstMonthDone = false;

            let remainingPremium = premiumNum;
            const startYear = startDate.getFullYear();

            const isCancel = policy.isCancelled === true;

            if (isCancel && policy.rootAccountingRecords && policy.rootAccountingRecords.length > 0) {
                // If it's a canceled policy and we have root records, we should derive the month breakdown
                // directly from what was put into the 180 and 280 accounts.
                const rootRecords = policy.rootAccountingRecords.filter(r => r.isSub && (r.account.includes('180') || r.account.includes('280')));
                
                // We'll process them backwards (from end date). Our previous logic handled reversed sorting, but here we just need to build a breakdown array.
                rootRecords.sort((a, b) => { // Sort descending by date roughly
                    const [m1, y1] = a.date.split(' ');
                    const [m2, y2] = b.date.split(' ');
                    if (y1 !== y2) return parseInt(y2) - parseInt(y1);
                    return m2.localeCompare(m1); // Note: Turkish month sorting string comparison isn't perfect, but we assume it's roughly sorted by generation order.
                });

                // Simplified approach: Re-build monthBreakdown from root records exactly as they were laid out natively
                // But in reverse chronological direction for the refund loop until premium is depleted.
                
                let remain = premiumNum;
                // Since original root records might just say "Ağustos 2026", we do our best to map it.
                // A better approach is to just use the dates we already calculate, but cap the `monthlyAmount` 
                // exactly at what the root record had for that month.
                
                let currentDate = new Date(endDate);
                while (remain > 0 && currentDate.getTime() >= startDate.getTime()) {
                    const year = currentDate.getFullYear();
                    const month = currentDate.getMonth();

                    const monthNameRaw = new Date(year, month, 1).toLocaleDateString('tr-TR', { month: 'long' });
                    const dateStr = new Date(year, month, 1).toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });
                    
                    // Look for a root record that matches this month/year for 180 or 280
                    const rootMatch = rootRecords.find(r => r.date === dateStr || r.account.includes(monthNameRaw));
                    
                    let monthlyAmount = 0;
                    if (rootMatch) {
                        monthlyAmount = rootMatch.debitAmount || rootMatch.creditAmount || 0;
                    } else {
                        // Fallback if root record not found for this specific month for some reason
                        const daysInMonth = new Date(year, month + 1, 0).getDate();
                        const isStartMonth = startDate.getFullYear() === year && startDate.getMonth() === month;
                        const isEndMonth = endDate.getFullYear() === year && endDate.getMonth() === month;
                        let days = daysInMonth;
                        if (isStartMonth && isEndMonth) days = endDate.getDate() - startDate.getDate();
                        else if (isStartMonth) days = daysInMonth - startDate.getDate();
                        else if (isEndMonth) days = endDate.getDate();
                        monthlyAmount = days * dailyAmount;
                    }

                    const isFirstMonthChronological = (year === startDate.getFullYear() && month === startDate.getMonth());
                    if (isFirstMonthChronological || monthlyAmount > remain) {
                        monthlyAmount = remain;
                    }

                    remain -= monthlyAmount;

                    if (!firstMonthDone) {
                        firstMonthDone = true;
                    } else if (monthlyAmount > 0) {
                        monthBreakdown.unshift({
                            date: dateStr,
                            monthNameRaw: monthNameRaw,
                            year: year,
                            monthIndex: month,
                            amount: monthlyAmount,
                            days: 30 // generic
                        });
                    }

                    currentDate = new Date(year, month, 0, 23, 59, 59, 999);
                }
            } else if (!isCancel) {
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
                                date: new Date(year, month, 1).toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' }),
                                monthNameRaw: new Date(year, month, 1).toLocaleDateString('tr-TR', { month: 'long' }),
                                year: year,
                                monthIndex: month,
                                amount: monthlyAmount,
                                days: daysInThisMonthForPolicy
                            });
                        }
                    }
                    currentDate = new Date(year, month + 1, 1, 0, 0, 0, 0);
                }
            } else {
                // CANCELED POLICY: Backward (LIFO) Loop (FALLBACK if no root records)
                let remainingPremium = premiumNum;
                let currentDate = new Date(endDate);

                while (remainingPremium > 0 && currentDate.getTime() >= startDate.getTime()) {
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

                        const isFirstMonthChronological = (year === startDate.getFullYear() && month === startDate.getMonth());
                        if (isFirstMonthChronological || monthlyAmount > remainingPremium) {
                            monthlyAmount = remainingPremium;
                        }

                        remainingPremium -= monthlyAmount;

                        if (!firstMonthDone) {
                            firstMonthDone = true;
                        } else {
                            monthBreakdown.unshift({
                                date: new Date(year, month, 1).toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' }),
                                monthNameRaw: new Date(year, month, 1).toLocaleDateString('tr-TR', { month: 'long' }),
                                year: year,
                                monthIndex: month,
                                amount: monthlyAmount,
                                days: daysInThisMonthForPolicy
                            });
                        }
                    }

                    // Jump to last day of previous month
                    currentDate = new Date(year, month, 0, 23, 59, 59, 999);
                }
            }

            // Giderleştirme (Tahakkuk) Kayıtlarını Oluştur
            if (monthBreakdown.length > 0) {
                // Sadece seçili olan ay/yıla ait tahakkuk fişini al
                const filteredBreakdown = monthBreakdown.filter(mb => mb.year === selectedYear && mb.monthIndex === selectedMonth);

                filteredBreakdown.forEach((mb) => {
                    const monthEndDate = new Date(mb.year, mb.monthIndex + 1, 0).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });

                    const isCancel = policy.isCancelled === true;

                    // Helper to swap
                    const createRecord = (type, date, account, defaultDebit, defaultCredit, isMain, isSub) => {
                        let debitAmount = defaultDebit;
                        let creditAmount = defaultCredit;

                        if (isCancel) {
                            debitAmount = defaultCredit;
                            creditAmount = defaultDebit;
                        }

                        records.push({
                            type: isCancel && !isMain ? `${type} (İPTAL)` : type,
                            date,
                            account,
                            debitAmount,
                            creditAmount,
                            isMain,
                            isSub
                        });
                    };

                    // Main Header
                    createRecord(
                        `Aylık Tahakkuk Fişi: ${mb.date}`,
                        monthEndDate,
                        'Belge/Dekont No: Sistem',
                        null,
                        null,
                        true,
                        false
                    );

                    // 180 (Alacak)
                    createRecord(
                        `Giderin Kapatılması`,
                        monthEndDate,
                        `180 Gelecek Aylara Ait Giderler - ${mb.monthNameRaw}`,
                        null,
                        mb.amount,
                        false,
                        true
                    );

                    // 770 / KKEG (Borç)
                    if (isBinek) {
                        const gider = mb.amount * 0.7;
                        const kkeg = mb.amount * 0.3;
                        createRecord(
                            `Gider Kaydı (%70)`,
                            monthEndDate,
                            `770 Genel Yönetim Giderleri`,
                            gider,
                            null,
                            false,
                            true
                        );
                        createRecord(
                            `KKEG (%30)`,
                            monthEndDate,
                            `689 Diğer Olağandışı Gider/Zararlar`,
                            kkeg,
                            null,
                            false,
                            true
                        );
                    } else {
                        createRecord(
                            `Gider Kaydı (%100)`,
                            monthEndDate,
                            `770 Genel Yönetim Giderleri`,
                            mb.amount,
                            null,
                            false,
                            true
                        );
                    }
                });
            }

            // Available months for dropdown
            const uniqueMonths = monthBreakdown.map(mb => ({
                label: mb.date,
                year: mb.year,
                monthIndex: mb.monthIndex
            }));
            setAvailableMonths(uniqueMonths);

            setReceiptData(records);

        } catch (error) {
            console.error("Error calculating receipts:", error);
        }

    }, [policy]);

    const formatCurrency = (val) => {
        return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(val);
    };

    if (!policy) return null;

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000,
            display: 'flex', justifyContent: 'center', alignItems: 'center'
        }}>
            <div className="glass-panel" style={{
                width: '90%', maxWidth: '900px', maxHeight: '90vh', overflowY: 'auto',
                padding: '2rem', position: 'relative'
            }}>
                <button
                    onClick={onClose}
                    style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                >
                    <X size={24} />
                </button>

                <h2 style={{ marginBottom: '0.5rem', color: 'var(--primary)', borderBottom: '1px solid var(--border)', paddingBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <Calendar size={24} /> Aylık Tahakkuk (Giderleştirme) Fişleri
                </h2>
                <div style={{ marginBottom: '1.5rem', display: 'flex', gap: '2rem', fontSize: '0.9rem', color: 'var(--text-muted)', alignItems: 'center' }}>
                    <div><strong>Poliçe No:</strong> {policy.policyNumber}</div>
                    <div><strong>Tür:</strong> {policy.vehicleType === 'Ticari' ? 'Ticari' : 'Binek'}</div>
                    <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontWeight: '500', color: 'var(--text-main)' }}>Tahakkuk Dönemi:</span>
                        <select
                            value={`${selectedYear}-${selectedMonth}`}
                            onChange={(e) => {
                                const [y, m] = e.target.value.split('-');
                                setSelectedYear(parseInt(y));
                                setSelectedMonth(parseInt(m));
                            }}
                            style={{
                                padding: '0.5rem',
                                borderRadius: 'var(--radius-sm)',
                                border: '1px solid var(--border)',
                                background: 'var(--background)',
                                color: 'var(--text-main)',
                                outline: 'none'
                            }}
                        >
                            {availableMonths.map((am, i) => (
                                <option key={i} value={`${am.year}-${am.monthIndex}`}>
                                    {am.label}
                                </option>
                            ))}
                            {/* In case the current month is not in the policy breakdown, optionally add it */}
                            {!availableMonths.some(am => am.year === today.getFullYear() && am.monthIndex === today.getMonth()) && (
                                <option value={`${today.getFullYear()}-${today.getMonth()}`}>
                                    {today.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' })} (Kayıt Yok)
                                </option>
                            )}
                        </select>
                    </div>
                </div>

                {receiptData.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                        Bu poliçe için aylık devredek herhangi bir tahakkuk fişi (180'den 770'e) bulunmuyor (Tüm tutar muhtemelen ilk ayda giderleşmiş).
                    </div>
                ) : (
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
                                {receiptData.map((record, index) => (
                                    <tr key={index} style={{
                                        borderBottom: '1px solid var(--border)',
                                        background: record.isMain ? 'rgba(16, 185, 129, 0.05)' : 'transparent',
                                        fontWeight: record.isMain ? '600' : 'normal'
                                    }}>
                                        <td style={{ padding: '1rem 0.75rem' }}>
                                            <div style={{ color: record.isMain ? 'var(--secondary)' : 'var(--text-main)' }}>{record.type}</div>
                                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{record.date}</div>
                                        </td>
                                        <td style={{ padding: '1rem 0.75rem', color: record.isMain ? 'var(--text-muted)' : 'var(--text-main)' }}>{record.account}</td>
                                        <td style={{ padding: '1rem 0.75rem', textAlign: 'right', fontWeight: '500', color: 'var(--secondary)' }}>
                                            {record.debitAmount !== null ? formatCurrency(record.debitAmount) : '-'}
                                        </td>
                                        <td style={{ padding: '1rem 0.75rem', textAlign: 'right', fontWeight: '500', color: 'var(--danger)' }}>
                                            {record.creditAmount !== null ? formatCurrency(record.creditAmount) : '-'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
