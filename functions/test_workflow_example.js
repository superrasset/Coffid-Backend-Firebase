// Example test scenario for the new document verification workflow
// This demonstrates how documents should be structured for the new system

const testDocuments = {
  // Example 1: ID Document - Recto Side Upload
  idDocumentRecto: {
    userId: "user123",
    documentType: "id",
    side: "recto",
    imageUrl: "https://storage.googleapis.com/bucket/id_recto_image.jpg",
    status: "pending",
    uploadedAt: new Date()
  },

  // Example 2: ID Document - Verso Side Upload (separate document)
  idDocumentVerso: {
    userId: "user123", // Same user as recto
    documentType: "id",
    side: "verso", 
    imageUrl: "https://storage.googleapis.com/bucket/id_verso_image.jpg",
    status: "pending",
    uploadedAt: new Date()
  },

  // Example 3: Passport Document
  passportDocument: {
    userId: "user456",
    documentType: "passport",
    // No 'side' field for passport
    imageUrl: "https://storage.googleapis.com/bucket/passport_image.jpg",
    status: "pending",
    uploadedAt: new Date()
  }
};

// Expected verification results after processing
const expectedResults = {
  // After recto verification
  rectoverificationResult: {
    isValid: true,
    confidence: 0.95,
    extractedData: {
      side: "recto",
      imageProcessed: true,
      firstName: "Sample",
      lastName: "Name",
      birthDate: "1990-01-01"
    },
    errors: [],
    processedAt: "2025-07-30T...",
    side: "recto"
  },

  // After verso verification
  versoVerificationResult: {
    isValid: true,
    confidence: 0.95,
    extractedData: {
      side: "verso",
      imageProcessed: true,
      address: "Sample Address",
      issueDate: "2020-01-01"
    },
    errors: [],
    processedAt: "2025-07-30T...",
    side: "verso"
  },

  // Final aggregated result in verifiedDocument collection
  aggregatedResult: {
    userId: "user123",
    id: {
      recto: {
        // recto verification result
        isValid: true,
        confidence: 0.95,
        extractedData: { /* recto data */ }
      },
      verso: {
        // verso verification result  
        isValid: true,
        confidence: 0.95,
        extractedData: { /* verso data */ }
      },
      overallValid: true, // Both sides valid
      aggregatedAt: new Date()
    },
    createdAt: new Date()
  }
};

// Workflow Steps:
console.log(`
NEW DOCUMENT VERIFICATION WORKFLOW TEST SCENARIO
===============================================

1. Upload ID Recto Side:
   - Create document in uploadedDocument with 'side: recto'
   - Trigger fires: processUploadedDocument
   - Verification runs: processDocumentVerification(imageUrl, 'recto')
   - Document updated with verification result
   
2. Upload ID Verso Side:
   - Create document in uploadedDocument with 'side: verso'  
   - Trigger fires: processUploadedDocument
   - Verification runs: processDocumentVerification(imageUrl, 'verso')
   - Document updated with verification result
   
3. Aggregation:
   - checkAndAggregateIDResults runs after each verification
   - When both sides complete, creates entry in verifiedDocument
   - Sets overallValid = recto.isValid && verso.isValid

For Passport:
   - Single document upload
   - Immediate verification 
   - Direct entry to verifiedDocument

Benefits:
✅ No update triggers (eliminates complexity)
✅ Atomic operations per document side
✅ Clear audit trail
✅ Easy debugging
✅ Scalable architecture
`);

module.exports = {
  testDocuments,
  expectedResults
};
