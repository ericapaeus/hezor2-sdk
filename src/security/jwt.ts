/**
 * JWT utilities using Ed25519 asymmetric encryption.
 *
 * Mirrors hezor_common.security.jwt (Python).
 *
 * Provides functions for encoding and decoding JSON Web Tokens (JWT)
 * using Ed25519 asymmetric encryption algorithm via the `jose` library.
 */

import { readFileSync } from 'node:fs'

import { importPKCS8, importSPKI, SignJWT, jwtVerify, type JWTPayload } from 'jose'

import { deserializePrivateKey, deserializePublicKey } from './signature.js'

// ─── Core JWT Functions ─────────────────────────────────────────────────────

/**
 * Encode a JWT token using an Ed25519 private key (PEM string, unencrypted).
 */
export async function encodeJwt(
  privateKeyPem: string,
  payload: Record<string, unknown>,
  options: { algorithm?: string; expiresIn?: number } = {},
): Promise<string> {
  const { algorithm = 'EdDSA', expiresIn } = options
  const key = await importPKCS8(privateKeyPem, algorithm)

  let builder = new SignJWT(payload as JWTPayload)
    .setProtectedHeader({ alg: algorithm })
    .setIssuedAt()

  if (expiresIn !== undefined) {
    builder = builder.setExpirationTime(`${expiresIn}s`)
  }

  return builder.sign(key)
}

/**
 * Decode and verify a JWT token using an Ed25519 public key (PEM string).
 */
export async function decodeJwt(
  publicKeyPem: string,
  token: string,
  options: { algorithms?: string[]; verifySignature?: boolean } = {},
): Promise<Record<string, unknown>> {
  const { algorithms = ['EdDSA'], verifySignature = true } = options

  if (!verifySignature) {
    // Decode without verification — just parse the payload
    const parts = token.split('.')
    if (parts.length !== 3) throw new Error('Invalid JWT format')
    const payload = JSON.parse(Buffer.from(parts[1]!, 'base64url').toString('utf-8'))
    return payload
  }

  const key = await importSPKI(publicKeyPem, algorithms[0]!)
  const { payload } = await jwtVerify(token, key, { algorithms })
  return payload as Record<string, unknown>
}

// ─── PEM Convenience Variants ───────────────────────────────────────────────

/**
 * Encode a JWT using a PEM-encoded private key (possibly encrypted).
 */
export async function encodeJwtWithPem(
  privatePem: string,
  payload: Record<string, unknown>,
  options: { password?: string; algorithm?: string; expiresIn?: number } = {},
): Promise<string> {
  const { password, ...rest } = options
  const pem = password ? deserializePrivateKey(privatePem, password) : privatePem
  return encodeJwt(pem, payload, rest)
}

/**
 * Decode a JWT using a PEM-encoded public key.
 */
export async function decodeJwtWithPem(
  publicPem: string,
  token: string,
  options: { algorithms?: string[]; verifySignature?: boolean } = {},
): Promise<Record<string, unknown>> {
  const pem = deserializePublicKey(publicPem)
  return decodeJwt(pem, token, options)
}

// ─── File Convenience Variants ──────────────────────────────────────────────

/**
 * Encode a JWT using a private key file (possibly encrypted).
 */
export async function encodeJwtWithFile(
  privateKeyPath: string,
  payload: Record<string, unknown>,
  options: { password?: string; algorithm?: string; expiresIn?: number } = {},
): Promise<string> {
  const pem = readFileSync(privateKeyPath, 'utf-8')
  return encodeJwtWithPem(pem, payload, options)
}

/**
 * Decode a JWT using a public key file.
 */
export async function decodeJwtWithFile(
  publicKeyPath: string,
  token: string,
  options: { algorithms?: string[]; verifySignature?: boolean } = {},
): Promise<Record<string, unknown>> {
  const pem = readFileSync(publicKeyPath, 'utf-8')
  return decodeJwtWithPem(pem, token, options)
}

// ─── Convenient Aliases ─────────────────────────────────────────────────────

/** Alias for `encodeJwtWithFile` — the most common encoding operation. */
export { encodeJwtWithFile as encode }
/** Alias for `decodeJwtWithFile` — the most common decoding operation. */
export { decodeJwtWithFile as decode }
