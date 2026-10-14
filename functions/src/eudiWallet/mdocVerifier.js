// mDoc / ISO 18013-5 verification — EU Age Verification credential (eu.europa.ec.av.1)

const { decode: cborDecode, encode: cborEncode, Tag: CborTag } = require('cbor-x')
const crypto = require('node:crypto')

// Certificats IACA France Identité (autorités de certification publiques, non-secrets)
const IACA_PREPROD_PEM = `-----BEGIN CERTIFICATE-----
MIIDUzCCAvmgAwIBAgISESHtNjf+2KAQ0ttWtR9EhAAPMAoGCCqGSM49BAMCMIHF
MQswCQYDVQQGEwJGUjEwMC4GA1UECgwnQWdlbmNlIE5hdGlvbmFsZSBkZXMgVGl0
cmVzIFPDqWN1cmlzw6lzMRcwFQYDVQQLDA4wMDAyIDEzMDAwMzI2MjEmMCQGA1UE
CwwdUE9VUiBRVUFMSUZJQ0FUSU9OIFVOSVFVRU1FTlQxNzA1BgNVBAMMLkF1dG9y
aXTDqSBkZSBDZXJ0aWZpY2F0aW9uIEZyYW5jZSBBdHRlc3RhdGlvbnMxCjAIBgNV
BAUTATEwHhcNMjUwMTI5MDAwMDAwWhcNMzAwMTI5MDAwMDAwWjCBxTELMAkGA1UE
BhMCRlIxMDAuBgNVBAoMJ0FnZW5jZSBOYXRpb25hbGUgZGVzIFRpdHJlcyBTw6lj
dXJpc8OpczEXMBUGA1UECwwOMDAwMiAxMzAwMDMyNjIxJjAkBgNVBAsMHVBPVVIg
UVVBTElGSUNBVElPTiBVTklRVUVNRU5UMTcwNQYDVQQDDC5BdXRvcml0w6kgZGUg
Q2VydGlmaWNhdGlvbiBGcmFuY2UgQXR0ZXN0YXRpb25zMQowCAYDVQQFEwExMFkw
EwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEoCYCM9LYS8zUk8I1xL2B2G9voa4yFsko
qohrsEQkpNEeKb59J3VDHausTqFWCOfwEGUzi6yocLIbE+gfz59pnaOBxjCBwzAO
BgNVHQ8BAf8EBAMCAQYwMAYDVR0SBCkwJ4ElZnJhbmNlLWF0dGVzdGF0aW9uc0Bp
bnRlcmlldXIuZ291di5mcjASBgNVHRMBAf8ECDAGAQH/AgEAMEwGA1UdHwRFMEMw
QaA/oD2GO2h0dHA6Ly9jcmwucXVhbGlmLmFudHMuZ291di5mci9hY19mcmFuY2Vf
YXR0ZXN0YXRpb25zXzEuY3JsMB0GA1UdDgQWBBR3bIy6PB3fPAlYHOvqk7nftps4
sDAKBggqhkjOPQQDAgNIADBFAiBrI2HGG1SZNRfEoaIwk3bjAjLBcE9tcKPi1gu0
oah58AIhAL+KWRF8FwT4JBblyZdmuoVVXJ36LMmAUcs5YwJpMiQW
-----END CERTIFICATE-----`

const IACA_PROD_PEM = `-----BEGIN CERTIFICATE-----
MIIDLTCCAtKgAwIBAgISESEFJUbpBJovlg7lg3Eb5YTCMAoGCCqGSM49BAMCMIGi
MQswCQYDVQQGEwJGUjEwMC4GA1UECgwnQWdlbmNlIE5hdGlvbmFsZSBkZXMgVGl0
cmVzIFPDqWN1cmlzw6lzMRcwFQYDVQQLDA4wMDAyIDEzMDAwMzI2MjE8MDoGA1UE
AwwzQXV0b3JpdMOpIGRlIENlcnRpZmljYXRpb24gRnJhbmNlIEF0dGVzdGF0aW9u
cyBJQUNBMQowCAYDVQQFEwExMB4XDTI1MTAxNzAwMDAwMFoXDTM0MTAxNzAwMDAw
MFowgaIxCzAJBgNVBAYTAkZSMTAwLgYDVQQKDCdBZ2VuY2UgTmF0aW9uYWxlIGRl
cyBUaXRyZXMgU8OpY3VyaXPDqXMxFzAVBgNVBAsMDjAwMDIgMTMwMDAzMjYyMTww
OgYDVQQDDDNBdXRvcml0w6kgZGUgQ2VydGlmaWNhdGlvbiBGcmFuY2UgQXR0ZXN0
YXRpb25zIElBQ0ExCjAIBgNVBAUTATEwWTATBgcqhkjOPQIBBggqhkjOPQMBBwNC
AASa4ZI0w4Mn4FW6kYdKPUlYYgVbwFf1A6lBDnurRsoPJxM3+dVupbkGl9O+QnJ3
6wc8ngoXE3oH1hP11flDmWsIo4HlMIHiMA4GA1UdDwEB/wQEAwIBBjASBgNVHRMB
Af8ECDAGAQH/AgEAMDAGA1UdEgQpMCeBJWZyYW5jZS1hdHRlc3RhdGlvbnNAaW50
ZXJpZXVyLmdvdXYuZnIwSgYDVR0fBEMwQTA/oD2gO4Y5aHR0cDovL2NybC5hbnRz
LmdvdXYuZnIvYWNfZnJhbmNlX2F0dGVzdGF0aW9uc19pYWNhXzEuY3JsMB0GA1Ud
DgQWBBT/dscZoX+tou0+F2dDsFrTPfsMpzAfBgNVHSMEGDAWgBT/dscZoX+tou0+
F2dDsFrTPfsMpzAKBggqhkjOPQQDAgNJADBGAiEAmMD8Kpgnctmx12gCBYrj98kn
oKDSPlO5SucThy1EEqwCIQDsYM80Ere4Yw0fHNJQQHl6D1rAITDV3qFKP62Uq7xt
sQ==
-----END CERTIFICATE-----`

// Mapping COSE alg → hash Node.js + format signature
const COSE_ALG_MAP = {
  [-7]:  { hash: 'SHA256', encoding: 'ieee-p1363' }, // ES256 P-256
  [-35]: { hash: 'SHA384', encoding: 'ieee-p1363' }, // ES384 P-384
  [-36]: { hash: 'SHA512', encoding: 'ieee-p1363' }, // ES512 P-521
}

// DER prefix pour clé publique P-256 non-compressée (SubjectPublicKeyInfo)
const P256_SPKI_PREFIX = Buffer.from(
  '3059301306072a8648ce3d020106082a8648ce3d030107034200',
  'hex'
)

/**
 * Vérifie une COSE_Sign1 ([protectedBstr, unprotectedMap, payload, signature]) contre
 * une liste de clés publiques candidates (IACA ou leaf cert extrait du x5chain).
 * externalPayload est utilisé quand le payload COSE est null (détaché).
 */
function verifyCoseSign1(coseSign1, candidateKeys, externalPayload = null) {
  let arr = coseSign1
  if (arr && typeof arr === 'object' && 'value' in arr) arr = arr.value
  if (!Array.isArray(arr) || arr.length < 4) return false

  const [protectedBstr, , payload, signature] = arr

  let protectedHeader = {}
  try {
    protectedHeader = cborDecode(protectedBstr)
  } catch { /* fallback ES256 */ }

  const alg = protectedHeader[1] ?? -7
  const { hash = 'SHA256', encoding = 'ieee-p1363' } = COSE_ALG_MAP[alg] ?? {}

  const effectivePayload = externalPayload ?? payload
  const sigStructure = cborEncode(['Signature1', protectedBstr, Buffer.alloc(0), effectivePayload])
  const sig = Buffer.isBuffer(signature) ? signature : Buffer.from(signature)

  for (const key of candidateKeys) {
    try {
      const valid = crypto.verify(hash, sigStructure, { key, dsaEncoding: encoding }, sig)
      if (valid) return true
    } catch { /* mauvaise clé ou algo incompatible */ }
  }
  return false
}

/**
 * Résout les clés de vérification pour un COSE_Sign1 d'issuerAuth.
 * Si le header non-protégé contient un x5chain (label 33), extrait la clé du leaf cert
 * et vérifie que ce cert est signé par l'une des IACA connues.
 */
function resolveIssuerKeys(coseSign1, iacaPublicKeys) {
  let arr = coseSign1
  if (arr && typeof arr === 'object' && 'value' in arr) arr = arr.value
  if (!Array.isArray(arr) || arr.length < 4) return iacaPublicKeys

  const [, unprotectedHeader] = arr
  const x5chain = unprotectedHeader?.[33]
  if (!x5chain) return iacaPublicKeys

  const certDerList = Array.isArray(x5chain) ? x5chain : [x5chain]
  const leafDer = Buffer.isBuffer(certDerList[0]) ? certDerList[0] : Buffer.from(certDerList[0])

  let leafCert
  try {
    leafCert = new crypto.X509Certificate(leafDer)
  } catch (e) {
    console.warn('⚠️ Impossible de parser le leaf cert x5chain:', e.message)
    return iacaPublicKeys
  }

  const issuedByKnownIaca = iacaPublicKeys.some(iacaKey => {
    try { return leafCert.verify(iacaKey) } catch { return false }
  })

  if (!issuedByKnownIaca) {
    console.error('❌ Leaf cert non signé par une IACA France Identité connue')
    return []
  }

  return [leafCert.publicKey]
}

/**
 * Extrait le MSO (Mobile Security Object) depuis le payload de l'issuerAuth COSE_Sign1.
 */
function extractMso(coseSign1) {
  let arr = coseSign1
  if (arr && typeof arr === 'object' && 'value' in arr) arr = arr.value
  if (!Array.isArray(arr) || arr.length < 4) return null
  const payload = arr[2]
  if (!payload) return null
  try {
    const buf = Buffer.isBuffer(payload) ? payload : Buffer.from(payload)
    return cborDecode(buf)
  } catch {
    return null
  }
}

/**
 * Normalise un IssuerSignedItemBytes (CBOR tag 24) en ses deux formes utiles :
 *  - innerBytes : bytes CBOR de l'IssuerSignedItem (pour décodage du claim)
 *  - tag24Bytes : bytes CBOR complets incluant le tag 24 (pour hachage valueDigest)
 *
 * cbor-x retourne tag 24 comme Tag { tag: 24, value: Buffer } sans extension configurée.
 */
function unwrapTag24(encodedItem) {
  if (encodedItem instanceof CborTag && encodedItem.tag === 24) {
    const inner = encodedItem.value
    const innerBytes = Buffer.isBuffer(inner) ? inner : Buffer.from(inner)
    const tag24Bytes = cborEncode(new CborTag(innerBytes, 24))
    return { innerBytes, tag24Bytes }
  }
  // Fallback : buffer brut (inner bytes sans wrapper tag 24)
  if (Buffer.isBuffer(encodedItem) || encodedItem instanceof Uint8Array) {
    const innerBytes = Buffer.from(encodedItem)
    const tag24Bytes = cborEncode(new CborTag(innerBytes, 24))
    return { innerBytes, tag24Bytes }
  }
  // Dernier recours : objet déjà décodé — ré-encode
  const innerBytes = cborEncode(encodedItem)
  const tag24Bytes = cborEncode(new CborTag(innerBytes, 24))
  return { innerBytes, tag24Bytes }
}

/**
 * Vérifie que chaque IssuerSignedItem correspond au valueDigest signé dans le MSO.
 * Protège contre la modification d'un élément (ex: age_over_18: false → true)
 * après signature de l'IssuerAuth par l'IACA.
 */
function verifyValueDigests(items, nameSpace, mso) {
  const digestAlg = mso?.digestAlgorithm
  if (!digestAlg) {
    console.error('❌ MSO: digestAlgorithm absent')
    return false
  }

  const nodeHashAlg = digestAlg === 'SHA-256' ? 'sha256'
    : digestAlg === 'SHA-384' ? 'sha384'
    : 'sha512'

  const nsDigests = mso?.valueDigests?.[nameSpace]
  if (!nsDigests) {
    console.error(`❌ MSO: valueDigests absent pour le namespace ${nameSpace}`)
    return false
  }

  for (const encodedItem of items) {
    const { innerBytes, tag24Bytes } = unwrapTag24(encodedItem)

    let item
    try {
      item = cborDecode(innerBytes)
    } catch {
      console.error('❌ valueDigests: impossible de décoder un IssuerSignedItem')
      return false
    }

    const digestID = item?.digestID
    if (digestID === undefined || digestID === null) {
      console.error('❌ valueDigests: digestID absent dans IssuerSignedItem')
      return false
    }

    const expectedDigest = nsDigests[digestID]
    if (!expectedDigest) {
      console.error(`❌ valueDigests: digestID ${digestID} absent dans le MSO`)
      return false
    }

    const actualDigest = crypto.createHash(nodeHashAlg).update(tag24Bytes).digest()
    const expectedBuf = Buffer.isBuffer(expectedDigest) ? expectedDigest : Buffer.from(expectedDigest)

    if (!crypto.timingSafeEqual(actualDigest, expectedBuf)) {
      console.error(`❌ valueDigests: digest incorrect pour digestID ${digestID} (${item.elementIdentifier})`)
      return false
    }
  }

  return true
}

/**
 * Extrait la clé publique P-256 du device depuis MSO.deviceKeyInfo.deviceKey (COSE_Key).
 */
function extractDevicePublicKey(mso) {
  const deviceKey = mso?.deviceKeyInfo?.deviceKey
  if (!deviceKey) return null
  try {
    const kty = deviceKey[1]   // 2 = EC2
    const crv = deviceKey[-1]  // 1 = P-256
    const xRaw = deviceKey[-2]
    const yRaw = deviceKey[-3]
    if (kty !== 2 || crv !== 1 || !xRaw || !yRaw) return null
    const x = Buffer.isBuffer(xRaw) ? xRaw : Buffer.from(xRaw)
    const y = Buffer.isBuffer(yRaw) ? yRaw : Buffer.from(yRaw)
    // Construit SubjectPublicKeyInfo DER pour P-256 uncompressed (04 || x || y)
    const spkiDer = Buffer.concat([P256_SPKI_PREFIX, Buffer.from([0x04]), x, y])
    return crypto.createPublicKey({ key: spkiDer, format: 'der', type: 'spki' })
  } catch (e) {
    console.warn('⚠️ extractDevicePublicKey:', e.message)
    return null
  }
}

/**
 * Vérifie le holder binding (deviceSigned) via COSE_Sign1 sur DeviceAuthentication.
 *
 * DeviceAuthentication = ["DeviceAuthentication", SessionTranscript, docType, DeviceNameSpacesBytes]
 *
 * sessionTranscriptBytes : CBOR encodé du SessionTranscript (chemin DC API = info HPKE).
 * Pour le chemin OID4VP deeplink, passer null — la vérification sera ignorée.
 */
function verifyDeviceSignature(deviceSigned, docType, sessionTranscriptBytes, devicePublicKey) {
  if (!sessionTranscriptBytes || !devicePublicKey) return false

  const deviceSignature = deviceSigned?.deviceAuth?.deviceSignature
  if (!deviceSignature) {
    console.error('❌ deviceSigned: deviceSignature absent')
    return false
  }

  // DeviceNameSpacesBytes = tag 24 wrapping CBOR({}) pour AV (nameSpaces device vides)
  const ns = deviceSigned?.nameSpaces
  let deviceNameSpacesBstrBytes
  if (!ns) {
    deviceNameSpacesBstrBytes = cborEncode(new CborTag(cborEncode({}), 24))
  } else if (Buffer.isBuffer(ns) || ns instanceof Uint8Array) {
    deviceNameSpacesBstrBytes = cborEncode(new CborTag(Buffer.from(ns), 24))
  } else if (ns instanceof CborTag && ns.tag === 24) {
    deviceNameSpacesBstrBytes = cborEncode(ns)
  } else {
    deviceNameSpacesBstrBytes = cborEncode(new CborTag(cborEncode(ns), 24))
  }

  // SessionTranscript décodé pour inclusion dans DeviceAuthentication
  const sessionTranscript = cborDecode(sessionTranscriptBytes)

  // DeviceAuthentication CBOR (payload détaché du COSE_Sign1 deviceSignature)
  const deviceAuthenticationBytes = cborEncode([
    'DeviceAuthentication',
    sessionTranscript,
    docType,
    deviceNameSpacesBstrBytes,
  ])

  return verifyCoseSign1(deviceSignature, [devicePublicKey], deviceAuthenticationBytes)
}

// Clés publiques IACA chargées une seule fois au démarrage de la fonction
const IACA_PUBLIC_KEYS = (() => {
  const keys = []
  for (const pem of [IACA_PREPROD_PEM, IACA_PROD_PEM]) {
    try {
      keys.push(new crypto.X509Certificate(pem).publicKey)
    } catch (e) {
      console.error('❌ Impossible de charger le certificat IACA:', e.message)
    }
  }
  return keys
})()

/**
 * Vérifie un DeviceResponse mDoc et extrait le claim d'âge.
 *
 * @param {Buffer} deviceResponseBuffer   CBOR brut du DeviceResponse
 * @param {string} threshold              'age_over_18' | 'age_over_21'
 * @param {Buffer|null} sessionTranscriptBytes  CBOR du SessionTranscript (chemin DC API).
 *                                        Null pour le chemin deeplink OID4VP —
 *                                        le holder binding sera alors ignoré.
 * @returns {{ verified: boolean, ageVerified: boolean }}
 */
async function verifyMdoc(deviceResponseBuffer, threshold, sessionTranscriptBytes = null) {
  try {
    const deviceResponse = cborDecode(deviceResponseBuffer)
    const doc = deviceResponse?.documents?.[0]
    if (!doc) {
      console.error('❌ mDoc: aucun document dans la DeviceResponse')
      return { verified: false, ageVerified: false }
    }

    const { issuerSigned, deviceSigned } = doc

    // 1. Vérification IssuerAuth (signature IACA sur le MSO)
    const issuerAuth = issuerSigned?.issuerAuth
    if (!issuerAuth) {
      console.error('❌ mDoc: issuerAuth absent')
      return { verified: false, ageVerified: false }
    }

    const issuerKeys = resolveIssuerKeys(issuerAuth, IACA_PUBLIC_KEYS)
    if (!verifyCoseSign1(issuerAuth, issuerKeys)) {
      console.error('❌ mDoc: signature IssuerAuth invalide')
      return { verified: false, ageVerified: false }
    }

    // 2. Extraction du MSO
    const mso = extractMso(issuerAuth)
    if (!mso) {
      console.error('❌ mDoc: impossible d\'extraire le MSO depuis issuerAuth')
      return { verified: false, ageVerified: false }
    }

    const nameSpace = 'eu.europa.ec.av.1'
    const avItems = issuerSigned?.nameSpaces?.[nameSpace]
    if (!avItems || !Array.isArray(avItems)) {
      console.error('❌ mDoc: namespace eu.europa.ec.av.1 absent')
      return { verified: false, ageVerified: false }
    }

    // 3. Vérification valueDigests — lie chaque élément à la signature IACA
    if (!verifyValueDigests(avItems, nameSpace, mso)) {
      console.error('❌ mDoc: échec vérification valueDigests')
      return { verified: false, ageVerified: false }
    }

    // 4. Holder binding (deviceSigned) — chemin DC API uniquement
    if (sessionTranscriptBytes) {
      const devicePublicKey = extractDevicePublicKey(mso)
      const docType = doc?.docType ?? nameSpace
      if (!verifyDeviceSignature(deviceSigned, docType, sessionTranscriptBytes, devicePublicKey)) {
        console.error('❌ mDoc: holder binding (deviceSigned) invalide')
        return { verified: false, ageVerified: false }
      }
      console.log('✅ mDoc: holder binding OK')
    } else {
      console.warn('⚠️ mDoc: holder binding ignoré — SessionTranscript non fourni (chemin deeplink OID4VP)')
    }

    // 5. Extraction du claim d'âge
    for (const encodedItem of avItems) {
      const { innerBytes } = unwrapTag24(encodedItem)
      let item
      try { item = cborDecode(innerBytes) } catch { continue }
      if (item?.elementIdentifier === threshold && item?.elementValue === true) {
        console.log(`✅ mDoc: ${threshold} = true — IssuerAuth OK, valueDigests OK`)
        return { verified: true, ageVerified: true }
      }
    }

    console.warn(`⚠️ mDoc: claim ${threshold} absent ou false dans la réponse`)
    return { verified: true, ageVerified: false }

  } catch (error) {
    console.error('❌ mDoc parsing/verification error:', error.message)
    return { verified: false, ageVerified: false }
  }
}

module.exports = { verifyMdoc }
