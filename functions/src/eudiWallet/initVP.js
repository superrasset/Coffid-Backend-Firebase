const { onRequest } = require('firebase-functions/v2/https')
const { getFirestore } = require('firebase-admin/firestore')
const { encode: cborEncode, addExtension } = require('cbor-x')
const crypto = require('node:crypto')

// CBOR tag 24 = "embedded CBOR" (bstr containing CBOR bytes) — ISO 18013-5 DeviceRequest
class EmbeddedCbor {
  constructor(bytes) { this.bytes = bytes }
}
addExtension({
  Class: EmbeddedCbor,
  tag: 24,
  encode(instance, encodeItem) { encodeItem(instance.bytes) },
  decode(data)                 { return data },
})

const { getHpkeSuite } = require('./hpkeUtils')
const { resolveEudiThreshold } = require('./eudiMapping')

/**
 * POST /api/vp/init?taskId=xxx
 * Appelé par coffid-web (chemin DC API — navigator.credentials.get / org-iso-mdoc).
 * Génère une paire de clés HPKE éphémère P-256, construit DeviceRequest + encryptionInfo CBOR,
 * stocke la clé privée + nonce en Firestore et retourne les deux blobs base64url au frontend.
 */
const initVP = onRequest({ cors: true }, async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const taskId = req.query.taskId
  if (!taskId) return res.status(400).json({ error: 'Missing taskId' })

  try {
    const db = getFirestore()
    const taskSnap = await db.collection('pendingRequest').doc(taskId).get()
    if (!taskSnap.exists) return res.status(404).json({ error: 'Task not found' })

    const taskData = taskSnap.data()
    if (taskData.status !== 'pending') return res.status(409).json({ error: 'Task already processed' })

    const threshold = resolveEudiThreshold(taskData.infoRequired)
    if (!threshold) return res.status(400).json({ error: 'Task not eligible for EU Wallet verification' })

    // Paire de clés HPKE éphémère — une par transaction, jamais réutilisée
    const suite = await getHpkeSuite()
    const rkp = await suite.kem.generateKeyPair()
    const pubKeyBytes = Buffer.from(await suite.kem.serializePublicKey(rkp.publicKey))   // 65 bytes, non-compressé
    const privKeyB64  = Buffer.from(await suite.kem.serializePrivateKey(rkp.privateKey)).toString('base64url') // 32 bytes

    const nonce = crypto.randomBytes(32).toString('base64url')

    // DeviceRequest CBOR (ISO 18013-5)
    // itemsRequest = CBOR tag 24 (bstr .cbor — embedded CBOR)
    const itemsRequestInner = cborEncode({
      docType: 'eu.europa.ec.av.1',
      nameSpaces: { 'eu.europa.ec.av.1': { [threshold]: false } }, // intent_to_retain = false
    })
    const deviceRequestCbor = cborEncode({
      version: '1.0',
      docRequests: [{ itemsRequest: new EmbeddedCbor(itemsRequestInner) }],
    })

    // encryptionInfo CBOR (ISO 18013-7 Annex C)
    const encryptionInfoCbor = cborEncode({
      algorithm: 'HPKE-v1-Base-SHA256-P256-SHA256-AES128GCM',
      recipientPublicKey: pubKeyBytes,
    })

    const deviceRequestB64    = deviceRequestCbor.toString('base64url')
    const encryptionInfoB64   = encryptionInfoCbor.toString('base64url')

    await db.collection('pendingRequest').doc(taskId).update({
      vpNonce:            nonce,
      vpThreshold:        threshold,
      hpkePrivKey:        privKeyB64,
      hpkeEncryptionInfo: encryptionInfoB64,
      vpInitiatedAt:      new Date(),
    })

    console.log(`✅ initVP — taskId: ${taskId}, threshold: ${threshold}`)
    return res.status(200).json({ deviceRequest: deviceRequestB64, encryptionInfo: encryptionInfoB64 })

  } catch (err) {
    console.error('❌ initVP error:', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
})

module.exports = initVP
