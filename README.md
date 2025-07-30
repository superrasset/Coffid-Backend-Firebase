# Coffid Backend - Firebase Cloud Functions

A Firebase Cloud Functions backend for the Coffid application that handles QR code generation, user profile management, and data verification processes.

## Features

- **QR Code Generation**: Generate QR codes for data verification requests
- **Process Status Tracking**: Poll for task completion status
- **User Profile Management**: Automatically create user profiles when users sign up via Firebase Authentication

## Functions

### 1. `generateQrCode`
Generates QR codes for data verification requests and creates pending requests in Firestore.

**Endpoint**: `https://your-project.cloudfunctions.net/generateQrCode`
**Method**: GET
**Parameters**:
- `q` (required): The type of information requested (e.g., "majorite", "age", "genre")

**Example**:
```
https://generateqrcode-n7h5iyb34a-uc.a.run.app/?q=majorite
```

### 2. `getProcessStatus`
Allows clients to poll for the status of verification requests.

**Endpoint**: `https://your-project.cloudfunctions.net/getProcessStatus`
**Method**: GET
**Parameters**:
- `taskId` (required): The ID of the task to check

**Example**:
```
https://getprocessstatus-n7h5iyb34a-uc.a.run.app/?taskId=Rk8YsmkkIOEk37U4T0IB
```

### 3. `createUserProfile`
Automatically triggered when a new user signs up via Firebase Authentication. Creates a user document in the Firestore `users` collection.

## Project Structure

```
├── functions/
│   ├── index.js          # Main Cloud Functions code
│   ├── package.json      # Node.js dependencies
│   └── package-lock.json # Dependency lock file
├── public/
│   ├── index.html        # Firebase hosting files
│   └── 404.html
├── firebase.json         # Firebase configuration
├── firestore.rules       # Firestore security rules
└── firestore.indexes.json # Firestore indexes
```

## Setup

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd BackEnd-Firebase
   ```

2. **Install dependencies**:
   ```bash
   cd functions
   npm install
   ```

3. **Firebase Configuration**:
   - Install Firebase CLI: `npm install -g firebase-tools`
   - Login to Firebase: `firebase login`
   - Initialize your project: `firebase use --add`

4. **Local Development**:
   ```bash
   # Start the emulator
   firebase emulators:start --only functions
   
   # Test functions locally
   http://localhost:5001/your-project-id/us-central1/generateQrCode?q=majorite
   ```

## Deployment

Deploy to Firebase:
```bash
firebase deploy --only functions
```

## Dependencies

- `firebase-functions`: Firebase Cloud Functions SDK
- `firebase-admin`: Firebase Admin SDK for server-side operations
- `qrcode`: QR code generation library

## Environment

- **Node.js**: 20
- **Firebase Functions**: v5.1.0
- **Firebase Admin**: v12.1.0

## API Endpoints

### Local Development
- Generate QR: `http://localhost:5001/coffid-2388b/us-central1/generateQrCode?q=majorite`
- Get Status: `http://localhost:5001/coffid-2388b/us-central1/getProcessStatus?taskId=<taskId>`

### Production
- Generate QR: `https://generateqrcode-n7h5iyb34a-uc.a.run.app/?q=majorite`
- Get Status: `https://getprocessstatus-n7h5iyb34a-uc.a.run.app/?taskId=<taskId>`

## License

This project is proprietary software. All rights reserved.
