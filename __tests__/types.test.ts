import { describe, it, expect } from 'vitest'
import { mergedConfigs } from '@hezor/hezor2-sdk'
import type { PullConfigsResponse } from '@hezor/hezor2-sdk'

describe('mergedConfigs', () => {
  it('should merge public and user configs with user taking priority', () => {
    const resp: PullConfigsResponse = {
      public: { KEY: 'public_value', ONLY_PUBLIC: 'x' },
      user: { KEY: 'user_value' },
    }
    const merged = mergedConfigs(resp)
    expect(merged).toEqual({
      KEY: 'user_value',
      ONLY_PUBLIC: 'x',
    })
  })

  it('should return empty object for empty configs', () => {
    const resp: PullConfigsResponse = { public: {}, user: {} }
    expect(mergedConfigs(resp)).toEqual({})
  })

  it('should include all user-only keys', () => {
    const resp: PullConfigsResponse = {
      public: {},
      user: { A: '1', B: '2' },
    }
    const merged = mergedConfigs(resp)
    expect(merged).toEqual({ A: '1', B: '2' })
  })
})
