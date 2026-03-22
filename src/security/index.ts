/**
 * Security module — Ed25519 signature and JWT utilities.
 *
 * Mirrors hezor_common.security (Python).
 */

// ─── Signature ──────────────────────────────────────────────────────────────
export {
  // Key generation & serialization
  generateKeyPair,
  serializePrivateKey,
  serializePublicKey,
  deserializePrivateKey,
  deserializePublicKey,
  // Message signing
  signMessage,
  signMessageWithPem,
  signMessageWithFile,
  // Message verification
  verifySignature,
  verifySignatureWithPem,
  verifySignatureWithFile,
  // JSON signing
  signJson,
  signJsonWithPem,
  signJsonWithFile,
  // JSON verification
  verifyJsonSignature,
  verifyJsonSignatureWithPem,
  verifyJsonSignatureWithFile,
  // Aliases
  signFile,
  verifyFile,
  // Types
  type Ed25519KeyPair,
} from './signature.js'

// ─── JWT ────────────────────────────────────────────────────────────────────
export {
  encodeJwt,
  decodeJwt,
  encodeJwtWithPem,
  decodeJwtWithPem,
  encodeJwtWithFile,
  decodeJwtWithFile,
  // Aliases
  encode,
  decode,
} from './jwt.js'
