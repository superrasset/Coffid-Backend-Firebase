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

const { resolvePidAttributes } = require('./eudiMapping')

const PID_DOCTYPE = 'eu.europa.ec.eudi.pid.1'

function buildDcqlQuery(pidAttributes) {
  return {
    credentials: [{
      id: 'credential',
      format: 'mso_mdoc',
      meta: { doctype_value: PID_DOCTYPE },
      claims: pidAttributes.map(attr => ({
        path: [PID_DOCTYPE, attr],
        intent_to_retain: false,
      })),
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

      const pidAttributes = resolvePidAttributes(taskData.infoRequired)
      if (!pidAttributes) {
        console.error(`❌ Task not eligible for EU Wallet: ${taskId}`)
        return res.status(400).json({ error: 'Task not eligible for EU Wallet verification' })
      }

      // Générer state + nonce (anti-CSRF / anti-rejeu)
      const nonce = crypto.randomBytes(32).toString('base64url')
      const state = crypto.randomBytes(32).toString('base64url')

      await db.collection('pendingRequest').doc(taskId).update({
        vpNonce: nonce,
        vpState: state,
        vpPidAttributes: pidAttributes,
        vpInitiatedAt: new Date(),
      })

      const privateKeyPem = verifierPrivateKey.value()
      const certPem = verifierCert.value()
      if (!privateKeyPem || !certPem) {
        console.error('❌ COFFID_VERIFIER_PRIVATE_KEY ou COFFID_VERIFIER_CERT manquant')
        return res.status(500).json({ error: 'Verifier credentials not configured' })
      }

      // x5c : chaîne de certs DER en base64. COFFID_VERIFIER_CERT peut contenir
      // plusieurs certs PEM concaténés (leaf + CA) — on les extrait tous.
      const x5c = [...certPem.matchAll(/-----BEGIN CERTIFICATE-----([\s\S]*?)-----END CERTIFICATE-----/g)]
        .map(m => m[1].replace(/\s/g, ''))

      const encPubKeyJwk = JSON.parse(encryptionPubKeyJwk.value() || '{}')

      const apiBase = process.env.COFFID_API_BASE_URL || 'https://api.coffid.com'
      // aud = https://self-issued.me/v2 per OID4VP spec (confirmed by playground reference JWT)
      const fiAud = 'https://self-issued.me/v2'
      const clientId = 'x509_san_dns:api.coffid.com'

      const { SignJWT, importPKCS8 } = await jose()
      const privateKey = await importPKCS8(privateKeyPem, 'ES256')

      // OID4VP spec : si le wallet envoie wallet_nonce, il DOIT être retourné dans le JWT
      const walletNonce = req.body?.wallet_nonce || null

      const jwtPayload = {
        response_type: 'vp_token',
        response_mode: 'direct_post.jwt',
        response_uri: process.env.RESPONSE_URI_OVERRIDE || `${apiBase}/api/vp/response/${taskId}`,
        client_id: clientId,
        nonce,
        state,
      }
      if (walletNonce) jwtPayload.wallet_nonce = walletNonce

      const jwt = await new SignJWT({
        ...jwtPayload,
        client_metadata: {
          jwks: { keys: [encPubKeyJwk] },
          encrypted_response_enc_values_supported: ['A128GCM', 'A256GCM'],
          authorization_encrypted_response_alg: 'ECDH-ES',
          authorization_encrypted_response_enc: 'A256GCM',
          vp_formats_supported: {
            mso_mdoc: {
              issuerauth_alg_values: [-7, -35, -36, -9],
              deviceauth_alg_values: [-7, -35, -36, -9],
            },
          },
        },
        dcql_query: buildDcqlQuery(pidAttributes),
      })
        // typ: 'oauth-authz-req+jwt' required by OID4VP spec (confirmed by playground reference)
        .setProtectedHeader({ alg: 'ES256', typ: 'oauth-authz-req+jwt', x5c })
        .setIssuer(clientId)
        .setAudience(fiAud)
        .setIssuedAt()
        .setExpirationTime('5m')
        .sign(privateKey)

      console.log(`✅ Request Object JWT généré — taskId: ${taskId}, attrs: ${pidAttributes.join(',')}`)

      res.set('Content-Type', 'application/oauth-authz-req+jwt')
      return res.status(200).send(jwt)

    } catch (error) {
      console.error('❌ getVPRequestObject error:', error)
      return res.status(500).json({ error: 'Internal server error' })
    }
  }
)

module.exports = getVPRequestObject
