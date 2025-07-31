// Example of new data structures with extractedData

console.log('=== NEW LOGGING AND DATA STRUCTURE ===\n');

// What you'll see in the Cloud Function logs:
console.log('📋 CLOUD FUNCTION LOGS will now include:');
console.log(`
1. OCR Data Extraction Log:
{
  "uploadedDocumentId": "doc123",
  "ocrProvider": "mindee",
  "confidence": 0.99,
  "isValid": true,
  "extractedData": {
    "documentType": "NEW",
    "documentSide": "RECTO & VERSO",
    "surname": "MARTIN",
    "givenNames": ["Marie"],
    "birthDate": "1990-07-13",
    "birthPlace": "PARIS",
    "gender": "F",
    "nationality": "FRA",
    "documentNumber": "D2H6862M2",
    "issueDate": "2020-02-12",
    "expiryDate": "2030-02-11",
    "authority": "Préfecture de Paris",
    "cardAccessNumber": "546497",
    "mrz1": "IDFRAX4RTBPFW46<<<<<<<<<<<<<<<",
    "mrz2": "9007138F3002119FRA<<<<<<<<<<<6",
    "mrz3": "MARTIN<<MAELYS<GAELLE<MARIE<<<",
    "confidenceScores": {
      "surname": 0.99,
      "givenNames": 0.99,
      "birthDate": 0.99,
      "documentNumber": 0.99,
      "overall": 0.99
    }
  }
}

2. Document Creation Log (Recto):
{
  "message": "Created new verified document with auto-generated ID abc123 for user user456",
  "extractedData": { ...all the OCR data above... }
}

3. Document Completion Log (Verso):
{
  "message": "Completed ID verification for document abc123 - user user456",
  "rectoValid": true,
  "versoValid": true,
  "overallValid": true,
  "rectoExtractedData": { ...recto OCR data... },
  "versoExtractedData": { ...verso OCR data... }
}
`);

console.log('📄 FIRESTORE DOCUMENT STRUCTURE will be:');
console.log(`
verifiedDocument/{docId}:
{
  "userId": "user456",
  "documentType": "Traditional ID",
  "uploadedDocuments": {
    "recto": {
      "isValid": true,
      "processedAt": "2025-07-31T...",
      "side": "recto",
      "uploadedDocumentId": "doc123",
      "filename": "recto.jpg",
      "imageUrl": "https://...",
      
      // 🎯 NEW: All OCR extracted data stored here
      "extractedData": {
        "documentType": "NEW",
        "surname": "MARTIN",
        "givenNames": ["Marie"],
        "birthDate": "1990-07-13",
        "birthPlace": "PARIS",
        "gender": "F",
        "nationality": "FRA",
        "documentNumber": "D2H6862M2",
        "issueDate": "2020-02-12",
        "expiryDate": "2030-02-11",
        "confidenceScores": {
          "surname": 0.99,
          "givenNames": 0.99,
          "birthDate": 0.99,
          "overall": 0.99
        }
      },
      
      "ocrData": {
        "provider": "mindee",
        "confidence": 0.99,
        "errors": []
      }
    },
    
    "verso": {
      "isValid": true,
      "processedAt": "2025-07-31T...",
      "side": "verso",
      "uploadedDocumentId": "doc124",
      "filename": "verso.jpg",
      "imageUrl": "https://...",
      
      // 🎯 NEW: All OCR extracted data stored here
      "extractedData": {
        "documentType": "NEW",
        "authority": "Préfecture de Paris",
        "cardAccessNumber": "546497",
        "mrz1": "IDFRAX4RTBPFW46<<<<<<<<<<<<<<<",
        "mrz2": "9007138F3002119FRA<<<<<<<<<<<6",
        "mrz3": "MARTIN<<MAELYS<GAELLE<MARIE<<<",
        "confidenceScores": {
          "overall": 0.99
        }
      },
      
      "ocrData": {
        "provider": "mindee",
        "confidence": 0.99,
        "errors": []
      }
    },
    
    "rectoProcessedAt": "2025-07-31T...",
    "versoProcessedAt": "2025-07-31T...",
    "overallValid": true,
    "status": "complete",
    "completedAt": "2025-07-31T..."
  },
  "createdAt": "2025-07-31T...",
  "updatedAt": "2025-07-31T..."
}
`);

console.log('✅ BENEFITS:');
console.log(`
1. 📊 Complete OCR data visible in logs for debugging
2. 💾 All extracted data stored in Firestore for future use
3. 🔍 Easy access to:
   - Personal info: recto.extractedData.surname, givenNames, etc.
   - Document info: recto.extractedData.documentNumber, dates, etc.
   - Security data: verso.extractedData.mrz1, mrz2, mrz3, etc.
4. 📈 Confidence scores for quality assessment
5. 🔧 OCR metadata separate from extracted data
`);

console.log('🚀 Ready for production document processing!');
