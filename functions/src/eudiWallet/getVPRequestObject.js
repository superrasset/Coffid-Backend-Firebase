const { onRequest } = require('firebase-functions/v2/https')
const { defineSecret } = require('firebase-functions/params')
const { getFirestore } = require('firebase-admin/firestore')
const crypto = require('node:crypto')

// jose est ESM-only en v5 — on utilise dynamic import (supporté en CJS Node 22)
let _jose = null
async function jose() {
  if (!_jose) _jose = await import('jose')
  return _jose
}

const verifierPrivateKey = defineSecret('COFFID_VERIFIER_PRIVATE_KEY')
const verifierCert = defineSecret('COFFID_VERIFIER_CERT')
const encryptionPubKeyJwk = defineSecret('COFFID_ENCRYPTION_PUBLIC_KEY_JWK')

const { resolveEudiThreshold } = require('./eudiMapping')

function buildDcqlQuery(threshold) {
  return {
    credentials: [{
      id: threshold,
      format: 'mso_mdoc',
      meta: { doctype_value: 'eu.europa.ec.av.1' },
      claims: [{ path: ['eu.europa.ec.av.1', threshold], intent_to_retain: true }],
      multiple: false,
      require_cryptographic_holder_binding: true,
    }],
  }
}

/**
 * POST /api/vp/req/:taskId
 * Appelé par l'app France Identité (fallback OID4VP iOS).
 * Génère un Request Object JWT signé ES256, stocke state + nonce en Firestore.
 *
 * Secrets (Secret Manager) :
 *   COFFID_VERIFIER_PRIVATE_KEY      — PEM clé privée EC P-256 (signature JWT)
 *   COFFID_VERIFIER_CERT             — PEM certificat x509 (x5c dans le JWT header)
 *   COFFID_ENCRYPTION_PUBLIC_KEY_JWK — JSON JWK clé publique pour déchiffrement réponse
 *
 * Variables d'environnement (.env) :
 *   COFFID_API_BASE_URL  — ex: https://coffid-2388b.web.app
 *   FRANCE_IDENTITE_AUD  — ex: https://api.playground.france-identite.gouv.fr
 */
const getVPRequestObject = onRequest(
  { cors: true, secrets: [verifierPrivateKey, verifierCert, encryptionPubKeyJwk] },
  async (req, res) => {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' })
    }

    // Extraire taskId depuis le path : /api/vp/req/{taskId}
    const taskId = req.path.split('/').filter(Boolean).pop()
    if (!taskId) return res.status(400).json({ error: 'Missing taskId in path' })

    console.log(`📋 getVPRequestObject — taskId: ${taskId}`)

    try {
      const db = getFirestore()
      const taskSnap = await db.collection('pendingRequest').doc(taskId).get()

      if (!taskSnap.exists) {
        console.error(`❌ Task not found: ${taskId}`)
        return res.status(404).json({ error: 'Task not found' })
      }

      const taskData = taskSnap.data()
      if (taskData.status !== 'pending') {
        console.error(`❌ Task already processed: ${taskId}`)
        return res.status(409).json({ error: 'Task already processed' })
      }

      const threshold = resolveEudiThreshold(taskData.infoRequired)
      if (!threshold) {
        console.error(`❌ Task not eligible for EU Wallet: ${taskId}`)
        return res.status(400).json({ error: 'Task not eligible for EU Wallet verification' })
      }

      // Générer state + nonce (anti-CSRF / anti-rejeu)
      const nonce = crypto.randomBytes(32).toString('base64url')
      const state = crypto.randomBytes(32).toString('base64url')

      await db.collection('pendingRequest').doc(taskId).update({
        vpNonce: nonce,
        vpState: state,
        vpThreshold: threshold,
        vpInitiatedAt: new Date(),
      })

      const privateKeyPem = verifierPrivateKey.value()
      const certPem = verifierCert.value()
      if (!privateKeyPem || !certPem) {
        console.error('❌ COFFID_VERIFIER_PRIVATE_KEY ou COFFID_VERIFIER_CERT manquant')
        return res.status(500).json({ error: 'Verifier credentials not configured' })
      }

      // x5c : certificat DER en base64 (sans headers PEM)
      const certDer = certPem
        .replace(/-----BEGIN CERTIFICATE-----/g, '')
        .replace(/-----END CERTIFICATE-----/g, '')
        .replace(/\s/g, '')

      const encPubKeyJwk = JSON.parse(encryptionPubKeyJwk.value() || '{}')

      const apiBase = process.env.COFFID_API_BASE_URL || 'https://api.coffid.com'
      const fiAud = process.env.FRANCE_IDENTITE_AUD || 'https://api.playground.france-identite.gouv.fr'
      const clientId = 'x509_san_dns:api.coffid.com'

      const { SignJWT, importPKCS8 } = await jose()
      const privateKey = await importPKCS8(privateKeyPem, 'ES256')

      const jwt = await new SignJWT({
        response_type: 'vp_token',
        response_mode: 'direct_post.jwt',
        response_uri: `${apiBase}/api/vp/response/${taskId}`,
        client_id: clientId,
        nonce,
        state,
        client_metadata: {
          authorization_encrypted_response_alg: 'ECDH-ES',
          authorization_encrypted_response_enc: 'A256GCM',
          jwks: { keys: [encPubKeyJwk] },
          vp_formats_supported: { mso_mdoc: {} },
        },
        dcql_query: buildDcqlQuery(threshold),
      })
        .setProtectedHeader({ alg: 'ES256', x5c: [certDer] })
        .setIssuer(clientId)
        .setAudience(fiAud)
        .setIssuedAt()
        .setExpirationTime('5m')
        .sign(privateKey)

      console.log(`✅ Request Object JWT généré — taskId: ${taskId}, threshold: ${threshold}`)

      res.set('Content-Type', 'application/oauth-authz-req+jwt')
      return res.status(200).send(jwt)

    } catch (error) {
      console.error('❌ getVPRequestObject error:', error)
      return res.status(500).json({ error: 'Internal server error' })
    }
  }
)

module.exports = getVPRequestObject
