const {onRequest} = require("firebase-functions/v2/https");
const {getFirestore} = require("firebase-admin/firestore");
const qrcode = require('qrcode');
const { auth } = require('express-oauth2-jwt-bearer');

// Configuration Auth0 pour la validation JWT
const jwtCheck = auth({
  audience: 'https://coffid.com/api',
  issuerBaseURL: 'https://bluelocker.eu.auth0.com/',
  tokenSigningAlg: 'RS256'
});

/**
 * Function to generate a QR code based on text passed as a query parameter
 * Creates a pending request in Firestore and returns QR code data
 * Protected with Auth0 JWT authentication and scope verification
 */
const generateQrCode = onRequest({ cors: true }, async (req, res) => {
    // Apply Auth0 JWT validation
    try {
        await new Promise((resolve, reject) => {
            jwtCheck(req, res, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    } catch (error) {
        console.error('Auth0 JWT validation failed:', error);
        return res.status(401).send('Unauthorized');
    }

    // Verify that the token has the required scope
    const authToken = req.auth;
    
    if (!authToken) {
        console.error('No auth token found');
        return res.status(403).send('Insufficient permissions: no auth token');
    }

    // Check for scope in the token payload
    let scopes = [];
    if (authToken.payload && authToken.payload.scope) {
        scopes = authToken.payload.scope.split(' ');
    } else {
        console.error('No scope found in token');
        return res.status(403).send('Insufficient permissions: no scope found');
    }

    if (!scopes.includes('identity:generate')) {
        console.error('Required scope "identity:generate" not found in token. Available scopes:', scopes);
        return res.status(403).send('Insufficient permissions: identity:generate scope required');
    }

    try {
        // Get the info the client wants to access
        const queryParam = req.query.q;
        
        if (!queryParam) {
            // If no text is provided, return a 400 Bad Request error
            return res.status(400).send('Please provide the data you want to check in the query parameter.');
        }

        // Parse multiple infoRequired parameters
        // Support multiple formats:
        // 1. Ampersand-separated within q: ?q=majority&firstname (as a single parameter)
        // 2. Multiple query parameters: ?q=majority&firstname (where firstname is a separate parameter)
        // 3. Comma-separated: ?q=majority,firstname
        let infoRequired = [];
        
        // First, check if q parameter contains separators
        if (queryParam.includes('&')) {
            // Handle ampersand-separated values within q parameter (majority&firstname)
            infoRequired = queryParam.split('&').map(item => item.trim()).filter(item => item.length > 0);
        } else if (queryParam.includes(',')) {
            // Handle comma-separated values (majority,firstname)
            infoRequired = queryParam.split(',').map(item => item.trim()).filter(item => item.length > 0);
        } else {
            // Single value in q parameter
            infoRequired = [queryParam.trim()];
        }
        
        // Also check for additional query parameters that might be info requirements
        // Common info types that might be requested
        const possibleInfoTypes = ['firstname', 'lastname', 'age', 'majority', 'birthdate', 'nationality', 'sex', 'gender'];
        
        for (const infoType of possibleInfoTypes) {
            if (req.query[infoType] !== undefined && !infoRequired.includes(infoType)) {
                infoRequired.push(infoType);
            }
        }

        if (infoRequired.length === 0) {
            return res.status(400).send('Please provide valid data to check in the query parameter.');
        }

        console.log('Parsed infoRequired:', infoRequired);
        console.log('All query parameters:', req.query);

        const pendingRequest = await getFirestore()
        .collection("pendingRequest")
        
        // TODO: Add switch case to validate input (majorité/age/genre/...)
        
        .add({
          clientRequester : 'Demo Platform',  
          infoRequired: infoRequired, // Now stores an array of required information
          status : 'pending',
          createdAt : new Date(),
          result: null,
          userId: null,
          userResponseUpdatedAt: null
        });

        let qrOutput;
        let contentType;

        // Generate QR code URL
        const qrCodeText = 'https://coffid.com/identity-check/' + pendingRequest.id;
        
        // TODO: Get format from request parameter
        let qrFormat = 'text';

        switch (qrFormat.toLowerCase()) {
          case 'svg':
              qrOutput = await qrcode.toString(qrCodeText, { type: 'svg' });
              contentType = 'image/svg+xml';
              break;

          case 'text':
          default:
                qrOutput = qrCodeText;
                contentType = 'application/json';
        }
        
        // Send the QR code back in the appropriate format
        if (contentType === 'application/json') {
            res.status(200).json({ 
              deep_link: qrOutput,
              task_id: pendingRequest.id,
              infoRequired: infoRequired // Include the parsed array of requirements
            });
        } else {
            res.setHeader('Content-Type', contentType);
            res.status(200).send(qrOutput);
        }

    } catch (error) {
        // Log any errors and send a 500 Internal Server Error response
        console.error('Error generating QR code:', error);
        res.status(500).send('Error generating QR code');
    }
});

module.exports = generateQrCode;
