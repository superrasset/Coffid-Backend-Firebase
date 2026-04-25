const {onRequest} = require("firebase-functions/v2/https");
const {getFirestore} = require("firebase-admin/firestore");
const { authenticateRequest } = require('../auth/authMiddleware');

/**
 * HTTP Trigger - Allows client to poll for status of verification requests
 * Protected with unified authentication (Auth0 JWT OR API Key)
 * 
 * @param {Object} req - HTTP request object
 * @param {Object} res - HTTP response object
 */
const getProcessStatus = onRequest({ cors: true }, async (req, res) => {
    // Apply unified authentication middleware
    try {
        await authenticateRequest(req, res);
    } catch (error) {
        // Response already sent by middleware
        return;
    }

    // Verify scope (accept both 'status:read' for Auth0 compatibility and 'identity:status')
    const hasStatusScope = req.authContext.scopes.includes('status:read') || 
                           req.authContext.scopes.includes('identity:status');
    
    if (!hasStatusScope) {
        console.error('Required scope "status:read" or "identity:status" not found. Available scopes:', req.authContext.scopes);
        return res.status(403).json({ 
            error: 'Insufficient permissions: status:read or identity:status scope required',
            available_scopes: req.authContext.scopes
        });
    }

    const taskId = req.query.task_id;
    console.log('Checking status for task_id:', taskId);
    
    if (!taskId) {
        return res.status(400).send('Missing "task_id" query parameter.');
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
            task_id: taskId,
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
