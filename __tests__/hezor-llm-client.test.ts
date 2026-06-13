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
  })
})
