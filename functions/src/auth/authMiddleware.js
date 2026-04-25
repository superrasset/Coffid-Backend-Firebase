const { auth } = require('express-oauth2-jwt-bearer');
const { getFirestore } = require('firebase-admin/firestore');
const crypto = require('crypto');

// Configuration Auth0 pour la validation JWT
const jwtCheck = auth({
  audience: 'https://coffid.com/api',
  issuerBaseURL: 'https://bluelocker.eu.auth0.com/',
  tokenSigningAlg: 'RS256'
});

/**
 * Middleware d'authentification unifié
 * Supporte Auth0 JWT (Bearer token) OU API Key (X-API-Key header)
 * 
 * Peuple req.authContext avec les métadonnées du client :
 * - method: 'auth0' | 'apikey'
 * - customer_id, subscription_id, organization_id, organization_name, display_name
 * - client_id (pour le logging)
 * - scopes: array de permissions
 * - metadata: infos additionnelles
 */
async function authenticateRequest(req, res) {
  return new Promise(async (resolve, reject) => {
    try {
      // 1. Vérifier si c'est une API Key
      const apiKey = req.headers['x-api-key'];
      if (apiKey) {
        const result = await validateApiKey(req, apiKey);
        if (result.success) {
          req.authContext = result.authContext;
          resolve();
        } else {
          res.status(401).json({ error: 'Invalid API key' });
          reject(new Error('Invalid API key'));
        }
        return;
      }

      // 2. Vérifier si c'est un token Auth0
      const authHeader = req.headers['authorization'];
      if (authHeader && authHeader.startsWith('Bearer ')) {
        try {
          await new Promise((resolveJWT, rejectJWT) => {
            jwtCheck(req, res, (err) => {
              if (err) rejectJWT(err);
              else resolveJWT();
            });
          });

          // Extraire les métadonnées depuis le token Auth0
          const authToken = req.auth;
          if (!authToken) {
            res.status(403).json({ error: 'No auth token found' });
            reject(new Error('No auth token found'));
            return;
          }

          // Extraire les scopes
          let scopes = [];
          if (authToken.payload && authToken.payload.scope) {
            scopes = authToken.payload.scope.split(' ');
          }

          // Peupler authContext
          req.authContext = {
            method: 'auth0',
            customer_id: authToken.payload["https://coffid.com/stripe_customer_id"],
            subscription_id: authToken.payload["https://coffid.com/stripe_subscription_id"],
            organization_id: authToken.payload["https://coffid.com/organization_id"],
            organization_name: authToken.payload["https://coffid.com/organization_name"],
            display_name: authToken.payload["https://coffid.com/display_name"],
            client_id: authToken.payload.aud,
            scopes: scopes,
            metadata: {}
          };

          resolve();
          return;
        } catch (error) {
          console.error('Auth0 JWT validation failed:', error);
          res.status(401).json({ error: 'Unauthorized' });
          reject(error);
          return;
        }
      }

      // 3. Aucune authentification fournie
      res.status(401).json({ error: 'Authentication required. Provide X-API-Key header or Authorization Bearer token.' });
      reject(new Error('No authentication provided'));
    } catch (error) {
      console.error('Authentication error:', error);
      res.status(500).json({ error: 'Internal authentication error' });
      reject(error);
    }
  });
}

/**
 * Valide une API Key et retourne les métadonnées associées
 * @param {Object} req - Express request object
 * @param {string} apiKey - La clé API en clair
 * @returns {Object} { success: boolean, authContext?: object }
 */
async function validateApiKey(req, apiKey) {
  try {
    // Calculer le hash SHA256 de la clé
    const hash = crypto.createHash('sha256').update(apiKey).digest('hex');

    console.log('🔑 Validating API key, hash:', hash.substring(0, 16) + '...');

    // Chercher dans Firestore
    const db = getFirestore();
    const keySnapshot = await db.collection('apiKeys')
      .where('hash', '==', hash)
      .where('status', '==', 'active')
      .limit(1)
      .get();

    if (keySnapshot.empty) {
      console.warn('❌ API key not found or revoked');
      return { success: false };
    }

    const keyDoc = keySnapshot.docs[0];
    const keyData = keyDoc.data();

    console.log('✅ API key validated for organization:', keyData.organization_name);

    // Mettre à jour last_used_at de manière asynchrone (non-bloquant)
    updateLastUsed(keyDoc.id).catch(err => {
      console.error('Failed to update last_used_at:', err);
    });

    // Retourner le contexte d'authentification
    return {
      success: true,
      authContext: {
        method: 'apikey',
        key_id: keyDoc.id,
        customer_id: keyData.customer_id,
        subscription_id: keyData.subscription_id,
        organization_id: keyData.organization_id,
        organization_name: keyData.organization_name,
        display_name: keyData.display_name || keyData.organization_name, // Utilise display_name si disponible
        client_id: keyDoc.id, // Pour le logging
        scopes: keyData.scopes || ['identity:generate', 'identity:status', 'status:read'],
        metadata: keyData.metadata || {}
      }
    };
  } catch (error) {
    console.error('Error validating API key:', error);
    return { success: false };
  }
}

/**
 * Met à jour le champ last_used_at d'une API key
 * @param {string} keyId - ID du document dans la collection apiKeys
 */
async function updateLastUsed(keyId) {
  try {
    const db = getFirestore();
    await db.collection('apiKeys').doc(keyId).update({
      last_used_at: new Date()
    });
    console.log('📝 Updated last_used_at for key:', keyId);
  } catch (error) {
    console.error('Failed to update last_used_at:', error);
    // Non-bloquant, on ne propage pas l'erreur
  }
}

/**
 * Middleware pour vérifier qu'un scope spécifique est présent
 * @param {string} requiredScope - Le scope requis (ex: 'identity:generate')
 */
function requireScope(requiredScope) {
  return (req, res, next) => {
    if (!req.authContext) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    if (!req.authContext.scopes.includes(requiredScope)) {
      console.error(`❌ Required scope "${requiredScope}" not found. Available scopes:`, req.authContext.scopes);
      return res.status(403).json({ 
        error: `Insufficient permissions: ${requiredScope} scope required`,
        available_scopes: req.authContext.scopes
      });
    }

    next();
  };
}

module.exports = {
  authenticateRequest,
  requireScope,
  validateApiKey
};
