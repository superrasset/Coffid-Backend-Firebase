const { getFirestore } = require('firebase-admin/firestore');
const crypto = require('crypto');

async function authenticateRequest(req, res) {
  return new Promise(async (resolve, reject) => {
    try {
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

      res.status(401).json({ error: 'Authentication required. Provide an X-API-Key header.' });
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
    console.log('🔍 Debug Firestore keyData:', {
      display_name_raw: keyData.display_name,
      display_name_type: typeof keyData.display_name,
      organization_name: keyData.organization_name,
      will_use: keyData.display_name || keyData.organization_name
    });

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
