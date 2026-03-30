/**
 * Hezor2 CLI — 命令行工具 (TypeScript)。
 *
 * 通过命令行访问 Hezor2 平台的所有 SDK 功能。
 * 凭据格式与 Python CLI 互操作。
 */

import { Command } from 'commander'
import { Hezor2APIClient } from '../hezor2-api-client.js'
import { Hezor2SDK } from '../hezor2-sdk.js'
import type { CreationGenerateResultV2 } from '../types.js'
import { VERSION } from '../index.js'
import { CredentialManager, type ProfileData } from './credential.js'

const program = new Command()

program
  .name('hezor2')
  .description('Hezor2 CLI — 命令行工具，访问 Hezor2 平台全部功能。')
  .version(VERSION)

// ── Helpers ──────────────────────────────────────────────────────────────

function getProfile(profileName?: string): ProfileData {
  const cm = new CredentialManager()
  const profile = cm.loadProfile(profileName)
  if (!profile) {
    console.error('✗ 未登录。请先运行 hezor2 login <host> 或使用 hezor2 connect <host> 进行连接')
    process.exit(1)
  }
  return profile
}

function createSDK(profile: ProfileData): Hezor2SDK {
  return new Hezor2SDK({
    baseUrl: profile.base_url,
    apiKey: profile.api_key,
    appName: profile.app_name ?? undefined,
    metaInfo: profile.caller_id
      ? { subject: 'anonymous', subject_code: 'anonymous', caller_id: profile.caller_id }
      : undefined,
    privateKeyPem: profile.cert_content ?? undefined,
    password: profile.client_secret ?? undefined,
  })
}

function outputResult(data: unknown, raw: boolean): void {
  const text = JSON.stringify(data, null, raw ? undefined : 2)
  console.log(text)
}

function buildBaseUrl(host: string): string {
  let h = host.replace(/\/+$/, '')
  if (!/^https?:\/\//.test(h)) {
    const isLocal = /^(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?$/.test(h)
    h = `${isLocal ? 'http' : 'https'}://${h}`
  }
  return `${h}/api/v1`
}

// ── Login ────────────────────────────────────────────────────────────────

program
  .command('login <host>')
  .description('登录 Hezor2 平台')
  .option('-p, --profile <name>', 'Profile 名称', 'default')
  .option('-a, --app-name <name>', '应用名称（用于证书解析，默认 public）')
  .action(async (host: string, opts: { profile: string; appName?: string }) => {
    const baseUrl = buildBaseUrl(host)

    // Prompt for API key (hidden input)
    const apiKey = await promptPassword('API Key: ')
    if (!apiKey) {
      console.error('✗ API Key 不能为空')
      process.exit(1)
    }

    console.log(`连接到 ${baseUrl} ...`)

    const os = await import('node:os')
    const loginPayload = {
      device_name: os.hostname(),
      os_info: `${os.type()} ${os.release()}`,
      cli_version: VERSION,
      sdk_type: 'typescript',
    }

    try {
      const resp = await fetch(`${baseUrl}/auth/cli/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(loginPayload),
      })

      if (resp.status === 401) {
        console.error('✗ API Key 无效或已过期')
        process.exit(1)
      }
      if (!resp.ok) {
        console.error(`✗ 登录失败 (HTTP ${resp.status}): ${await resp.text()}`)
        process.exit(1)
      }

      const data = (await resp.json()) as {
        session_id: string
        user_id: string
        user_name: string
        display_name: string
        expires_at?: string
      }

      const profileData: ProfileData = {
        host: host.replace(/\/+$/, ''),
        base_url: baseUrl,
        api_key: apiKey,
        session_id: data.session_id,
        user_id: data.user_id,
        user_name: data.user_name,
        display_name: data.display_name,
        logged_in_at: new Date().toISOString(),
        expires_at: data.expires_at ?? null,
        app_name: opts.appName ?? null,
        caller_id: null,
        client_id: null,
        client_secret: null,
        cert_content: null,
      }

      const cm = new CredentialManager()
      cm.saveProfile(opts.profile, profileData)

      console.log('✓ 登录成功！')
      console.log(`  用户: ${profileData.display_name} (${profileData.user_name})`)
      console.log(`  服务器: ${profileData.host}`)
      console.log(`  Profile: ${opts.profile}`)
    } catch (err) {
      if (err instanceof TypeError && String(err).includes('fetch')) {
        console.error(`✗ 无法连接到 ${baseUrl}`)
      } else {
        throw err
      }
      process.exit(1)
    }
  })

// ── Connect (anonymous WeChat) ───────────────────────────────────────────

program
  .command('connect <host>')
  .description('匿名连接 — 通过微信扫码获取 caller_id')
  .option('-p, --profile <name>', 'Profile 名称', 'default')
  .action(async (host: string, opts: { profile: string }) => {
    const baseUrl = buildBaseUrl(host)

    // 无需认证的客户端
    const client = new Hezor2APIClient({ baseUrl })

    console.log(`连接到 ${baseUrl} ...`)

    // 1. 获取微信扫码登录 URL
    let url: string
    let key: string
    try {
      const result = await client.wechatLoginUrl()
      url = result.url
      key = result.key
    } catch (err) {
      console.error(`✗ 获取微信二维码失败: ${err instanceof Error ? err.message : String(err)}`)
      process.exit(1)
    }

    console.log('\n请在浏览器中打开以下链接扫码:')
    console.log(`  ${url}\n`)
    console.log('等待扫码...')

    // 2. 轮询 openid（每 2 秒，最多 120 秒）
    const maxAttempts = 60
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise((r) => setTimeout(r, 2000))

      try {
        const poll = await client.wechatPollOpenid(key)

        if (poll.status === 'success' && poll.openid) {
          const profileData: ProfileData = {
            host: host.replace(/\/+$/, ''),
            base_url: baseUrl,
            api_key: '',
            session_id: '',
            user_id: '',
            user_name: 'anonymous',
            display_name: '匿名用户',
            app_name: 'public',
            caller_id: poll.openid,
            logged_in_at: new Date().toISOString(),
            expires_at: null,
            client_id: null,
            client_secret: null,
            cert_content: null,
          }

          const cm = new CredentialManager()
          cm.saveProfile(opts.profile, profileData)

          console.log('\n✓ 连接成功！')
          console.log(`  caller_id: ${poll.openid}`)
          console.log(`  Profile: ${opts.profile}`)
          return
        }

        if (poll.status === 'expired') {
          console.error('\n✗ 二维码已过期，请重新运行命令')
          process.exit(1)
        }
      } catch {
        // 网络波动时继续轮询
      }

      process.stdout.write('.')
    }

    console.error('\n✗ 等待超时，请重新运行命令')
    process.exit(1)
  })

// ── Logout ───────────────────────────────────────────────────────────────

program
  .command('logout')
  .description('登出 Hezor2 平台')
  .option('-p, --profile <name>', 'Profile 名称')
  .action(async (opts: { profile?: string }) => {
    const cm = new CredentialManager()
    const profileName = opts.profile ?? cm.getActiveProfileName()
    const profile = cm.loadProfile(profileName)

    if (!profile) {
      console.log(`! Profile '${profileName}' 不存在或未登录`)
      return
    }

    // Server-side logout (best-effort)
    if (profile.api_key) {
      try {
        await fetch(`${profile.base_url}/auth/cli/logout`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${profile.api_key}`,
          },
          body: JSON.stringify({ session_id: profile.session_id }),
        })
      } catch {
        // Ignore server logout failures
      }
    }

    cm.deleteProfile(profileName)
    console.log(`✓ 已登出 (Profile: ${profileName})`)
  })

// ── Status ───────────────────────────────────────────────────────────────

program
  .command('status')
  .description('查看当前登录状态')
  .action(() => {
    const cm = new CredentialManager()
    const profiles = cm.listProfiles()

    if (profiles.length === 0) {
      console.log('未登录任何账户')
      console.log('运行 hezor2 login <host> 开始使用')
      return
    }

    const active = cm.getActiveProfileName()
    console.log('登录状态:')
    console.log('─'.repeat(60))

    for (const name of profiles) {
      const p = cm.loadProfile(name)
      if (!p) continue
      const marker = name === active ? '★' : ' '
      const anonTag = p.caller_id ? '(匿名)' : ''
      const display = `${p.display_name} ${anonTag}`.trim()
      console.log(
        `${marker} ${name.padEnd(12)} ${display.padEnd(16)} ${p.host.padEnd(30)} ${p.logged_in_at ?? '-'}`,
      )
    }
  })

// ── Sessions ─────────────────────────────────────────────────────────────

const sessions = program.command('sessions').description('管理 CLI 登录会话')

sessions
  .command('list')
  .description('列出服务端活跃会话')
  .action(async () => {
    const profile = getProfile()
    if (!profile.api_key) {
      console.error('✗ 匿名 Profile 无法管理会话。请使用 hezor2 login 登录。')
      process.exit(1)
    }
    const resp = await fetch(`${profile.base_url}/auth/cli/sessions`, {
      headers: { Authorization: `Bearer ${profile.api_key}` },
    })
    if (!resp.ok) {
      console.error(`✗ 获取会话失败 (HTTP ${resp.status})`)
      process.exit(1)
    }
    const data = (await resp.json()) as { sessions: Array<Record<string, string>> }
    const list = data.sessions ?? []
    if (list.length === 0) {
      console.log('没有活跃会话')
      return
    }
    console.log('活跃会话:')
    console.log('─'.repeat(80))
    for (const s of list) {
      console.log(
        `  ${(s['id'] ?? '-').slice(0, 8)}...  ${s['device_name'] ?? '-'}  ${s['sdk_type'] ?? '-'}  ${s['created_at'] ?? '-'}`,
      )
    }
  })

sessions
  .command('revoke <sessionId>')
  .description('撤销指定会话')
  .action(async (sessionId: string) => {
    const profile = getProfile()
    if (!profile.api_key) {
      console.error('✗ 匿名 Profile 无法管理会话。请使用 hezor2 login 登录。')
      process.exit(1)
    }
    const resp = await fetch(`${profile.base_url}/auth/cli/sessions/${sessionId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${profile.api_key}` },
    })
    if (resp.status === 404) {
      console.error(`✗ 会话 ${sessionId} 不存在`)
      process.exit(1)
    }
    if (!resp.ok) {
      console.error(`✗ 撤销失败 (HTTP ${resp.status})`)
      process.exit(1)
    }
    console.log(`✓ 会话 ${sessionId.slice(0, 8)}... 已撤销`)
  })

// ── Health ────────────────────────────────────────────────────────────────

program
  .command('health')
  .description('执行健康检查')
  .action(async () => {
    const profile = getProfile()
    const sdk = createSDK(profile)
    const [isHealthy, data] = await sdk.healthCheck()
    console.log(isHealthy ? '✓ 服务正常' : '✗ 服务异常')
    if (Object.keys(data).length > 0) {
      console.log(JSON.stringify(data, null, 2))
    }
  })

// ── Webhook ──────────────────────────────────────────────────────────────

program
  .command('webhook <action>')
  .description('查看 Webhook 动作帮助文档')
  .option('--raw', '输出原始 JSON')
  .action(async (action: string, opts: { raw?: boolean }) => {
    const profile = getProfile()
    const sdk = createSDK(profile)
    const result = await sdk.webhookHelp(action)
    outputResult(result, opts.raw ?? false)
  })

// ── Reports ──────────────────────────────────────────────────────────────

const reports = program.command('reports').description('报告管理')

reports
  .command('list')
  .description('列出公开报告')
  .option('-n, --top-n <number>', '返回数量', '5')
  .option('-c, --creation-id <id>', '按创建 ID 过滤')
  .option('--raw', '输出原始 JSON')
  .action(async (opts: { topN: string; creationId?: string; raw?: boolean }) => {
    const profile = getProfile()
    const sdk = createSDK(profile)
    const result = await sdk.getPublicReports({
      topN: parseInt(opts.topN, 10),
      ...(opts.creationId ? { creationId: opts.creationId } : {}),
    })
    outputResult(result, opts.raw ?? false)
  })

reports
  .command('status <creationId> <reportId>')
  .description('查询报告状态')
  .option('--raw', '输出原始 JSON')
  .action(async (creationId: string, reportId: string, opts: { raw?: boolean }) => {
    const profile = getProfile()
    const sdk = createSDK(profile)
    const result = await sdk.getReportStatus(creationId, reportId)
    outputResult(result, opts.raw ?? false)
  })

reports
  .command('generate-id')
  .description('生成报告 ID')
  .option('-n, --count <number>', '生成数量', '1')
  .action(async (opts: { count: string }) => {
    const profile = getProfile()
    const sdk = createSDK(profile)
    const ids = await sdk.generateReportId(parseInt(opts.count, 10))
    for (const id of ids) console.log(id)
  })

reports
  .command('publish <jsonFile>')
  .description('发布创建报告（从本地 JSON 文件）')
  .option('-t, --task-id <id>', '任务 ID')
  .option('-e, --execution-id <id>', '执行 ID')
  .option('--raw', '输出原始 JSON')
  .action(async (jsonFile: string, opts: { taskId?: string; executionId?: string; raw?: boolean }) => {
    const fs = await import('node:fs')
    const path = await import('node:path')

    const resolved = path.resolve(jsonFile)
    if (!fs.existsSync(resolved)) {
      console.error(`✗ 文件不存在: ${resolved}`)
      process.exit(1)
    }

    let data: Record<string, unknown>
    try {
      data = JSON.parse(fs.readFileSync(resolved, 'utf-8')) as Record<string, unknown>
    } catch (err) {
      console.error(`✗ JSON 解析失败: ${err instanceof Error ? err.message : String(err)}`)
      process.exit(1)
    }

    // 基本结构验证
    const requiredFields = ['creation_id', 'title', 'full_content', 'subject', 'slug']
    const missingFields = requiredFields.filter((f) => !(f in data))
    if (missingFields.length > 0) {
      console.error(`✗ JSON 数据缺少必填字段: ${missingFields.join(', ')}`)
      process.exit(1)
    }

    const profile = getProfile()
    const sdk = createSDK(profile)
    const result = await sdk.publishCreationReport(data as unknown as CreationGenerateResultV2, {
      ...(opts.taskId ? { taskId: opts.taskId } : {}),
      ...(opts.executionId ? { executionId: opts.executionId } : {}),
    })

    if (!opts.raw) console.log('✓ 报告发布成功！')
    outputResult(result, opts.raw ?? false)
  })

// ── Knowledge ────────────────────────────────────────────────────────────

const knowledge = program.command('knowledge').description('知识库检索')

knowledge
  .command('search <query> <collection>')
  .description('在指定集合中搜索知识')
  .option('-k, --top-k <number>', '返回数量', '5')
  .option('-t, --threshold <number>', '分数阈值', '0.5')
  .option('-m, --mode <mode>', '搜索模式 (semantic, hybrid)', 'semantic')
  .option('--vector-weight <number>', '向量权重', '0.7')
  .option('--text-weight <number>', '文本权重', '0.3')
  .option('--entity-type <type>', '实体类型过滤')
  .option('--doc-id <id>', '文档 ID 过滤')
  .option('--raw', '输出原始 JSON')
  .action(
    async (
      query: string,
      collection: string,
      opts: {
        topK: string
        threshold: string
        mode: string
        vectorWeight: string
        textWeight: string
        entityType?: string
        docId?: string
        raw?: boolean
      },
    ) => {
      const profile = getProfile()
      const sdk = createSDK(profile)
      const result = await sdk.knowledgeSearch(query, collection, {
        topK: parseInt(opts.topK, 10),
        scoreThreshold: parseFloat(opts.threshold),
        searchMode: opts.mode as 'semantic' | 'hybrid',
        vectorWeight: parseFloat(opts.vectorWeight),
        textWeight: parseFloat(opts.textWeight),
        ...(opts.entityType ? { entityType: opts.entityType } : {}),
        ...(opts.docId ? { docId: opts.docId } : {}),
      })
      outputResult(result, opts.raw ?? false)
    },
  )

knowledge
  .command('retrieve <query>')
  .description('跨集合检索知识')
  .option('-k, --top-k <number>', '返回数量', '3')
  .option('-t, --threshold <number>', '分数阈值', '0.5')
  .option('--raw', '输出原始 JSON')
  .action(async (query: string, opts: { topK: string; threshold: string; raw?: boolean }) => {
    const profile = getProfile()
    const sdk = createSDK(profile)
    const result = await sdk.knowledgeRetrieve(query, {
      topK: parseInt(opts.topK, 10),
      scoreThreshold: parseFloat(opts.threshold),
    })
    outputResult(result, opts.raw ?? false)
  })

// ── Data ─────────────────────────────────────────────────────────────────

const data = program.command('data').description('数据检索')

data
  .command('retrieve <query>')
  .description('执行数据检索')
  .option('-k, --top-k <number>', '返回数量', '1')
  .option('--raw', '输出原始 JSON')
  .action(async (query: string, opts: { topK: string; raw?: boolean }) => {
    const profile = getProfile()
    const sdk = createSDK(profile)
    const result = await sdk.dataRetrieve(query, { topK: parseInt(opts.topK, 10) })
    outputResult(result, opts.raw ?? false)
  })

// ── Graph ────────────────────────────────────────────────────────────────

const graph = program.command('graph').description('知识图谱查询')

graph
  .command('query <queryType>')
  .description('执行知识图谱查询')
  .option('-q, --keyword <keyword>', '搜索关键词')
  .option('-e, --entity <name>', '实体名称')
  .option('--entity-type <type>', '实体类型')
  .option('--rel-type <type>', '关系类型')
  .option('-d, --direction <dir>', '方向 (both, in, out)', 'both')
  .option('--target <name>', '目标实体名称')
  .option('--max-depth <number>', '最大遍历深度', '2')
  .option('--max-paths <number>', '最大路径数', '3')
  .option('--community-id <id>', '社区 ID')
  .option('-n, --limit <number>', '结果数量限制', '20')
  .option('--raw', '输出原始 JSON')
  .action(
    async (
      queryType: string,
      opts: {
        keyword?: string
        entity?: string
        entityType?: string
        relType?: string
        direction: string
        target?: string
        maxDepth: string
        maxPaths: string
        communityId?: string
        limit: string
        raw?: boolean
      },
    ) => {
      const profile = getProfile()
      const sdk = createSDK(profile)
      const result = await sdk.knowledgeGraphQuery(queryType, {
        ...(opts.keyword ? { keyword: opts.keyword } : {}),
        ...(opts.entity ? { entityName: opts.entity } : {}),
        ...(opts.entityType ? { entityType: opts.entityType } : {}),
        ...(opts.relType ? { relationshipType: opts.relType } : {}),
        direction: opts.direction as 'in' | 'out' | 'both',
        ...(opts.target ? { targetName: opts.target } : {}),
        maxDepth: parseInt(opts.maxDepth, 10),
        maxPaths: parseInt(opts.maxPaths, 10),
        ...(opts.communityId ? { communityId: opts.communityId } : {}),
        limit: parseInt(opts.limit, 10),
      })
      outputResult(result, opts.raw ?? false)
    },
  )

// ── Config ───────────────────────────────────────────────────────────────

const config = program.command('config').description('配置中心')

config
  .command('pull')
  .description('拉取配置')
  .option('-k, --key <key...>', '指定配置键')
  .option('--global-base-url <url>', '替换 ${GLOBAL_BASE_URL} 占位符')
  .option('--merged', '输出合并后的配置')
  .option('--raw', '输出原始 JSON')
  .action(async (opts: { key?: string[]; globalBaseUrl?: string; merged?: boolean; raw?: boolean }) => {
    const profile = getProfile()
    const sdk = createSDK(profile)
    const result = await sdk.pullConfigs({
      ...(opts.key ? { keys: opts.key } : {}),
      ...(opts.globalBaseUrl ? { globalBaseUrl: opts.globalBaseUrl } : {}),
    })
    if (opts.merged) {
      const { mergedConfigs } = await import('../types.js')
      outputResult(mergedConfigs(result), opts.raw ?? false)
    } else {
      outputResult(result, opts.raw ?? false)
    }
  })

// ── Apps ─────────────────────────────────────────────────────────────────

const apps = program.command('apps').description('应用管理')

apps
  .command('list')
  .description('列出当前用户绑定的应用（需要 JWT 认证）')
  .action(async () => {
    console.error('✗ apps list 需要 JWT 认证（Web 登录），CLI 暂不支持。')
    console.error('  请向平台管理员获取您有权限的应用名称 (app_name)，然后运行：')
    console.error('  hezor2 apps use <app_name>')
    process.exit(1)
  })

apps
  .command('use <appName>')
  .description('切换应用，获取证书并保存到凭据中')
  .action(async (appName: string) => {
    const cm = new CredentialManager()
    const profileName = cm.getActiveProfileName()
    const profile = getProfile(profileName)
    const sdk = createSDK(profile)
    const result = await sdk.getAppCerts(appName)

    profile.app_name = result.app_name
    profile.client_id = result.client_id
    profile.client_secret = result.client_secret
    profile.cert_content = result.cert_content
    cm.saveProfile(profileName, profile)

    console.log(`✓ 已切换到应用 ${appName}，证书已保存到 Profile [${profileName}]`)
    console.log(`  app_name:      ${result.app_name}`)
    console.log(`  client_id:     ${result.client_id}`)
    console.log(`  client_secret: ${result.client_secret.slice(0, 6)}...`)
    console.log(`  cert_content:  ${result.cert_content.slice(0, 30)}...`)
  })

// ── Hidden input helper ──────────────────────────────────────────────────

async function promptPassword(prompt: string): Promise<string> {
  const { createInterface } = await import('node:readline')

  return new Promise((resolve) => {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
    })

    // Disable echoing
    if (process.stdin.isTTY) {
      process.stdout.write(prompt)
      process.stdin.setRawMode(true)
      let input = ''

      const onData = (buf: Buffer): void => {
        const char = buf.toString('utf-8')
        if (char === '\n' || char === '\r' || char === '\u0004') {
          process.stdin.setRawMode(false)
          process.stdin.removeListener('data', onData)
          process.stdout.write('\n')
          rl.close()
          resolve(input)
        } else if (char === '\u007F' || char === '\b') {
          // Backspace
          if (input.length > 0) input = input.slice(0, -1)
        } else if (char === '\u0003') {
          // Ctrl+C
          process.stdout.write('\n')
          process.exit(130)
        } else {
          input += char
        }
      }
      process.stdin.on('data', onData)
    } else {
      // Non-TTY: read line normally
      rl.question(prompt, (answer: string) => {
        rl.close()
        resolve(answer)
      })
    }
  })
}

// ── Run ──────────────────────────────────────────────────────────────────

export { program }

export function main(): void {
  program.parseAsync(process.argv).catch((err: unknown) => {
    console.error('Error:', err instanceof Error ? err.message : String(err))
    process.exit(1)
  })
}
