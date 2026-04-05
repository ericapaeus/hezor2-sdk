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
}

async function encodeJwtWithPem(
  pem: string,
  payload: Record<string, unknown>,
  password?: string,
  expiresIn: number = 3600,
): Promise<string> {
  const alg = 'EdDSA'

  // Use node:crypto for encrypted PKCS#8 keys (jose's importPKCS8 only handles unencrypted)
  const key = password
    ? createPrivateKey({ key: pem, format: 'pem', type: 'pkcs8', passphrase: password })
    : await importPKCS8(pem, alg, { extractable: false })

  const jwt = await new SignJWT(payload)
    .setProtectedHeader({ alg })
    .setIssuedAt()
    .setExpirationTime(`${expiresIn}s`)
    .sign(key)

  return jwt
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

  // Resolve PEM from file path if privateKeyPem is not directly provided
  if (!privateKeyPem && options.privateKeyPath) {
    privateKeyPem = readFileSync(options.privateKeyPath, 'utf-8')
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
  }

  const payload: Record<string, unknown> = { ...metaInfo }

  try {
    const token = await encodeJwtWithPem(privateKeyPem, payload, password, expiresIn)
    return { [REQ_HEADER_META_INFO_KEY]: token }
  } catch (e: unknown) {
    // Password retry: if decryption failed and we're not already using anonymous password,
    // retry with anonymous password (mirrors Python's MetaInfo.to_request_header)
    const message = e instanceof Error ? e.message.toLowerCase() : ''
    if (!message.includes('decrypt') && !message.includes('could not')) throw e
    if (password === ANONYMOUS_HEADER_PRIVATE_KEY_PASSWORD) throw e

    const token = await encodeJwtWithPem(
      privateKeyPem,
      payload,
      ANONYMOUS_HEADER_PRIVATE_KEY_PASSWORD,
      expiresIn,
    )
    return { [REQ_HEADER_META_INFO_KEY]: token }
  }
}
