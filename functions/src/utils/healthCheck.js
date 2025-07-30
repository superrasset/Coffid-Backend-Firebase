const {onRequest} = require("firebase-functions/v2/https");
const {getFirestore} = require("firebase-admin/firestore");

/**
 * Example utility function - Health check endpoint
 * Returns system status and basic information
 * 
 * @param {Object} req - HTTP request object
 * @param {Object} res - HTTP response object
 */
const healthCheck = onRequest(async (req, res) => {
    try {
        const db = getFirestore();
        
        // Simple database connectivity test
        const testCollection = await db.collection("pendingRequest").limit(1).get();
        
        const healthData = {
            status: "healthy",
            timestamp: new Date().toISOString(),
            services: {
                firestore: testCollection ? "connected" : "disconnected",
                functions: "running"
            },
            version: "1.0.0"
        };

        res.status(200).json(healthData);
        
    } catch (error) {
        console.error('Health check failed:', error);
        res.status(500).json({
            status: "unhealthy",
            timestamp: new Date().toISOString(),
            error: error.message
        });
    }
});

module.exports = healthCheck;
