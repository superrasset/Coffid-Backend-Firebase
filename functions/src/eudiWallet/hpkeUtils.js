// Utilitaires partagés entre initVP.js et verifyVP.js (chemin DC API)

let _suite = null

async function getHpkeSuite() {
  if (_suite) return _suite
  const { CipherSuite, HkdfSha256, Aes128Gcm, DhkemP256HkdfSha256 } = await import('@hpke/core')
  _suite = new CipherSuite({
    kem: new DhkemP256HkdfSha256(),
    kdf: new HkdfSha256(),
    aead: new Aes128Gcm(),
  })
  return _suite
}

// Buffer.buffer peut pointer vers un ArrayBuffer partagé plus large — slice pour isoler
function toArrayBuffer(buf) {
  if (buf instanceof Buffer || buf instanceof Uint8Array) {
    return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
  }
  return buf
}

module.exports = { getHpkeSuite, toArrayBuffer }
