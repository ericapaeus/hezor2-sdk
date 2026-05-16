import { describe, it, expect } from 'vitest'

import { normalizeBaseUrl, InvalidBaseUrlError } from '@hezor/hezor2-sdk'

describe('normalizeBaseUrl', () => {
  it('accepts a baseUrl ending with /api/v1', () => {
    expect(normalizeBaseUrl('https://hezor.ai/api/v1')).toBe('https://hezor.ai/api/v1')
  })

  it('accepts /api/v2 etc. (any positive version)', () => {
    expect(normalizeBaseUrl('https://hezor.ai/api/v2')).toBe('https://hezor.ai/api/v2')
  })

  it('strips trailing slashes after validation', () => {
    expect(normalizeBaseUrl('http://localhost:8000/api/v1/')).toBe(
      'http://localhost:8000/api/v1',
    )
    expect(normalizeBaseUrl('http://localhost:8000/api/v1///')).toBe(
      'http://localhost:8000/api/v1',
    )
  })

  it('throws when baseUrl is empty / whitespace / undefined', () => {
    expect(() => normalizeBaseUrl('')).toThrow(InvalidBaseUrlError)
    expect(() => normalizeBaseUrl('   ')).toThrow(InvalidBaseUrlError)
    expect(() => normalizeBaseUrl(undefined)).toThrow(InvalidBaseUrlError)
  })

  it('throws with actionable message when /api/v<N> suffix is missing', () => {
    expect(() => normalizeBaseUrl('https://hezor.ai')).toThrow(
      /must include the API version prefix "\/api\/v<N>"/,
    )
  })

  it('throws when /api/v1 is not at the end of the URL', () => {
    // 防止用户传整段 URL（例如带 query 或后续 path），强制只接受 API 根
    expect(() => normalizeBaseUrl('https://hezor.ai/api/v1/oauth/token')).toThrow(
      InvalidBaseUrlError,
    )
  })
})
