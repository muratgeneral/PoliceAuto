import { Download, Copy, RefreshCw, Save } from 'lucide-react';
import { useState, useEffect } from 'react';

export default function ResultsForm({ data, rawText, onReset }) {
    if (!data) return null;

    const [showRaw, setShowRaw] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);

    // Manage local form state so user edits can be saved
    const [formData, setFormData] = useState({ ...data, isCancelled: data.isCancelled || false });
    const [isVehicleRegistered, setIsVehicleRegistered] = useState(false);

    useEffect(() => {
        const checkVehicle = async () => {
            if (!formData.plateInfo || formData.plateInfo === 'Bulunamadı') return;
            try {
                const response = await fetch('/api/vehicles');
                if (response.ok) {
                    const result = await response.json();
                    const vehicles = result.data;
                    const existingVehicle = vehicles.find(v => String(v.plateInfo).trim() === String(formData.plateInfo).trim());
                    if (existingVehicle) {
                        setIsVehicleRegistered(true);
                        // Update form data with existing vehicle type
                        setFormData(prev => ({ ...prev, vehicleType: existingVehicle.vehicleType || 'Binek' }));
                    } else {
                        setIsVehicleRegistered(false);
                    }
                }
            } catch (error) {
                console.error("Araç kontrolü yapılamadı:", error);
            }
        };

        checkVehicle();
    }, [formData.plateInfo]);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSaveDatabase = async () => {
        setIsSaving(true);
        try {
            const { policyNumber, ekNo, policyType, startDate, endDate, plateInfo, brand, model, chassisNo, premiumAmount, vehicleType, isCancelled } = formData;

            const payload = {
                policyNumber,
                ekNo,
                policyType,
                isCancelled,
                startDate,
                endDate,
                plateInfo,
                brand,
                model,
                chassisNo,
                premiumAmount,
                vehicleType
            };

            const response = await fetch('/api/policies', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                setSaveSuccess(true);
                // Dispatch event to update the list
                window.dispatchEvent(new Event('policySaved'));
                setTimeout(() => setSaveSuccess(false), 3000);
            } else {
                const errorData = await response.json();
                alert(`Kaydetme başarısız: ${errorData.error || 'Bilinmeyen hata'}`);
            }
        } catch (error) {
            console.error("Error saving to database:", error);
            alert("Sunucuya bağlanılamadı.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleExportJSON = () => {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(formData, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", "police_bilgileri.json");
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    };

    return (
        <div className="glass-panel" style={{ marginTop: '2rem' }}>
            <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{ fontSize: '1.5rem', fontWeight: '600', color: 'var(--text-main)' }}>Ayrıştırılan Poliçe Bilgileri</h2>
                <span className="alert alert-info" style={{ padding: '0.5rem 1rem', marginBottom: 0 }}>Analiz Tamamlandı</span>
            </div>

            <div className="results-grid">
                <div className="form-group">
                    <label>Poliçe Numarası</label>
                    <input type="text" name="policyNumber" className="form-control" value={formData.policyNumber} onChange={handleInputChange} />
                </div>

                <div className="form-group">
                    <label>Ek (Zeyil) No</label>
                    <input type="text" name="ekNo" className="form-control" value={formData.ekNo || '0'} onChange={handleInputChange} />
                </div>

                <div className="form-group">
                    <label>Sigorta Türü</label>
                    <input type="text" name="policyType" className="form-control" value={formData.policyType || 'Diğer'} onChange={handleInputChange} />
                </div>

                {!isVehicleRegistered && (
                    <div className="form-group">
                        <label>Araç Türü</label>
                        <select name="vehicleType" className="form-control" value={formData.vehicleType || 'Binek'} onChange={handleInputChange}>
                            <option value="Binek">Binek</option>
                            <option value="Ticari">Ticari</option>
                        </select>
                    </div>
                )}

                <div className="form-group">
                    <label>Poliçe Durumu</label>
                    <select 
                        name="isCancelled" 
                        className="form-control" 
                        value={formData.isCancelled ? 'true' : 'false'} 
                        onChange={(e) => {
                            const isCancelled = e.target.value === 'true';
                            setFormData(prev => {
                                let newType = prev.policyType || '';
                                if (isCancelled && !newType.includes('(İptal)')) {
                                    newType += ' (İptal)';
                                } else if (!isCancelled && newType.includes('(İptal)')) {
                                    newType = newType.replace(' (İptal)', '').replace('(İptal)', '').trim();
                                }
                                return { ...prev, isCancelled, policyType: newType };
                            });
                        }}
                    >
                        <option value="false">Normal Poliçe</option>
                        <option value="true">İptal Poliçesi</option>
                    </select>
                </div>

                {isVehicleRegistered && (
                    <div className="form-group">
                        <label>Araç Türü (Sistemden)</label>
                        <input type="text" className="form-control" value={formData.vehicleType || 'Binek'} disabled style={{ backgroundColor: 'var(--background)' }} />
                    </div>
                )}

                <div className="form-group">
                    <label>Başlangıç Tarihi</label>
                    <input type="text" name="startDate" className="form-control" value={formData.startDate} onChange={handleInputChange} />
                </div>

                <div className="form-group">
                    <label>Bitiş Tarihi</label>
                    <input type="text" name="endDate" className="form-control" value={formData.endDate} onChange={handleInputChange} />
                </div>

                <div className="form-group">
                    <label>Marka</label>
                    <input type="text" name="brand" className="form-control" value={formData.brand} onChange={handleInputChange} />
                </div>

                <div className="form-group">
                    <label>Model</label>
                    <input type="text" name="model" className="form-control" value={formData.model} onChange={handleInputChange} />
                </div>

                <div className="form-group">
                    <label>Şasi No</label>
                    <input type="text" name="chassisNo" className="form-control" value={formData.chassisNo} onChange={handleInputChange} />
                </div>

                <div className="form-group">
                    <label>Plaka (Kasko/Trafik için)</label>
                    <input type="text" name="plateInfo" className="form-control" value={formData.plateInfo} onChange={handleInputChange} />
                </div>

                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label>Prim Tutarı / Toplam Tutar</label>
                    <input type="text" name="premiumAmount" className="form-control" value={formData.premiumAmount} onChange={handleInputChange} />
                </div>
            </div>

            {showRaw && (
                <div style={{ marginTop: '2rem', padding: '1rem', background: 'var(--background)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', maxHeight: '300px', overflowY: 'auto' }}>
                    <h4 style={{ marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>Okunan Ham Metin (Hata Ayıklama İçin):</h4>
                    <pre style={{ fontSize: '0.8rem', whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: 'var(--text-main)' }}>{rawText}</pre>
                </div>
            )}

            <div className="results-actions">
                <button className="btn btn-secondary" onClick={() => setShowRaw(!showRaw)} style={{ marginRight: 'auto' }}>
                    {showRaw ? "Ham Metni Gizle" : "Ham Metni Göster"}
                </button>
                <button className="btn btn-secondary" onClick={onReset}>
                    <RefreshCw size={18} /> Yeni Poliçe Yükle
                </button>
                <button className="btn btn-secondary" onClick={handleExportJSON}>
                    <Download size={18} /> JSON Olarak İndir
                </button>
                <button className="btn btn-primary" onClick={handleSaveDatabase} disabled={isSaving || saveSuccess} style={{ backgroundColor: saveSuccess ? 'var(--secondary)' : 'var(--primary)' }}>
                    <Save size={18} /> {saveSuccess ? "Kaydedildi!" : (isSaving ? "Kaydediliyor..." : "Veritabanına Kaydet")}
                </button>
            </div>
        </div>
    );
}
