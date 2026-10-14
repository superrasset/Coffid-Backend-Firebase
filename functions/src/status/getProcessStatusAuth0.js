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

        // Ownership check — pivot: key_id
        const callerKeyId = req.authContext.key_id;
        if (data.clientKeyId) {
            if (data.clientKeyId !== callerKeyId) {
                console.warn('Ownership mismatch on task', taskId, { callerKeyId, owner: data.clientKeyId });
                return res.status(403).json({ error: 'Forbidden: this task belongs to a different API key.' });
            }
        } else {
            // Legacy task without clientKeyId — allow but log
            console.warn('Task', taskId, 'has no clientKeyId (legacy), skipping ownership check');
        }

        res.status(200).json({
            task_id: taskId,
            status: data.status,
            result: data.result || null,
            infoRequired: data.infoRequired || null,
            userResponseUpdatedAt: data.userResponseUpdatedAt || null,
        });

    } catch (error) {
      console.error('Error retrieving task status:', error);    
      res.status(500).send('Error retrieving task status.');
    }
});

module.exports = getProcessStatus;
