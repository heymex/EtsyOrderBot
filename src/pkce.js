const crypto = require('crypto');

function base64Url(buf) {
  return buf
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function randomState() {
  return base64Url(crypto.randomBytes(24));
}

/**
 * RFC 7636 PKCE pair. Verifier uses unreserved characters; challenge is S256.
 */
function createPkcePair() {
  const codeVerifier = base64Url(crypto.randomBytes(32));
  const codeChallenge = base64Url(
    crypto.createHash('sha256').update(codeVerifier).digest()
  );
  return { codeVerifier, codeChallenge };
}

module.exports = { randomState, createPkcePair };
