/**
 * Base API Client — manages HTTP lifecycle, authentication, and header injection.
 *
 * Mirrors hezor_common.transfer.base_sdk.base_api_client.BaseAPIClient.
 */

import {
  ANONYMOUS_HEADER_PRIVATE_KEY,
  ANONYMOUS_HEADER_PRIVATE_KEY_PASSWORD,
  REQ_HEADER_APP_NAME_KEY,
} from './constants.js'
import { SubscriptionRequiredError } from './errors.js'
import { type MetaInfoData, metaInfoToRequestHeader } from './meta-info.js'

/** Default app name when none is provided (matches server DEFAULT_APP_NAME). */
const DEFAULT_APP_NAME = 'public'

/** Default anonymous MetaInfo used when no metaInfo is explicitly supplied. */
const DEFAULT_META_INFO: MetaInfoData = {
  subject: 'anonymous',
  subject_code: 'anonymous',
  caller_id: 'sdk',
}

export interface BaseAPIClientOptions {
  /**
   * hezor2 API base URL，**必须包含 `/api/v1` 前缀**（例如
   * `https://hezor.ai/api/v1` 或 `http://localhost:8000/api/v1`，不含末尾 `/`）。
   * 客户端按 `${baseUrl}${path}` 拼接，`path` 形如 `/webhook/`、`/health` 等
   * 不带 `/api/v1` 的相对路径。
   */
  baseUrl: string
  timeout?: number | undefined
  apiKey?: string | undefined
  metaInfo?: MetaInfoData | undefined
  privateKeyPath?: string | undefined
  privateKeyPem?: string | undefined
  password?: string | undefined
  metaInfoExpiresIn?: number | undefined
  appName?: string | undefined
  /**
   * 收到 HTTP 402 响应时触发的回调。SDK 内部不会抛出 `SubscriptionRequiredError`
   * （为保持现有 `Response` 返回契约），仅在每次返回前调用此 hook，由调用方决定
   * 是否引导用户去订阅页。
   *
   * @param error 已构造好的 `SubscriptionRequiredError`，含响应体里的 `detail`（若解析成功）
   * @param response 原始 `Response`，未消费 body
   */
  onSubscriptionRequired?: (
    error: SubscriptionRequiredError,
    response: Response,
  ) => void | Promise<void>
}

export class BaseAPIClient {
  readonly baseUrl: string
  readonly timeout: number
  readonly apiKey: string | undefined
  readonly metaInfo: MetaInfoData | undefined
  readonly privateKeyPath: string | undefined
  readonly privateKeyPem: string | undefined
  readonly password: string | undefined
  readonly metaInfoExpiresIn: number
  readonly appName: string | undefined
  readonly onSubscriptionRequired:
    | ((error: SubscriptionRequiredError, response: Response) => void | Promise<void>)
    | undefined

  constructor(options: BaseAPIClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, '')
    this.timeout = options.timeout ?? 120_000
    this.apiKey = options.apiKey ?? undefined
    this.metaInfo = options.metaInfo ?? undefined
    this.privateKeyPath = options.privateKeyPath ?? undefined
    this.privateKeyPem = options.privateKeyPem ?? undefined
    this.password = options.password ?? undefined
    this.metaInfoExpiresIn = options.metaInfoExpiresIn ?? 3600
    this.appName = options.appName ?? undefined
    this.onSubscriptionRequired = options.onSubscriptionRequired ?? undefined
  }

  /** Build request headers with auth and meta-info. */
  async getHeaders(): Promise<Record<string, string>> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }

    // Always send X-APP-NAME; fall back to "public" when not provided
    headers[REQ_HEADER_APP_NAME_KEY] = this.appName ?? DEFAULT_APP_NAME

    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`
    }

    // Resolve effective metaInfo; use anonymous default when not provided
    const effectiveMetaInfo: MetaInfoData = this.metaInfo ?? DEFAULT_META_INFO

    if (!this.privateKeyPem && !this.privateKeyPath) {
      const metaHeader = await metaInfoToRequestHeader(effectiveMetaInfo, {
        privateKeyPem: ANONYMOUS_HEADER_PRIVATE_KEY,
        password: ANONYMOUS_HEADER_PRIVATE_KEY_PASSWORD,
        expiresIn: this.metaInfoExpiresIn,
      })
      Object.assign(headers, metaHeader)
    } else {
      const opts: {
        privateKeyPath?: string
        privateKeyPem?: string
        password?: string
        expiresIn: number
      } = {
        expiresIn: this.metaInfoExpiresIn,
      }
      if (this.privateKeyPath != null) opts.privateKeyPath = this.privateKeyPath
      if (this.privateKeyPem != null) opts.privateKeyPem = this.privateKeyPem
      if (this.password != null) opts.password = this.password
      const metaHeader = await metaInfoToRequestHeader(effectiveMetaInfo, opts)
      Object.assign(headers, metaHeader)
    }

    return headers
  }

  /**
   * Build headers for a request.
   * When `skipAuth` is true, only `Content-Type: application/json` is included.
   */
  private async buildRequestHeaders(options?: {
    headers?: Record<string, string>
    skipAuth?: boolean
  }): Promise<Record<string, string>> {
    const headers = options?.skipAuth
      ? { 'Content-Type': 'application/json' }
      : await this.getHeaders()
    if (options?.headers) Object.assign(headers, options.headers)
    return headers
  }

  /**
   * 拦截 HTTP 402 响应：克隆 body 解析 detail，构造 `SubscriptionRequiredError`
   * 并触发 `onSubscriptionRequired` 回调（不抛出，原 `Response` 仍照常返回）。
   */
  private async interceptResponse(response: Response): Promise<Response> {
    if (response.status !== 402 || !this.onSubscriptionRequired) {
      return response
    }
    let detail = 'subscription required'
    try {
      const cloned = response.clone()
      const body = (await cloned.json()) as { detail?: string; message?: string } | null
      if (body && typeof body === 'object') {
        if (typeof body.detail === 'string') detail = body.detail
        else if (typeof body.message === 'string') detail = body.message
      }
    } catch {
      // body 不是 JSON 时退化为默认 detail
    }
    const error = new SubscriptionRequiredError(detail)
    try {
      await this.onSubscriptionRequired(error, response)
    } catch {
      // 回调抛出不影响主流程
    }
    return response
  }

  /** Execute a GET request. */
  async get(
    path: string,
    options?: {
      params?: Record<string, string>
      headers?: Record<string, string>
      skipAuth?: boolean
      /** Per-request timeout in ms. Falls back to the client-level timeout. */
      timeout?: number
    },
  ): Promise<Response> {
    const headers = await this.buildRequestHeaders(options)

    let url = `${this.baseUrl}${path}`
    if (options?.params) {
      const qs = new URLSearchParams(options.params).toString()
      url += `?${qs}`
    }

    const response = await fetch(url, {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(options?.timeout ?? this.timeout),
    })
    return this.interceptResponse(response)
  }

  /** Execute a POST request. */
  async post(
    path: string,
    options?: {
      json?: unknown
      headers?: Record<string, string>
      skipAuth?: boolean
      /** Per-request timeout in ms. Falls back to the client-level timeout. */
      timeout?: number
    },
  ): Promise<Response> {
    const headers = await this.buildRequestHeaders(options)

    const init: RequestInit = {
      method: 'POST',
      headers,
      signal: AbortSignal.timeout(options?.timeout ?? this.timeout),
    }
    if (options?.json != null) init.body = JSON.stringify(options.json)

    const response = await fetch(`${this.baseUrl}${path}`, init)
    return this.interceptResponse(response)
  }

  /** Execute a PUT request. */
  async put(
    path: string,
    options?: {
      json?: unknown
      headers?: Record<string, string>
      skipAuth?: boolean
    },
  ): Promise<Response> {
    const headers = await this.buildRequestHeaders(options)

    const init: RequestInit = {
      method: 'PUT',
      headers,
      signal: AbortSignal.timeout(this.timeout),
    }
    if (options?.json != null) init.body = JSON.stringify(options.json)

    const response = await fetch(`${this.baseUrl}${path}`, init)
    return this.interceptResponse(response)
  }

  /** Execute a PATCH request. */
  async patch(
    path: string,
    options?: {
      json?: unknown
      headers?: Record<string, string>
      skipAuth?: boolean
    },
  ): Promise<Response> {
    const headers = await this.buildRequestHeaders(options)

    const init: RequestInit = {
      method: 'PATCH',
      headers,
      signal: AbortSignal.timeout(this.timeout),
    }
    if (options?.json != null) init.body = JSON.stringify(options.json)

    const response = await fetch(`${this.baseUrl}${path}`, init)
    return this.interceptResponse(response)
  }

  /** Execute a DELETE request. */
  async delete(
    path: string,
    options?: { headers?: Record<string, string>; skipAuth?: boolean },
  ): Promise<Response> {
    const headers = await this.buildRequestHeaders(options)

    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'DELETE',
      headers,
      signal: AbortSignal.timeout(this.timeout),
    })
    return this.interceptResponse(response)
  }
}
