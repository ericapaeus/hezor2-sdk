import { describe, it, expect } from 'vitest'
import { loadEnv } from '@hezor/hezor2-sdk'

describe('loadEnv', () => {
  it('should return default config when no env vars set', () => {
    const config = loadEnv()
    expect(config.hezor2ApiBaseUrl).toBe('http://localhost:8000')
    expect(config.hezor2ApiKey).toBe('test-api-key')
    expect(config.hezor2HeaderPkFilepath).toBeUndefined()
    expect(config.hezor2HeaderPkPassword).toBeUndefined()
    expect(config.hezor2AppName).toBeUndefined()
  })

  it('should accept overrides', () => {
    const config = loadEnv({
      hezor2ApiBaseUrl: 'https://api.custom.com',
      hezor2ApiKey: 'my-key',
    })
    expect(config.hezor2ApiBaseUrl).toBe('https://api.custom.com')
    expect(config.hezor2ApiKey).toBe('my-key')
  })

  it('should read from environment variables', () => {
    const prev = process.env['HEZOR2_APP_NAME']
    process.env['HEZOR2_APP_NAME'] = 'env-app'
    try {
      const config = loadEnv()
      expect(config.hezor2AppName).toBe('env-app')
    } finally {
      if (prev === undefined) delete process.env['HEZOR2_APP_NAME']
      else process.env['HEZOR2_APP_NAME'] = prev
    }
  })

  it('should prefer overrides over env vars', () => {
    const prev = process.env['HEZOR2_APP_NAME']
    process.env['HEZOR2_APP_NAME'] = 'env-app'
    try {
      const config = loadEnv({ hezor2AppName: 'override-app' })
      expect(config.hezor2AppName).toBe('override-app')
    } finally {
      if (prev === undefined) delete process.env['HEZOR2_APP_NAME']
      else process.env['HEZOR2_APP_NAME'] = prev
    }
  })

  it('should accept all optional fields', () => {
    const config = loadEnv({
      hezor2HeaderPkFilepath: '/path/to/key.pem',
      hezor2HeaderPkPassword: 'secret',
      hezor2AppName: 'my-app',
    })
    expect(config.hezor2HeaderPkFilepath).toBe('/path/to/key.pem')
    expect(config.hezor2HeaderPkPassword).toBe('secret')
    expect(config.hezor2AppName).toBe('my-app')
  })
})
