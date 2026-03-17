import { useState, useEffect } from 'react';
import { Database, Trash2, Receipt, Calculator } from 'lucide-react';
import AccountingModal from './AccountingModal';
import ReceiptModal from './ReceiptModal';
import { API_BASE_URL } from '../utils/apiConfig';

export default function PolicyList({ filterPlate, embedded }) {
    const [policies, setPolicies] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [accountingPolicy, setAccountingPolicy] = useState(null);
    const [receiptPolicy, setReceiptPolicy] = useState(null);

    const fetchPolicies = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/api/policies`);
            if (response.ok) {
                const result = await response.json();
                setPolicies(result.data);
            }
        } catch (error) {
            console.error("Geçmiş poliçeler yüklenemedi:", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchPolicies();

        // Listen for custom event to refresh list when a new policy is saved
        const handlePolicySaved = () => fetchPolicies();
        window.addEventListener('policySaved', handlePolicySaved);

        return () => window.removeEventListener('policySaved', handlePolicySaved);
    }, []);

    const handleDelete = async (id) => {
        if (!window.confirm("Bu poliçeyi silmek istediğinize emin misiniz?")) return;

        try {
            const response = await fetch(`${API_BASE_URL}/api/policies/${id}`, { method: 'DELETE' });
            if (response.ok) {
                setPolicies(policies.filter(p => p.id !== id));
            }
        } catch (error) {
            console.error("Silme işlemi başarısız:", error);
        }
    };

    const handleReceiptUpload = (policyId) => {
        const policy = policies.find(p => p.id === policyId);
        if (policy) {
            let rootAccountingRecords = null;
            if (policy.isCancelled) {
                const rootPolicy = policies.find(r => 
                    !r.isCancelled && 
                    r.plateInfo === policy.plateInfo && 
                    r.policyNumber === policy.policyNumber
                );
                if (rootPolicy && rootPolicy.accountingRecords) {
                    rootAccountingRecords = rootPolicy.accountingRecords;
                }
            }
            setReceiptPolicy({ ...policy, rootAccountingRecords });
        }
    };

    const handleAccountingUpload = (policyId) => {
        const policy = policies.find(p => p.id === policyId);
        if (policy) {
            let rootAccountingRecords = null;
            if (policy.isCancelled) {
                const rootPolicy = policies.find(r => 
                    !r.isCancelled && 
                    r.plateInfo === policy.plateInfo && 
                    r.policyNumber === policy.policyNumber
                );
                if (rootPolicy && rootPolicy.accountingRecords) {
                    rootAccountingRecords = rootPolicy.accountingRecords;
                }
            }
            setAccountingPolicy({ ...policy, rootAccountingRecords });
        }
    };

    if (isLoading) {
        return <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Yükleniyor...</div>;
    }

    if (policies.length === 0) {
        if (embedded) {
            return <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-muted)' }}>Bu araca ait kayıtlı poliçe bulunamadı.</div>;
        }
        return null; // Don't show anything if there are no saved policies
    }

    const displayPolicies = filterPlate
        ? policies.filter(p => p.plateInfo === filterPlate)
        : policies;

    if (filterPlate && displayPolicies.length === 0) {
        return <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-muted)' }}>Bu araca ait kayıtlı poliçe bulunamadı.</div>;
    }

    const tableContent = (
        <div className="glass-panel" style={{ marginTop: '2rem' }}>
            <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                    <thead>
                        <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                            <th style={{ padding: '0.5rem', width: '90px' }}>İşlem</th>
                            <th style={{ padding: '0.5rem' }}>Poliçe No</th>
                            <th style={{ padding: '0.5rem' }}>Tür</th>
                            <th style={{ padding: '0.5rem' }}>Başlangıç</th>
                            <th style={{ padding: '0.5rem' }}>Bitiş</th>
                            {!embedded && <th style={{ padding: '0.5rem' }}>Plaka</th>}
                            <th style={{ padding: '0.5rem' }}>Prim Tutarı</th>
                            <th style={{ padding: '0.5rem' }}>Marka</th>
                            <th style={{ padding: '0.5rem' }}>Model</th>
                            <th style={{ padding: '0.5rem' }}>Şasi No</th>
                        </tr>
                    </thead>
                    <tbody>
                        {displayPolicies.map(policy => (
                            <tr key={policy.id} style={{ borderBottom: '1px solid rgba(0,0,0,0.05)', transition: 'background-color 0.2s', whiteSpace: 'nowrap' }}>
                                <td style={{ padding: '0.5rem', display: 'flex', gap: '0.25rem' }}>
                                    <button
                                        onClick={() => handleReceiptUpload(policy.id)}
                                        style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', padding: '0.25rem' }}
                                        title="Dekont İşlemleri"
                                    >
                                        <Receipt size={16} />
                                    </button>
                                    <button
                                        onClick={() => handleAccountingUpload(policy.id)}
                                        style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', padding: '0.25rem' }}
                                        title="Muhasebeleştirme (Netsis) 1. Adım"
                                    >
                                        <Calculator size={16} />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(policy.id)}
                                        style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: '0.25rem' }}
                                        title="Sil"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </td>
                                <td style={{ padding: '0.5rem', fontWeight: '500' }}>
                                    {policy.policyNumber}
                                    {(policy.ekNo && policy.ekNo !== '0') && (
                                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginLeft: '0.5rem' }}>
                                            (Ek: {policy.ekNo})
                                        </span>
                                    )}
                                </td>
                                <td style={{ padding: '0.5rem' }}>
                                    {policy.policyType ? (
                                        <span style={{
                                            background: policy.policyType.includes('Kasko') ? 'rgba(56, 189, 248, 0.1)' : policy.policyType.includes('Trafik') ? 'rgba(16, 185, 129, 0.1)' : 'rgba(148, 163, 184, 0.1)',
                                            color: policy.policyType.includes('Kasko') ? '#38bdf8' : policy.policyType.includes('Trafik') ? '#10b981' : '#94a3b8',
                                            padding: '0.25rem 0.5rem',
                                            borderRadius: 'var(--radius-sm)',
                                            fontSize: '0.75rem',
                                            fontWeight: '600'
                                        }}>
                                            {policy.policyType.toUpperCase()}
                                        </span>
                                    ) : '-'}
                                </td>
                                <td style={{ padding: '0.5rem', color: 'var(--text-muted)' }}>{policy.startDate}</td>
                                <td style={{ padding: '0.5rem', color: 'var(--text-muted)' }}>{policy.endDate}</td>
                                {!embedded && <td style={{ padding: '0.5rem', fontWeight: '600', color: 'var(--primary)' }}>{policy.plateInfo}</td>}
                                <td style={{ padding: '0.5rem', fontWeight: '500', color: 'var(--secondary)' }}>{policy.premiumAmount}</td>
                                <td style={{ padding: '0.5rem' }}>{policy.brand || '-'}</td>
                                <td style={{ padding: '0.5rem' }}>{policy.model || '-'}</td>
                                <td style={{ padding: '0.5rem' }}>{policy.chassisNo || '-'}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {accountingPolicy && (
                <AccountingModal
                    policy={accountingPolicy}
                    onClose={() => {
                        setAccountingPolicy(null);
                        fetchPolicies(); // Refresh to catch potential new saves
                    }}
                />
            )}

            {receiptPolicy && (
                <ReceiptModal
                    policy={receiptPolicy}
                    onClose={() => setReceiptPolicy(null)}
                />
            )}
        </div>
    );

    if (embedded) {
        return tableContent;
    }

    return (
        <div className="glass-panel" style={{ marginTop: '2rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
                <div style={{ background: 'var(--secondary)', padding: '0.4rem', borderRadius: 'var(--radius-sm)', color: 'white' }}>
                    <Database size={20} />
                </div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: '600' }}>Geçmiş Poliçeler</h2>
            </div>
            {tableContent}
        </div>
    );
}
