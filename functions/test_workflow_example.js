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
  },

  // Example 6: Face/Video Upload - Traditional ID (NO 'side' field!)
  faceVideoTraditionalId: {
    userId: "user123", // Same user as recto/verso above
    documentType: "Traditional ID", 
    faceRecordingUrl: "https://storage.googleapis.com/bucket/face_recording_123.mp4",
    filename: "face_recording_user123.mp4",
    status: "pending",
    uploadedAt: new Date()
    // ❌ NO 'side' field - this is key for video uploads!
  },

  // Example 7: Face/Video Upload - New ID (NO 'side' field!)
  faceVideoNewId: {
    userId: "user456", // Same user as recto/verso above
    documentType: "New ID",
    videoUrl: "https://storage.googleapis.com/bucket/video_validation_456.mp4", 
    filename: "video_liveness_check_456.mp4",
    status: "pending",
    uploadedAt: new Date()
    // ❌ NO 'side' field - this is key for video uploads!
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

VIDEO UPLOAD PROCESSING:
1. Face/Video uploads do NOT have 'side' field
2. Directly processed based on documentType  
3. Useful for liveness checks and additional verification

⚠️  FRONTEND REQUIREMENTS FOR VIDEO UPLOADS:
- ❌ NEVER include 'side' field for video/face uploads
- ✅ Include faceRecordingUrl OR videoUrl field
- ✅ Use descriptive filename containing 'video' or 'face'
- ✅ Include proper userId and documentType matching existing document

EXPECTED UPLOAD FLOW:
1. Document recto upload (side: "recto") → status: "partial 1/3"
2. Document verso upload (side: "verso") → status: "partial 2/3"  
3. Video/face upload (NO side field) → status: "completed"
4. User data gets updated in users collection

BENEFITS:
✅ Clean separation of concerns
✅ documentProcessor.js only routes by documentType
✅ All business logic contained in dedicated files
✅ Easy to extend with new document types
✅ Side handling encapsulated in ID verification logic
`);

// Test OCR Service Configuration
console.log('\n=== Testing OCR Service Configuration ===');

// Test different OCR providers
const { createOCRService, OCR_CONFIG } = require('./src/documentCheck/ocrService');

async function testOCRProviders() {
  console.log('Current OCR Provider:', OCR_CONFIG.OCR_PROVIDER);
  
  const ocrService = createOCRService();
  const result = await ocrService.processDocument(
    'https://example.com/test-id.jpg',
    'Traditional ID',
    'recto'
  );
  
  console.log('OCR Test Result:', {
    provider: result.provider,
    isValid: result.isValid,
    confidence: result.confidence
  });
}

// Uncomment to test OCR service
// testOCRProviders().catch(console.error);

module.exports = {
  testDocuments,
  expectedResults
};
