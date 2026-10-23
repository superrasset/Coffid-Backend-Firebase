// The Firebase Admin SDK to access Firestore.
const {initializeApp} = require("firebase-admin/app");
const {setGlobalOptions} = require("firebase-functions/v2");

// Set default region to Europe (co-located with Firestore eur3)
setGlobalOptions({ region: "europe-west1" });

// Initialize Firebase Admin
initializeApp();

// Import all functions from subfolders
const generateQrCode = require('./src/qr/generateQrCodeAuth0');
const getProcessStatus = require('./src/status/getProcessStatusAuth0');
const createUserProfile = require('./src/auth/createUserProfile');
const healthCheck = require('./src/utils/healthCheck');
const { processPassportVerification } = require('./src/documentCheck/verifyPassportDocument');
const { processUploadedDocument } = require('./src/documentCheck/documentProcessor');
const processVideoValidation = require('./src/video/processVideoValidation');
const { storeApiKey, revokeApiKey } = require('./src/apiKeys/manageApiKeys');
const getVPRequestObject = require('./src/eudiWallet/getVPRequestObject');
const handleVPResponse = require('./src/eudiWallet/handleVPResponse');
const initVP = require('./src/eudiWallet/initVP');
const verifyVP = require('./src/eudiWallet/verifyVP');

// Export all functions
exports.generateQrCode = generateQrCode;
exports.getProcessStatus = getProcessStatus;
exports.createUserProfile = createUserProfile;
exports.healthCheck = healthCheck;
exports.processUploadedDocument = processUploadedDocument;
exports.processVideoValidation = processVideoValidation;
exports.storeApiKey = storeApiKey;
exports.revokeApiKey = revokeApiKey;
exports.getVPRequestObject = getVPRequestObject;
exports.handleVPResponse = handleVPResponse;
exports.initVP = initVP;
exports.verifyVP = verifyVP;

// -----------------------------------------------------------------------------------------------------------
// ---------------------------------------------API ENDPOINTS-------------------------------------------------
// -----------------------------------------------------------------------------------------------------------

// LOCAL ENDPOINTS:
// - QR Generation: http://localhost:5001/coffid-2388b/us-central1/generateQrCode?q=majorite
// - Status Check: http://localhost:5001/coffid-2388b/us-central1/getProcessStatus?taskId=<taskId>
// - Video Validation: http://localhost:5001/coffid-2388b/us-central1/processVideoValidation (POST)

// PRODUCTION ENDPOINTS:
// - QR Generation: https://generateqrcode-n7h5iyb34a-uc.a.run.app/?q=majorite
// - Status Check: https://getprocessstatus-n7h5iyb34a-uc.a.run.app/?taskId=<taskId>
// - Video Validation: https://processvideovaliation-n7h5iyb34a-uc.a.run.app/ (POST)

// TODO:
// - Créer un deeplink
// - Add input validation for QR generation
// - Add authentication middleware
// - Add rate limiting
