/**
 * HezorLLMClient — 通过 hezor2 OpenAI-compatible API 调用 LLM
 *
 * 封装 hello-hezor `caller-llm.ts` 等客户端对
 * `${baseUrl}/openai/latest/chat/completions` 的裸 fetch 调用。
 *
 * 使用 `openai` SDK，构造时把 hezor `/openai/latest` 作为 `baseURL`，
 * 把 **用户 OAuth access_token** 作为 `apiKey`。用量自动归 caller 名下。
 *
 * MUST:
 *   - Authorization: Bearer <access_token>（openai SDK 内部处理）
 * MUST NOT:
 *   - 不透传 X-Hezor-User-Id / X-Hezor-Runtime-Id / 任何 tunnel 头
 *   - 不把 access_token 写进任何日志 / 错误消息
 */

import OpenAI from 'openai'
import type {
  ChatMessage,
  HezorNoticeReason,
  HezorStreamEvent,
  HezorStreamEventType,
} from './types.js'
import { normalizeBaseUrl } from './utils/base-url.js'

export interface HezorLLMClientOptions {
  /**
   * hezor2 API base URL，**必须包含 `/api/v1` 前缀**
   * （如 `https://hezor.ai/api/v1`）。
   * SDK 内部拼接为 `${baseUrl}/openai/latest` 作为 OpenAI baseURL。
   */
  baseUrl: string
  /** 用户 OAuth access_token，作为 Bearer 鉴权。续期时重新构造实例。 */
  userToken: string
  /** 模型名称，默认 `hezor-donare`。 */
  model?: string
  /** 请求超时毫秒数，默认 120 000。 */
  timeout?: number
}

export class HezorLLMClient {
  private readonly openai: OpenAI
  private readonly model: string

  constructor(options: HezorLLMClientOptions) {
    const base = normalizeBaseUrl(options.baseUrl)
    this.openai = new OpenAI({
      apiKey: options.userToken,
      baseURL: `${base}/openai/latest`,
      timeout: options.timeout ?? 120_000,
    })
    this.model = options.model ?? 'hezor-donare'
  }

  /**
   * 非流式 chat completion，返回第一条 assistant 文本。
   *
   * 适合"贴文本→总结"等一次性业务调用（非 agent 回合内）。
   *
   * @param messages - 消息列表（role + content）
   * @param options.temperature - 温度，默认 0.2
   * @param options.model - 覆盖实例默认模型
   * @returns assistant 文本内容
   * @throws {Error} 网络错误 / 模型返回空内容
   */
  async chatCompletion(
    messages: ChatMessage[],
    options?: { temperature?: number; model?: string },
  ): Promise<string> {
    const completion = await this.openai.chat.completions.create({
      model: options?.model ?? this.model,
      messages,
      temperature: options?.temperature ?? 0.2,
      stream: false,
    })

    const content = completion.choices[0]?.message?.content ?? ''
    if (!content) {
      throw new Error('HezorLLMClient: upstream returned no content')
    }
    return content
  }

  /**
   * 流式 chat completion，通过回调逐 token 推送增量文本。
   *
   * 适合在 agent worker 内联调 LLM 并实时渲染打字机效果
   * （非经 PST 路径的直接业务调用）。
   *
   * Hezor 后端在检测到逻辑性失败（空流 / 长度耗尽 / overload 等）时会在流中
   * 插入携带 `hezor_event.type` 的合成 chunk：
   * - `retry_notice`：提示文案走 `delta.reasoning_content`，**不会**混入
   *   `onDelta` 的正文累积，但会经 `options.onEvent` 透出，便于调用方渲染
   *   "AI 正在重试"的轻量提示。
   * - `fallback_notice`：兜底文案走 `delta.content`，会混入 `onDelta` 的正文
   *   累积（向后兼容），同时经 `options.onEvent` 透出。调用方可据
   *   `type === 'fallback_notice'` 识别这是兜底文案而非模型的真实回答，自行
   *   决定如何渲染 / 是否从正文中剔除 / 是否引导用户重新生成。
   *
   * @param messages  - 消息列表
   * @param onDelta   - 每次收到新 token 时触发，参数为**累计**全文（而非增量片段）
   * @param options.temperature - 温度，默认 0.2
   * @param options.model - 覆盖实例默认模型
   * @param options.onEvent - 收到 Hezor 扩展事件（`hezor_event`）时触发，
   *       可用于识别 `retry_notice` / `fallback_notice` 等并渲染专属 UI
   * @returns 完整 assistant 文本（与 onDelta 最后一次参数相同）
   */
  async chatCompletionStream(
    messages: ChatMessage[],
    onDelta: (accumulated: string) => void,
    options?: {
      temperature?: number
      model?: string
      onEvent?: (event: HezorStreamEvent) => void
    },
  ): Promise<string> {
    const stream = await this.openai.chat.completions.create({
      model: options?.model ?? this.model,
      messages,
      temperature: options?.temperature ?? 0.2,
      stream: true,
    })

    let accumulated = ''
    for await (const chunk of stream) {
      this.emitHezorEvent(chunk, options?.onEvent)
      const delta = chunk.choices[0]?.delta?.content ?? ''
      if (delta) {
        accumulated += delta
        onDelta(accumulated)
      }
    }
    return accumulated
  }

  /**
   * 从 OpenAI compatible 的 chunk 里解析并透出 Hezor 扩展事件 `hezor_event`。
   *
   * 只有当 chunk 的 delta 携带 `hezor_event.type` 且调用方提供了
   * `onEvent` 回调时才触发，否则静默跳过（兼容旧客户端与标准 OpenAI 行为）。
   */
  private emitHezorEvent(
    chunk: unknown,
    onEvent: ((event: HezorStreamEvent) => void) | undefined,
  ): void {
    if (!onEvent) return
    const rawEvent = this.extractHezorEvent(chunk)
    if (!rawEvent) return

    const type = rawEvent['type'] as HezorStreamEventType | undefined
    if (!type) return

    const event: HezorStreamEvent = {
      type,
      payload: rawEvent,
    }
    const reason = rawEvent['reason']
    if (typeof reason === 'string' && isHezorNoticeReason(reason)) {
      event['reason'] = reason
    }
    const attempt = rawEvent['attempt']
    if (typeof attempt === 'number') {
      event['attempt'] = attempt
    }
    const maxAttempts = rawEvent['max_attempts']
    if (typeof maxAttempts === 'number') {
      event['max_attempts'] = maxAttempts
    }
    const nextRetryIn = rawEvent['next_retry_in']
    if (typeof nextRetryIn === 'number') {
      event['next_retry_in'] = nextRetryIn
    }
    onEvent(event)
  }

  /** 从 stream chunk 中取出 `hezor_event` 字段（Chat Completions 走 delta）。 */
  private extractHezorEvent(chunk: unknown): Record<string, unknown> | undefined {
    if (!chunk || typeof chunk !== 'object') return undefined
    const c = chunk as Record<string, unknown>
    const choice = Array.isArray(c['choices']) ? c['choices'][0] : undefined
    if (!choice || typeof choice !== 'object') return undefined
    const delta = (choice as Record<string, unknown>)['delta']
    if (!delta || typeof delta !== 'object') return undefined
    const hezorEvent = (delta as Record<string, unknown>)['hezor_event']
    if (!hezorEvent || typeof hezorEvent !== 'object') return undefined
    return hezorEvent as Record<string, unknown>
  }
}

/** 判断是否为已知的 `retry_notice` / `fallback_notice` 失败分类。 */
function isHezorNoticeReason(value: string): value is HezorNoticeReason {
  return (
    value === 'empty_stream' ||
    value === 'length_limit' ||
    value === 'content_filter' ||
    value === 'overload' ||
    value === 'embedded_error'
  )
}
