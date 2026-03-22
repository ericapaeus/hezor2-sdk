import { describe, it, expect } from 'vitest'
import { greet, VERSION } from './index'

describe('hezor2-sdk', () => {
  it('should export VERSION', () => {
    expect(VERSION).toBe('0.1.0')
  })

  it('greet should return a greeting string', () => {
    expect(greet('World')).toBe('Hello from @hezor/hezor2-sdk, World!')
  })
})
