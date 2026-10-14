const { onRequest } = require('firebase-functions/v2/https')
const { getFirestore } = require('firebase-admin/firestore')
const { encode: cborEncode, decode: cborDecode } = require('cbor-x')
const crypto = require('node:crypto')
const { verifyMdoc } = require('./mdocVerifier')

// Origines autorisées — whitelist côté backend, l'origin est incluse dans le SessionTranscript
// donc une origin forgée invaliderait le déchiffrement HPKE
const ALLOWED_ORIGINS = ['https://api.coffid.com', 'https://coffid-2388b.web.app']

const { getHpkeSuite, toArrayBuffer } = require('./hpkeUtils')

/**
 * Reconstruit le SessionTranscript (ISO 18013-7 Annex C) et l'encode en CBOR.
 * Ce CBOR est passé comme paramètre `info` au déchiffrement HPKE.
 *
 * SessionTranscript = [null, null, ["dcapi", SHA256(CBOR([encryptionInfoB64, origin]))]]
 */
function buildHpkeInfo(encryptionInfoB64, origin) {
  const dcapiInfoCbor  = cborEncode([encryptionInfoB64, origin])
  const dcapiInfoHash  = crypto.createHash('sha256').update(dcapiInfoCbor).digest()
  return Buffer.from(cborEncode([null, null, ['dcapi', dcapiInfoHash]]))
}

/**
 * POST /api/vp/verify?taskId=xxx
 * Appelé par coffid-web après navigator.credentials.get() (chemin DC API — org-iso-mdoc).
 *
 * Body JSON : {
 *   response: string,   // base64url — CBOR EncryptedResponse ["dcapi", { enc, cipherText }]
 *   origin:  string,    // window.location.origin depuis le frontend
 * }
 *
 * Flow :
 *   1. Récupère clé privée HPKE + nonce depuis Firestore
 *   2. Reconstruit SessionTranscript → info HPKE
 *   3. Déchiffre via HPKE single-shot (DHKEM P-256 / HKDF-SHA256 / AES-128-GCM)
 *   4. Vérifie le mDoc (chaîne IACA + holder binding + claim)
 *   5. Met à jour Firestore → status completed ou failed
 */
const verifyVP = onRequest({ cors: true }, async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const taskId = req.query.taskId
  if (!taskId) return res.status(400).json({ error: 'Missing taskId' })

  const { response: responseB64, origin } = req.body || {}
  if (!responseB64) return res.status(400).json({ error: 'Missing response' })
  if (!origin)      return res.status(400).json({ error: 'Missing origin' })
  if (!ALLOWED_ORIGINS.includes(origin)) {
    console.error(`❌ verifyVP — origin non autorisée: ${origin}`)
    return res.status(400).json({ error: 'Invalid origin' })
  }

  try {
    const db = getFirestore()
    const taskSnap = await db.collection('pendingRequest').doc(taskId).get()
    if (!taskSnap.exists) return res.status(404).json({ error: 'Task not found' })

    const taskData = taskSnap.data()
    if (taskData.status !== 'pending') return res.status(409).json({ error: 'Task already processed' })

    const { vpNonce, hpkePrivKey, hpkeEncryptionInfo, vpThreshold } = taskData
    if (!vpNonce || !hpkePrivKey || !hpkeEncryptionInfo) {
      return res.status(400).json({ error: 'VP flow not initiated — call /api/vp/init first' })
    }

    // Décode EncryptedResponse CBOR : ["dcapi", { enc: bstr, cipherText: bstr }]
    let encryptedResponse
    try {
      encryptedResponse = cborDecode(Buffer.from(responseB64, 'base64url'))
    } catch {
      return res.status(400).json({ error: 'Invalid response encoding' })
    }

    if (!Array.isArray(encryptedResponse) || encryptedResponse[0] !== 'dcapi' || !encryptedResponse[1]) {
      return res.status(400).json({ error: 'Invalid EncryptedResponse format' })
    }
    const { enc, cipherText } = encryptedResponse[1]
    if (!enc || !cipherText) return res.status(400).json({ error: 'Missing enc or cipherText in response' })

    // Reconstruit HPKE info = CBOR(SessionTranscript) liant encryptionInfo + origin
    const info = buildHpkeInfo(hpkeEncryptionInfo, origin)

    // Déchiffrement HPKE single-shot (RFC 9180 — Base mode)
    const suite = await getHpkeSuite()
    const privKeyBytes = Buffer.from(hpkePrivKey, 'base64url')
    const recipientKey = await suite.kem.deserializePrivateKey(
      privKeyBytes.buffer.slice(privKeyBytes.byteOffset, privKeyBytes.byteOffset + privKeyBytes.byteLength)
    )

    let deviceResponseBytes
    try {
      const ctx = await suite.createRecipientContext({
        recipientKey,
        enc:  toArrayBuffer(enc),
        info: toArrayBuffer(info),
      })
      const plaintext = await ctx.open(toArrayBuffer(cipherText))
      deviceResponseBytes = Buffer.from(plaintext)
    } catch (e) {
      console.error('❌ verifyVP — HPKE decryption failed:', e.message)
      return res.status(400).json({ error: 'Decryption failed — invalid or tampered response' })
    }

    // Vérification mDoc : chaîne IACA + valueDigests + holder binding + extraction claim
    // info = CBOR(SessionTranscript) — utilisé à la fois pour HPKE et pour DeviceAuthentication
    const { verified, ageVerified } = await verifyMdoc(deviceResponseBytes, vpThreshold, info)

    if (!verified || !ageVerified) {
      console.error(`❌ verifyVP — mDoc verification failed — taskId: ${taskId}`)
      await db.collection('pendingRequest').doc(taskId).update({
        status: 'failed',
        verificationMethod: 'france_identite',
        vpNonce: null,
        failedAt: new Date(),
      })
      return res.status(400).json({ error: 'Age verification failed' })
    }

    const result = {
      ageVerified: true,
      age: null,
      ageOver18: true, // age_over_21 implique age_over_18
      ...(vpThreshold === 'age_over_21' ? { ageOver21: true } : {}),
      verificationMethod: 'france_identite',
    }

    await db.collection('pendingRequest').doc(taskId).update({
      status: 'completed',
      verificationMethod: 'france_identite',
      ageVerified: true,
      result,
      vpNonce: null, // nonce consommé — empêche le rejeu
      completedAt: new Date(),
    })

    console.log(`✅ verifyVP — taskId: ${taskId}, threshold: ${vpThreshold}`)
    return res.status(200).json({ ok: true })

  } catch (err) {
    console.error('❌ verifyVP error:', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
})

module.exports = verifyVP
