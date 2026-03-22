import { writeFileSync, unlinkSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, it, expect, vi } from 'vitest'
import { metaInfoToRequestHeader, REQ_HEADER_META_INFO_KEY } from '../src/index'
import type { MetaInfoData } from '../src/index'

describe('metaInfoToRequestHeader', () => {
  const sampleMeta: MetaInfoData = {
    subject: '鮨大山',
    subject_code: 'wdyl_001',
    caller_id: 'user_123',
    data_coverage: '202401-202412',
    creation_slug: 'single_store_profit_model',
    creation_name: '单店盈利模型',
  }

  it('should generate X-META-INFO header with anonymous key when no key provided', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const header = await metaInfoToRequestHeader(sampleMeta)

    expect(header).toHaveProperty(REQ_HEADER_META_INFO_KEY)
    const token = header[REQ_HEADER_META_INFO_KEY]!
    // JWT format: header.payload.signature
    expect(token.split('.')).toHaveLength(3)
    expect(warnSpy).toHaveBeenCalled()
    warnSpy.mockRestore()
  })

  it('should use privateKeyPath to load key from file', async () => {
    const { generateKeyPair, exportPKCS8 } = await import('jose')
    const { privateKey } = await generateKeyPair('EdDSA', { extractable: true })
    const pem = await exportPKCS8(privateKey)

    const tmpDir = mkdtempSync(join(tmpdir(), 'hezor2-test-'))
    const keyPath = join(tmpDir, 'test_key.pem')
    writeFileSync(keyPath, pem)

    try {
      const header = await metaInfoToRequestHeader(sampleMeta, {
        privateKeyPath: keyPath,
      })
      expect(header).toHaveProperty(REQ_HEADER_META_INFO_KEY)
      expect(header[REQ_HEADER_META_INFO_KEY]!.split('.')).toHaveLength(3)
    } finally {
      unlinkSync(keyPath)
    }
  })

  it('should use privateKeyPem directly', async () => {
    const { generateKeyPair, exportPKCS8 } = await import('jose')
    const { privateKey } = await generateKeyPair('EdDSA', { extractable: true })
    const pem = await exportPKCS8(privateKey)

    const header = await metaInfoToRequestHeader(sampleMeta, {
      privateKeyPem: pem,
    })
    expect(header).toHaveProperty(REQ_HEADER_META_INFO_KEY)
    expect(header[REQ_HEADER_META_INFO_KEY]!.split('.')).toHaveLength(3)
  })

  it('should prefer privateKeyPem over privateKeyPath', async () => {
    const { generateKeyPair, exportPKCS8 } = await import('jose')
    const { privateKey } = await generateKeyPair('EdDSA', { extractable: true })
    const pem = await exportPKCS8(privateKey)

    // Even if privateKeyPath points to nonexistent file, privateKeyPem should be used
    const header = await metaInfoToRequestHeader(sampleMeta, {
      privateKeyPem: pem,
      privateKeyPath: '/nonexistent/path/key.pem',
    })
    expect(header).toHaveProperty(REQ_HEADER_META_INFO_KEY)
  })

  it('should throw for nonexistent privateKeyPath', async () => {
    await expect(
      metaInfoToRequestHeader(sampleMeta, {
        privateKeyPath: '/nonexistent/path/key.pem',
      }),
    ).rejects.toThrow()
  })

  it('should respect custom expiresIn', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const header = await metaInfoToRequestHeader(sampleMeta, {
      expiresIn: 7200,
    })
    expect(header).toHaveProperty(REQ_HEADER_META_INFO_KEY)
    warnSpy.mockRestore()
  })

  it('should handle MetaInfo with only required fields', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const minimalMeta: MetaInfoData = {
      subject: 'test',
      subject_code: 'test_001',
      caller_id: 'caller',
    }
    const header = await metaInfoToRequestHeader(minimalMeta)
    expect(header).toHaveProperty(REQ_HEADER_META_INFO_KEY)
    warnSpy.mockRestore()
  })
})
