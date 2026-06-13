/**
 * SiliconRuntimeClient — Silicon Runtime 生命周期管理
 *
 * 封装 hello-hezor / silicon-runtime-integration 等客户端对
 * hezor2 `/silicon/runtimes/*` 接口的四条裸 fetch 调用：
 *
 *   - autoProvision   POST /silicon/runtimes/auto-provision
 *   - listRuntimes    GET  /silicon/runtimes
 *   - deregisterRuntime DELETE /silicon/runtimes/{rid}（204/404 均幂等成功）
 *   - refreshTunnelToken POST /silicon/runtimes/{rid}/refresh-tunnel-token
 *
 * 所有方法鉴权均由调用方传入动态 token（userToken / tunnelToken），
 * 不在构造函数中固化——两类 token 的续期逻辑在 hello-hezor 侧管理。
 *
 * MUST NOT：不把任何 token 写进日志 / 错误消息。
 */

import { SiliconOwnerBoundError } from './errors.js'
import type {
  AutoProvisionRequest,
  AutoProvisionResponse,
  RefreshTunnelTokenResponse,
  SiliconRuntime,
} from './types.js'
import { normalizeBaseUrl } from './utils/base-url.js'

export interface SiliconRuntimeClientOptions {
  /** hezor2 API base URL，**必须包含 `/api/v1` 前缀**。 */
  baseUrl: string
  /** 请求超时毫秒数，默认 30 000。 */
  timeout?: number
}

export class SiliconRuntimeClient {
  private readonly baseUrl: string
  private readonly timeout: number

  constructor(options: SiliconRuntimeClientOptions) {
    this.baseUrl = normalizeBaseUrl(options.baseUrl)
    this.timeout = options.timeout ?? 30_000
  }

  /**
   * 注册（或复用）当前设备的 Silicon Runtime。
   *
   * @param req   - 设备信息（device_id 必填）
   * @param userToken - 当前用户的 OAuth access_token
   * @throws {SiliconOwnerBoundError} 同 device_id 已被其他账号占用
   */
  async autoProvision(
    req: AutoProvisionRequest,
    userToken: string,
  ): Promise<AutoProvisionResponse> {
    const resp = await fetch(`${this.baseUrl}/silicon/runtimes/auto-provision`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${userToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(req),
      signal: AbortSignal.timeout(this.timeout),
    })

    if (!resp.ok) {
      const text = await resp.text().catch(() => '')
      // 解析 SILICON_RUNTIME_OWNER_BOUND 错误码
      let code = ''
      try {
        const body = JSON.parse(text) as {
          code?: string
          detail?: { code?: string } | string
        }
        const detail = body.detail
        code =
          body.code ?? (typeof detail === 'object' && detail !== null ? (detail.code ?? '') : '')
      } catch {
        // 非 JSON 响应
      }
      if (code === 'SILICON_RUNTIME_OWNER_BOUND') {
        throw new SiliconOwnerBoundError(
          'device_id 已被其他 hezor 账号绑定，如需切换账号请先在平台注销原 runtime',
        )
      }
      throw new Error(`auto-provision failed: HTTP ${resp.status}`)
    }

    return (await resp.json()) as AutoProvisionResponse
  }

  /**
   * 获取当前用户名下的 Silicon Runtime 列表。
   *
   * @param userToken - 当前用户的 OAuth access_token
   */
  async listRuntimes(userToken: string): Promise<SiliconRuntime[]> {
    const resp = await fetch(`${this.baseUrl}/silicon/runtimes`, {
      headers: { Authorization: `Bearer ${userToken}` },
      signal: AbortSignal.timeout(this.timeout),
    })

    if (resp.status === 401 || resp.status === 403) {
      throw new Error(`listRuntimes: HTTP ${resp.status} — token may have expired`)
    }
    if (!resp.ok) {
      throw new Error(`listRuntimes: HTTP ${resp.status}`)
    }

    return (await resp.json()) as SiliconRuntime[]
  }

  /**
   * 注销指定 Silicon Runtime（幂等：404 视作已删除）。
   *
   * @param runtimeId - 要注销的 runtime ID
   * @param userToken - 当前用户的 OAuth access_token（runtime owner）
   */
  async deregisterRuntime(runtimeId: string, userToken: string): Promise<void> {
    const resp = await fetch(`${this.baseUrl}/silicon/runtimes/${encodeURIComponent(runtimeId)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${userToken}` },
      signal: AbortSignal.timeout(this.timeout),
    })

    // 204 成功；404 runtime 已不存在 → 幂等
    if (resp.status === 204 || resp.status === 404) return

    const errText = await resp.text().catch(() => '')
    throw new Error(`deregisterRuntime: HTTP ${resp.status} ${errText.slice(0, 200)}`)
  }

  /**
   * 用当前 tunnel_token 换一枚新的（旧 token 立即失效）。
   *
   * @param runtimeId  - 当前 runtime ID
   * @param tunnelToken - 当前有效的 tunnel_token（不是 user token）
   */
  async refreshTunnelToken(
    runtimeId: string,
    tunnelToken: string,
  ): Promise<RefreshTunnelTokenResponse> {
    const resp = await fetch(
      `${this.baseUrl}/silicon/runtimes/${encodeURIComponent(runtimeId)}/refresh-tunnel-token`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${tunnelToken}`,
          'Content-Type': 'application/json',
        },
        body: '{}',
        signal: AbortSignal.timeout(this.timeout),
      },
    )

    if (!resp.ok) {
      const text = await resp.text().catch(() => '')
      throw new Error(`refreshTunnelToken: HTTP ${resp.status} ${text.slice(0, 200)}`)
    }

    return (await resp.json()) as RefreshTunnelTokenResponse
  }
}
