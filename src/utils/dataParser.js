/**
 * A simple regex-based parser that tries to extract common insurance fields
 * from raw text. In a production app, an LLM API would replace this.
 * @param {string} text 
 * @returns {Object} Extracted data fields
 */
export function parseInsurancePolicy(text) {
    console.log("----- RAW EXTRACTED TEXT -----");
    console.log(text.substring(0, 1000) + "..."); // Print first 1000 chars for debugging

    // PDF.js often extracts tables line by line, or mixes up spaces. 
    // For example: "Acente Kodu Poli ç e No ... 320497 1107528824"
    // We need very forgiving regex.

    const results = {};

    // 1. Policy Number
    // Look for standalone 8-11 digit numbers. To avoid picking Acente No (often 6 digits), we look for larger ones.
    const policyNumMatch = text.match(/(?:Poliçe No|Police No)[\s:.-]*([0-9]{6,15}[A-Z0-9/-]*)/i) ||
        text.match(/POLİÇE\s+NO.*?(\d{8,15})/i) || // For tabular headers 
        text.match(/\b([1-9]\d{13,15})\b/) || // Sompo uses 14, 15 digit combinations natively without clear inline heading
        text.match(/\b([1-9]\d{7,11})\b/); // Fallback: 8 to 12 digit number
    results.policyNumber = policyNumMatch ? policyNumMatch[1] : '';

    // Extract Ek No (Supplement / Supplement Number)
    // E.g., "Ek No 1" or "Zeyil No 1" or "Ek No : 1"
    const ekNoMatch = text.match(/(?:Ek\s*No|Zeyil\s*No)[\s:.-]*(\d+)/i) || text.match(/Ek\s*No[\s:.-]*(\d+)/i);
    results.ekNo = ekNoMatch ? ekNoMatch[1] : '0'; // Default to 0 if not found


    // 2. Dates
    // Extract ALL valid date strings
    const allDates = [...text.matchAll(/(\d{2}[./-]\d{2}[./-]\d{4})/g)].map(m => m[1]);

    if (allDates.length > 0) {
        // Convert dates to JS Date objects to easily sort them
        const parsedDates = allDates.map(d => {
            const parts = d.split(/[./-]/);
            return { raw: d, obj: new Date(`${parts[2]}-${parts[1]}-${parts[0]}`) };
        }).sort((a, b) => a.obj - b.obj); // Sort ascending

        // The End Date is usually the latest date in the document
        results.endDate = parsedDates[parsedDates.length - 1].raw;

        // The Start Date is usually exactly 1 year before the End Date, or the second to last date
        const endDateObj = parsedDates[parsedDates.length - 1].obj;
        const potentialStartDateObj = new Date(endDateObj);
        potentialStartDateObj.setFullYear(endDateObj.getFullYear() - 1);

        let foundStartDateObj = parsedDates.find(d => d.obj.getTime() === potentialStartDateObj.getTime());
        if (foundStartDateObj) {
            results.startDate = foundStartDateObj.raw;
        } else if (parsedDates.length >= 2) {
            // fallback: just pick the second to last date
            results.startDate = parsedDates[parsedDates.length - 2].raw;
        } else {
            results.startDate = parsedDates[0].raw;
        }
    }

    // 5. Plate: 01 ABC 123 or 026DM478 (allow leading zeros or 3 digits)
    const plateMatch = text.match(/(?:Plaka|Araç)[\s:.-]*((?:\d{2,3})\s*[A-Z]{1,3}\s*\d{2,4})/i) || text.match(/\b((?:\d{2,3})\s*[A-Z]{1,3}\s*\d{2,4})\b/i);
    results.plateInfo = plateMatch ? plateMatch[1].replace(/\s+/g, ' ') : '';

    // 6. Premium Amount (Tutar) - Prioritize Ödenecek/Toplam before falling back to Net
    const premiumMatch = text.match(/(?:Toplam\s*Brüt\s*Prim|Ö\s*denecek\s*Tutar|Toplam\s*Tutar|Genel\s*Toplam|Toplam|Brüt\s*Prim)[\s:.-]*([\d.,]+)\s*(?:TL|TRY)?/i) ||
        text.match(/(?:Tutar|Net\s*Prim|Vergi\s*Ö\s*ncesi\s*Prim)[\s:.-]*([\d.,]+)\s*(?:TL|TRY)?/i);
    results.premiumAmount = premiumMatch ? premiumMatch[1] : '';

    // 7 & 9. Marka and Model
    let brand = '';
    let model = '';

    // Handle Sompo's "Marka/Tip   : CITROEN C3 ELLE 1.2 PURETECH 110 EAT6  Kullanım Tarzı"
    const markaTipMatch = text.match(/Marka\/Tip[\s:.-]*([A-Za-z0-9ÇŞĞÜÖİçşğüöı\s.\/-]+?)(?=\s+Kullan[ıi]m|\s+Trafik|\n|$)/i);
    const egmMarkaMatch = text.match(/EGM\s+Marka\s+Bilgisi[\s:.-]*([A-Za-z0-9ÇŞĞÜÖİçşğüöı\s\/-]+?)(?=\s+EGM|\s+Model|\n|$)/i);

    if (markaTipMatch) {
        // "Marka/Tip" usually contains both the brand and full model name
        let fullStr = markaTipMatch[1].trim();

        if (egmMarkaMatch && egmMarkaMatch[1]) {
            brand = egmMarkaMatch[1].trim();
            // Strip brand from the beginning to isolate the model
            if (fullStr.toUpperCase().startsWith(brand.toUpperCase())) {
                model = fullStr.substring(brand.length).trim();
            } else {
                model = fullStr;
            }
        } else {
            // Fallback: take first word as brand
            let parts = fullStr.split(/\s+/);
            brand = parts[0];
            model = parts.slice(1).join(' ').trim();
        }
    } else {
        // Standard parser logic
        const defaultMarkaMatch = text.match(/(?:Markas[ıi]|Marka)[\s:.-]*([A-Za-z0-9ÇŞĞÜÖİçşğüöı\s\/-]+?)(?=\s+Motor|\s+Model|\s+Tip|\s+Şasi|\n|$)/i);
        brand = defaultMarkaMatch ? defaultMarkaMatch[1].trim() : '';

        const defaultModelMatch = text.match(/(?:Model\s+Yılı|Model|Tip)[\s:.-]*([A-Za-z0-9ÇŞĞÜÖİçşğüöı\s.]+?)(?=\s+Plaka|\s+Koltuk|\s+Ş\s*asi|\s+Motor|\n|$)/i);
        model = defaultModelMatch ? defaultModelMatch[1].replace(/\s{2,}/g, ' ').trim() : '';
    }

    results.brand = brand;
    results.model = model;

    // 10. Şasi No
    const sasiMatch = text.match(/(?:Ş\s*asi\s*Numaras[ıi]|Ş\s*asi\s*No|Sasi\s*No|Sasi\s*Numarasi)[\s:.-]*([A-Z0-9]{10,25})/i);
    results.chassisNo = sasiMatch ? sasiMatch[1].trim() : '';

    // Determine Policy Type
    let baseType = "Diğer";
    const headerText = text.substring(0, 2000).replace(/\s+/g, '').toUpperCase(); // Remove spaces to bypass "B İ RLE Şİ K" spacing errors

    // Check Trafik explicitly
    if (headerText.includes("KARAYOLLARIMOTORLUARAÇLAR") ||
        headerText.includes("KARAYOLLARIMOTORLUARACLAR") ||
        headerText.includes("ZORUNLUMALİSORUMLULUKSİGORTAPOLİÇES") ||
        headerText.includes("ZORUNLUMALISORUMLULUKSIGORTAPOLICES") ||
        headerText.includes("TRAFİKSİGORTA") ||
        headerText.includes("TRAFIKSIGORTA")) {
        baseType = "Trafik Sigortası";
    }
    // Check Kasko explicitly
    else if (headerText.includes("BİRLEŞİKKASKO") ||
        headerText.includes("BIRLESIKKASKO") ||
        headerText.includes("GENİŞLETİLMİŞKASKO") ||
        headerText.includes("GENISLETILMISKASKO") ||
        headerText.includes("KASKOPOLİÇES") ||
        headerText.includes("KASKOPOLICES") ||
        headerText.includes("KASKO")) {
        baseType = "Kasko";
    }
    // Fallbacks
    else if (/TRAF[İIİ]K/i.test(text)) {
        baseType = "Trafik Sigortası";
    } else if (/KASKO/i.test(text)) {
        baseType = "Kasko";
    }

    let policyType = baseType;
    if (results.ekNo && results.ekNo !== '0') {
        policyType += " Zeyil";
    }

    // Detect if this is a cancellation policy
    // Check top text to avoid matching "İptal Klozu" deep in the standard policy conditions
    const topTextForCancel = text.substring(0, 3000).replace(/\s+/g, ' ').toUpperCase();
    const isCancelled = /İPTAL POL\w*/.test(topTextForCancel) || 
                        /IPTAL POL\w*/.test(topTextForCancel) || 
                        /İPTAL ZEY\w*/.test(topTextForCancel) ||
                        /IPTAL ZEY\w*/.test(topTextForCancel) ||
                        /İPTAL ED\w*/.test(topTextForCancel) ||
                        /IPTAL ED\w*/.test(topTextForCancel) ||
                        /İPTAL SEBEBİ/.test(topTextForCancel) ||
                        /POLİÇE\s*DURUMU\s*İPTAL/.test(topTextForCancel);

    if (isCancelled) {
        policyType += " (İptal)";
    }

    results.policyType = policyType;
    results.isCancelled = isCancelled;

    // Clean up format
    return {
        policyNumber: results.policyNumber || 'Bulunamadı',
        ekNo: results.ekNo || '0',
        policyType: results.policyType,
        isCancelled: results.isCancelled || false,
        startDate: results.startDate || 'Bulunamadı',
        endDate: results.endDate || 'Bulunamadı',
        plateInfo: results.plateInfo || 'Bulunamadı',
        brand: results.brand || 'Bulunamadı',
        model: results.model || 'Bulunamadı',
        chassisNo: results.chassisNo || 'Bulunamadı',
        premiumAmount: results.premiumAmount ? `${results.premiumAmount} TL` : 'Bulunamadı'
    };
}
