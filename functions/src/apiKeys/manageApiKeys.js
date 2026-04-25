const { onRequest } = require('firebase-functions/v2/https');
const { getFirestore } = require('firebase-admin/firestore');
const { defineSecret } = require('firebase-functions/params');

// Secret partagé pour authentifier les appels depuis coffid-business
const INTERNAL_API_SECRET = defineSecret('INTERNAL_API_SECRET');

/**
 * Middleware pour vérifier le secret partagé
 * Utilisé pour sécuriser les APIs internes (storeApiKey, revokeApiKey)
 */
function verifyInternalSecret(req, res) {
  return new Promise((resolve, reject) => {
    const authHeader = req.headers['authorization'];
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Missing Authorization header' });
      reject(new Error('Missing Authorization header'));
      return;
    }

    const token = authHeader.substring(7); // Remove 'Bearer '
    
    if (token !== INTERNAL_API_SECRET.value()) {
      console.error('❌ Invalid internal secret');
      res.status(403).json({ error: 'Forbidden: Invalid internal secret' });
      reject(new Error('Invalid internal secret'));
      return;
    }

    console.log('✅ Internal secret validated');
    resolve();
  });
}

/**
 * API interne pour stocker une nouvelle API Key
 * Appelée par coffid-business lors de la création d'une clé
 * 
 * POST /storeApiKey
 * Headers: Authorization: Bearer <INTERNAL_API_SECRET>
 * Body: {
 *   api_key_hash: "sha256_hash",
 *   customer_id: "cus_xxx",
 *   subscription_id: "sub_xxx",
 *   organization_id: "org_xxx",
 *   organization_name: "Acme Corp",
 *   display_name: "Acme - Production API",
 *   scopes: ["identity:generate", "identity:status"],
 *   metadata: {...}
 * }
 * 
 * Response: {
 *   success: true,
 *   key_id: "key_abc123"
 * }
 */
const storeApiKey = onRequest(
  { 
    cors: true,
    secrets: [INTERNAL_API_SECRET]
  }, 
  async (req, res) => {
    try {
      // Vérifier la méthode HTTP
      if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed. Use POST.' });
      }

      // Vérifier le secret interne
      await verifyInternalSecret(req, res);

      // Extraire les données du body
      const {
        api_key_hash,
        customer_id,
        subscription_id,
        organization_id,
        organization_name,
        display_name,
        scopes,
        metadata
      } = req.body;

      // Validation des champs requis
      if (!api_key_hash) {
        return res.status(400).json({ error: 'Missing required field: api_key_hash' });
      }
      if (!customer_id) {
        return res.status(400).json({ error: 'Missing required field: customer_id' });
      }
      if (!organization_id) {
        return res.status(400).json({ error: 'Missing required field: organization_id' });
      }
      if (!organization_name) {
        return res.status(400).json({ error: 'Missing required field: organization_name' });
      }

      console.log('📝 Storing API key for organization:', organization_name);

      // Vérifier que le hash n'existe pas déjà
      const db = getFirestore();
      const existingKey = await db.collection('apiKeys')
        .where('hash', '==', api_key_hash)
        .limit(1)
        .get();

      if (!existingKey.empty) {
        console.warn('⚠️ API key hash already exists');
        return res.status(409).json({ 
          error: 'API key already exists',
          key_id: existingKey.docs[0].id
        });
      }

      // Créer le document dans Firestore
      const keyDoc = await db.collection('apiKeys').add({
        hash: api_key_hash,
        customer_id: customer_id,
        subscription_id: subscription_id || null,
        organization_id: organization_id,
        organization_name: organization_name,
        display_name: display_name || organization_name, // Fallback sur organization_name si non fourni
        scopes: scopes || ['identity:generate', 'identity:status', 'status:read'], // Tous les scopes par défaut (Auth0 compat)
        status: 'active',
        created_at: new Date(),
        last_used_at: null,
        revoked_at: null,
        metadata: metadata || {}
      });

      console.log('✅ API key stored successfully with ID:', keyDoc.id);

      res.status(201).json({
        success: true,
        key_id: keyDoc.id,
        created_at: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Error storing API key:', error);
      
      // Si l'erreur vient de la vérification du secret, ne pas répondre à nouveau
      if (error.message === 'Invalid internal secret' || error.message === 'Missing Authorization header') {
        return;
      }
      
      res.status(500).json({ 
        error: 'Internal server error',
        message: error.message 
      });
    }
  }
);

/**
 * API interne pour révoquer une API Key
 * Appelée par coffid-business lors de la révocation d'une clé
 * 
 * POST /revokeApiKey
 * Headers: Authorization: Bearer <INTERNAL_API_SECRET>
 * Body: {
 *   api_key_hash: "sha256_hash"  // OU
 *   key_id: "key_abc123"
 * }
 * 
 * Response: {
 *   success: true,
 *   revoked_at: "2026-04-25T10:30:00Z"
 * }
 */
const revokeApiKey = onRequest(
  { 
    cors: true,
    secrets: [INTERNAL_API_SECRET]
  }, 
  async (req, res) => {
    try {
      // Vérifier la méthode HTTP
      if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed. Use POST.' });
      }

      // Vérifier le secret interne
      await verifyInternalSecret(req, res);

      // Extraire les données du body
      const { api_key_hash, key_id } = req.body;

      // Validation : au moins un des deux doit être fourni
      if (!api_key_hash && !key_id) {
        return res.status(400).json({ 
          error: 'Missing required field: provide either api_key_hash or key_id' 
        });
      }

      console.log('🔒 Revoking API key...');

      const db = getFirestore();
      let keyDoc = null;

      // Chercher la clé par hash ou par ID
      if (key_id) {
        const doc = await db.collection('apiKeys').doc(key_id).get();
        if (doc.exists) {
          keyDoc = doc;
        }
      } else if (api_key_hash) {
        const snapshot = await db.collection('apiKeys')
          .where('hash', '==', api_key_hash)
          .limit(1)
          .get();
        
        if (!snapshot.empty) {
          keyDoc = snapshot.docs[0];
        }
      }

      // Si la clé n'existe pas
      if (!keyDoc) {
        console.warn('⚠️ API key not found');
        return res.status(404).json({ error: 'API key not found' });
      }

      const keyData = keyDoc.data();

      // Si déjà révoquée
      if (keyData.status === 'revoked') {
        console.log('ℹ️ API key already revoked');
        return res.status(200).json({
          success: true,
          message: 'API key was already revoked',
          revoked_at: keyData.revoked_at.toDate().toISOString()
        });
      }

      // Révoquer la clé
      const revokedAt = new Date();
      await db.collection('apiKeys').doc(keyDoc.id).update({
        status: 'revoked',
        revoked_at: revokedAt
      });

      console.log('✅ API key revoked successfully:', keyDoc.id);

      res.status(200).json({
        success: true,
        key_id: keyDoc.id,
        revoked_at: revokedAt.toISOString()
      });

    } catch (error) {
      console.error('❌ Error revoking API key:', error);
      
      // Si l'erreur vient de la vérification du secret, ne pas répondre à nouveau
      if (error.message === 'Invalid internal secret' || error.message === 'Missing Authorization header') {
        return;
      }
      
      res.status(500).json({ 
        error: 'Internal server error',
        message: error.message 
      });
    }
  }
);

module.exports = {
  storeApiKey,
  revokeApiKey
};
