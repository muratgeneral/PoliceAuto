import * as pdfjsLib from 'pdfjs-dist';

// Use a reliable CDN for the worker to avoid Vite build/dev server chunking issues
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

/**
 * Extracts raw text from a given PDF File object
 * @param {File} file 
 * @returns {Promise<string>} The extracted text
 */
export async function extractTextFromPDF(file) {
  try {
    const arrayBuffer = await file.arrayBuffer();

    // Setting cMapUrl and cMapPacked to handle special characters properly
    const loadingTask = pdfjsLib.getDocument({
      data: arrayBuffer,
      cMapUrl: 'https://unpkg.com/pdfjs-dist@' + pdfjsLib.version + '/cmaps/',
      cMapPacked: true,
    });

    const pdf = await loadingTask.promise;

    let fullText = '';

    // Iterate through all pages
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();

      const pageText = textContent.items.map(item => item.str).join(' ');
      fullText += pageText + '\n';
    }

    return fullText;
  } catch (error) {
    console.error("Error extracting PDF text:", error);
    throw new Error("PDF dosyası okunamadı. Dosyanın bozuk veya şifreli olmadığından emin olun. (" + error.message + ")");
  }
}
