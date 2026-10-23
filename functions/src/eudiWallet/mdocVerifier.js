// mDoc / ISO 18013-5 verification — EUDI PID (eu.europa.ec.eudi.pid.1)

const { decode: cborDecode, encode: cborEncode, Tag: CborTag } = require('cbor-x')
const crypto = require('node:crypto')

// ── Certificats IACA France Identité (publics, non-secrets) ─────────────────
//
// EAA / AV (eu.europa.ec.av.1) — conservés ici pour réactivation future
// const IACA_EAA_PREPROD_PEM = `-----BEGIN CERTIFICATE-----
// MIIDUzCCAvmgAwIBAgISESHtNjf+2KAQ0ttWtR9EhAAPMAoGCCqGSM49BAMCMIHF
// ...
// -----END CERTIFICATE-----`
//
// Réactiver : ajouter IACA_EAA_PREPROD_PEM dans IACA_PUBLIC_KEYS
// et passer docType = 'eu.europa.ec.av.1' à verifyMdoc()

// PID (eu.europa.ec.eudi.pid.1) — pre-prod/Partenaires
const IACA_PID_PREPROD_PEM = `-----BEGIN CERTIFICATE-----
MIIDdjCCAxugAwIBAgISESHseuWkt7eIRNVD2TUo+Bu2MAoGCCqGSM49BAMCMIHH
MQswCQYDVQQGEwJGUjEwMC4GA1UECgwnQWdlbmNlIE5hdGlvbmFsZSBkZXMgVGl0
cmVzIFPDqWN1cmlzw6lzMRcwFQYDVQQLDA4wMDAyIDEzMDAwMzI2MjEmMCQGA1UE
CwwdUE9VUiBRVUFMSUZJQ0FUSU9OIFVOSVFVRU1FTlQxOTA3BgNVBAMMMEF1dG9y
aXTDqSBkZSBDZXJ0aWZpY2F0aW9uIEZyYW5jZSBJZGVudGl0w6kgSUFDQTEKMAgG
A1UEBRMBMTAeFw0yNTAxMjkwMDAwMDBaFw0zNDAxMjkwMDAwMDBaMIHHMQswCQYD
VQQGEwJGUjEwMC4GA1UECgwnQWdlbmNlIE5hdGlvbmFsZSBkZXMgVGl0cmVzIFPD
qWN1cmlzw6lzMRcwFQYDVQQLDA4wMDAyIDEzMDAwMzI2MjEmMCQGA1UECwwdUE9V
UiBRVUFMSUZJQ0FUSU9OIFVOSVFVRU1FTlQxOTA3BgNVBAMMMEF1dG9yaXTDqSBk
ZSBDZXJ0aWZpY2F0aW9uIEZyYW5jZSBJZGVudGl0w6kgSUFDQTEKMAgGA1UEBRMB
MTBZMBMGByqGSM49AgEGCCqGSM49AwEHA0IABEWDSW7a1G6Ebbydwncvqx1JXjcL
p0Uk/OKc5IWXEJCiejLWd3brmKVIrnJNi3GtLPOsokA7Y8I0XJpqQrROvYSjgeQw
geEwDgYDVR0PAQH/BAQDAgEGMBIGA1UdEwEB/wQIMAYBAf8CAQAwLAYDVR0SBCUw
I4EhZnJhbmNlLWlkZW50aXRlQGludGVyaWV1ci5nb3V2LmZyME0GA1UdHwRGMEQw
QqBAoD6GPGh0dHA6Ly9jcmwucXVhbGlmLmFudHMuZ291di5mci9hY19mcmFuY2Vf
aWRlbnRpdGVfaWFjYV8xLmNybDAdBgNVHQ4EFgQU6qGsPka6CBXTy3qGlF/2yRr2
8aUwHwYDVR0jBBgwFoAU6qGsPka6CBXTy3qGlF/2yRr28aUwCgYIKoZIzj0EAwID
SQAwRgIhAIWippsk9geJFGe/WInhC6IQpWgBfscynyMb4B2fKcbXAiEA9CFvazbn
ATTWeV9JY4z4xiazYY5QeBH8Ug8RmFU0zVM=
-----END CERTIFICATE-----`

// PID — production
const IACA_PID_PROD_PEM = `-----BEGIN CERTIFICATE-----
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

function verifyCoseSign1(coseSign1, candidateKeys, externalPayload = null) {
  let arr = coseSign1
  if (arr && typeof arr === 'object' && 'value' in arr) arr = arr.value
  if (!Array.isArray(arr) || arr.length < 4) return false

  const [protectedBstr, , payload, signature] = arr

  let protectedHeader = {}
  try { protectedHeader = cborDecode(protectedBstr) } catch { /* fallback ES256 */ }

  const alg = protectedHeader[1] ?? -7
  const { hash = 'SHA256', encoding = 'ieee-p1363' } = COSE_ALG_MAP[alg] ?? {}

  const effectivePayload = externalPayload ?? payload
  const sigStructure = cborEncode(['Signature1', protectedBstr, Buffer.alloc(0), effectivePayload])
  const sig = Buffer.isBuffer(signature) ? signature : Buffer.from(signature)

  for (const key of candidateKeys) {
    try {
      if (crypto.verify(hash, sigStructure, { key, dsaEncoding: encoding }, sig)) return true
    } catch { /* mauvaise clé */ }
  }
  return false
}

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

function extractMso(coseSign1) {
  let arr = coseSign1
  if (arr && typeof arr === 'object' && 'value' in arr) arr = arr.value
  if (!Array.isArray(arr) || arr.length < 4) return null
  const payload = arr[2]
  if (!payload) return null
  try {
    const decoded = cborDecode(Buffer.isBuffer(payload) ? payload : Buffer.from(payload))
    // MSO may be wrapped in CBOR Tag 24 (embedded CBOR bstr)
    if (decoded instanceof CborTag && decoded.tag === 24) {
      const inner = Buffer.isBuffer(decoded.value) ? decoded.value : Buffer.from(decoded.value)
      return cborDecode(inner)
    }
    // cbor-x may decode Tag 24 as plain object { tag, value }
    if (decoded && typeof decoded === 'object' && decoded.tag === 24 && decoded.value) {
      const inner = Buffer.isBuffer(decoded.value) ? decoded.value : Buffer.from(decoded.value)
      return cborDecode(inner)
    }
    return decoded
  } catch { return null }
}

function unwrapTag24(encodedItem) {
  if (encodedItem instanceof CborTag && encodedItem.tag === 24) {
    const inner = encodedItem.value
    const innerBytes = Buffer.isBuffer(inner) ? inner : Buffer.from(inner)
    return { innerBytes, tag24Bytes: cborEncode(new CborTag(innerBytes, 24)) }
  }
  if (Buffer.isBuffer(encodedItem) || encodedItem instanceof Uint8Array) {
    const innerBytes = Buffer.from(encodedItem)
    return { innerBytes, tag24Bytes: cborEncode(new CborTag(innerBytes, 24)) }
  }
  const innerBytes = cborEncode(encodedItem)
  return { innerBytes, tag24Bytes: cborEncode(new CborTag(innerBytes, 24)) }
}

function verifyValueDigests(items, nameSpace, mso) {
  const digestAlg = mso?.digestAlgorithm
  if (!digestAlg) { console.error('❌ MSO: digestAlgorithm absent'); return { ok: false, debug: { reason: 'no_digestAlgorithm' } } }

  const nodeHashAlg = digestAlg === 'SHA-256' ? 'sha256' : digestAlg === 'SHA-384' ? 'sha384' : 'sha512'
  const nsDigests = mso?.valueDigests?.[nameSpace]
  if (!nsDigests) { console.error(`❌ MSO: valueDigests absent pour ${nameSpace}`); return { ok: false, debug: { reason: 'no_nsDigests' } } }

  for (const encodedItem of items) {
    const { innerBytes, tag24Bytes } = unwrapTag24(encodedItem)
    let item
    try { item = cborDecode(innerBytes) } catch {
      console.error('❌ valueDigests: impossible de décoder un IssuerSignedItem')
      return { ok: false }
    }

    const digestID = item?.digestID
    if (digestID === undefined || digestID === null) {
      console.error('❌ valueDigests: digestID absent')
      return { ok: false }
    }

    // Accès avec clé numérique ET string (cbor-x peut retourner Map ou objet)
    let expectedDigest = nsDigests[digestID]
    if (!expectedDigest && nsDigests instanceof Map) expectedDigest = nsDigests.get(digestID)
    if (!expectedDigest && nsDigests instanceof Map) expectedDigest = nsDigests.get(String(digestID))
    if (!expectedDigest) expectedDigest = nsDigests[String(digestID)]

    if (!expectedDigest) { console.error(`❌ valueDigests: digestID ${digestID} absent du MSO`); return { ok: false } }

    const actualDigest = crypto.createHash(nodeHashAlg).update(tag24Bytes).digest()
    const expectedBuf = Buffer.isBuffer(expectedDigest) ? expectedDigest : Buffer.from(expectedDigest)
    if (!crypto.timingSafeEqual(actualDigest, expectedBuf)) {
      console.error(`❌ valueDigests: digest incorrect pour ${item.elementIdentifier}`)
      return { ok: false }
    }
  }
  return { ok: true }
}

function extractDevicePublicKey(mso) {
  const deviceKey = mso?.deviceKeyInfo?.deviceKey
  if (!deviceKey) return null
  try {
    const kty = deviceKey[1], crv = deviceKey[-1]
    const xRaw = deviceKey[-2], yRaw = deviceKey[-3]
    if (kty !== 2 || crv !== 1 || !xRaw || !yRaw) return null
    const x = Buffer.isBuffer(xRaw) ? xRaw : Buffer.from(xRaw)
    const y = Buffer.isBuffer(yRaw) ? yRaw : Buffer.from(yRaw)
    const spkiDer = Buffer.concat([P256_SPKI_PREFIX, Buffer.from([0x04]), x, y])
    return crypto.createPublicKey({ key: spkiDer, format: 'der', type: 'spki' })
  } catch (e) {
    console.warn('⚠️ extractDevicePublicKey:', e.message)
    return null
  }
}

function verifyDeviceSignature(deviceSigned, docType, sessionTranscriptBytes, devicePublicKey) {
  if (!sessionTranscriptBytes || !devicePublicKey) return false

  const deviceSignature = deviceSigned?.deviceAuth?.deviceSignature
  if (!deviceSignature) { console.error('❌ deviceSigned: deviceSignature absent'); return false }

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

  const sessionTranscript = cborDecode(sessionTranscriptBytes)
  const deviceAuthenticationBytes = cborEncode([
    'DeviceAuthentication', sessionTranscript, docType, deviceNameSpacesBstrBytes,
  ])
  return verifyCoseSign1(deviceSignature, [devicePublicKey], deviceAuthenticationBytes)
}

// Clés IACA chargées au démarrage
const IACA_PUBLIC_KEYS = (() => {
  const keys = []
  for (const pem of [IACA_PID_PREPROD_PEM, IACA_PID_PROD_PEM]) {
    try { keys.push(new crypto.X509Certificate(pem).publicKey) }
    catch (e) { console.error('❌ Impossible de charger un certificat IACA:', e.message) }
  }
  return keys
})()

/**
 * Vérifie un DeviceResponse mDoc PID et extrait tous les attributs présents.
 *
 * @param {Buffer} deviceResponseBuffer   CBOR brut du DeviceResponse
 * @param {string} docType                ex: 'eu.europa.ec.eudi.pid.1'
 * @param {Buffer|null} sessionTranscriptBytes  CBOR du SessionTranscript (DC API) ou null (deeplink)
 * @returns {{ verified: boolean, attributes: object }}
 */
async function verifyMdoc(deviceResponseBuffer, docType, sessionTranscriptBytes = null) {
  try {
    const deviceResponse = cborDecode(deviceResponseBuffer)
    const doc = deviceResponse?.documents?.[0]
    if (!doc) {
      console.error('❌ mDoc: aucun document dans la DeviceResponse')
      return { verified: false, attributes: null, reason: 'no_document' }
    }

    const { issuerSigned, deviceSigned } = doc
    const issuerAuth = issuerSigned?.issuerAuth
    if (!issuerAuth) {
      console.error('❌ mDoc: issuerAuth absent')
      return { verified: false, attributes: null, reason: 'no_issuer_auth' }
    }

    // 1. Vérification IssuerAuth
    const issuerKeys = resolveIssuerKeys(issuerAuth, IACA_PUBLIC_KEYS)
    if (issuerKeys.length === 0) {
      console.error('❌ mDoc: leaf cert non validé par IACA connue')
      return { verified: false, attributes: null, reason: 'iaca_unknown' }
    }
    if (!verifyCoseSign1(issuerAuth, issuerKeys)) {
      console.error('❌ mDoc: signature IssuerAuth invalide')
      return { verified: false, attributes: null, reason: 'issuer_sig_invalid' }
    }

    // 2. Extraction du MSO
    const mso = extractMso(issuerAuth)
    if (!mso) {
      console.error('❌ mDoc: impossible d\'extraire le MSO')
      return { verified: false, attributes: null, reason: 'mso_extract_failed' }
    }
    const nameSpace = docType
    const nsItems = issuerSigned?.nameSpaces?.[nameSpace]
    if (!nsItems || !Array.isArray(nsItems)) {
      console.error(`❌ mDoc: namespace ${nameSpace} absent`)
      return { verified: false, attributes: null, reason: 'namespace_absent' }
    }

    // 3. Vérification valueDigests
    const digestResult = verifyValueDigests(nsItems, nameSpace, mso)
    if (!digestResult.ok) {
      console.error('❌ mDoc: échec vérification valueDigests')
      return { verified: false, attributes: null, reason: 'digest_mismatch' }
    }

    // 4. Holder binding (DC API uniquement)
    if (sessionTranscriptBytes) {
      const devicePublicKey = extractDevicePublicKey(mso)
      const currentDocType = doc?.docType ?? nameSpace
      if (!verifyDeviceSignature(deviceSigned, currentDocType, sessionTranscriptBytes, devicePublicKey)) {
        console.error('❌ mDoc: holder binding invalide')
        return { verified: false, attributes: null }
      }
      console.log('✅ mDoc: holder binding OK')
    } else {
      console.warn('⚠️ mDoc: holder binding ignoré (chemin deeplink OID4VP)')
    }

    // 5. Extraction de tous les attributs présents
    const attributes = {}
    for (const encodedItem of nsItems) {
      const { innerBytes } = unwrapTag24(encodedItem)
      try {
        const item = cborDecode(innerBytes)
        if (item?.elementIdentifier) {
          attributes[item.elementIdentifier] = item.elementValue
        }
      } catch { /* item illisible, on continue */ }
    }

    console.log(`✅ mDoc: vérifié — attributs extraits: ${Object.keys(attributes).join(', ')}`)
    return { verified: true, attributes }

  } catch (error) {
    console.error('❌ mDoc parsing/verification error:', error.message)
    return { verified: false, attributes: null }
  }
}

module.exports = { verifyMdoc }
