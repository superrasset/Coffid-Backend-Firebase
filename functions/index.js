// The Firebase Admin SDK to access Firestore.
const {initializeApp} = require("firebase-admin/app");

// Initialize Firebase Admin
initializeApp();

// Import all functions from subfolders
const generateQrCode = require('./src/qr/generateQrCode');
const getProcessStatus = require('./src/status/getProcessStatus');
const createUserProfile = require('./src/auth/createUserProfile');
const healthCheck = require('./src/utils/healthCheck');

// Export all functions
exports.generateQrCode = generateQrCode;
exports.getProcessStatus = getProcessStatus;
exports.createUserProfile = createUserProfile;
exports.healthCheck = healthCheck;

// -----------------------------------------------------------------------------------------------------------
// ---------------------------------------------API ENDPOINTS-------------------------------------------------
// -----------------------------------------------------------------------------------------------------------

// LOCAL ENDPOINTS:
// - QR Generation: http://localhost:5001/coffid-2388b/us-central1/generateQrCode?q=majorite
// - Status Check: http://localhost:5001/coffid-2388b/us-central1/getProcessStatus?taskId=<taskId>

// PRODUCTION ENDPOINTS:
// - QR Generation: https://generateqrcode-n7h5iyb34a-uc.a.run.app/?q=majorite
// - Status Check: https://getprocessstatus-n7h5iyb34a-uc.a.run.app/?taskId=<taskId>

// TODO:
// - Créer un deeplink
// - Add input validation for QR generation
// - Add authentication middleware
// - Add rate limiting
