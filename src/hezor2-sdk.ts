/**
 * Hezor2SDK — unified async SDK interface.
 *
 * Mirrors hezor_common.transfer.hezor2_sdk.sdk.Hezor2SDK.
 *
 * TypeScript doesn't have Python's async context managers, so we provide
 * explicit `create()` / `close()` and a static `with()` helper for
 * scoped usage.
 */

import { DEFAULT_API_BASE_URL, DEFAULT_API_KEY } from './env-config.js'
import { Hezor2APIClient } from './hezor2-api-client.js'
import type { MetaInfoData } from './meta-info.js'
import type {
  AppCertInfo,
  ConnectRefreshResponse,
  ConnectVerifyResponse,
  CreationGenerateResult,
  CreationGenerateResultV2,
  DataRetrieveResult,
  GraphQueryResult,
  KnowledgeSearchResult,
  PublicReportsResponseData,
  PublishCreationResponseData,
  PullConfigsResponse,
  ReportMetadata,
  UserAppBindingInfo,
  WebhookActionHelp,
} from './types.js'

export interface Hezor2SDKOptions {
  /** API base URL (default: from env or http://localhost:8000) */
  baseUrl?: string | undefined
  /** Request timeout in milliseconds (default: 120000) */
  timeout?: number | undefined
  /** API key for Bearer token authentication */
  apiKey?: string | undefined
  /** Meta information for JWT header generation */
  metaInfo?: MetaInfoData | undefined
  /** Path to PEM-encoded private key file for JWT signing */
  privateKeyPath?: string | undefined
  /** PEM-encoded private key for JWT signing */
  privateKeyPem?: string | undefined
  /** Password for encrypted private key */
  password?: string | undefined
  /** JWT token expiration in seconds (default: 3600) */
  metaInfoExpiresIn?: number | undefined
  /** Application name for X-APP-NAME header */
  appName?: string | undefined
}

export class Hezor2SDK {
  private readonly client: Hezor2APIClient

  constructor(options: Hezor2SDKOptions = {}) {
    this.client = new Hezor2APIClient({
      baseUrl: options.baseUrl ?? DEFAULT_API_BASE_URL,
      timeout: options.timeout,
      apiKey: options.apiKey ?? DEFAULT_API_KEY,
      metaInfo: options.metaInfo,
      privateKeyPath: options.privateKeyPath,
      privateKeyPem: options.privateKeyPem,
      password: options.password,
      metaInfoExpiresIn: options.metaInfoExpiresIn,
      appName: options.appName,
    })
  }

  /**
   * Scoped usage helper — similar to Python's `async with Hezor2SDK() as sdk:`.
   *
   * @example
   * ```ts
   * const result = await Hezor2SDK.with({ apiKey: 'xxx' }, async (sdk) => {
   *   return sdk.generateReportId(3)
   * })
   * ```
   */
  static async with<T>(options: Hezor2SDKOptions, fn: (sdk: Hezor2SDK) => Promise<T>): Promise<T> {
    const sdk = new Hezor2SDK(options)
    return fn(sdk)
  }

  /** Generate unique report IDs with `rpt_` prefix. */
  async generateReportId(count: number = 1): Promise<string[]> {
    return this.client.generateReportId(count)
  }

  /**
   * Publish a creation report.
   *
   * Recommended: pass a `CreationGenerateResultV2` (flat structure).
   * The SDK automatically uses `publish_creation_report_v2` action.
   *
   * Passing `CreationGenerateResult` (V1) still works but will be
   * deprecated in future versions.
   */
  async publishCreationReport(
    creationResult: CreationGenerateResult | CreationGenerateResultV2,
    options?: { taskId?: string; executionId?: string },
  ): Promise<PublishCreationResponseData> {
    return this.client.publishCreationReport(creationResult, options)
  }

  /** Query report status and metadata. */
  async getReportStatus(creationId: string, reportId: string): Promise<ReportMetadata> {
    return this.client.getReportStatus(creationId, reportId)
  }

  /**
   * Get public reports.
   *
   * This action supports anonymous access (no API key required).
   *
   * @param options.topN - Max number of reports to return (default: 5)
   * @param options.creationId - Filter by specific creation ID (optional)
   */
  async getPublicReports(options?: {
    topN?: number
    creationId?: string
  }): Promise<PublicReportsResponseData> {
    return this.client.getPublicReports(options)
  }

  /**
   * Check service health via GET /health.
   * @returns [isHealthy, responseData]
   */
  async healthCheck(): Promise<[boolean, Record<string, unknown>]> {
    try {
      return await this.client.healthCheck()
    } catch {
      return [false, { error: 'HTTP request failed' }]
    }
  }

  /** Retrieve webhook action documentation. */
  async webhookHelp(action: string): Promise<WebhookActionHelp> {
    return this.client.webhookHelp(action)
  }

  /** Execute knowledge retrieval. */
  async knowledgeRetrieve(
    query: string,
    options?: { topK?: number; scoreThreshold?: number },
  ): Promise<KnowledgeSearchResult> {
    return this.client.knowledgeRetrieve(query, options)
  }

  /** Execute data retrieval. */
  async dataRetrieve(query: string, options?: { topK?: number }): Promise<DataRetrieveResult> {
    return this.client.dataRetrieve(query, options)
  }

  /**
   * Execute single-collection knowledge search.
   *
   * Targets a specific collection with collection-specific filter parameters.
   */
  async knowledgeSearch(
    query: string,
    collection: string,
    options?: {
      topK?: number
      scoreThreshold?: number
      metadataFilter?: Record<string, unknown>
      dateRange?: [string, string]
      searchMode?: 'semantic' | 'hybrid'
      vectorWeight?: number
      textWeight?: number
      entityType?: string
      docId?: string
    },
  ): Promise<KnowledgeSearchResult> {
    return this.client.knowledgeSearch(query, collection, options)
  }

  /**
   * Execute knowledge graph topology query.
   *
   * Supports: graph_statistics, entity_search, entity_relationships,
   * entity_subgraph, find_paths, entity_co_occurrence,
   * entity_communities, community_subgraph, related_communities.
   */
  async knowledgeGraphQuery(
    queryType: string,
    options?: {
      keyword?: string
      entityName?: string
      entityType?: string
      relationshipType?: string
      direction?: 'in' | 'out' | 'both'
      targetName?: string
      maxDepth?: number
      maxPaths?: number
      communityId?: string
      limit?: number
    },
  ): Promise<GraphQueryResult> {
    return this.client.knowledgeGraphQuery(queryType, options)
  }

  /** Pull configs from configuration center. */
  async pullConfigs(options?: {
    keys?: string[]
    globalBaseUrl?: string
  }): Promise<PullConfigsResponse> {
    return this.client.pullConfigs(options)
  }

  // ── Connect login ─────────────────────────────────────────────────────────

  /**
   * Verify a Connect app identity.
   *
   * @param callbackUrl - The callback URL to verify
   */
  async connectVerify(callbackUrl: string): Promise<ConnectVerifyResponse> {
    return this.client.connectVerify(callbackUrl)
  }

  /**
   * Refresh a Connect token.
   *
   * @param refreshToken - The refresh token from Connect login
   */
  async connectRefresh(refreshToken: string): Promise<ConnectRefreshResponse> {
    return this.client.connectRefresh(refreshToken)
  }

  /**
   * Build a Connect login URL.
   *
   * @param frontendUrl - The Hezor frontend base URL
   * @param callbackUrl - The callback URL to redirect to after login
   */
  async buildConnectUrl(frontendUrl: string, callbackUrl: string): Promise<string> {
    return this.client.buildConnectUrl(frontendUrl, callbackUrl)
  }

  // ── App certs ──────────────────────────────────────────────────────────

  /**
   * Get application credentials.
   *
   * @param appName - Casdoor application name
   */
  async getAppCerts(appName: string): Promise<AppCertInfo> {
    return this.client.getAppCerts(appName)
  }

  // ── My apps ────────────────────────────────────────────────────────────

  /**
   * Get current user's bound applications with credentials.
   *
   * Requires JWT authentication.
   */
  async getMyApps(): Promise<UserAppBindingInfo[]> {
    return this.client.getMyApps()
  }
}
