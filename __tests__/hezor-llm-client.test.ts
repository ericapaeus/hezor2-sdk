import { describe, it, expect, vi, beforeEach } from 'vitest'
import { HezorLLMClient } from '@hezor/hezor2-sdk'

const BASE_URL = 'http://localhost:8000/api/v1'
const USER_TOKEN = 'test-user-oauth-token'

// 伪造 openai 模块，避免实际 HTTP 请求
vi.mock('openai', () => {
  const mockCreate = vi.fn()
  const OpenAI = vi.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: mockCreate,
      },
    },
  }))
  // 将 mockCreate 挂到 OpenAI 本身方便在测试里取用
  ;(OpenAI as unknown as Record<string, unknown>)._mockCreate = mockCreate
  return { default: OpenAI }
})

describe('HezorLLMClient', () => {
  let client: HezorLLMClient
  let mockCreate: ReturnType<typeof vi.fn>

  beforeEach(async () => {
    vi.clearAllMocks()
    client = new HezorLLMClient({ baseUrl: BASE_URL, userToken: USER_TOKEN })

    // 通过 openai 模块拿到 mock create（动态 import 同一个 mock）
    const { default: OpenAI } = await import('openai')
    mockCreate = (OpenAI as unknown as Record<string, ReturnType<typeof vi.fn>>)._mockCreate
  })

  // ── chatCompletion ────────────────────────────────────────────────────────

  describe('chatCompletion', () => {
    it('happy path — 返回 assistant 文本', async () => {
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: 'Hello, hezor!' } }],
      })

      const result = await client.chatCompletion([{ role: 'user', content: '你好' }])

      expect(result).toBe('Hello, hezor!')
      expect(mockCreate).toHaveBeenCalledOnce()
      const callArgs = mockCreate.mock.calls[0]![0]
      expect(callArgs.stream).toBe(false)
      expect(callArgs.messages).toEqual([{ role: 'user', content: '你好' }])
      expect(callArgs.temperature).toBe(0.2)
    })

    it('temperature 参数透传', async () => {
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: 'ok' } }],
      })

      await client.chatCompletion([{ role: 'user', content: 'test' }], { temperature: 0.8 })
      const callArgs = mockCreate.mock.calls[0]![0]
      expect(callArgs.temperature).toBe(0.8)
    })

    it('模型返回空内容 — 抛出 Error', async () => {
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: '' } }],
      })

      await expect(
        client.chatCompletion([{ role: 'user', content: 'test' }]),
      ).rejects.toThrow(/no content/)
    })

    it('choices 为空 — 抛出 Error', async () => {
      mockCreate.mockResolvedValue({ choices: [] })

      await expect(
        client.chatCompletion([{ role: 'user', content: 'test' }]),
      ).rejects.toThrow(/no content/)
    })

    it('网络错误 — 原样向上抛出', async () => {
      mockCreate.mockRejectedValue(new Error('network timeout'))

      await expect(
        client.chatCompletion([{ role: 'user', content: 'test' }]),
      ).rejects.toThrow('network timeout')
    })
  })

  // ── chatCompletionStream ──────────────────────────────────────────────────

  describe('chatCompletionStream', () => {
    it('happy path — 逐 token 回调并返回全文', async () => {
      // 模拟 async iterable stream
      async function* fakeStream() {
        yield { choices: [{ delta: { content: 'Hello' } }] }
        yield { choices: [{ delta: { content: ', ' } }] }
        yield { choices: [{ delta: { content: 'world' } }] }
      }
      mockCreate.mockResolvedValue(fakeStream())

      const deltas: string[] = []
      const result = await client.chatCompletionStream(
        [{ role: 'user', content: 'stream test' }],
        (accumulated) => deltas.push(accumulated),
      )

      expect(result).toBe('Hello, world')
      // onDelta 收到的是累计全文
      expect(deltas).toEqual(['Hello', 'Hello, ', 'Hello, world'])
    })

    it('stream: true 传给 openai SDK', async () => {
      async function* emptyStream() {
        // 无内容
      }
      mockCreate.mockResolvedValue(emptyStream())

      await client.chatCompletionStream([], vi.fn())
      const callArgs = mockCreate.mock.calls[0]![0]
      expect(callArgs.stream).toBe(true)
    })

    // ── hezor_event 透出（retry_notice / fallback_notice） ──────────────────

    it('retry_notice — 经 onEvent 透出，且不混入正文累积', async () => {
      async function* fakeStream() {
        // retry_notice：提示文案走 reasoning_content（不进入 content）
        yield {
          choices: [
            {
              delta: {
                reasoning_content: '（检测到空流，正在自动重试…）',
                hezor_event: {
                  type: 'retry_notice',
                  reason: 'empty_stream',
                  attempt: 1,
                  max_attempts: 3,
                  next_retry_in: 1.0,
                },
              },
            },
          ],
        }
        // 正常正文
        yield { choices: [{ delta: { content: '这是正常回答' } }] }
      }
      mockCreate.mockResolvedValue(fakeStream())

      const events: any[] = []
      const deltas: string[] = []
      const result = await client.chatCompletionStream(
        [{ role: 'user', content: 'hi' }],
        (acc) => deltas.push(acc),
        { onEvent: (e) => events.push(e) },
      )

      // 正文累积不含 retry_notice 的提示文案
      expect(result).toBe('这是正常回答')
      expect(deltas).toEqual(['这是正常回答'])
      // 事件透出完整字段
      expect(events).toHaveLength(1)
      expect(events[0]!.type).toBe('retry_notice')
      expect(events[0]!.reason).toBe('empty_stream')
      expect(events[0]!.attempt).toBe(1)
      expect(events[0]!.max_attempts).toBe(3)
      expect(events[0]!.next_retry_in).toBe(1.0)
      expect(events[0]!.payload).toEqual({
        type: 'retry_notice',
        reason: 'empty_stream',
        attempt: 1,
        max_attempts: 3,
        next_retry_in: 1.0,
      })
    })

    it('fallback_notice — 经 onEvent 透出，兜底文案仍进入正文（向后兼容）', async () => {
      async function* fakeStream() {
        // fallback_notice：兜底文案走 content，最终以 finish_reason=stop 结束
        yield {
          choices: [
            {
              delta: {
                content: '抱歉，暂时无法完成该请求，请稍后重试。',
                hezor_event: {
                  type: 'fallback_notice',
                  reason: 'overload',
                  attempt: 3,
                  max_attempts: 3,
                },
              },
              finish_reason: 'stop',
            },
          ],
        }
      }
      mockCreate.mockResolvedValue(fakeStream())

      const events: any[] = []
      const result = await client.chatCompletionStream(
        [{ role: 'user', content: 'hi' }],
        vi.fn(),
        { onEvent: (e) => events.push(e) },
      )

      // 兜底文案与旧行为一致进入返回（向后兼容），但同时能识别出这是兜底
      expect(result).toContain('暂时无法完成')
      expect(events).toHaveLength(1)
      expect(events[0]!.type).toBe('fallback_notice')
      expect(events[0]!.reason).toBe('overload')
      expect(events[0]!.attempt).toBe(3)
      expect(events[0]!.max_attempts).toBe(3)
      expect(events[0]!.next_retry_in).toBeUndefined()
    })

    it('未提供 onEvent — hezor_event 静默忽略，行为与旧客户端一致', async () => {
      async function* fakeStream() {
        yield {
          choices: [
            {
              delta: {
                content: '正常回答',
                hezor_event: { type: 'fallback_notice', reason: 'overload' },
              },
            },
          ],
        }
      }
      mockCreate.mockResolvedValue(fakeStream())

      const result = await client.chatCompletionStream(
        [{ role: 'user', content: 'hi' }],
        vi.fn(),
      )

      expect(result).toBe('正常回答')
    })
  })
})
