import { useState } from 'react';
import DragDrop from './components/DragDrop';
import ResultsForm from './components/ResultsForm';
import PolicyList from './components/PolicyList';
import VehicleList from './components/VehicleList';
import BulkReceipt from './components/BulkReceipt';
import { extractTextFromPDF } from './utils/pdfExtractor';
import { parseInsurancePolicy } from './utils/dataParser';
import { Bot, FileText, AlertTriangle, FileStack, CarFront, Calculator } from 'lucide-react';

function App() {
  const [activeTab, setActiveTab] = useState('policies'); // 'policies', 'vehicles' or 'accounting'
  const [isProcessing, setIsProcessing] = useState(false);
  const [extractedData, setExtractedData] = useState(null);
  const [rawText, setRawText] = useState('');
  const [errorDetails, setErrorDetails] = useState('');

  const handleFileLoad = async (file) => {
    setIsProcessing(true);
    setExtractedData(null);
    setRawText('');
    setErrorDetails('');

    try {
      // 1. PDF içerisindeki metinleri ayrıştır (Client-side)
      const extractedStr = await extractTextFromPDF(file);
      console.log("Extracted Text Length:", extractedStr.length);
      setRawText(extractedStr);

      // 2. Metni kategorik verilere dönüştür (Regex Fallback)
      const parsedData = parseInsurancePolicy(extractedStr);

      // Simulate slight network delay for premium feel
      setTimeout(() => {
        setExtractedData(parsedData);
        setIsProcessing(false);
      }, 1000);

    } catch (err) {
      console.error(err);
      setErrorDetails(err.message || "Bilinmeyen bir hata oluştu.");
      setIsProcessing(false);
    }
  };

  const resetProcess = () => {
    setExtractedData(null);
    setRawText('');
    setErrorDetails('');
  };

  return (
    <div className="app-container">
      <header className="header">
        <h1>Sigorta Poliçesi Analizcisi</h1>
        <p>Yapay Zeka Destekli Anında Veri Çıkarım Aracı</p>
      </header>

      <main>
        {errorDetails && (
          <div className="alert alert-error">
            <AlertTriangle size={20} />
            {errorDetails}
          </div>
        )}

        {/* Tab Navigation Menu */}
        <div className="tabs-container">
          <button
            className={`tab-btn ${activeTab === 'policies' ? 'active' : ''}`}
            onClick={() => setActiveTab('policies')}
          >
            <FileStack size={20} /> Poliçe İşlemleri
          </button>
          <button
            className={`tab-btn ${activeTab === 'vehicles' ? 'active' : ''}`}
            onClick={() => setActiveTab('vehicles')}
          >
            <CarFront size={20} /> Araç İşlemleri
          </button>
          <button
            className={`tab-btn ${activeTab === 'accounting' ? 'active' : ''}`}
            onClick={() => setActiveTab('accounting')}
          >
            <Calculator size={20} /> Muhasebe İşlemleri
          </button>
        </div>

        {activeTab === 'policies' && (
          <>
            {/* Upload Window */}
            <div className="glass-panel" style={{ display: extractedData ? 'none' : 'block' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2rem' }}>
                <div style={{ background: 'var(--primary)', padding: '0.5rem', borderRadius: 'var(--radius-sm)', color: 'white' }}>
                  <Bot size={24} />
                </div>
                <div>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: '600' }}>Akıllı Doküman İşleme</h2>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>PDF dosyanızı cihazınızda güvenle işler, sunucuya aktarmaz.</p>
                </div>
              </div>

              <DragDrop onFileLoad={handleFileLoad} isProcessing={isProcessing} />
            </div>

            {/* Results View */}
            {extractedData && (
              <ResultsForm data={extractedData} rawText={rawText} onReset={resetProcess} />
            )}

            {/* Saved Policies List View */}
            <PolicyList />
          </>
        )}

        {activeTab === 'vehicles' && (
          /* Master Vehicles View */
          <VehicleList />
        )}

        {activeTab === 'accounting' && (
          <BulkReceipt />
        )}

      </main>
    </div>
  );
}

export default App;
