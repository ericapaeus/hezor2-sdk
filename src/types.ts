/**
 * Data models used by the Hezor2 SDK.
 *
 * These are TypeScript interfaces/types that mirror the Python Pydantic models
 * from hezor_common.data_model.
 */

// ---------------------------------------------------------------------------
// Webhook envelope
// ---------------------------------------------------------------------------

export interface WebhookResponse<T = unknown> {
  action: string
  status: string
  data: T | null
  message: string
}

// ---------------------------------------------------------------------------
// Webhook action help
// ---------------------------------------------------------------------------

export interface WebhookActionUsage {
  method: string
  url: string
  headers: Record<string, string>
  body: Record<string, string>
}

export interface WebhookActionHelp {
  action: string
  description: string
  usage: WebhookActionUsage
  payload_schema: Record<string, unknown>
  response_data_schema: Record<string, unknown>
}

// ---------------------------------------------------------------------------
// Creation models
// ---------------------------------------------------------------------------

export interface GenerateReportIdResponseData {
  report_ids: string[]
}

export interface PublishCreationResponseData {
  report_id: string
  task_id: string
  execution_id: string
  status: string
  message: string
}

export interface ReportMetadata {
  reportId: string
  reportTitle: string
  description: string
  generatedAt: string
  verificationCode: string
  statusMessage: string
  summary: string
}

/**
 * Simplified creation result (V2 — flat structure).
 * Recommended for new code.
 */
export interface CreationGenerateResultV2 {
  creation_id: string
  title: string
  full_content: string
  summary?: string
  subject: string
  period?: string
  data_coverage?: string
  subject_code?: string | null
  creation_name?: string
  creation_description?: string
  author_name?: string
  contributors?: string[]
  domain?: string | null
  path?: string | null
  slug: string
  chapter_count?: number
  original_query?: string
  file_path?: string
  prefix?: string
  postfix?: string
  creation_model_json?: string | null
}

/**
 * Full nested creation result (V1).
 * Kept for backward compatibility; prefer V2 for new code.
 */
export interface CreationGenerateResult {
  original_query: string
  creation: Record<string, unknown>
  params: Record<string, unknown>
  chapter_results: Record<string, unknown>[]
  summary: string
  title: string
  data_coverage: string
  full_content: string
  creation_id: string
  prefix: string
  postfix: string
  file_path: string
}

// ---------------------------------------------------------------------------
// Knowledge retrieval models
// ---------------------------------------------------------------------------

export interface Chunk {
  vectorId: string
  batchId: string
  contentId: string
  text: string
  textLength: number
  vectorDimension: number
  chunkId: string
  docId: string
  docName: string
  page: number
  updateAt: string
  status: string
  sourceFile: string
  fileType: string
}

export interface OntologyEntity {
  id: string
  entityId: string
  entityType: string
  name: string
  aliases: string[]
  description: string
  docIds: string[]
  sourceChunkIds: string[]
  sourcePictureIds: string[]
  updatedAt: string
  status: string
  batchId: string
  contentId: string
  sourceFile: string
}

export interface CommunityFinding {
  summary: string
  explanation: string
}

export interface Community {
  id: string
  communityId: string
  title: string
  summary: string
  level: number
  entityIds: string[]
  relationshipIds: string[]
  parentId: string | null
  childrenIds: string[]
  rating: number
  ratingExplanation: string
  findings: CommunityFinding[]
  updatedAt: string
  status: string
  batchId: string
  contentId: string
  sourceFile: string
}

export interface GalleryPicture {
  vectorId: string
  batchId: string
  contentId: string
  text: string
  textLength: number
  vectorDimension: number
  picId: string
  description: string
  filename: string
  docId: string
  docName: string
  page: number
  updateAt: string
  status: string
  sourceFile: string
  fileType: string
}

export interface ScoredChunk {
  chunk: Chunk
  score: number
  rank: number
}

export interface ScoredEntity {
  entity: OntologyEntity
  score: number
  rank: number
}

export interface ScoredCommunity {
  community: Community
  score: number
  rank: number
}

export interface ScoredPicture {
  picture: GalleryPicture
  score: number
  rank: number
}

export interface ChunkSearchResultList {
  items: ScoredChunk[]
  collection: string
  query: string
  total: number
}

export interface EntitySearchResultList {
  items: ScoredEntity[]
  collection: string
  query: string
  total: number
}

export interface CommunitySearchResultList {
  items: ScoredCommunity[]
  collection: string
  query: string
  total: number
}

export interface PictureSearchResultList {
  items: ScoredPicture[]
  collection: string
  query: string
  total: number
}

export interface KnowledgeSearchResult {
  chunks: ChunkSearchResultList
  entities: EntitySearchResultList
  communities: CommunitySearchResultList
  pictures: PictureSearchResultList
  query: string
}

// ---------------------------------------------------------------------------
// Data retrieval models
// ---------------------------------------------------------------------------

export interface ExecuteResponse {
  success: boolean
  data: Record<string, unknown> | unknown[]
  count: number
  error: string
  desc: string
}

export interface DataRetrieveResult {
  query: string
  results: Record<string, ExecuteResponse>
}

// ---------------------------------------------------------------------------
// Connect login models
// ---------------------------------------------------------------------------

export interface ConnectVerifyRequest {
  app_name: string
  meta_info: string
  callback_url: string
}

export interface ConnectVerifyResponse {
  valid: boolean
  app_name: string
  meta_info: Record<string, unknown>
  callback_url: string
}

export interface ConnectRefreshRequest {
  app_name: string
  meta_info: string
  refresh_token: string
}

export interface ConnectRefreshResponse {
  access_token: string
  refresh_token?: string
  token_type: string
  expires_in: number
  user: {
    id: string
    name: string
    display_name: string
  }
}

// ---------------------------------------------------------------------------
// App config models
// ---------------------------------------------------------------------------

export interface PullConfigsResponse {
  public: Record<string, string>
  user: Record<string, string>
}

/** Return merged config dict with user configs taking priority. */
export function mergedConfigs(resp: PullConfigsResponse): Record<string, string> {
  return { ...resp.public, ...resp.user }
}
