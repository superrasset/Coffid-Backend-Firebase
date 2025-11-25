const {onRequest} = require("firebase-functions/v2/https");
const https = require('https');

/**
 * Proxy endpoint pour obtenir un token Auth0
 * Endpoint: POST /api/token
 * 
 * Body (optionnel):
 * {
 *   "client_id": "...",      // Optionnel, utilise les credentials par défaut si non fourni
 *   "client_secret": "..."   // Optionnel
 * }
 * 
 * Response:
 * {
 *   "access_token": "...",
 *   "token_type": "Bearer",
 *   "expires_in": 86400,
 *   "scope": "identity:generate status:read"
 * }
 */
exports.getToken = onRequest({
  cors: true,
  region: 'us-central1'
}, async (req, res) => {
  
  // Accepter uniquement POST
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed. Use POST.' });
    return;
  }

  try {
    // Credentials par défaut (peuvent être overridés dans le body)
    const DEFAULT_CLIENT_ID = 'vMZEeccBI34Rplzxcyw8YOX9EYsUv7IW';
    const DEFAULT_CLIENT_SECRET = 'qxqeqp-QpbPhFT0du70EzUInI00hBj1rkYRqINtJQCHaP8evNrLeW7_FW7JwlUcI';
    
    // Utiliser les credentials fournis ou par défaut
    const clientId = req.body?.client_id || DEFAULT_CLIENT_ID;
    const clientSecret = req.body?.client_secret || DEFAULT_CLIENT_SECRET;
    
    // Construire le payload pour Auth0
    const auth0Payload = JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      audience: 'https://coffid.com/api',
      grant_type: 'client_credentials'
    });

    // Options pour la requête HTTPS vers Auth0
    const options = {
      hostname: 'bluelocker.eu.auth0.com',
      path: '/oauth/token',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(auth0Payload)
      }
    };

    // Effectuer la requête vers Auth0
    const auth0Response = await new Promise((resolve, reject) => {
      const req = https.request(options, (response) => {
        let data = '';
        
        response.on('data', (chunk) => {
          data += chunk;
        });
        
        response.on('end', () => {
          try {
            const parsedData = JSON.parse(data);
            resolve({
              statusCode: response.statusCode,
              data: parsedData
            });
          } catch (error) {
            reject(new Error('Failed to parse Auth0 response'));
          }
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      req.write(auth0Payload);
      req.end();
    });

    // Retourner la réponse Auth0 au client
    if (auth0Response.statusCode === 200) {
      console.log('✅ Token generated successfully');
      res.status(200).json(auth0Response.data);
    } else {
      console.error('❌ Auth0 error:', auth0Response.data);
      res.status(auth0Response.statusCode).json(auth0Response.data);
    }

  } catch (error) {
    console.error('❌ Error getting token:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});
