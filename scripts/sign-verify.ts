#!/usr/bin/env npx tsx
/**
 * Sign / verify a MetaInfo JWT (X-META-INFO header) using an Ed25519 key pair
 * (see generate-keys.ts). Signing goes through `metaInfoToRequestHeader`,
 * the same helper the SDK uses to build the real request header.
 *
 * Usage:
 *   npx tsx scripts/sign-verify.ts sign <private-key-path> <meta-info-json> [password]
 *   npx tsx scripts/sign-verify.ts verify <public-key-path> <jwt-token>
 *
 * Examples:
 *   npx tsx scripts/sign-verify.ts sign ./.keys/private_key.pem \
 *     '{"subject":"demo","subject_code":"DEMO","caller_id":"demo-caller"}' my_secure_password
 *   npx tsx scripts/sign-verify.ts verify ./.keys/public_key.pem <jwt-token>
 */

import { resolve } from 'node:path'

import { metaInfoToRequestHeader, type MetaInfoData } from '../src/meta-info.js'
import { decodeJwtWithFile } from '../src/security/jwt.js'
import { REQ_HEADER_META_INFO_KEY } from '../src/constants.js'

const [mode, keyPath, arg1, arg2] = process.argv.slice(2)

function usageAndExit(): never {
  console.error('Usage:')
  console.error('  npx tsx scripts/sign-verify.ts sign <private-key-path> <meta-info-json> [password]')
  console.error('  npx tsx scripts/sign-verify.ts verify <public-key-path> <jwt-token>')
  process.exit(1)
}

if (mode !== 'sign' && mode !== 'verify') usageAndExit()
if (!keyPath || !arg1) usageAndExit()

const resolvedKeyPath = resolve(keyPath)

if (mode === 'sign') {
  const metaInfoJson = arg1
  const password = arg2

  let metaInfo: MetaInfoData
  try {
    metaInfo = JSON.parse(metaInfoJson) as MetaInfoData
  } catch {
    console.error('meta-info-json must be a valid JSON string, e.g.')
    console.error('  \'{"subject":"demo","subject_code":"DEMO","caller_id":"demo-caller"}\'')
    process.exit(1)
  }

  const header = await metaInfoToRequestHeader(metaInfo, {
    privateKeyPath: resolvedKeyPath,
    password,
  })

  console.log('─'.repeat(60))
  console.log(`  ${REQ_HEADER_META_INFO_KEY} (JWT)`)
  console.log('─'.repeat(60))
  console.log()
  console.log(header[REQ_HEADER_META_INFO_KEY])
} else {
  const token = arg1

  try {
    const payload = await decodeJwtWithFile(resolvedKeyPath, token)

    console.log('─'.repeat(60))
    console.log('  Signature is VALID ✅')
    console.log('─'.repeat(60))
    console.log()
    console.log(JSON.stringify(payload, null, 2))
  } catch (e: unknown) {
    console.log('─'.repeat(60))
    console.log('  Signature is INVALID ❌')
    console.log('─'.repeat(60))
    console.error(e instanceof Error ? e.message : e)
    process.exit(1)
  }
}
