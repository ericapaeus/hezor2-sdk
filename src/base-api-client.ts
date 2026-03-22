/**
 * Base API Client — manages HTTP lifecycle, authentication, and header injection.
 *
 * Mirrors hezor_common.transfer.base_sdk.base_api_client.BaseAPIClient.
 */

import {
  ANONYMOUS_HEADER_PRIVATE_KEY,
  ANONYMOUS_HEADER_PRIVATE_KEY_PASSWORD,
  ANONYMOUS_HEADER_PUBLIC_KEY,
  REQ_HEADER_APP_NAME_KEY,
  REQ_HEADER_META_INFO_KEY,
} from './constants.js'
import { type MetaInfoData, metaInfoToRequestHeader } from './meta-info.js'

export interface BaseAPIClientOptions {
  baseUrl: string
  timeout?: number | undefined
  apiKey?: string | undefined
  metaInfo?: MetaInfoData | undefined
  privateKeyPath?: string | undefined
  privateKeyPem?: string | undefined
  password?: string | undefined
  metaInfoExpiresIn?: number | undefined
  appName?: string | undefined
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
  }

  /** Build request headers with auth and meta-info. */
  async getHeaders(): Promise<Record<string, string>> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }

    if (this.appName) {
      headers[REQ_HEADER_APP_NAME_KEY] = this.appName
    }

    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`
    }

    if (this.metaInfo) {
      if (!this.privateKeyPem && !this.privateKeyPath) {
        console.warn('*'.repeat(20))
        console.warn(
          'privateKeyPem is not provided, using anonymous private key. ' +
            'The corresponding public key is:\n' +
            ANONYMOUS_HEADER_PUBLIC_KEY,
        )
        console.warn('*'.repeat(20))

        const metaHeader = await metaInfoToRequestHeader(this.metaInfo, {
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
        const metaHeader = await metaInfoToRequestHeader(this.metaInfo, opts)
        Object.assign(headers, metaHeader)
      }
    }

    return headers
  }

  /** Execute a GET request. */
  async get(
    path: string,
    options?: { params?: Record<string, string>; headers?: Record<string, string> },
  ): Promise<Response> {
    const headers = await this.getHeaders()
    if (options?.headers) Object.assign(headers, options.headers)

    let url = `${this.baseUrl}${path}`
    if (options?.params) {
      const qs = new URLSearchParams(options.params).toString()
      url += `?${qs}`
    }

    return fetch(url, {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(this.timeout),
    })
  }

  /** Execute a POST request. */
  async post(
    path: string,
    options?: {
      json?: unknown
      headers?: Record<string, string>
    },
  ): Promise<Response> {
    const headers = await this.getHeaders()
    if (options?.headers) Object.assign(headers, options.headers)

    const init: RequestInit = {
      method: 'POST',
      headers,
      signal: AbortSignal.timeout(this.timeout),
    }
    if (options?.json != null) init.body = JSON.stringify(options.json)

    return fetch(`${this.baseUrl}${path}`, init)
  }

  /** Execute a PUT request. */
  async put(
    path: string,
    options?: {
      json?: unknown
      headers?: Record<string, string>
    },
  ): Promise<Response> {
    const headers = await this.getHeaders()
    if (options?.headers) Object.assign(headers, options.headers)

    const init: RequestInit = {
      method: 'PUT',
      headers,
      signal: AbortSignal.timeout(this.timeout),
    }
    if (options?.json != null) init.body = JSON.stringify(options.json)

    return fetch(`${this.baseUrl}${path}`, init)
  }

  /** Execute a PATCH request. */
  async patch(
    path: string,
    options?: {
      json?: unknown
      headers?: Record<string, string>
    },
  ): Promise<Response> {
    const headers = await this.getHeaders()
    if (options?.headers) Object.assign(headers, options.headers)

    const init: RequestInit = {
      method: 'PATCH',
      headers,
      signal: AbortSignal.timeout(this.timeout),
    }
    if (options?.json != null) init.body = JSON.stringify(options.json)

    return fetch(`${this.baseUrl}${path}`, init)
  }

  /** Execute a DELETE request. */
  async delete(
    path: string,
    options?: { headers?: Record<string, string> },
  ): Promise<Response> {
    const headers = await this.getHeaders()
    if (options?.headers) Object.assign(headers, options.headers)

    return fetch(`${this.baseUrl}${path}`, {
      method: 'DELETE',
      headers,
      signal: AbortSignal.timeout(this.timeout),
    })
  }
}
