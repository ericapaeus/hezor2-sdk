/**
 * @hezor/hezor2-sdk
 *
 * TypeScript SDK for interacting with Hezor2 API.
 * Ported from hezor_common.transfer.hezor2_sdk (Python).
 */

import { createRequire } from 'node:module'
const _require = createRequire(import.meta.url)
const _pkg = _require('../package.json') as { version: string }

export const VERSION: string = _pkg.version

// --- Main SDK ---
export { Hezor2SDK, type Hezor2SDKOptions } from './hezor2-sdk.js'

// --- API Client ---
export { Hezor2APIClient, type Hezor2APIClientOptions } from './hezor2-api-client.js'
export { BaseAPIClient, type BaseAPIClientOptions } from './base-api-client.js'

// --- MetaInfo ---
export { metaInfoToRequestHeader, type MetaInfoData } from './meta-info.js'

// --- Environment Config ---
export {
  loadEnv,
  DEFAULT_API_BASE_URL,
  DEFAULT_API_KEY,
  type Hezor2EnvConfig,
} from './env-config.js'

// --- Constants ---
export {
  REQ_HEADER_META_INFO_KEY,
  REQ_HEADER_APP_NAME_KEY,
  ANONYMOUS_HEADER_PRIVATE_KEY,
  ANONYMOUS_HEADER_PRIVATE_KEY_PASSWORD,
  ANONYMOUS_HEADER_PUBLIC_KEY,
  META_EXTRAS_KEY_AUTHORIZED_TOOLKITS,
} from './constants.js'

// --- Security ---
export * as security from './security/index.js'

// --- Types ---
export { mergedConfigs } from './types.js'
export type {
  // Webhook
  WebhookResponse,
  WebhookActionHelp,
  WebhookActionUsage,
  // Creation
  CreationGenerateResult,
  CreationGenerateResultV2,
  GenerateReportIdResponseData,
  PublishCreationResponseData,
  ReportMetadata,
  // Public reports
  PublicReportsResponseData,
  // Knowledge retrieval
  KnowledgeSearchResult,
  // Graph query
  GraphQueryResult,
  GraphNode,
  GraphEdge,
  SubGraph,
  GraphPath,
  PathResult,
  GraphStatistics,
  CoOccurrence,
  CoOccurrenceList,
  Chunk,
  OntologyEntity,
  Community,
  CommunityFinding,
  GalleryPicture,
  ScoredChunk,
  ScoredEntity,
  ScoredCommunity,
  ScoredPicture,
  ChunkSearchResultList,
  EntitySearchResultList,
  CommunitySearchResultList,
  PictureSearchResultList,
  // Data retrieval
  DataRetrieveResult,
  ExecuteResponse,
  // Config
  PullConfigsResponse,
  // Connect
  ConnectVerifyRequest,
  ConnectVerifyResponse,
  ConnectRefreshRequest,
  ConnectRefreshResponse,
  // WeChat
  WechatLoginUrlResponse,
  WechatPollOpenidResponse,
  // App binding
  AppCertInfo,
  UserAppBindingInfo,
} from './types.js'
