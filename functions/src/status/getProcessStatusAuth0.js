const {onRequest} = require("firebase-functions/v2/https");
const {getFirestore} = require("firebase-admin/firestore");
const { auth } = require('express-oauth2-jwt-bearer');

// Configuration Auth0 pour la validation JWT
const jwtCheck = auth({
  audience: 'https://coffid.com/api',
  issuerBaseURL: 'https://bluelocker.eu.auth0.com/',
  tokenSigningAlg: 'RS256'
});

/**
 * HTTP Trigger - Allows client to poll for status of verification requests
 * Protected with Auth0 JWT authentication and scope verification
 * 
 * @param {Object} req - HTTP request object
 * @param {Object} res - HTTP response object
 */
const getProcessStatus = onRequest({ cors: true }, async (req, res) => {
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

    if (!scopes.includes('status:read')) {
        console.error('Required scope "status:read" not found in token. Available scopes:', scopes);
        return res.status(403).send('Insufficient permissions: status:read scope required');
    }

    const taskId = req.query.taskId;
    console.log('Checking status for taskId:', taskId);
    
    if (!taskId) {
        return res.status(400).send('Missing "taskId" query parameter.');
    }

    try {
        const db = getFirestore();
        const taskDoc = await db.collection("pendingRequest").doc(taskId).get();
       
        if (!taskDoc.exists) {
            return res.status(404).json({ 
              status: 'not_found', 
              message: 'Task not found.' 
            });
        }

        const data = taskDoc.data();
        
        // Return only the necessary public information
        res.status(200).json({
            taskId: taskId,
            status: data.status,
            result: data.result || null, // Only return result if available
            infoRequired: data.infoRequired || null, // Include infoRequired if needed
            userResponseUpdatedAt: data.userResponseUpdatedAt || null, // Include userResponseUpdatedAt if needed
        });

    } catch (error) {
      console.error('Error retrieving task status:', error);    
      res.status(500).send('Error retrieving task status.');
    }
});

module.exports = getProcessStatus;
