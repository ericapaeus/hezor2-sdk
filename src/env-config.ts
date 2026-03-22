/**
 * Hezor2 environment configuration.
 *
 * Reads configuration from environment variables (or provided defaults).
 * Mirrors hezor_common.transfer.hezor2_sdk.env_config.
 */

import dotenv from 'dotenv'

export interface Hezor2EnvConfig {
  /** API base URL */
  hezor2ApiBaseUrl: string
  /** API key for authentication */
  hezor2ApiKey: string
  /** Private key file path for JWT signing (optional) */
  hezor2HeaderPkFilepath: string | undefined
  /** Password for encrypted private key (optional) */
  hezor2HeaderPkPassword: string | undefined
  /** Application name for X-APP-NAME header (optional) */
  hezor2AppName: string | undefined
}

/**
 * Load environment configuration.
 *
 * @param envFileOrOverrides - Path to a .env file, or overrides object
 * @param overrides - Optional overrides (only when first arg is envFile path)
 * @returns Resolved Hezor2EnvConfig
 */
export function loadEnv(
  envFileOrOverrides?: string | Partial<Hezor2EnvConfig>,
  overrides?: Partial<Hezor2EnvConfig>,
): Hezor2EnvConfig {
  let envFileValues: Record<string, string> = {}
  let finalOverrides: Partial<Hezor2EnvConfig> | undefined

  if (typeof envFileOrOverrides === 'string') {
    const parsed = dotenv.config({ path: envFileOrOverrides, override: false })
    envFileValues = (parsed.parsed ?? {}) as Record<string, string>
    finalOverrides = overrides
  } else {
    finalOverrides = envFileOrOverrides
  }

  return {
    hezor2ApiBaseUrl:
      finalOverrides?.hezor2ApiBaseUrl ??
      process.env['HEZOR2_API_BASE_URL'] ??
      envFileValues['HEZOR2_API_BASE_URL'] ??
      'http://localhost:8000',
    hezor2ApiKey:
      finalOverrides?.hezor2ApiKey ??
      process.env['HEZOR2_API_KEY'] ??
      envFileValues['HEZOR2_API_KEY'] ??
      'test-api-key',
    hezor2HeaderPkFilepath:
      finalOverrides?.hezor2HeaderPkFilepath ??
      process.env['HEZOR2_HEADER_PK_FILEPATH'] ??
      envFileValues['HEZOR2_HEADER_PK_FILEPATH'] ??
      undefined,
    hezor2HeaderPkPassword:
      finalOverrides?.hezor2HeaderPkPassword ??
      process.env['HEZOR2_HEADER_PK_PASSWORD'] ??
      envFileValues['HEZOR2_HEADER_PK_PASSWORD'] ??
      undefined,
    hezor2AppName:
      finalOverrides?.hezor2AppName ??
      process.env['HEZOR2_APP_NAME'] ??
      envFileValues['HEZOR2_APP_NAME'] ??
      undefined,
  }
}

const _defaultConfig = loadEnv()

export const DEFAULT_API_BASE_URL = _defaultConfig.hezor2ApiBaseUrl
export const DEFAULT_API_KEY = _defaultConfig.hezor2ApiKey
