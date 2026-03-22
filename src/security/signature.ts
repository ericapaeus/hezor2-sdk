/**
 * Digital signature utilities using Ed25519 algorithm.
 *
 * Mirrors hezor_common.security.signature (Python).
 *
 * Provides functions for generating Ed25519 key pairs and performing
 * digital signature operations (signing and verification).
 */

import { createPrivateKey, createPublicKey, generateKeyPairSync, sign, verify } from 'node:crypto'
import { readFileSync } from 'node:fs'

// ─── Key Generation & Serialization ─────────────────────────────────────────

export interface Ed25519KeyPair {
  privateKey: string // PEM-encoded PKCS#8
  publicKey: string  // PEM-encoded SPKI
}

/**
 * Generate an Ed25519 key pair and return PEM-encoded strings.
 */
export function generateKeyPair(): Ed25519KeyPair {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519', {
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' },
  })
  return { privateKey, publicKey }
}

/**
 * Serialize (re-export) a private key to PEM, optionally encrypting with a password.
 */
export function serializePrivateKey(privateKeyPem: string, password?: string): string {
  const key = createPrivateKey(privateKeyPem)
  if (password) {
    return key.export({
      type: 'pkcs8',
      format: 'pem',
      cipher: 'aes-256-cbc',
      passphrase: password,
    }) as string
  }
  return key.export({ type: 'pkcs8', format: 'pem' }) as string
}

/**
 * Serialize (re-export) a public key to PEM.
 */
export function serializePublicKey(publicKeyPem: string): string {
  const key = createPublicKey(publicKeyPem)
  return key.export({ type: 'spki', format: 'pem' }) as string
}

/**
 * Deserialize (load) a PEM-encoded private key, optionally decrypting with password.
 * Returns a PEM string (passphrase-free) for further use.
 */
export function deserializePrivateKey(pem: string, password?: string): string {
  const key = password
    ? createPrivateKey({ key: pem, format: 'pem', type: 'pkcs8', passphrase: password })
    : createPrivateKey(pem)
  return key.export({ type: 'pkcs8', format: 'pem' }) as string
}

/**
 * Deserialize (load) a PEM-encoded public key. Returns a PEM string.
 */
export function deserializePublicKey(pem: string): string {
  const key = createPublicKey(pem)
  return key.export({ type: 'spki', format: 'pem' }) as string
}

// ─── Message Signing & Verification ─────────────────────────────────────────

/**
 * Sign a message (Buffer) using an Ed25519 private key PEM.
 */
export function signMessage(privateKeyPem: string, message: Buffer): Buffer {
  const key = createPrivateKey(privateKeyPem)
  return sign(null, message, key)
}

/**
 * Verify a message signature using an Ed25519 public key PEM.
 */
export function verifySignature(publicKeyPem: string, signature: Buffer, message: Buffer): boolean {
  try {
    const key = createPublicKey(publicKeyPem)
    return verify(null, message, key, signature)
  } catch {
    return false
  }
}

// ─── JSON Signing & Verification ────────────────────────────────────────────

function jsonToBytes(data: Record<string, unknown>): Buffer {
  // Sorted keys for deterministic serialization (matches Python's sort_keys=True)
  return Buffer.from(JSON.stringify(data, Object.keys(data).sort()), 'utf-8')
}

/**
 * Sign a JSON-serializable object using an Ed25519 private key PEM.
 * Keys are sorted for deterministic serialization.
 */
export function signJson(privateKeyPem: string, data: Record<string, unknown>): Buffer {
  return signMessage(privateKeyPem, jsonToBytes(data))
}

/**
 * Verify a JSON object's signature using an Ed25519 public key PEM.
 */
export function verifyJsonSignature(
  publicKeyPem: string,
  signature: Buffer,
  data: Record<string, unknown>,
): boolean {
  return verifySignature(publicKeyPem, signature, jsonToBytes(data))
}

// ─── PEM Convenience Variants ───────────────────────────────────────────────

export function signMessageWithPem(
  privatePem: string,
  message: Buffer,
  password?: string,
): Buffer {
  const pem = deserializePrivateKey(privatePem, password)
  return signMessage(pem, message)
}

export function verifySignatureWithPem(
  publicPem: string,
  signature: Buffer,
  message: Buffer,
): boolean {
  return verifySignature(publicPem, signature, message)
}

export function signJsonWithPem(
  privatePem: string,
  data: Record<string, unknown>,
  password?: string,
): Buffer {
  const pem = deserializePrivateKey(privatePem, password)
  return signJson(pem, data)
}

export function verifyJsonSignatureWithPem(
  publicPem: string,
  signature: Buffer,
  data: Record<string, unknown>,
): boolean {
  return verifyJsonSignature(publicPem, signature, data)
}

// ─── File Convenience Variants ──────────────────────────────────────────────

export function signMessageWithFile(
  privateKeyPath: string,
  message: Buffer,
  password?: string,
): Buffer {
  const pem = readFileSync(privateKeyPath, 'utf-8')
  return signMessageWithPem(pem, message, password)
}

export function verifySignatureWithFile(
  publicKeyPath: string,
  signature: Buffer,
  message: Buffer,
): boolean {
  const pem = readFileSync(publicKeyPath, 'utf-8')
  return verifySignatureWithPem(pem, signature, message)
}

export function signJsonWithFile(
  privateKeyPath: string,
  data: Record<string, unknown>,
  password?: string,
): Buffer {
  const pem = readFileSync(privateKeyPath, 'utf-8')
  return signJsonWithPem(pem, data, password)
}

export function verifyJsonSignatureWithFile(
  publicKeyPath: string,
  signature: Buffer,
  data: Record<string, unknown>,
): boolean {
  const pem = readFileSync(publicKeyPath, 'utf-8')
  return verifyJsonSignatureWithPem(pem, signature, data)
}

// ─── Convenient Aliases ─────────────────────────────────────────────────────

/** Alias for `signJsonWithFile` — the most common signing operation. */
export { signJsonWithFile as signFile }
/** Alias for `verifyJsonSignatureWithFile` — the most common verification. */
export { verifyJsonSignatureWithFile as verifyFile }
