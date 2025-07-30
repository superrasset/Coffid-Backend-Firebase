# Coffid Document Verification Workflow

## Overview

The Coffid backend uses Firebase Cloud Functions to automatically verify uploaded identity documents. The system has been refactored to use a clean, trigger-only approach with document aggregation.

## New Workflow Architecture

### Document Storage Strategy

1. **Front and Back Sides as Separate Documents**: Each recto (front) and verso (back) side of an ID document is stored as a separate document in the `uploadedDocument` collection.

2. **Creation-Only Triggers**: Firestore triggers only fire on document creation, eliminating the complexity of update triggers and preventing infinite loops.

3. **Result Aggregation**: After verification of both sides, results are aggregated into the `verifiedDocument` collection.

### Document Structure

#### uploadedDocument Collection
Each document represents a single side of an ID or a complete passport:

```javascript
{
  userId: "user123",
  documentType: "id" | "passport",
  side: "recto" | "verso", // Only for ID documents, not used for passport
  imageUrl: "https://...",
  status: "pending" | "verified" | "error",
  verificationResult: {
    isValid: boolean,
    confidence: number,
    extractedData: {...},
    errors: [...],
    processedAt: string,
    side: string
  },
  verifiedAt: Date,
  errorAt: Date,
  error: string
}
```

#### verifiedDocument Collection
Aggregated verification results per user:

```javascript
{
  userId: "user123",
  id: {
    recto: { /* verification result */ },
    verso: { /* verification result */ },
    overallValid: boolean,
    aggregatedAt: Date
  },
  passport: { /* verification result */ }, // If passport was verified
  createdAt: Date,
  updatedAt: Date
}
```

## Process Flow

### For ID Documents (Traditional ID & New ID)

1. **Upload Recto Side**:
   - Document created in `uploadedDocument` with `side: "recto"`
   - `processUploadedDocument` trigger fires
   - Recto verification runs
   - Document updated with verification result

2. **Upload Verso Side**:
   - Document created in `uploadedDocument` with `side: "verso"`
   - `processUploadedDocument` trigger fires
   - Verso verification runs
   - Document updated with verification result

3. **Aggregation**:
   - After each side verification, system checks if both sides are complete
   - If both recto and verso are verified, creates/updates entry in `verifiedDocument`
   - Sets `overallValid` based on both sides being valid

### For Passport Documents

1. **Upload Passport**:
   - Document created in `uploadedDocument` with `documentType: "passport"`
   - `processUploadedDocument` trigger fires
   - Passport verification runs
   - Document updated with verification result
   - Entry created/updated in `verifiedDocument` immediately

## Functions

### Core Functions

- **`processUploadedDocument`**: Firestore trigger that processes newly created documents
- **`processDocumentVerification`**: ID document verification logic
- **`processPassportVerification`**: Passport document verification logic
- **`checkAndAggregateIDResults`**: Checks for complete ID verification and aggregates results
- **`createVerifiedDocument`**: Creates or updates entries in the `verifiedDocument` collection

### Utility Functions

- **`generateQrCode`**: Generates QR codes for document verification
- **`getProcessStatus`**: Retrieves processing status for a given task
- **`createUserProfile`**: Creates user profiles in Firestore
- **`healthCheck`**: Health check endpoint

## File Structure

```
functions/
├── index.js                    # Main exports
├── src/
│   ├── documentCheck/
│   │   ├── documentProcessor.js    # Main trigger and aggregation logic
│   │   ├── verifyIDDocument.js     # ID verification logic
│   │   └── verifyPassportDocument.js # Passport verification logic
│   ├── qr/
│   │   └── generateQrCode.js       # QR code generation
│   ├── status/
│   │   └── getProcessStatus.js     # Status checking
│   ├── auth/
│   │   └── createUserProfile.js    # User profile creation
│   └── utils/
│       └── healthCheck.js          # Health check endpoint
```

## Benefits of New Architecture

1. **Simplified Triggers**: Only creation triggers eliminate complexity and edge cases
2. **Clear Separation**: Each document side has its own entry and lifecycle
3. **Atomic Operations**: Each verification is independent and atomic
4. **Easy Debugging**: Clear audit trail for each document side
5. **Scalable**: Easy to add new document types or verification steps
6. **No Infinite Loops**: Creation-only triggers prevent recursive updates

## Deployment

To deploy the functions:

```bash
firebase deploy --only functions
```

## Testing

The system can be tested by:

1. Creating documents in the `uploadedDocument` collection
2. Monitoring the Cloud Functions logs
3. Checking the `verifiedDocument` collection for aggregated results

## Future Enhancements

- Add actual document verification API integration
- Implement more sophisticated error handling
- Add document quality checks
- Implement expiration handling for verification results
- Add webhook notifications for verification completion
