# Functions Source Structure

This directory contains the organized Cloud Functions code for the Coffid backend.

## Directory Structure

```
src/
├── auth/                 # Authentication-related functions
│   └── createUserProfile.js
├── qr/                   # QR code generation functions  
│   └── generateQrCode.js
├── status/               # Status and polling functions
│   └── getProcessStatus.js
└── utils/                # Utility and helper functions
    └── healthCheck.js
```

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

- **generateQrCode**: Generates QR codes for verification requests
- **getProcessStatus**: Polls status of verification tasks  
- **createUserProfile**: Creates user profiles on signup
- **healthCheck**: System health and connectivity check

## Testing

Run the functions locally:
```bash
firebase emulators:start --only functions
```

Test endpoints:
- Health: `http://localhost:5001/project-id/region/healthCheck`
- QR Gen: `http://localhost:5001/project-id/region/generateQrCode?q=test`
- Status: `http://localhost:5001/project-id/region/getProcessStatus?taskId=xyz`
