#!/usr/bin/env npx tsx
/**
 * Generate an Ed25519 key pair, save to files, and display full PEM content.
 *
 * Usage:
 *   npx tsx scripts/generate-keys.ts <password> [output-dir]
 *
 * Arguments:
 *   password    Password to encrypt the private key (required)
 *   output-dir  Directory to save key files (default: ./keys)
 *
 * Examples:
 *   npx tsx scripts/generate-keys.ts my_secure_password
 *   npx tsx scripts/generate-keys.ts my_secure_password ./my-keys
 */

import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { generateKeyPair, serializePrivateKey, serializePublicKey } from '../src/security/signature.js'

const password = process.argv[2]
const outputDir = resolve(process.argv[3] ?? './.keys')

if (!password) {
  console.error('Usage: npx tsx scripts/generate-keys.ts <password> [output-dir]')
  process.exit(1)
}

// Generate key pair
const { privateKey, publicKey } = generateKeyPair()

// Encrypt private key with password
const encryptedPrivateKey = serializePrivateKey(privateKey, password)
const publicKeyPem = serializePublicKey(publicKey)

// Ensure output directory exists
if (!existsSync(outputDir)) {
  mkdirSync(outputDir, { recursive: true })
}

// Save to files
const privatePath = resolve(outputDir, 'private_key.pem')
const publicPath = resolve(outputDir, 'public_key.pem')

writeFileSync(privatePath, encryptedPrivateKey, { mode: 0o600 })
writeFileSync(publicPath, publicKeyPem, { mode: 0o644 })

// Display results
console.log('═'.repeat(60))
console.log('  Ed25519 Key Pair Generated')
console.log('═'.repeat(60))
console.log()
console.log(`  Output directory: ${outputDir}`)
console.log(`  Private key:      ${privatePath}`)
console.log(`  Public key:       ${publicPath}`)
console.log()
console.log('─'.repeat(60))
console.log('  Private Key (encrypted)')
console.log('─'.repeat(60))
console.log()
console.log(encryptedPrivateKey)
console.log('─'.repeat(60))
console.log('  Public Key')
console.log('─'.repeat(60))
console.log()
console.log(publicKeyPem)
console.log('═'.repeat(60))
console.log('  Done. Keep your password safe!')
console.log('═'.repeat(60))
