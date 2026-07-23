/**
 * MetaInfo — metadata model for JWT header generation.
 *
 * Mirrors hezor_common.transfer.base_sdk.meta_info.MetaInfo.
 */

import { createPrivateKey } from 'node:crypto'
import { readFileSync } from 'node:fs'

import { importPKCS8, SignJWT } from 'jose'

import {
  ANONYMOUS_HEADER_PRIVATE_KEY,
  ANONYMOUS_HEADER_PRIVATE_KEY_PASSWORD,
  ANONYMOUS_HEADER_PUBLIC_KEY,
  REQ_HEADER_META_INFO_KEY,
} from './constants.js'

export interface MetaInfoData {
  /** 主体名称 */
  subject: string
  /** 主体编码 */
  subject_code: string
  /** 调用者 ID */
  caller_id: string
  /** 数据覆盖范围，格式 yyyyMM-yyyyMM 或 yyyyMMdd-yyyyMMdd */
  data_coverage?: string
  /** 报告/模型类型识别码 */
  creation_slug?: string
  /** 报告类型名称 */
  creation_name?: string
  /** 可扩展信息字典，用于传递额外的上下文数据 */
  extras?: Record<string, unknown>
  /**
   * 本次请求所属的授权模式：
   * - `'private_key'`：第三方后端用 Ed25519 私钥签发（历史模式，`extras.authorized_*` 由调用方自报）
   * - `'oauth'`：用户在 `/oauth/consent` 主动授权后由平台签发，`extras.authorized_toolkits` 应等于 `grants ∩ subscriptions`
   * - `undefined`：兼容旧客户端，按 `'private_key'` 处理
   */
  auth_mode?: 'private_key' | 'oauth'
  /**
   * OAuth 模式下用户对该应用的授权版本号；用户撤销 / 调整 scope 后递增，
   * 网关比对 token claim 与当前 grant 不一致即拒绝。私钥模式下保持 undefined。
   */
  grant_version?: number
}

/** Returns true when the PEM header indicates an encrypted PKCS#8 private key. */
function pemLooksEncrypted(pem: string): boolean {
  return pem.includes('ENCRYPTED PRIVATE KEY')
}

async function encodeJwtWithPem(
  pem: string,
  payload: Record<string, unknown>,
  password?: string,
  expiresIn: number = 3600,
  /** Diagnostic label used only for warn logs, e.g. 'anonymous fallback' / 'retry with anonymous password'. */
  diagLabel = 'primary',
): Promise<string> {
  const alg = 'EdDSA'

  // Sanity-check the PEM/password combo up front — mismatches here are the most common
  // cause of the opaque OpenSSL "bad decrypt" error surfaced later.
  const encrypted = pemLooksEncrypted(pem)
  if (password && !encrypted) {
    // eslint-disable-next-line no-console
    console.warn(
      `[meta-info:${diagLabel}] password 已提供，但 PEM 头不是 "ENCRYPTED PRIVATE KEY"（看起来是未加密的私钥）。` +
        '继续尝试用 passphrase 解密大概率会触发 "bad decrypt"。请确认私钥文件本身是否用密码加密过。',
    )
  }
  if (!password && encrypted) {
    // eslint-disable-next-line no-console
    console.warn(
      `[meta-info:${diagLabel}] PEM 头是 "ENCRYPTED PRIVATE KEY"，但未提供 password。解密会失败。` +
        '请检查 privateKeyPath/privateKeyPem 对应的密钥是否需要 password 参数。',
    )
  }

  try {
    // Use node:crypto for encrypted PKCS#8 keys (jose's importPKCS8 only handles unencrypted)
    const key = password
      ? createPrivateKey({ key: pem, format: 'pem', type: 'pkcs8', passphrase: password })
      : await importPKCS8(pem, alg, { extractable: false })

    return await new SignJWT(payload)
      .setProtectedHeader({ alg })
      .setIssuedAt()
      .setExpirationTime(`${expiresIn}s`)
      .sign(key)
  } catch (e: unknown) {
    const originalMessage = e instanceof Error ? e.message : String(e)
    // eslint-disable-next-line no-console
    console.warn(
      `[meta-info:${diagLabel}] JWT 签名失败：${originalMessage}\n` +
        `  - PEM 头判断为${encrypted ? '已加密' : '未加密'}（是否含 "ENCRYPTED PRIVATE KEY"）\n` +
        `  - 本次调用是否提供了 password：${password ? '是' : '否'}\n` +
        '  - 常见原因：① password 错误 ② PEM 加密/未加密状态与是否传 password 不匹配 ' +
        '③ PEM 内容被截断/换行符被破坏（例如从环境变量读取时 \\n 被转义或被裁剪）',
    )
    throw e
  }
}

/**
 * Generate the X-META-INFO request header with a JWT-encoded MetaInfo payload.
 *
 * @param metaInfo  - metadata fields
 * @param options   - signing options (supports both file path and PEM content)
 * @returns header dict with X-META-INFO key
 */
export async function metaInfoToRequestHeader(
  metaInfo: MetaInfoData,
  options: {
    privateKeyPath?: string
    privateKeyPem?: string
    password?: string
    expiresIn?: number
  } = {},
): Promise<Record<string, string>> {
  const { expiresIn = 3600 } = options
  let privateKeyPem = options.privateKeyPem
  let password = options.password

  // Diagnostic: record where the key actually came from, so a later "bad decrypt"
  // can be traced back to "path" vs "inline pem" vs "anonymous fallback" without
  // needing to log the key/password content itself.
  let keySource: 'privateKeyPem' | 'privateKeyPath' | 'anonymous' = privateKeyPem
    ? 'privateKeyPem'
    : options.privateKeyPath
      ? 'privateKeyPath'
      : 'anonymous'

  // Resolve PEM from file path if privateKeyPem is not directly provided
  if (!privateKeyPem && options.privateKeyPath) {
    try {
      privateKeyPem = readFileSync(options.privateKeyPath, 'utf-8')
    } catch (e: unknown) {
      // eslint-disable-next-line no-console
      console.warn(
        `[meta-info] 读取 privateKeyPath="${options.privateKeyPath}" 失败：` +
          `${e instanceof Error ? e.message : String(e)}`,
      )
      throw e
    }
  }

  if (!privateKeyPem) {
    // Use anonymous key with warning
    // eslint-disable-next-line no-console
    console.warn('*'.repeat(20))
    // eslint-disable-next-line no-console
    console.warn(
      'privateKeyPem is not provided, using anonymous private key. ' +
        'The corresponding public key is:\n' +
        ANONYMOUS_HEADER_PUBLIC_KEY,
    )
    // eslint-disable-next-line no-console
    console.warn('*'.repeat(20))
    privateKeyPem = ANONYMOUS_HEADER_PRIVATE_KEY
    password = ANONYMOUS_HEADER_PRIVATE_KEY_PASSWORD
    keySource = 'anonymous'
  }

  const payload: Record<string, unknown> = { ...metaInfo }

  try {
    const token = await encodeJwtWithPem(privateKeyPem, payload, password, expiresIn, keySource)
    return { [REQ_HEADER_META_INFO_KEY]: token }
  } catch (e: unknown) {
    // Password retry: if decryption failed and we're not already using anonymous password,
    // retry with anonymous password (mirrors Python's MetaInfo.to_request_header)
    const message = e instanceof Error ? e.message.toLowerCase() : ''
    const looksLikeDecryptFailure = message.includes('decrypt') || message.includes('could not')

    if (!looksLikeDecryptFailure) {
      // eslint-disable-next-line no-console
      console.warn(
        `[meta-info] JWT 签名失败且不是常见的解密类错误，直接向上抛出（keySource=${keySource}）：` +
          `${e instanceof Error ? e.message : String(e)}`,
      )
      throw e
    }
    if (password === ANONYMOUS_HEADER_PRIVATE_KEY_PASSWORD) {
      // eslint-disable-next-line no-console
      console.warn(
        `[meta-info] 已经在用匿名私钥兜底签名仍然失败（keySource=${keySource}），` +
          '说明问题大概率不是业务方密钥，而是匿名密钥/依赖本身异常，请检查 SDK 版本或 jose/node:crypto 环境。',
      )
      throw e
    }

    // eslint-disable-next-line no-console
    console.warn(
      `[meta-info] 使用 keySource=${keySource} 签名失败（疑似密码/密钥不匹配），` +
        '按兼容旧客户端逻辑改用匿名密钥重试一次。若重试仍失败，请重点核对：' +
        '① 传入的 password 是否正确 ② privateKeyPem/privateKeyPath 内容是否完整（换行符未被破坏）' +
        `③ 该私钥文件是否确实是加密的 PKCS#8 格式。原始错误：${e instanceof Error ? e.message : String(e)}`,
    )

    try {
      const token = await encodeJwtWithPem(
        privateKeyPem,
        payload,
        ANONYMOUS_HEADER_PRIVATE_KEY_PASSWORD,
        expiresIn,
        'retry-with-anonymous-password',
      )
      return { [REQ_HEADER_META_INFO_KEY]: token }
    } catch (retryError: unknown) {
      // eslint-disable-next-line no-console
      console.warn(
        `[meta-info] 匿名密钥重试也失败了（keySource=${keySource}），原始错误和重试错误都会附在抛出的异常上。` +
          `重试错误：${retryError instanceof Error ? retryError.message : String(retryError)}`,
      )
      const wrapped = new Error(
        `metaInfoToRequestHeader 签名失败：原始错误="${e instanceof Error ? e.message : String(e)}"，` +
          `匿名密钥重试错误="${retryError instanceof Error ? retryError.message : String(retryError)}"（keySource=${keySource}）`,
      )
      // Preserve the retry error for programmatic inspection without relying on ES2022 Error.cause.
      ;(wrapped as Error & { cause?: unknown }).cause = retryError
      throw wrapped
    }
  }
}
