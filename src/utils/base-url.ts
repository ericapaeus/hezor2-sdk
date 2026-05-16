/**
 * Base URL 校验与归一化。
 *
 * SDK 约定 `baseUrl` 必须是 hezor2 的完整 API 根（含 `/api/v1` 前缀），
 * 例如 `https://hezor.ai/api/v1`。所有路径都按 `${baseUrl}${path}` 拼接，
 * `path` 为不含 `/api/v1` 的相对路径。
 *
 * 在 SDK 边界做强制校验（fail fast），避免错误配置在请求阶段才以 404 形式
 * 暴露、定位困难。
 */

const API_VERSION_SUFFIX_RE = /\/api\/v\d+$/

export class InvalidBaseUrlError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'InvalidBaseUrlError'
  }
}

/**
 * 校验并归一化 baseUrl：去掉末尾 `/`，强制要求以 `/api/v<N>` 结尾。
 *
 * @throws {InvalidBaseUrlError} 当 baseUrl 为空或缺少 `/api/v<N>` 后缀。
 */
export function normalizeBaseUrl(baseUrl: string | undefined): string {
  if (!baseUrl || !baseUrl.trim()) {
    throw new InvalidBaseUrlError('baseUrl is required')
  }
  const trimmed = baseUrl.trim().replace(/\/+$/, '')
  if (!API_VERSION_SUFFIX_RE.test(trimmed)) {
    throw new InvalidBaseUrlError(
      `baseUrl must include the API version prefix "/api/v<N>" ` +
        `(e.g. "https://hezor.ai/api/v1"). Got: "${baseUrl}".`,
    )
  }
  return trimmed
}
