const { onRequest } = require('firebase-functions/v2/https')
const { defineSecret } = require('firebase-functions/params')
const { getFirestore } = require('firebase-admin/firestore')
const { verifyMdoc } = require('./mdocVerifier')

let _jose = null
async function jose() {
  if (!_jose) _jose = await import('jose')
  return _jose
}

const encryptionPrivateKey = defineSecret('COFFID_ENCRYPTION_PRIVATE_KEY')

/**
 * POST /api/vp/response/:taskId
 * Appelé par l'app France Identité après approbation utilisateur (fallback OID4VP iOS).
 * Body (application/x-www-form-urlencoded) : response=<JWE>
 *
 * Flow :
 *   1. Déchiffre le JWE (ECDH-ES + A256GCM) avec la clé privée COFFID
 *   2. Valide state (anti-CSRF) + nonce (anti-rejeu)
 *   3. Vérifie le mDoc (IACA chain + holder binding + claim)
 *   4. Met à jour pendingRequest en Firestore
 *
 * Variables d'environnement requises :
 *   COFFID_ENCRYPTION_PRIVATE_KEY — PEM clé privée EC P-256 (déchiffrement JWE)
 */
const handleVPResponse = onRequest({ cors: true, secrets: [encryptionPrivateKey] }, async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Extraire taskId depuis le path : /api/vp/response/{taskId}
  const taskId = req.path.split('/').filter(Boolean).pop()
  if (!taskId) return res.status(400).json({ error: 'Missing taskId in path' })

  console.log(`📋 handleVPResponse — taskId: ${taskId}`)

  try {
    const db = getFirestore()
    const taskSnap = await db.collection('pendingRequest').doc(taskId).get()

    if (!taskSnap.exists) return res.status(404).json({ error: 'Task not found' })

    const taskData = taskSnap.data()
    if (taskData.status !== 'pending') {
      return res.status(409).json({ error: 'Task already processed' })
    }
    if (!taskData.vpNonce || !taskData.vpState) {
      console.error(`❌ VP flow not initiated for taskId: ${taskId}`)
      return res.status(400).json({ error: 'VP flow not initiated' })
    }

    // Récupérer le JWE depuis le body
    // direct_post.jwt → form-urlencoded : { response: "<JWE>" }
    const jwe = req.body?.response || (typeof req.body === 'string' ? req.body : null)
    if (!jwe) {
      console.error('❌ Missing response in body')
      return res.status(400).json({ error: 'Missing response parameter' })
    }

    // 1. Déchiffrer le JWE
    const encPrivKeyPem = encryptionPrivateKey.value()
    if (!encPrivKeyPem) {
      console.error('❌ COFFID_ENCRYPTION_PRIVATE_KEY manquant')
      return res.status(500).json({ error: 'Encryption key not configured' })
    }

    const { compactDecrypt, importPKCS8 } = await jose()

    let decryptedPayload
    try {
      const encPrivKey = await importPKCS8(encPrivKeyPem, 'ECDH-ES')
      const { plaintext } = await compactDecrypt(jwe, encPrivKey)
      decryptedPayload = JSON.parse(new TextDecoder().decode(plaintext))
    } catch (e) {
      console.error('❌ JWE decryption failed:', e.message)
      return res.status(400).json({ error: 'Invalid or tampered response' })
    }

    // 2. Valider state (anti-CSRF)
    if (decryptedPayload.state !== taskData.vpState) {
      console.error(`❌ State mismatch pour taskId: ${taskId}`)
      return res.status(400).json({ error: 'Invalid state' })
    }

    // 3. Valider nonce (anti-rejeu) — le nonce du Request Object JWT doit être retourné dans le payload
    if (decryptedPayload.nonce !== taskData.vpNonce) {
      console.error(`❌ Nonce mismatch pour taskId: ${taskId}`)
      return res.status(400).json({ error: 'Invalid nonce' })
    }

    // 4. Vérifier le mDoc
    const vpToken = decryptedPayload.vp_token
    if (!vpToken) {
      console.error('❌ vp_token absent dans le payload déchiffré')
      return res.status(400).json({ error: 'Missing vp_token' })
    }

    const deviceResponseBuffer = Buffer.from(vpToken, 'base64url')
    // SessionTranscript null pour le chemin deeplink OID4VP — holder binding ignoré
    const { verified, ageVerified } = await verifyMdoc(
      deviceResponseBuffer,
      taskData.vpThreshold,
      null,
    )

    if (!verified || !ageVerified) {
      console.error(`❌ Vérification mDoc échouée — taskId: ${taskId}`)
      await db.collection('pendingRequest').doc(taskId).update({
        status: 'failed',
        verificationMethod: 'france_identite',
        vpNonce: null,
        failedAt: new Date(),
      })
      return res.status(400).json({ error: 'Age verification failed' })
    }

    // 5. Consommer le nonce + marquer completed
    const result = {
      ageVerified: true,
      age: null,
      ageOver18: true,
      ...(taskData.vpThreshold === 'age_over_21' ? { ageOver21: true } : {}),
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

    console.log(`✅ VP response vérifiée — taskId: ${taskId}, threshold: ${taskData.vpThreshold}`)
    return res.status(200).json({ ok: true })

  } catch (error) {
    console.error('❌ handleVPResponse error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
})

module.exports = handleVPResponse
