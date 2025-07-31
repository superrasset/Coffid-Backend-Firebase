// Example test scenario for the new document verification workflow
// This demonstrates how documents should be structured for the new system

const testDocuments = {
  // Example 1: Traditional ID Document - Recto Side Upload
  traditionalIdRecto: {
    userId: "user123",
    documentType: "Traditional ID", // Exact string that routes to verifyIDDocument.js
    side: "recto",
    imageUrl: "https://storage.googleapis.com/bucket/traditional_id_recto.jpg",
    status: "pending",
    uploadedAt: new Date()
  },

  // Example 2: Traditional ID Document - Verso Side Upload (separate document)
  traditionalIdVerso: {
    userId: "user123", // Same user as recto
    documentType: "Traditional ID", // Exact string that routes to verifyIDDocument.js
    side: "verso", 
    imageUrl: "https://storage.googleapis.com/bucket/traditional_id_verso.jpg",
    status: "pending",
    uploadedAt: new Date()
  },

  // Example 3: New ID Document - Recto Side Upload
  newIdRecto: {
    userId: "user456",
    documentType: "New ID", // Exact string that routes to verifyIDDocument.js
    side: "recto",
    imageUrl: "https://storage.googleapis.com/bucket/new_id_recto.jpg",
    status: "pending",
    uploadedAt: new Date()
  },

  // Example 4: New ID Document - Verso Side Upload
  newIdVerso: {
    userId: "user456",
    documentType: "New ID", // Exact string that routes to verifyIDDocument.js
    side: "verso",
    imageUrl: "https://storage.googleapis.com/bucket/new_id_verso.jpg",
    status: "pending",
    uploadedAt: new Date()
  },

  // Example 5: Passport Document
  passportDocument: {
    userId: "user789",
    documentType: "Passport", // Exact string that routes to verifyPassportDocument.js
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
NEW DOCUMENT VERIFICATION WORKFLOW - REFACTORED ARCHITECTURE
============================================================

ROUTING LOGIC (documentProcessor.js):
- Routes ONLY based on documentType field
- "Traditional ID" → verifyIDDocument.js  
- "New ID" → verifyIDDocument.js
- "Passport" → verifyPassportDocument.js

ID DOCUMENT PROCESSING (verifyIDDocument.js):
1. Handles both Traditional ID and New ID types
2. Validates side ('recto' or 'verso') internally
3. Performs verification based on documentType + side combination
4. Creates/updates verifiedDocument with recto, then completes with verso

PASSPORT PROCESSING (verifyPassportDocument.js):
1. Handles Passport documentType
2. No side validation needed (single document)
3. Direct verification and verifiedDocument creation

BENEFITS:
✅ Clean separation of concerns
✅ documentProcessor.js only routes by documentType
✅ All business logic contained in dedicated files
✅ Easy to extend with new document types
✅ Side handling encapsulated in ID verification logic
`);

module.exports = {
  testDocuments,
  expectedResults
};
