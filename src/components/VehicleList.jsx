import { useState, useEffect } from 'react';
import { CarFront, Trash2, Receipt, Plus } from 'lucide-react';
import PolicyList from './PolicyList';
import { API_BASE_URL } from '../utils/apiConfig';

export default function VehicleList() {
    const [vehicles, setVehicles] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    // Show Policies State
    const [selectedVehicleId, setSelectedVehicleId] = useState(null);

    // Add New State
    const [isAddingNew, setIsAddingNew] = useState(false);
    const [newForm, setNewForm] = useState({ plateInfo: '', brand: '', model: '', chassisNo: '', vehicleType: 'Binek' });

    const fetchVehicles = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/api/vehicles`);
            if (response.ok) {
                const result = await response.json();
                setVehicles(result.data);
            }
        } catch (error) {
            console.error("Araçlar yüklenemedi:", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchVehicles();
        const handleVehicleSaved = () => fetchVehicles();
        window.addEventListener('policySaved', handleVehicleSaved);

        return () => window.removeEventListener('policySaved', handleVehicleSaved);
    }, []);

    const handleDelete = async (id) => {
        if (!window.confirm("DİKKAT! Bu aracı sildiğinizde, bu araca (plakaya) ait olan TÜM POLİÇELER DE kalıcı olarak SİLİNECEKTİR. Emin misiniz?")) return;

        try {
            const response = await fetch(`${API_BASE_URL}/api/vehicles/${id}`, { method: 'DELETE' });
            if (response.ok) {
                setVehicles(vehicles.filter(v => v.id !== id));
                // Dispatch event so policies list updates if the user switches tab
                window.dispatchEvent(new Event('policySaved'));
            } else {
                alert("Silme başarısız oldu.");
            }
        } catch (error) {
            console.error("Silme işlemi başarısız:", error);
        }
    };

    const handleShowPolicies = (vehicleId) => {
        // Toggle if same vehicle is clicked
        if (selectedVehicleId === vehicleId) {
            setSelectedVehicleId(null);
        } else {
            setSelectedVehicleId(vehicleId);
        }
    };

    const handleAddNew = async () => {
        if (!newForm.plateInfo.trim()) {
            alert("Lütfen araç plakasını giriniz.");
            return;
        }

        try {
            const response = await fetch(`${API_BASE_URL}/api/vehicles`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newForm)
            });

            if (response.ok) {
                const result = await response.json();
                setVehicles([result.data, ...vehicles]);
                setIsAddingNew(false);
                setNewForm({ plateInfo: '', brand: '', model: '', chassisNo: '', vehicleType: 'Binek' });
            } else {
                const errData = await response.json();
                alert(errData.error || "Kayıt başarısız.");
            }
        } catch (error) {
            console.error(error);
        }
    };

    if (isLoading) {
        return <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Araç kütüğü yükleniyor...</div>;
    }

    const renderAddNewForm = () => (
        <div style={{ background: 'var(--background)', padding: '1rem', borderRadius: 'var(--radius-sm)', marginBottom: '1.5rem', border: '1px solid var(--border)' }}>
            <h4 style={{ marginBottom: '1rem', color: 'var(--text-main)' }}>Yeni Araç Ekle</h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                <input type="text" className="form-control" placeholder="Plaka (Zorunlu)" value={newForm.plateInfo} onChange={e => setNewForm({ ...newForm, plateInfo: e.target.value })} />
                <input type="text" className="form-control" placeholder="Marka" value={newForm.brand} onChange={e => setNewForm({ ...newForm, brand: e.target.value })} />
                <input type="text" className="form-control" placeholder="Model" value={newForm.model} onChange={e => setNewForm({ ...newForm, model: e.target.value })} />
                <input type="text" className="form-control" placeholder="Şasi No" value={newForm.chassisNo} onChange={e => setNewForm({ ...newForm, chassisNo: e.target.value })} />
                <select className="form-control" value={newForm.vehicleType} onChange={e => setNewForm({ ...newForm, vehicleType: e.target.value })}>
                    <option value="Binek">Binek</option>
                    <option value="Ticari">Ticari</option>
                </select>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                <button className="btn btn-secondary" onClick={() => setIsAddingNew(false)}>İptal</button>
                <button className="btn btn-primary" onClick={handleAddNew}>Kaydet</button>
            </div>
        </div>
    );

    return (
        <div className="glass-panel" style={{ marginTop: '0' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{ background: 'var(--accent)', padding: '0.5rem', borderRadius: 'var(--radius-sm)', color: 'white', backgroundColor: '#8B5CF6' }}>
                        <CarFront size={24} />
                    </div>
                    <div>
                        <h2 style={{ fontSize: '1.25rem', fontWeight: '600' }}>Ana Araç Kütüğü</h2>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Sisteme daha önce tanımlanmış bağımsız araçlar.</p>
                    </div>
                </div>
                {!isAddingNew && (
                    <button className="btn btn-secondary" onClick={() => setIsAddingNew(true)}>
                        <Plus size={18} /> Yeni Ekle
                    </button>
                )}
            </div>

            {isAddingNew && renderAddNewForm()}

            {vehicles.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
                    <CarFront size={48} style={{ color: 'var(--text-muted)', marginBottom: '1rem', opacity: 0.5, margin: '0 auto' }} />
                    <h3 style={{ color: 'var(--text-muted)' }}>Henüz kaydedilmiş bir araç bulunmuyor</h3>
                </div>
            ) : (

                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.95rem' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                                <th style={{ padding: '0.75rem 0.5rem', width: '60px' }}>ID</th>
                                <th style={{ padding: '0.75rem 0.5rem' }}>Plaka</th>
                                <th style={{ padding: '0.75rem 0.5rem' }}>Tür</th>
                                <th style={{ padding: '0.75rem 0.5rem' }}>Marka</th>
                                <th style={{ padding: '0.75rem 0.5rem' }}>Model</th>
                                <th style={{ padding: '0.75rem 0.5rem' }}>Şasi No</th>
                                <th style={{ padding: '0.75rem 0.5rem' }}>Sisteme Kayıt</th>
                                <th style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>İşlem</th>
                            </tr>
                        </thead>
                        <tbody>
                            {vehicles.map(vehicle => (
                                <tr key={vehicle.id} style={{ borderBottom: '1px solid rgba(0,0,0,0.05)', transition: 'background-color 0.2s', background: selectedVehicleId === vehicle.id ? 'rgba(79, 70, 229, 0.05)' : 'transparent' }}>
                                    <td style={{ padding: '1rem 0.5rem', color: 'var(--text-muted)' }}>#{vehicle.id}</td>
                                    <td style={{ padding: '1rem 0.5rem', fontWeight: '600', color: 'var(--primary)' }}>{vehicle.plateInfo}</td>
                                    <td style={{ padding: '1rem 0.5rem' }}>
                                        {vehicle.vehicleType === 'Ticari' ? <span style={{ color: 'var(--accent)', fontWeight: '500' }}>Ticari</span> : 'Binek'}
                                    </td>
                                    <td style={{ padding: '1rem 0.5rem' }}>{vehicle.brand || '-'}</td>
                                    <td style={{ padding: '1rem 0.5rem' }}>{vehicle.model || '-'}</td>
                                    <td style={{ padding: '1rem 0.5rem', fontFamily: 'monospace' }}>{vehicle.chassisNo || '-'}</td>
                                    <td style={{ padding: '1rem 0.5rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                        {new Date(vehicle.createdAt).toLocaleDateString('tr-TR')}
                                    </td>
                                    <td style={{ padding: '1rem 0.5rem', textAlign: 'right', display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                                        <button onClick={() => handleShowPolicies(vehicle.id)} style={{ background: 'none', border: 'none', color: selectedVehicleId === vehicle.id ? 'var(--accent)' : 'var(--primary)', cursor: 'pointer', padding: '0.25rem' }} title="Poliçeleri Görüntüle">
                                            <Receipt size={16} />
                                        </button>
                                        <button onClick={() => handleDelete(vehicle.id)} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: '0.25rem' }} title="Sil">
                                            <Trash2 size={16} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {selectedVehicleId && (
                <div style={{ marginTop: '2rem', padding: '1.5rem', background: 'var(--background)', borderRadius: 'var(--radius-md)', border: '1px solid var(--accent)', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                    <h3 style={{ marginBottom: '1rem', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {vehicles.find(v => v.id === selectedVehicleId)?.plateInfo} Plakalı Araca Ait Poliçeler
                    </h3>
                    <PolicyList filterPlate={vehicles.find(v => v.id === selectedVehicleId)?.plateInfo} embedded={true} />
                </div>
            )}
        </div>
    );
}
