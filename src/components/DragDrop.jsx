import { useState, useRef } from 'react';
import { UploadCloud, FileText, CheckCircle } from 'lucide-react';

export default function DragDrop({ onFileLoad, isProcessing }) {
    const [isDragging, setIsDragging] = useState(false);
    const [selectedFile, setSelectedFile] = useState(null);
    const fileInputRef = useRef(null);

    const handleDragOver = (e) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setIsDragging(false);

        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            const file = e.dataTransfer.files[0];
            if (file.type === 'application/pdf') {
                setSelectedFile(file);
                onFileLoad(file);
            } else {
                alert("Lütfen sadece PDF dosyası yükleyin.");
            }
        }
    };

    const handleFileChange = (e) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            if (file.type === 'application/pdf') {
                setSelectedFile(file);
                onFileLoad(file);
            } else {
                alert("Lütfen sadece PDF dosyası yükleyin.");
            }
        }
    };

    return (
        <div
            className={`dropzone ${isDragging ? 'active' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
        >
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="application/pdf"
                style={{ display: 'none' }}
            />

            {isProcessing ? (
                <div className="loader-container">
                    <div className="spinner"></div>
                    <p>Belge analiz ediliyor, lütfen bekleyin...</p>
                </div>
            ) : selectedFile ? (
                <>
                    <CheckCircle className="dropzone-icon" style={{ color: 'var(--secondary)' }} />
                    <h3>{selectedFile.name} Yüklendi</h3>
                    <p>Farklı bir belge yüklemek için tıklayın veya sürükleyin</p>
                </>
            ) : (
                <>
                    <UploadCloud className="dropzone-icon" />
                    <h3>Poliçe PDF'ini Buraya Sürükleyin</h3>
                    <p>veya dosya seçmek için tıklayın</p>
                </>
            )}
        </div>
    );
}
