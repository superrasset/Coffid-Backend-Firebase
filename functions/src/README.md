# Functions Source Structure

This directory contains the organized Cloud Functions code for the Coffid backend.

## Directory Structure

```
src/
├── auth/                 # Authentication-related functions
│   └── createUserProfile.js
├── documentCheck/        # Document verification functions
│   ├── verifyIDDocument.js     # ID document verification logic
│   ├── verifyPassportDocument.js # Passport verification logic
│   └── documentProcessor.js    # Firestore triggers and aggregation
├── qr/                   # QR code generation functions  
│   └── generateQrCode.js
├── status/               # Status and polling functions
│   └── getProcessStatus.js
└── utils/                # Utility and helper functions
    └── healthCheck.js
```

## Document Verification Workflow

The system now uses a simplified trigger-based workflow:

### Key Changes (Latest Update)
- **Separate Documents**: Recto and verso sides are stored as separate documents
- **Creation-Only Triggers**: Only document creation triggers verification (no update triggers)
- **Result Aggregation**: Verification results are aggregated into `verifiedDocument` collection
- **Atomic Processing**: Each document side is processed independently

### Core Functions
- `processUploadedDocument`: Main Firestore trigger for document creation
- `processDocumentVerification`: ID document verification
- `processPassportVerification`: Passport document verification
- `checkAndAggregateIDResults`: Aggregates recto/verso results
- `createVerifiedDocument`: Manages verified document collection

See `WORKFLOW_README.md` for detailed workflow documentation.

## Adding New Functions

To add a new function:

1. **Create the function file** in the appropriate subfolder (or create a new subfolder)
2. **Export the function** using `module.exports = functionName`
3. **Import in index.js** with `const functionName = require('./src/folder/functionName')`
4. **Export in index.js** with `exports.functionName = functionName`

### Example: Adding a new function

```javascript
// src/data/validateUser.js
const {onRequest} = require("firebase-functions/v2/https");

const validateUser = onRequest(async (req, res) => {
    // Your function logic here
    res.status(200).json({ message: "User validated" });
});

module.exports = validateUser;
```

Then in `index.js`:
```javascript
const validateUser = require('./src/data/validateUser');
exports.validateUser = validateUser;
```

## Available Functions

### HTTP Triggers
- **generateQrCode**: Generates QR codes for verification requests
- **getProcessStatus**: Polls status of verification tasks  
- **healthCheck**: System health and connectivity check
- **verifyIDDocument**: ID document verification and validation
- **verifyPassportDocument**: Passport document verification and validation

### Firestore Triggers
- **createUserProfile**: Creates user profiles on signup (Auth trigger)
- **processUploadedDocument**: Auto-processes documents when created in uploadedDocument collection
  - Automatically triggers ID verification for documents with documentType = "Traditional ID"
  - Automatically triggers passport verification for documents with documentType = "Passport" or "International Passport"
- **processUpdatedDocument**: Auto-processes documents when updated in uploadedDocument collection
  - Re-triggers verification if document type changes to supported types or relevant fields are updated

### Automatic Processing Flow
1. Document uploaded to `uploadedDocument` collection with supported documentType:
   - `"Traditional ID"` → triggers `processDocumentVerification()` from `verifyIDDocument.js`
   - `"Passport"` or `"International Passport"` → triggers `processPassportVerification()` from `verifyPassportDocument.js`
2. Appropriate trigger fires automatically (`processUploadedDocument`)
3. Calls the corresponding verification function with source='firestore_trigger'
4. All verification logic and database updates are handled in the respective verification files
5. Both `uploadedDocument` and `pendingRequest` collections are updated with results

### Centralized Verification Logic
- Each document type has its own verification file with centralized logic
- Both HTTP endpoints and Firestore triggers use the same core verification functions
- Ensures consistency between manual and automatic processing
- Single source of truth for each document type's verification algorithms

## Testing

Run the functions locally:
```bash
firebase emulators:start --only functions
```

Test endpoints:
- Health: `http://localhost:5001/project-id/region/healthCheck`
- QR Gen: `http://localhost:5001/project-id/region/generateQrCode?q=test`
- Status: `http://localhost:5001/project-id/region/getProcessStatus?taskId=xyz`
