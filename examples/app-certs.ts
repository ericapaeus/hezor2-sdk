/**
 * 应用凭证 (App Certs) 获取示例
 *
 * 通过 API Key + X-APP-NAME 获取应用的 client_id / client_secret / 证书。
 *
 * Usage:
 *   npx tsx examples/app-certs.ts        # 运行所有
 *   npx tsx examples/app-certs.ts 1      # 运行指定
 *   npx tsx examples/app-certs.ts --list # 列出可用
 */

import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { Hezor2SDK, loadEnv, type AppCertInfo } from '../src/index.js'
import { runExamples } from './_runner.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const config = loadEnv(join(__dirname, '.env'))


// ── Examples ─────────────────────────────────────────────────────────────

async function getAppCerts() {
  const appName = config.hezor2AppName
  if (!appName) {
    console.log('  ⚠ HEZOR2_APP_NAME not set in .env — skipped.')
    console.log('  Set HEZOR2_APP_NAME to the Casdoor application name.')
    return
  }

  console.log(`  app_name: ${appName}\n`)

  try {
    const cert: AppCertInfo = await Hezor2SDK.getAppCerts(appName, {
      baseUrl: config.hezor2ApiBaseUrl,
      apiKey: config.hezor2ApiKey,
    })

    console.log('  ✓ App cert retrieved successfully\n')
    console.log(`    app_name:      ${cert.app_name}`)
    console.log(`    org_name:      ${cert.org_name}`)
    console.log(`    client_id:     ${cert.client_id}`)
    console.log(`    client_secret: ${cert.client_secret.slice(0, 8)}${'*'.repeat(24)}`)
    console.log(`    cert_content:  ${cert.cert_content.split('\n')[0]}…  (${cert.cert_content.length} chars)`)
  } catch (err) {
    console.log(`  ✗ ${err}`)
  }
}

async function useAppCertsForSearch() {
  const appName = config.hezor2AppName
  if (!appName) {
    console.log('  ⚠ HEZOR2_APP_NAME not set in .env — skipped.')
    return
  }

  console.log(`  app_name: ${appName}\n`)

  try {
    // 1. 获取应用凭证（含私钥）—— 使用静态方法，无需创建完整实例
    const cert = await Hezor2SDK.getAppCerts(appName, {
      baseUrl: config.hezor2ApiBaseUrl,
      apiKey: config.hezor2ApiKey,
    })

    console.log('  ✓ Got app certs, using cert_content as private key\n')
    console.log(`    client_secret (as password): ${cert.client_secret.slice(0, 8)}${'*'.repeat(24)}`)
    console.log(`    cert_content (private key):  ${cert.cert_content.split('\n')[0]}…\n`)

    // 2. 用获得的私钥 + client_secret 作为密码，创建带签名的 SDK 实例
    const searchSdk = new Hezor2SDK({
      baseUrl: config.hezor2ApiBaseUrl,
      apiKey: config.hezor2ApiKey,
      appName,
      metaInfo: {
        caller_id: 'example/app_certs_search',
        subject: 'example',
        subject_code: 'example_001',
      },
      privateKeyPem: cert.cert_content,
      password: cert.client_secret,
    })

    // 3. 执行一次简单的 knowledge search
    const query = '什么是万店盈利'
    const collection = 'chunks'
    console.log(`    query:      ${query}`)
    console.log(`    collection: ${collection}\n`)

    const result = await searchSdk.knowledgeSearch(query, collection, { topK: 3 })

    console.log(`  ✓ chunks:      ${result.chunks.items.length}`)
    console.log(`  ✓ entities:    ${result.entities.items.length}`)
    console.log(`  ✓ communities: ${result.communities.items.length}`)
    console.log(`  ✓ pictures:    ${result.pictures.items.length}`)

    const top = result.chunks.items[0]
    if (top) {
      console.log(`\n  Top chunk (rank=${top.rank}, score=${top.score.toFixed(4)}):`)
      console.log(`    doc:  ${top.chunk.docName}`)
      console.log(`    text: ${top.chunk.text.slice(0, 100)}…`)
    }
  } catch (err) {
    console.log(`  ✗ ${err}`)
  }
}

// ── Run ──────────────────────────────────────────────────────────────────

runExamples('app-certs', [
  { name: '通过 API Key 获取应用凭证', run: getAppCerts },
  { name: '使用凭证私钥执行 knowledge search', run: useAppCertsForSearch },
])
