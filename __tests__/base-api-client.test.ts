import { writeFileSync, unlinkSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { BaseAPIClient } from '../src/index'
import type { MetaInfoData } from '../src/index'

describe('BaseAPIClient', () => {
  it('should build correct base URL (strip trailing slashes)', () => {
    const client = new BaseAPIClient({ baseUrl: 'http://localhost:8000/' })
    expect(client.baseUrl).toBe('http://localhost:8000')
  })

  it('should strip multiple trailing slashes', () => {
    const client = new BaseAPIClient({ baseUrl: 'http://localhost:8000///' })
    expect(client.baseUrl).toBe('http://localhost:8000')
  })

  it('should apply default timeout', () => {
    const client = new BaseAPIClient({ baseUrl: 'http://localhost:8000' })
    expect(client.timeout).toBe(120_000)
  })

  it('should accept custom timeout', () => {
    const client = new BaseAPIClient({ baseUrl: 'http://localhost:8000', timeout: 5_000 })
    expect(client.timeout).toBe(5_000)
  })

  it('should store all options', () => {
    const metaInfo: MetaInfoData = {
      subject: 'test',
      subject_code: 'tc',
      caller_id: 'cid',
    }
    const client = new BaseAPIClient({
      baseUrl: 'http://localhost:8000',
      apiKey: 'key',
      metaInfo,
      privateKeyPath: '/path/to/key.pem',
      privateKeyPem: 'PEM_CONTENT',
      password: 'pass',
      metaInfoExpiresIn: 7200,
      appName: 'my-app',
    })
    expect(client.apiKey).toBe('key')
    expect(client.metaInfo).toBe(metaInfo)
    expect(client.privateKeyPath).toBe('/path/to/key.pem')
    expect(client.privateKeyPem).toBe('PEM_CONTENT')
    expect(client.password).toBe('pass')
    expect(client.metaInfoExpiresIn).toBe(7200)
    expect(client.appName).toBe('my-app')
  })

  it('should default optional fields to undefined', () => {
    const client = new BaseAPIClient({ baseUrl: 'http://localhost:8000' })
    expect(client.apiKey).toBeUndefined()
    expect(client.metaInfo).toBeUndefined()
    expect(client.privateKeyPath).toBeUndefined()
    expect(client.privateKeyPem).toBeUndefined()
    expect(client.password).toBeUndefined()
    expect(client.appName).toBeUndefined()
    expect(client.metaInfoExpiresIn).toBe(3600)
  })

  it('should build headers with API key', async () => {
    const client = new BaseAPIClient({
      baseUrl: 'http://localhost:8000',
      apiKey: 'test-key',
    })
    const headers = await client.getHeaders()
    expect(headers['Authorization']).toBe('Bearer test-key')
    expect(headers['Content-Type']).toBe('application/json')
  })

  it('should include app name header', async () => {
    const client = new BaseAPIClient({
      baseUrl: 'http://localhost:8000',
      appName: 'my-app',
    })
    const headers = await client.getHeaders()
    expect(headers['X-APP-NAME']).toBe('my-app')
  })

  it('should not include Authorization if no apiKey', async () => {
    const client = new BaseAPIClient({ baseUrl: 'http://localhost:8000' })
    const headers = await client.getHeaders()
    expect(headers).not.toHaveProperty('Authorization')
  })

  it('should not include X-APP-NAME if no appName', async () => {
    const client = new BaseAPIClient({ baseUrl: 'http://localhost:8000' })
    const headers = await client.getHeaders()
    expect(headers).not.toHaveProperty('X-APP-NAME')
  })

  it('should not include X-META-INFO if no metaInfo', async () => {
    const client = new BaseAPIClient({ baseUrl: 'http://localhost:8000' })
    const headers = await client.getHeaders()
    expect(headers).not.toHaveProperty('X-META-INFO')
  })

  it('should use anonymous key for metaInfo when no private key provided', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const client = new BaseAPIClient({
      baseUrl: 'http://localhost:8000',
      metaInfo: {
        subject: 'test',
        subject_code: 'tc',
        caller_id: 'cid',
      },
    })
    const headers = await client.getHeaders()
    expect(headers).toHaveProperty('X-META-INFO')
    expect(headers['X-META-INFO']!.split('.')).toHaveLength(3)
    expect(warnSpy).toHaveBeenCalled()
    warnSpy.mockRestore()
  })

  it('should use privateKeyPem for metaInfo when provided', async () => {
    const { generateKeyPair, exportPKCS8 } = await import('jose')
    const { privateKey } = await generateKeyPair('EdDSA', { extractable: true })
    const pem = await exportPKCS8(privateKey)

    const client = new BaseAPIClient({
      baseUrl: 'http://localhost:8000',
      metaInfo: {
        subject: 'test',
        subject_code: 'tc',
        caller_id: 'cid',
      },
      privateKeyPem: pem,
    })
    const headers = await client.getHeaders()
    expect(headers).toHaveProperty('X-META-INFO')
  })

  it('should use privateKeyPath for metaInfo when provided', async () => {
    const { generateKeyPair, exportPKCS8 } = await import('jose')
    const { privateKey } = await generateKeyPair('EdDSA', { extractable: true })
    const pem = await exportPKCS8(privateKey)

    const tmpDir = mkdtempSync(join(tmpdir(), 'hezor2-test-'))
    const keyPath = join(tmpDir, 'test_key.pem')
    writeFileSync(keyPath, pem)

    try {
      const client = new BaseAPIClient({
        baseUrl: 'http://localhost:8000',
        metaInfo: {
          subject: 'test',
          subject_code: 'tc',
          caller_id: 'cid',
        },
        privateKeyPath: keyPath,
      })
      const headers = await client.getHeaders()
      expect(headers).toHaveProperty('X-META-INFO')
    } finally {
      unlinkSync(keyPath)
    }
  })

  describe('HTTP methods', () => {
    let client: BaseAPIClient
    let fetchSpy: ReturnType<typeof vi.fn>

    beforeEach(() => {
      client = new BaseAPIClient({
        baseUrl: 'http://localhost:8000',
        apiKey: 'test-key',
      })
      fetchSpy = vi.fn().mockResolvedValue(new Response('ok', { status: 200 }))
      vi.stubGlobal('fetch', fetchSpy)
    })

    it('should send GET request with correct URL', async () => {
      await client.get('/api/test')
      const [url, options] = fetchSpy.mock.calls[0]!
      expect(url).toBe('http://localhost:8000/api/test')
      expect(options.method).toBe('GET')
    })

    it('should append query params to GET request', async () => {
      await client.get('/api/test', { params: { foo: 'bar', baz: '1' } })
      const [url] = fetchSpy.mock.calls[0]!
      expect(url).toContain('?')
      expect(url).toContain('foo=bar')
      expect(url).toContain('baz=1')
    })

    it('should send POST request with JSON body', async () => {
      await client.post('/api/test', { json: { key: 'value' } })
      const [url, options] = fetchSpy.mock.calls[0]!
      expect(url).toBe('http://localhost:8000/api/test')
      expect(options.method).toBe('POST')
      expect(JSON.parse(options.body)).toEqual({ key: 'value' })
    })

    it('should send POST without body if json is undefined', async () => {
      await client.post('/api/test')
      const [, options] = fetchSpy.mock.calls[0]!
      expect(options.body).toBeUndefined()
    })

    it('should send PUT request with JSON body', async () => {
      await client.put('/api/test', { json: { updated: true } })
      const [, options] = fetchSpy.mock.calls[0]!
      expect(options.method).toBe('PUT')
      expect(JSON.parse(options.body)).toEqual({ updated: true })
    })

    it('should send PATCH request with JSON body', async () => {
      await client.patch('/api/test', { json: { field: 'new' } })
      const [, options] = fetchSpy.mock.calls[0]!
      expect(options.method).toBe('PATCH')
      expect(JSON.parse(options.body)).toEqual({ field: 'new' })
    })

    it('should send DELETE request', async () => {
      await client.delete('/api/test')
      const [url, options] = fetchSpy.mock.calls[0]!
      expect(url).toBe('http://localhost:8000/api/test')
      expect(options.method).toBe('DELETE')
    })

    it('should merge custom headers with default headers', async () => {
      await client.get('/api/test', { headers: { 'X-Custom': 'value' } })
      const [, options] = fetchSpy.mock.calls[0]!
      expect(options.headers['X-Custom']).toBe('value')
      expect(options.headers['Authorization']).toBe('Bearer test-key')
    })

    it('should allow custom headers to override defaults', async () => {
      await client.post('/api/test', {
        headers: { 'Content-Type': 'text/plain' },
      })
      const [, options] = fetchSpy.mock.calls[0]!
      expect(options.headers['Content-Type']).toBe('text/plain')
    })

    it('should set timeout signal on requests', async () => {
      const clientWithTimeout = new BaseAPIClient({
        baseUrl: 'http://localhost:8000',
        timeout: 5_000,
      })
      await clientWithTimeout.get('/api/test')
      const [, options] = fetchSpy.mock.calls[0]!
      expect(options.signal).toBeDefined()
    })
  })
})
