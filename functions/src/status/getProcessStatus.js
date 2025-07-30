const {onRequest} = require("firebase-functions/v2/https");
const {getFirestore} = require("firebase-admin/firestore");

/**
 * HTTP Trigger - Allows client to poll for status of verification requests
 * 
 * @param {Object} req - HTTP request object
 * @param {Object} res - HTTP response object
 */
const getProcessStatus = onRequest(async (req, res) => {
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
