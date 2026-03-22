import { describe, it, expect } from 'vitest'
import {
  VERSION,
  Hezor2SDK,
  Hezor2APIClient,
  BaseAPIClient,
  loadEnv,
  mergedConfigs,
  metaInfoToRequestHeader,
  REQ_HEADER_META_INFO_KEY,
  REQ_HEADER_APP_NAME_KEY,
  ANONYMOUS_HEADER_PRIVATE_KEY,
  ANONYMOUS_HEADER_PRIVATE_KEY_PASSWORD,
  ANONYMOUS_HEADER_PUBLIC_KEY,
  DEFAULT_API_BASE_URL,
  DEFAULT_API_KEY,
} from '../src/index'

describe('hezor2-sdk exports', () => {
  it('should export VERSION', () => {
    expect(VERSION).toBe('0.1.0')
  })

  it('should export main SDK class', () => {
    expect(Hezor2SDK).toBeDefined()
    expect(typeof Hezor2SDK).toBe('function')
  })

  it('should export API client classes', () => {
    expect(Hezor2APIClient).toBeDefined()
    expect(BaseAPIClient).toBeDefined()
  })

  it('should export constants', () => {
    expect(REQ_HEADER_META_INFO_KEY).toBe('X-META-INFO')
    expect(REQ_HEADER_APP_NAME_KEY).toBe('X-APP-NAME')
  })

  it('should export anonymous key constants', () => {
    expect(ANONYMOUS_HEADER_PRIVATE_KEY).toContain('BEGIN ENCRYPTED PRIVATE KEY')
    expect(ANONYMOUS_HEADER_PRIVATE_KEY_PASSWORD).toBe('file_password')
    expect(ANONYMOUS_HEADER_PUBLIC_KEY).toContain('BEGIN PUBLIC KEY')
  })

  it('should export default env config values', () => {
    expect(DEFAULT_API_BASE_URL).toBeDefined()
    expect(DEFAULT_API_KEY).toBeDefined()
  })

  it('should export metaInfoToRequestHeader function', () => {
    expect(typeof metaInfoToRequestHeader).toBe('function')
  })

  it('should export mergedConfigs function', () => {
    expect(typeof mergedConfigs).toBe('function')
  })
})
