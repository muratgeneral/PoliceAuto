import { useState, useEffect } from 'react';
import { X, Copy, Download, Save, Check } from 'lucide-react';
import { API_BASE_URL } from '../utils/apiConfig';

export default function AccountingModal({ policy, onClose }) {
    const [accountingData, setAccountingData] = useState([]);
    const [isSaving, setIsSaving] = useState(false);
    const [isSaved, setIsSaved] = useState(false);

    useEffect(() => {
        if (!policy) return;

        // Reset saved state when policy changes
        setIsSaved(false);

        // If the policy already has saved accounting records, load them directly.
        if (policy.accountingRecords && policy.accountingRecords.length > 0) {
            setAccountingData(policy.accountingRecords);
            setIsSaved(true);
            return;
        }

        // --- CANCELLATION FROM ROOT POLICY LOGIC ---
        const isCancel = policy.isCancelled === true;

        if (isCancel && policy.rootAccountingRecords && policy.rootAccountingRecords.length > 0) {
            // We have a saved 1st step from the original policy!
            // We need to reverse its records but process them backwards for 180s.
            const records = [];
            
            // Re-use createRecord helper here for simplicity
            const createRecord = (type, date, account, defaultDebit, defaultCredit, isMain, isSub) => {
                records.push({
                    type: !isMain ? `${type} (İPTAL)` : type,
                    date,
                    account,
                    debitAmount: defaultCredit,  // Flipped
                    creditAmount: defaultDebit,  // Flipped
                    isMain,
                    isSub
                });
            };

            const rootRecords = [...policy.rootAccountingRecords];

            // 1. Find the Main Header
            const mainHeader = rootRecords.find(r => r.isMain && r.type.includes('Poliçe Tahakkuk Fişi'));
            const headerDate = new Date(policy.startDate.split('/').reverse().join('-')).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });

            if (mainHeader) {
                // Ensure Header is always first.
                records.push({
                    type: `Poliçe Tahakkuk Fişi: ${policy.policyNumber}`,
                    date: headerDate,
                    account: mainHeader.account,
                    debitAmount: null,
                    creditAmount: null,
                    isMain: true,
                    isSub: false
                });
            } else {
                records.push({
                    type: `Poliçe Tahakkuk Fişi: ${policy.policyNumber}`,
                    date: headerDate,
                    account: 'Belge/Dekont No: Sistem',
                    debitAmount: null,
                    creditAmount: null,
                    isMain: true,
                    isSub: false
                });
            }

            let premiumNum = 0;
            if (policy.premiumAmount && policy.premiumAmount !== 'Bulunamadı') {
                let cleanedStr = policy.premiumAmount.replace(/[^\d.,]/g, '');
                const lastComma = cleanedStr.lastIndexOf(',');
                const lastDot = cleanedStr.lastIndexOf('.');
                if (lastDot > lastComma && lastDot !== -1) cleanedStr = cleanedStr.replace(/,/g, '');
                else if (lastComma > lastDot && lastComma !== -1) cleanedStr = cleanedStr.replace(/\./g, '').replace(',', '.');
                premiumNum = parseFloat(cleanedStr) || 0;
            }

            let remain = premiumNum;

            // Sort sub records (180, 280, 770, KKEG) chronologically descending (newest month first) to deplete from endDate
            const subRecords = rootRecords.filter(r => r.isSub && !r.isMain);
            // Reverse order to go from EndDate backwards
            subRecords.reverse();

            // Distribute remain
            let index280Info = subRecords.filter(r => r.account.includes('280')).length; // How many 280s we have going backwards

            // Array to hold the sub records we process so we can push them in exact order
            const processedSubRecords = [];

            for (const rec of subRecords) {
                if (remain <= 0) break;
                
                let amt = rec.debitAmount || rec.creditAmount || 0;
                if (amt === 0) continue;

                let applyAmt = Math.min(amt, remain);
                remain -= applyAmt;

                let accName = rec.account;
                // If it's a 280 and missing the 280-001 format from previous saves, patch it visually
                if (accName.includes('280') && !accName.match(/280-\d{3}/)) {
                    const prefixId = String(index280Info).padStart(3, '0');
                    accName = accName.replace('280', `280-${prefixId}`);
                    index280Info--;
                } else if (accName.includes('280')) {
                     index280Info--;
                }

                // Create the reversed record - Put amount in CREDIT side (Alacak) for 180/280
                // We PUSH this into a temp array. Since subRecords is reversed (EndDate to StartDate), 
                // pushing here naturally puts EndDate first, then the month before it, etc.
                processedSubRecords.push({
                    type: `${rec.type} (İPTAL)`,
                    date: rec.date,
                    account: accName,
                    debitAmount: null, 
                    creditAmount: applyAmt, 
                    isMain: false,
                    isSub: true
                });
            }

            // Now append all processed sub records to the main records array
            records.push(...processedSubRecords);

            // Reverse 320 Cari (with exact cancellation amount) placed at the VERY END
            const cariRecord = rootRecords.find(r => r.account.includes('320'));
            if (cariRecord) {
                // Determine the original 320 account name
                const accountName = cariRecord.account || '320 Sigorta Şirketi';
                
                // Put total cancellation amount in DEBIT side (Borç) for 320
                records.push({
                    type: 'Cari Hesap (İPTAL)',
                    date: headerDate,
                    account: accountName,
                    debitAmount: premiumNum, 
                    creditAmount: null, 
                    isMain: false,
                    isSub: false
                }); 
            }

            setAccountingData(records);
            return;
        }

        // --- FALLBACK LOGIC ---
        // Otherwise, Calculate the accounting breakdown based on the Netsis pdf rules
        // Total Premium -> 180 (Debit), 320 (Credit)
        // Installments -> 770 (Debit), 180 (Credit) per month

        try {
            let premiumNum = 0;
            if (policy.premiumAmount && policy.premiumAmount !== 'Bulunamadı') {
                let cleanedStr = policy.premiumAmount.replace(/[^\d.,]/g, '');
                const lastComma = cleanedStr.lastIndexOf(',');
                const lastDot = cleanedStr.lastIndexOf('.');

                if (lastDot > lastComma && lastDot !== -1) {
                    // US format: 100,000.00
                    cleanedStr = cleanedStr.replace(/,/g, '');
                } else if (lastComma > lastDot && lastComma !== -1) {
                    // TR format: 100.000,00
                    cleanedStr = cleanedStr.replace(/\./g, '').replace(',', '.');
                }

                premiumNum = parseFloat(cleanedStr);
            }

            if (isNaN(premiumNum)) premiumNum = 0;

            const records = [];



            // 2. Day-based Proportional Accrual Records
            let startDate = new Date(policy.startDate.split('/').reverse().join('-'));
            // Start of day
            startDate.setHours(0, 0, 0, 0);

            let endDate = new Date(policy.endDate.split('/').reverse().join('-'));
            // End of day
            endDate.setHours(0, 0, 0, 0);

            // Total days standard calculation
            const totalDays = 365;

            // Daily rate
            const dailyAmount = premiumNum / totalDays;

            // Generate monthly breakdown dynamically
            const monthBreakdown = [];
            const nextYearMonthBreakdown = [];
            let initialExpense = { days: 0, amount: 0, monthNameRaw: '' };
            let firstMonthDone = false;

            let remainingPremium = premiumNum;
            const startYear = startDate.getFullYear();

            // isCancel is already defined above

            if (!isCancel) {
                // NORMAL POLICY: Forward Loop
                let currentDate = new Date(startDate);

                while (currentDate.getTime() <= endDate.getTime()) {
                    const year = currentDate.getFullYear();
                    const month = currentDate.getMonth();

                    // Days in this specific month
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
                            // The very first overlapping month is expensed immediately to 770
                            initialExpense = {
                                days: daysInThisMonthForPolicy,
                                amount: monthlyAmount,
                                monthNameRaw: new Date(year, month, 1).toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' })
                            };
                            firstMonthDone = true;
                        } else if (year > startYear) {
                            // Gather into 280 (Next Year) monthly
                            nextYearMonthBreakdown.push({
                                date: new Date(year, month, 1).toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' }),
                                monthNameRaw: new Date(year, month, 1).toLocaleDateString('tr-TR', { month: 'long' }),
                                amount: monthlyAmount,
                                days: daysInThisMonthForPolicy
                            });
                        } else {
                            // Add to current year 180 breakdown
                            monthBreakdown.push({
                                date: new Date(year, month, 1).toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' }),
                                monthNameRaw: new Date(year, month, 1).toLocaleDateString('tr-TR', { month: 'long' }),
                                amount: monthlyAmount,
                                days: daysInThisMonthForPolicy
                            });
                        }
                    }

                    // Jump cleanly to 1st day of next month
                    currentDate = new Date(year, month + 1, 1, 0, 0, 0, 0);
                }
            } else {
                // CANCELED POLICY: Backward (LIFO) Loop
                let currentDate = new Date(endDate);
                
                // Go backwards until premium is depleted or we pass the start date
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

                        // Because we are going backwards, if this is the start month (or remaining amounts are small enough), we use the remaining premium
                        const isFirstMonthChronological = (year === startDate.getFullYear() && month === startDate.getMonth());
                        if (isFirstMonthChronological || monthlyAmount > remainingPremium) {
                            monthlyAmount = remainingPremium;
                        }

                        remainingPremium -= monthlyAmount;

                        if (!firstMonthDone) {
                            // Canceled policy still treats "first record" differently? 
                            // Since we want to just close the accounts backwards, we assign the end date's month to the immediate expense/discount
                            initialExpense = {
                                days: daysInThisMonthForPolicy,
                                amount: monthlyAmount,
                                monthNameRaw: new Date(year, month, 1).toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' })
                            };
                            firstMonthDone = true;
                        } else if (year > startYear) {
                            // Put this record at the end of the array to visually show the backward calculation chronologically
                            nextYearMonthBreakdown.push({
                                date: new Date(year, month, 1).toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' }),
                                monthNameRaw: new Date(year, month, 1).toLocaleDateString('tr-TR', { month: 'long' }),
                                amount: monthlyAmount,
                                days: daysInThisMonthForPolicy
                            });
                        } else {
                            monthBreakdown.push({
                                date: new Date(year, month, 1).toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' }),
                                monthNameRaw: new Date(year, month, 1).toLocaleDateString('tr-TR', { month: 'long' }),
                                amount: monthlyAmount,
                                days: daysInThisMonthForPolicy
                            });
                        }
                    }

                    // Jump to last day of previous month
                    currentDate = new Date(year, month, 0, 23, 59, 59, 999);
                }
            }

            // --- ADIM 1: Poliçe Kaydı (320 -> 180 aylık kırılımlar + 280) ---
            const isBinek = policy.vehicleType !== 'Ticari';
            // isCancel is already defined above

            // Helper to assign debit/credit based on cancellation
            const createRecord = (type, date, account, defaultDebit, defaultCredit, isMain, isSub) => {
                let debitAmount = defaultDebit;
                let creditAmount = defaultCredit;

                if (isCancel) {
                    // Force strictly reversed sides if cancel logic triggers this generic creation
                    // But our loops below now explicitly pass mapped amounts (null to credit, debit to null)
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

            const headerDate = new Date(policy.startDate.split('/').reverse().join('-')).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });

            if (!isCancel) {
                // 320 Sigorta Şirketi (Alacak) - Toplam Tutar
                createRecord(
                    '1. Adım: Poliçe Genel Kaydı',
                    policy.startDate,
                    '320 Sigorta Şirketi',
                    null,
                    premiumNum,
                    true,
                    false
                );
            } else {
                // Header (İptal)
                createRecord(
                    '1. Adım: Poliçe İptal Kaydı',
                    policy.startDate,
                    'Belge/Dekont No: Sistem',
                    null,
                    null,
                    true,
                    false
                );
            }

            if (!isCancel && initialExpense.days > 0) {
                if (isBinek) {
                    const gider = initialExpense.amount * 0.7;
                    const kkeg = initialExpense.amount * 0.3;
                    createRecord(
                        `770 Gider Kaydı (%70) - ${initialExpense.monthNameRaw} (${initialExpense.days} Gün)`,
                        initialExpense.monthNameRaw,
                        `770 Genel Yönetim Giderleri`,
                        gider,
                        null,
                        false,
                        true
                    );
                    createRecord(
                        `KKEG (%30) - ${initialExpense.monthNameRaw}`,
                        initialExpense.monthNameRaw,
                        `689 Diğer Olağandışı Gider ve Zararlar (KKEG)`,
                        kkeg,
                        null,
                        false,
                        true
                    );
                } else {
                    createRecord(
                        `770 / 760 Gider Kaydı - ${initialExpense.monthNameRaw} (${initialExpense.days} Gün)`,
                        initialExpense.monthNameRaw,
                        `770 Genel Yönetim Giderleri`,
                        initialExpense.amount,
                        null,
                        false,
                        true
                    );
                }
            } else if (isCancel && initialExpense.days > 0) {
                if (isBinek) {
                    const gider = initialExpense.amount * 0.7;
                    const kkeg = initialExpense.amount * 0.3;
                    createRecord(
                        `770 Gider Kaydı (%70) - ${initialExpense.monthNameRaw} (${initialExpense.days} Gün)`,
                        initialExpense.monthNameRaw,
                        `770 Genel Yönetim Giderleri`,
                        null,
                        gider,
                        false,
                        true
                    );
                    createRecord(
                        `KKEG (%30) - ${initialExpense.monthNameRaw}`,
                        initialExpense.monthNameRaw,
                        `689 Diğer Olağandışı Gider ve Zararlar (KKEG)`,
                        null,
                        kkeg,
                        false,
                        true
                    );
                } else {
                    createRecord(
                        `770 / 760 Gider Kaydı - ${initialExpense.monthNameRaw} (${initialExpense.days} Gün)`,
                        initialExpense.monthNameRaw,
                        `770 Genel Yönetim Giderleri`,
                        null,
                        initialExpense.amount,
                        false,
                        true
                    );
                }
            }

            if (isCancel) {
                // 280 Gelecek Yıllara Ait Giderler
                nextYearMonthBreakdown.forEach((mb, idx) => {
                    const prefixId = String(idx + 1).padStart(3, '0');
                    createRecord(
                        `280 Devri - ${mb.date} (${mb.days} Gün) (İPTAL)`,
                        mb.date,
                        `280-${prefixId} Gelecek Yıllara Ait Giderler - ${mb.monthNameRaw}`,
                        null, // Debit
                        mb.amount, // Credit
                        false,
                        true
                    );
                });

                // 180 Gelecek Aylara Ait Giderler
                monthBreakdown.forEach((mb) => {
                    createRecord(
                        `180 Devri - ${mb.date} (${mb.days} Gün) (İPTAL)`,
                        mb.date,
                        `180 Gelecek Aylara Ait Giderler - ${mb.monthNameRaw}`,
                        null, // Debit
                        mb.amount, // Credit
                        false,
                        true
                    );
                });
            } else {
                // NORMAL POLICY: 180 first, then 280 chronologically
                // 180 Gelecek Aylara Ait Giderler
                monthBreakdown.forEach((mb) => {
                    createRecord(
                        `180 Devri - ${mb.date} (${mb.days} Gün)`,
                        mb.date,
                        `180 Gelecek Aylara Ait Giderler - ${mb.monthNameRaw}`,
                        mb.amount, // Debit
                        null, // Credit
                        false,
                        true
                    );
                });

                // 280 Gelecek Yıllara Ait Giderler
                nextYearMonthBreakdown.forEach((mb, idx) => {
                    // No prefix Id for normal forward generation as they aren't reversed
                    createRecord(
                        `280 Devri - ${mb.date} (${mb.days} Gün)`,
                        mb.date,
                        `280 Gelecek Yıllara Ait Giderler - ${mb.monthNameRaw}`,
                        mb.amount, // Debit
                        null, // Credit
                        false,
                        true
                    );
                });
            }

            // If it's a cancellation, we put 320 at the very bottom on the DEBIT side (Borç)
            if (isCancel) {
                records.push({
                    type: 'Cari Hesap (İPTAL)',
                    date: policy.startDate,
                    account: '320 Sigorta Şirketi',
                    debitAmount: premiumNum, // DEBIT
                    creditAmount: null,
                    isMain: false,
                    isSub: false
                });
            }
            // Next year summary is kept since it's part of the initial record for policy.

            setAccountingData(records);

        } catch (error) {
            console.error("Error calculating accounting:", error);
        }

    }, [policy]);

    const handleSaveAccounting = async () => {
        if (!policy || !policy.id) return;
        setIsSaving(true);
        try {
            const response = await fetch(`${API_BASE_URL}/api/policies/${policy.id}/accounting`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ records: accountingData })
            });

            if (response.ok) {
                setIsSaved(true);
                // The parent component should ideally refetch policies so the state is globally updated. But we keep it simple here.
            } else {
                console.error("Failed to save accounting mapping");
            }
        } catch (err) {
            console.error(err);
        } finally {
            setIsSaving(false);
        }
    };

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

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '1rem' }}>
                    <h2 style={{ color: 'var(--primary)', margin: 0 }}>
                        Netsis Muhasebeleştirme Tablosu
                    </h2>
                    
                    {!isSaved ? (
                        <button 
                            onClick={handleSaveAccounting}
                            disabled={isSaving}
                            className="btn btn-primary"
                            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', fontSize: '0.9rem' }}
                        >
                            <Save size={16} />
                            {isSaving ? 'Kaydediliyor...' : 'Tabloyu Kaydet (1. Adım)'}
                        </button>
                    ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--success)', fontWeight: '500', fontSize: '0.9rem', padding: '0.5rem 1rem', backgroundColor: 'rgba(16, 185, 129, 0.1)', borderRadius: '8px' }}>
                            <Check size={16} />
                            Sisteme Kaydedildi
                        </div>
                    )}
                </div>
                <div style={{ marginBottom: '1.5rem', display: 'flex', gap: '2rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                    <div><strong>Poliçe No:</strong> {policy.policyNumber}</div>
                    <div><strong>Plaka:</strong> {policy.plateInfo}</div>
                    <div><strong>Tür:</strong> {policy.vehicleType === 'Ticari' ? 'Ticari' : 'Binek'}</div>
                    <div><strong>Toplam Tutar:</strong> <span style={{ color: 'var(--accent)', fontWeight: 'bold' }}>{policy.premiumAmount}</span></div>
                </div>

                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                        <thead style={{ background: 'var(--background)' }}>
                            <tr style={{ borderBottom: '2px solid var(--border)', color: 'var(--text-muted)' }}>
                                <th style={{ padding: '0.75rem' }}>İşlem / Dönem</th>
                                <th style={{ padding: '0.75rem' }}>Hesap</th>
                                <th style={{ padding: '0.75rem', textAlign: 'right' }}>Borç</th>
                                <th style={{ padding: '0.75rem', textAlign: 'right' }}>Alacak</th>
                            </tr>
                        </thead>
                        <tbody>
                            {accountingData.map((record, index) => (
                                <tr key={index} style={{
                                    borderBottom: '1px solid var(--border)',
                                    background: record.isMain ? 'rgba(79, 70, 229, 0.05)' : 'transparent',
                                    fontWeight: record.isMain ? '600' : 'normal'
                                }}>
                                    <td style={{ padding: '1rem 0.75rem' }}>
                                        <div>{record.type}</div>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{record.date}</div>
                                    </td>
                                    <td style={{ padding: '1rem 0.75rem', color: 'var(--text-main)' }}>{record.account}</td>
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
            </div>
        </div>
    );
}
