/**
 * knowledge_graph_query 使用示例
 *
 * 知识图谱拓扑查询，支持 9 种查询类型：
 * graph_statistics, entity_search, entity_relationships,
 * entity_subgraph, find_paths, entity_co_occurrence,
 * entity_communities, community_subgraph, related_communities.
 *
 * Usage:
 *   npx tsx examples/knowledge-graph-query.ts        # 运行所有
 *   npx tsx examples/knowledge-graph-query.ts 1      # 运行指定
 *   npx tsx examples/knowledge-graph-query.ts --list # 列出可用
 */

import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { Hezor2SDK, loadEnv, type MetaInfoData } from '../src/index.js'
import { runExamples } from './_runner.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const config = loadEnv(join(__dirname, '.env'))

function createSdk(): Hezor2SDK {
  const metaInfo: MetaInfoData = {
    caller_id: 'example/knowledge_graph_query',
    subject: 'example',
    subject_code: 'example_001',
    creation_name: '示例创建',
    creation_slug: 'example_creation',
    data_coverage: '20240101-20241231',
  }

  return new Hezor2SDK({
    baseUrl: config.hezor2ApiBaseUrl,
    apiKey: config.hezor2ApiKey,
    appName: config.hezor2AppName,
    metaInfo,
    privateKeyPath: config.hezor2HeaderPkFilepath,
    password: config.hezor2HeaderPkPassword,
  })
}

async function graphStatistics() {
  console.log('  queryType: graph_statistics\n')

  try {
    const sdk = createSdk()
    const result = await sdk.knowledgeGraphQuery('graph_statistics')

    const stats = result.statistics
    if (stats) {
      console.log(`  ✓ entityCount:       ${stats.entityCount}`)
      console.log(`  ✓ communityCount:    ${stats.communityCount}`)
      console.log(`  ✓ relationshipCount: ${stats.relationshipCount}`)
      console.log(`  ✓ avgRelPerEntity:   ${stats.avgRelationshipsPerEntity.toFixed(2)}`)

      if (Object.keys(stats.entityTypeDistribution).length > 0) {
        console.log('\n  Entity type distribution:')
        for (const [type, count] of Object.entries(stats.entityTypeDistribution)) {
          console.log(`    ${type}: ${count}`)
        }
      }

      if (Object.keys(stats.relationshipTypeDistribution).length > 0) {
        console.log('\n  Relationship type distribution:')
        for (const [type, count] of Object.entries(stats.relationshipTypeDistribution)) {
          console.log(`    ${type}: ${count}`)
        }
      }
    } else {
      console.log('  ✗ No statistics returned')
    }
  } catch (err) {
    console.log(`  ✗ ${err}`)
  }
}

async function entitySearch() {
  const keyword = '麦当劳'

  console.log(`  queryType:  entity_search`)
  console.log(`  keyword:    ${keyword}`)
  console.log(`  limit:      10\n`)

  try {
    const sdk = createSdk()
    const result = await sdk.knowledgeGraphQuery('entity_search', {
      keyword,
      limit: 10,
    })

    const nodes = result.nodes ?? []
    console.log(`  ✓ found ${nodes.length} entities`)
    for (const node of nodes) {
      console.log(`    [${node.entityType}] ${node.name} — ${node.description.slice(0, 60) || '(no description)'}`)
    }
  } catch (err) {
    console.log(`  ✗ ${err}`)
  }
}

async function entityRelationships() {
  const entityName = '麦当劳'

  console.log(`  queryType:  entity_relationships`)
  console.log(`  entityName: ${entityName}`)
  console.log(`  direction:  both\n`)

  try {
    const sdk = createSdk()
    const result = await sdk.knowledgeGraphQuery('entity_relationships', {
      entityName,
      direction: 'both',
      limit: 20,
    })

    const sg = result.subgraph
    if (sg) {
      console.log(`  ✓ nodes: ${sg.nodes.length}  edges: ${sg.edges.length}`)
      console.log(`  ✓ center: ${sg.centerNodeId}`)
      for (const edge of sg.edges.slice(0, 5)) {
        console.log(`    ${edge.sourceName} -[${edge.relationshipType}]-> ${edge.targetName}`)
      }
      if (sg.edges.length > 5) {
        console.log(`    … and ${sg.edges.length - 5} more`)
      }
    } else {
      console.log('  ✗ No subgraph returned')
    }
  } catch (err) {
    console.log(`  ✗ ${err}`)
  }
}

async function findPaths() {
  const entityName = '麦当劳'
  const targetName = '肯德基'

  console.log(`  queryType:  find_paths`)
  console.log(`  from:       ${entityName}`)
  console.log(`  to:         ${targetName}`)
  console.log(`  maxDepth:   3`)
  console.log(`  maxPaths:   5\n`)

  try {
    const sdk = createSdk()
    const result = await sdk.knowledgeGraphQuery('find_paths', {
      entityName,
      targetName,
      maxDepth: 3,
      maxPaths: 5,
    })

    const pr = result.pathResult
    if (pr) {
      console.log(`  ✓ ${pr.sourceName} → ${pr.targetName}: ${pr.paths.length} path(s)`)
      for (let i = 0; i < pr.paths.length; i++) {
        const path = pr.paths[i]!
        const route = path.nodes.map(n => n.name).join(' → ')
        console.log(`    Path #${i + 1} (length=${path.length}): ${route}`)
      }
    } else {
      console.log('  ✗ No paths found')
    }
  } catch (err) {
    console.log(`  ✗ ${err}`)
  }
}

async function entityCoOccurrence() {
  const entityName = '肯德基'

  console.log(`  queryType:  entity_co_occurrence`)
  console.log(`  entityName: ${entityName}`)
  console.log(`  limit:      10\n`)

  try {
    const sdk = createSdk()
    const result = await sdk.knowledgeGraphQuery('entity_co_occurrence', {
      entityName,
      limit: 10,
    })

    const co = result.coOccurrences
    if (co) {
      console.log(`  ✓ center: ${co.centerEntity}`)
      console.log(`  ✓ co-occurring entities: ${co.items.length}`)
      for (const item of co.items) {
        const types = item.sharedRelationshipTypes.join(', ') || '—'
        console.log(`    ${item.entityName} [${item.entityType}]  count=${item.coOccurrenceCount}  via: ${types}`)
      }
    } else {
      console.log('  ✗ No co-occurrences returned')
    }
  } catch (err) {
    console.log(`  ✗ ${err}`)
  }
}

async function entitySubgraph() {
  const entityName = '麦当劳'

  console.log(`  queryType:  entity_subgraph`)
  console.log(`  entityName: ${entityName}`)
  console.log(`  maxDepth:   2`)
  console.log(`  limit:      50\n`)

  try {
    const sdk = createSdk()
    const result = await sdk.knowledgeGraphQuery('entity_subgraph', {
      entityName,
      maxDepth: 2,
      limit: 50,
    })

    const sg = result.subgraph
    if (sg) {
      console.log(`  ✓ nodes: ${sg.nodes.length}  edges: ${sg.edges.length}`)
      console.log(`  ✓ center: ${sg.centerNodeId}`)

      const types = new Set(sg.nodes.map(n => n.entityType).filter(Boolean))
      console.log(`  ✓ entity types: ${[...types].join(', ')}`)
    } else {
      console.log('  ✗ No subgraph returned')
    }
  } catch (err) {
    console.log(`  ✗ ${err}`)
  }
}

runExamples('knowledge-graph-query', [
  { name: 'Graph statistics', run: graphStatistics },
  { name: 'Entity search', run: entitySearch },
  { name: 'Entity relationships', run: entityRelationships },
  { name: 'Find paths between entities', run: findPaths },
  { name: 'Entity co-occurrence analysis', run: entityCoOccurrence },
  { name: 'Entity subgraph (visualization)', run: entitySubgraph },
])
