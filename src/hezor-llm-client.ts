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
import type { ChatMessage } from './types.js'

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
    const base = options.baseUrl.replace(/\/+$/, '')
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
   * @param messages  - 消息列表
   * @param onDelta   - 每次收到新 token 时触发，参数为**累计**全文（而非增量片段）
   * @param options.temperature - 温度，默认 0.2
   * @param options.model - 覆盖实例默认模型
   * @returns 完整 assistant 文本（与 onDelta 最后一次参数相同）
   */
  async chatCompletionStream(
    messages: ChatMessage[],
    onDelta: (accumulated: string) => void,
    options?: { temperature?: number; model?: string },
  ): Promise<string> {
    const stream = await this.openai.chat.completions.create({
      model: options?.model ?? this.model,
      messages,
      temperature: options?.temperature ?? 0.2,
      stream: true,
    })

    let accumulated = ''
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content ?? ''
      if (delta) {
        accumulated += delta
        onDelta(accumulated)
      }
    }
    return accumulated
  }
}
