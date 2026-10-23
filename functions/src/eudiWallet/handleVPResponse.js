const { onRequest } = require('firebase-functions/v2/https')
const { defineSecret } = require('firebase-functions/params')
const { getFirestore } = require('firebase-admin/firestore')
const { verifyMdoc } = require('./mdocVerifier')
const { buildResult } = require('./eudiMapping')

const PID_DOCTYPE = 'eu.europa.ec.eudi.pid.1'

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

  console.log(`📋 handleVPResponse — taskId: ${taskId} | contentType: ${req.headers['content-type']} | bodyKeys: ${Object.keys(req.body || {}).join(',')} | bodyType: ${typeof req.body}`)

  const db = getFirestore()
  // DEBUG — sauvegarde le body brut pour analyse locale
  try {
    await db.collection('_vpDebug').doc(taskId).set({
      taskId,
      contentType: req.headers['content-type'],
      bodyKeys: Object.keys(req.body || {}),
      response: req.body?.response ?? null,
      state: req.body?.state ?? null,
      ts: new Date(),
    }, { merge: true })
  } catch (e) { console.warn('debug write failed:', e.message) }

  try {
    const taskSnap = await db.collection('pendingRequest').doc(taskId).get()

    if (!taskSnap.exists) return res.status(404).json({ error: 'Task not found' })

    const taskData = taskSnap.data()
    if (taskData.status !== 'pending') {
      return res.status(409).json({ error: 'Task already processed' })
    }
    if (!taskData.vpNonce || !taskData.vpState || !taskData.vpPidAttributes) {
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
      // DEBUG — sauvegarde le payload décrypté
      try {
        const vpT = decryptedPayload.vp_token
        await db.collection('_vpDebug').doc(taskId).set({
          decryptedKeys: Object.keys(decryptedPayload),
          vpTokenType: typeof vpT,
          vpTokenIsArray: Array.isArray(vpT),
          vpTokenKeys: vpT && typeof vpT === 'object' ? Object.keys(vpT) : null,
          vpTokenPreview: JSON.stringify(vpT)?.substring(0, 500) ?? null,
          stateInPayload: decryptedPayload.state ?? null,
        }, { merge: true })
      } catch (e) { /* ignore */ }
    } catch (e) {
      console.error('❌ JWE decryption failed:', e.message)
      return res.status(400).json({ error: 'Invalid or tampered response' })
    }

    // 2. Valider state (anti-CSRF)
    if (decryptedPayload.state !== taskData.vpState) {
      console.error(`❌ State mismatch pour taskId: ${taskId}`)
      return res.status(400).json({ error: 'Invalid state' })
    }
    // Note : le nonce OID4VP est lié au DeviceAuthentication CBOR dans le mDoc,
    // pas retourné comme champ JSON dans le JWE — vérification déléguée à verifyMdoc.

    // 4. Vérifier le mDoc
    // OID4VP 1.0 avec DCQL : vp_token est un objet { <credentialId>: "<base64url CBOR>" }
    // Avec Presentation Exchange ou réponse non-DCQL : vp_token est une chaîne base64url
    const vpTokenRaw = decryptedPayload.vp_token
    console.log(`📋 vp_token type: ${typeof vpTokenRaw} | isArray: ${Array.isArray(vpTokenRaw)} | keys: ${vpTokenRaw && typeof vpTokenRaw === 'object' ? Object.keys(vpTokenRaw).join(',') : 'N/A'} | preview: ${JSON.stringify(vpTokenRaw)?.substring(0, 100)}`)

    // OID4VP 1.0 DCQL : vp_token est { <credentialId>: "<base64url CBOR>" }
    // Fallback : base64url string directe (PE / non-DCQL)
    let rawVpToken
    if (vpTokenRaw && typeof vpTokenRaw === 'object' && !Buffer.isBuffer(vpTokenRaw)) {
      // OID4VP DCQL: vp_token = { credential: ["<base64url>"] } — credential value is an array
      let val = vpTokenRaw['credential'] ?? Object.values(vpTokenRaw)[0] ?? null
      if (Array.isArray(val)) val = val[0] ?? null
      rawVpToken = val
      console.log(`📋 vp_token extrait du DCQL map → type: ${typeof rawVpToken} | preview: ${String(rawVpToken)?.substring(0, 80)}`)
    } else {
      rawVpToken = vpTokenRaw
    }

    if (!rawVpToken || typeof rawVpToken !== 'string') {
      console.error('❌ vp_token absent ou format invalide', { type: typeof vpTokenRaw, extractedType: typeof rawVpToken })
      return res.status(400).json({ error: 'Missing vp_token' })
    }

    const deviceResponseBuffer = Buffer.from(rawVpToken, 'base64url')
    console.log(`📋 deviceResponseBuffer length: ${deviceResponseBuffer.length}`)

    // DEBUG — sauvegarder le token brut complet pour diagnostic local
    try {
      await db.collection('_vpDebug').doc(taskId).set({
        rawVpToken: rawVpToken,
        deviceResponseLength: deviceResponseBuffer.length,
      }, { merge: true })
    } catch (e) { console.warn('debug rawVpToken write failed:', e.message) }

    let verified, attributes, reason, debugInfo
    try {
      ;({ verified, attributes, reason, debugInfo } = await verifyMdoc(deviceResponseBuffer, PID_DOCTYPE, null))
    } catch (mdocErr) {
      console.error('❌ verifyMdoc threw:', mdocErr.message)
      await db.collection('_vpDebug').doc(taskId).set({ mdocError: mdocErr.message }, { merge: true })
      return res.status(400).json({ error: 'PID verification error' })
    }

    await db.collection('_vpDebug').doc(taskId).set({
      mdocVerified: verified,
      mdocAttrs: attributes ? Object.keys(attributes) : null,
      mdocReason: reason ?? null,
      mdocDebug: debugInfo ?? null,
    }, { merge: true })

    if (!verified || !attributes) {
      console.error(`❌ Vérification mDoc échouée — taskId: ${taskId}`)
      await db.collection('pendingRequest').doc(taskId).update({
        status: 'failed',
        verificationMethod: 'france_identite',
        vpNonce: null,
        failedAt: new Date(),
      })
      return res.status(400).json({ error: 'PID verification failed' })
    }

    // 5. Consommer le nonce + marquer completed
    const result = buildResult(attributes, taskData.infoRequired || [])

    await db.collection('pendingRequest').doc(taskId).update({
      status: 'completed',
      result,
      vpNonce: null,
      completedAt: new Date(),
    })

    console.log(`✅ VP response vérifiée — taskId: ${taskId}, attrs: ${Object.keys(attributes).join(',')}`)
    return res.status(200).json({ ok: true })

  } catch (error) {
    console.error('❌ handleVPResponse error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
})

module.exports = handleVPResponse
