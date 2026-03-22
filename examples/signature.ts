/**
 * Digital Signature (Ed25519) 使用示例
 *
 * Usage:
 *   npx tsx examples/signature.ts        # 运行所有
 *   npx tsx examples/signature.ts 1      # 运行指定
 *   npx tsx examples/signature.ts --list # 列出可用
 */

import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import { security } from '../src/index.js'
import { runExamples } from './_runner.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

async function basicKeyGen() {
  const { privateKey, publicKey } = security.generateKeyPair()
  console.log('  ✓ Generated Ed25519 key pair')

  const message = Buffer.from('Hello, World!')
  const signature = security.signMessage(privateKey, message)
  console.log(`  ✓ Signed: "${message}" → ${signature.length} bytes`)

  const valid = security.verifySignature(publicKey, signature, message)
  console.log(`  ✓ Verify (correct):  ${valid}`)

  const wrong = security.verifySignature(publicKey, signature, Buffer.from('Wrong'))
  console.log(`  ✓ Verify (tampered): ${wrong}`)
}

async function keySerialization() {
  const { privateKey, publicKey } = security.generateKeyPair()

  const privatePem = security.serializePrivateKey(privateKey)
  const publicPem = security.serializePublicKey(publicKey)
  console.log(`  ✓ Serialized to PEM`)
  console.log(`    private: ${privatePem.split('\n')[0]}…`)
  console.log(`    public:  ${publicPem.split('\n')[0]}…`)

  const loaded = {
    priv: security.deserializePrivateKey(privatePem),
    pub: security.deserializePublicKey(publicPem),
  }
  const msg = Buffer.from('Roundtrip test')
  const sig = security.signMessage(loaded.priv, msg)
  console.log(`  ✓ Roundtrip verify: ${security.verifySignature(loaded.pub, sig, msg)}`)
}

async function passwordProtection() {
  const { privateKey } = security.generateKeyPair()
  const password = 'my_secure_password_123'

  const encrypted = security.serializePrivateKey(privateKey, password)
  console.log(`  ✓ Encrypted PEM: ${encrypted.split('\n')[0]}…`)

  const loaded = security.deserializePrivateKey(encrypted, password)
  const sig = security.signMessage(loaded, Buffer.from('Secret'))
  console.log(`  ✓ Decrypted and signed: ${sig.length} bytes`)
}

async function jsonSigning() {
  const { privateKey, publicKey } = security.generateKeyPair()

  const data = {
    user_id: 'alice_123',
    action: 'login',
    timestamp: 1706025600,
    ip_address: '192.168.1.100',
  }

  console.log(`  data: ${JSON.stringify(data)}`)

  const sig = security.signJson(privateKey, data)
  console.log(`  ✓ Signature: ${sig.toString('hex').slice(0, 32)}…`)
  console.log(`  ✓ Verify (original): ${security.verifyJsonSignature(publicKey, sig, data)}`)
  console.log(`  ✓ Verify (tampered): ${security.verifyJsonSignature(publicKey, sig, { ...data, user_id: 'bob' })}`)
}

async function keyPersistence() {
  const { privateKey, publicKey } = security.generateKeyPair()

  const keysDir = join(__dirname, '.keys')
  if (!existsSync(keysDir)) mkdirSync(keysDir, { recursive: true })

  const privatePath = join(keysDir, 'private_key.pem')
  const publicPath = join(keysDir, 'public_key.pem')

  writeFileSync(privatePath, security.serializePrivateKey(privateKey, 'file_password'))
  writeFileSync(publicPath, security.serializePublicKey(publicKey))
  console.log(`  ✓ Saved: ${privatePath}`)
  console.log(`  ✓ Saved: ${publicPath}`)

  const priv = security.deserializePrivateKey(readFileSync(privatePath, 'utf-8'), 'file_password')
  const pub = security.deserializePublicKey(readFileSync(publicPath, 'utf-8'))

  const sig = security.signJson(priv, { test: true })
  console.log(`  ✓ Load & verify: ${security.verifyJsonSignature(pub, sig, { test: true })}`)
  console.log('  (Keys persisted for use in next example)')
}

async function authWorkflow() {
  const keysDir = join(__dirname, '.keys')
  const privatePath = join(keysDir, 'private_key.pem')
  const publicPath = join(keysDir, 'public_key.pem')

  if (!existsSync(privatePath) || !existsSync(publicPath)) {
    console.log('  ✗ Key files not found — run "Key Persistence" first.')
    return
  }

  console.log(`  Server keys: ${keysDir}/`)

  // Server signs auth token
  const token = {
    user_id: 'user_42',
    role: 'admin',
    expires_at: 1706112000,
    permissions: ['read', 'write', 'delete'],
  }

  const sig = security.signJsonWithFile(privatePath, token, 'file_password')
  console.log(`  ✓ Server signed token for ${token.user_id}`)

  // Client verifies
  const valid = security.verifyJsonSignatureWithFile(publicPath, sig, token)
  console.log(`  ✓ Client verify (authentic): ${valid}`)

  const fake = security.verifyJsonSignatureWithFile(publicPath, sig, { ...token, role: 'super_admin' })
  console.log(`  ✓ Client verify (tampered):  ${fake}`)
}

runExamples('signature', [
  { name: 'Basic key generation & signing', run: basicKeyGen },
  { name: 'Key serialization (PEM roundtrip)', run: keySerialization },
  { name: 'Password-protected private key', run: passwordProtection },
  { name: 'JSON data signing & verification', run: jsonSigning },
  { name: 'Key persistence to files', run: keyPersistence },
  { name: 'Complete authentication workflow', run: authWorkflow },
])
