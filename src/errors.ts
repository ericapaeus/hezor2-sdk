/**
 * Hezor 通用错误类（TypeScript 版）。
 *
 * 与 `hezor_common.exceptions` 一一对应，便于跨语言序列化的错误码统一。
 *
 * - `code`：OAuth 风格短 token（`invalid_scope` / `invalid_grant` / ...）
 * - `detail`：人类可读说明
 * - `statusCode`：建议的 HTTP 状态码
 *
 * `BaseAPIClient` 在 R1 引入 402 拦截后会在收到 402 响应时构造
 * `SubscriptionRequiredError` 并触发 `onSubscriptionRequired` 回调。
 */

export class HezorError extends Error {
  readonly code: string
  readonly detail: string
  readonly statusCode: number

  constructor(params: { code: string; detail: string; statusCode?: number }) {
    super(params.detail)
    this.name = 'HezorError'
    this.code = params.code
    this.detail = params.detail
    this.statusCode = params.statusCode ?? 400
  }
}

/** 402 — 用户访问需要订阅但当前未订阅的资源。 */
export class SubscriptionRequiredError extends HezorError {
  constructor(detail: string = 'subscription required') {
    super({ code: 'subscription_required', detail, statusCode: 402 })
    this.name = 'SubscriptionRequiredError'
  }
}

// --- OAuth ---

export class OAuthError extends HezorError {
  constructor(params: { code: string; detail: string; statusCode?: number }) {
    super(params)
    this.name = 'OAuthError'
  }
}

export class ScopeNotAllowedError extends OAuthError {
  constructor(detail: string = 'scope not allowed') {
    super({ code: 'invalid_scope', detail, statusCode: 400 })
    this.name = 'ScopeNotAllowedError'
  }
}

export class ToolkitSubscriptionRequiredError extends OAuthError {
  constructor(detail: string = 'toolkit subscription required') {
    super({ code: 'toolkit_subscription_required', detail, statusCode: 403 })
    this.name = 'ToolkitSubscriptionRequiredError'
  }
}

export class InvalidRedirectUriError extends OAuthError {
  constructor(detail: string = 'redirect_uri not registered') {
    super({ code: 'invalid_redirect_uri', detail, statusCode: 400 })
    this.name = 'InvalidRedirectUriError'
  }
}

export class ClientNotFoundError extends OAuthError {
  constructor(detail: string = 'client not found or oauth disabled') {
    super({ code: 'invalid_client', detail, statusCode: 400 })
    this.name = 'ClientNotFoundError'
  }
}

export class OAuthInvalidGrantError extends OAuthError {
  constructor(detail: string = 'invalid or expired authorization code') {
    super({ code: 'invalid_grant', detail, statusCode: 400 })
    this.name = 'OAuthInvalidGrantError'
  }
}

// --- Connect ---

export class ConnectError extends HezorError {
  constructor(params: { code: string; detail: string; statusCode?: number }) {
    super(params)
    this.name = 'ConnectError'
  }
}

export class ConnectInvalidGrantError extends ConnectError {
  constructor(detail: string = 'invalid or expired connect_code') {
    super({ code: 'invalid_grant', detail, statusCode: 400 })
    this.name = 'ConnectInvalidGrantError'
  }
}

export class ConnectAppMismatchError extends ConnectError {
  constructor(detail: string = 'app_name mismatch with issued code') {
    super({ code: 'invalid_grant', detail, statusCode: 400 })
    this.name = 'ConnectAppMismatchError'
  }
}
