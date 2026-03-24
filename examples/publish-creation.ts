/**
 * publish_creation_report 使用示例
 *
 * 演示如何通过 Hezor2SDK 发布综合报告（universal_report）到平台。
 * 使用 V2 扁平结构（CreationGenerateResultV2），SDK 自动选择
 * publish_creation_report_v2 action。
 *
 * 关键字段说明：
 *   - slug:        创作类型标识，如 'universal_report'（综合报告）
 *   - creation_id:  报告实例 ID，格式为 'rpt_xxxxxxxx'，
 *                   通过 sdk.generateReportId() 生成
 *
 * Usage:
 *   npx tsx examples/publish-creation.ts        # 运行所有
 *   npx tsx examples/publish-creation.ts 1      # 运行指定
 *   npx tsx examples/publish-creation.ts --list # 列出可用
 */

import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import {
  Hezor2SDK,
  loadEnv,
  type MetaInfoData,
  type CreationGenerateResultV2,
} from '../src/index.js'
import { runExamples } from './_runner.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const config = loadEnv(join(__dirname, '.env'))

function createSdk(): Hezor2SDK {
  const metaInfo: MetaInfoData = {
    caller_id: 'example/publish_creation',
    subject: 'CloudNote Pro',
    subject_code: 'cloudnote_pro',
    creation_name: '综合报告',
    creation_slug: 'universal_report',
    data_coverage: '20250101-20250331',
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

// ── 报告正文 ─────────────────────────────────────────────────────────────────

const FULL_CONTENT = `# CloudNote Pro 2025年第一季度市场分析报告

> 报告周期：2025年1月1日 — 2025年3月31日
> 产品：CloudNote Pro · 智能笔记协作平台
> 生成时间：2025年4月2日

---

## 一、核心业务指标总览

| 指标 | Q1 实际 | Q1 目标 | 达成率 | 同比变化 |
|------|---------|---------|--------|----------|
| 付费用户数（万） | 86.3 | 80.0 | **107.9%** | +18.5% |
| MRR（万元） | 3,215.8 | 3,000.0 | **107.2%** | +22.1% |
| ARPU（元/月） | 37.3 | 37.5 | 99.5% | +3.0% |
| 用户留存率（30 天） | 78.6% | 75.0% | **104.8%** | +4.2pp |
| NPS 净推荐值 | 62 | 55 | **112.7%** | +8 |
| 客户流失率 | 3.2% | 4.0% | **125.0%** | -0.8pp |

### 关键发现

1. **付费转化突破**：Q1 新增付费用户 12.6 万，转化率 8.3%，受益于"开工季"促销活动和 AI 写作助手功能上线。
2. **企业版快速增长**：企业团队订阅收入占比提升至 42%，同比增长 35.6%，成为新增长引擎。
3. **留存率持续优化**：通过个性化推荐和模板市场改版，30 天留存率提升 4.2pp。

---

## 二、市场与渠道分析

### 2.1 各渠道获客表现

| 排名 | 渠道 | 新增用户（万） | 占比 | 获客成本（元） | 同比 |
|------|------|---------------|------|---------------|------|
| 1 | 自然搜索 | 38.2 | 32.5% | 0 | +12.8% |
| 2 | 应用商店 | 28.6 | 24.3% | 8.5 | +15.2% |
| 3 | 社交媒体投放 | 22.1 | 18.8% | 14.2 | +28.6% |
| 4 | 内容营销 | 16.8 | 14.3% | 6.3 | +22.4% |
| 5 | 口碑推荐 | 11.9 | 10.1% | 3.1 | +18.6% |

### 2.2 各平台 DAU 分布

| 平台 | DAU（万） | 占比 | 同比 | 人均使用时长 |
|------|----------|------|------|-------------|
| iOS | 126.3 | 38.2% | +16.5% | 28 分钟 |
| Android | 108.5 | 32.8% | +21.3% | 24 分钟 |
| Web 端 | 62.8 | 19.0% | +12.1% | 42 分钟 |
| 桌面客户端 | 33.1 | 10.0% | +8.4% | 56 分钟 |

### 2.3 竞品对比

本季度在笔记协作赛道的市场份额变化：

- **CloudNote Pro**：市场份额 18.6%（+2.1pp），稳居国内第二
- 竞品 A：22.3%（-0.5pp），增速放缓
- 竞品 B：15.8%（+0.8pp），在教育市场发力
- 竞品 C：12.4%（-1.2pp），用户流失加速

---

## 三、产品功能分析

### 3.1 功能使用率 Top 10

| 功能 | 月活跃用户占比 | 同比 | 满意度 | 趋势 |
|------|---------------|------|--------|------|
| Markdown 编辑器 | 89.2% | +2.1% | 4.7/5 | 📈 |
| 多端同步 | 82.6% | +5.3% | 4.5/5 | 📈 |
| AI 写作助手 | 68.4% | 新功能 | 4.6/5 | 📈 |
| 团队协作空间 | 56.3% | +12.8% | 4.3/5 | 📈 |
| 模板市场 | 48.7% | +18.6% | 4.4/5 | 📈 |
| 思维导图 | 42.1% | +6.2% | 4.2/5 | ➡️ |
| 文档分享 | 38.5% | +3.8% | 4.1/5 | ➡️ |
| OCR 文字识别 | 31.2% | +8.4% | 4.5/5 | 📈 |
| 日历与提醒 | 26.8% | +4.5% | 3.9/5 | ➡️ |
| API 集成 | 15.6% | +22.3% | 4.0/5 | 📈 |

### 3.2 Q1 新功能表现

Q1 共发布 **3 个大版本**，新功能表现如下：

| 功能名称 | 上线日期 | 月活渗透率 | 满意度 | 状态 |
|----------|----------|-----------|--------|------|
| AI 写作助手 v1.0 | 2025/01 | 68.4% | 4.6/5 | ✅ 大规模采用 |
| 实时协作评论 | 2025/02 | 34.2% | 4.3/5 | ✅ 稳步增长 |
| 知识库全文检索 | 2025/03 | 22.8% | 4.5/5 | 🔄 持续迭代 |
| 表格视图 Beta | 2025/03 | 12.6% | 3.8/5 | 🔄 收集反馈中 |

### 3.3 用户功能需求排行

1. **离线模式优化** — 投票数 8,620，需求指数 ★★★★★
2. **Notion 数据导入** — 投票数 6,340，需求指数 ★★★★☆
3. **白板功能** — 投票数 5,280，需求指数 ★★★★☆
4. **自定义主题** — 投票数 4,150，需求指数 ★★★☆☆
5. **插件生态** — 投票数 3,890，需求指数 ★★★☆☆

---

## 四、用户增长与营销分析

### 4.1 订阅数据

| 指标 | 数值 | 同比 |
|------|------|------|
| 注册用户总数 | 1,280 万 | +28.6% |
| Q1 新增注册 | 117.6 万 | +22.3% |
| 付费用户数 | 86.3 万 | +18.5% |
| 企业团队数 | 12,680 个 | +35.6% |
| 年付费比例 | 38.2% | +5.8pp |

> **洞察**：年付费用户 ARPU 是月付费的 **1.4 倍**，且流失率仅为月付费的 1/3。Q2 应加大年付费优惠力度，目标将年付费比例提升至 42%。

### 4.2 Q1 营销活动复盘

| 活动 | 时间 | 投入（万元） | 新增付费用户 | ROI |
|------|------|-------------|-------------|-----|
| 开工季 7 折促销 | 2/3—2/14 | 85.0 | 32,800 | **4.6x** |
| AI 写作助手发布会 | 1/15 | 42.0 | 18,600 | **5.3x** |
| 教育版免费计划 | 3/1—3/31 | 28.0 | 15,200 | **3.8x** |
| KOL 测评合作 | 1—3 月 | 36.0 | 21,400 | **4.2x** |

---

## 五、用户满意度

### 5.1 综合评分

- **App Store 评分**：4.7 / 5.0（同类产品均值 4.2）
- **Google Play 评分**：4.6 / 5.0
- **G2 评分**：4.5 / 5.0，入选 2025 春季 "High Performer"

### 5.2 用户反馈分析

**高频好评关键词**：界面简洁、同步稳定、AI 写作好用、Markdown 体验好、团队协作方便

**需改进方向**：
- 离线编辑丢失（7.2% 用户反馈）→ Q2 计划发布离线模式 v2
- 大文档加载慢（5.8% 用户反馈）→ 已在 v3.2 中优化虚拟滚动

---

## 六、下季度规划

### 6.1 业务目标

| 指标 | Q2 目标 | 较 Q1 变动 |
|------|---------|-----------|
| 付费用户数（万） | 98.0 | +13.6% |
| MRR（万元） | 3,680.0 | +14.4% |
| 30 天留存率 | 80.0% | +1.4pp |
| NPS 净推荐值 | 65 | +3 |

### 6.2 重点行动计划

1. **AI 能力升级**：发布 AI 写作助手 v2.0，新增多语言翻译、自动摘要、文档问答
2. **离线体验重构**：推出全平台离线编辑模式，目标冲突率低于 0.5%
3. **企业版增强**：上线 SSO 集成、权限管理、审计日志，目标新增 3,000 企业团队
4. **国际化扩展**：启动东南亚市场推广计划（新加坡、马来西亚、泰国）
5. **开发者生态**：发布 Plugin SDK 开放平台，首批引入 50+ 社区插件

---

*本报告由 Hezor AI 自动生成，数据截止 2025年3月31日。*
`

// ── 报告正文（跨境电商领域） ─────────────────────────────────────────────────

const FULL_CONTENT_2 = `# GlobeCart 2025年第一季度跨境电商市场分析报告

> 报告周期：2025年1月1日 — 2025年3月31日
> 产品：GlobeCart · 一站式跨境电商 SaaS 平台
> 生成时间：2025年4月2日

---

## 一、核心业务指标总览

| 指标 | Q1 实际 | Q1 目标 | 达成率 | 同比变化 |
|------|---------|---------|--------|----------|
| GMV（亿元） | 12.6 | 11.0 | **114.5%** | +32.8% |
| 活跃卖家数 | 28,350 | 26,000 | **109.0%** | +24.6% |
| 订单量（万笔） | 684.2 | 600.0 | **114.0%** | +28.3% |
| 平均客单价（美元） | 42.6 | 40.0 | **106.5%** | +3.5% |
| 物流时效达标率 | 92.8% | 90.0% | **103.1%** | +4.6pp |
| 退货率 | 5.1% | 6.0% | **117.6%** | -1.2pp |

### 关键发现

1. **东南亚市场爆发**：东南亚站点 GMV 同比增长 68.4%，Q1 占总 GMV 的 35.2%，超越北美成为第一大市场。
2. **直播电商贡献突出**：直播带货 GMV 占比达 18.6%，转化率是普通商品页的 3.2 倍。
3. **物流时效大幅提升**：海外仓覆盖从 12 国扩展至 18 国，平均配送时效缩短 2.3 天。

---

## 二、区域市场分析

### 2.1 各站点 GMV 排名

| 排名 | 站点 | GMV（亿元） | 占比 | 同比 | 订单量（万笔） |
|------|------|------------|------|------|---------------|
| 1 | 东南亚 | 4.44 | 35.2% | +68.4% | 268.5 |
| 2 | 北美 | 3.65 | 29.0% | +15.2% | 186.3 |
| 3 | 欧洲 | 2.39 | 19.0% | +18.6% | 112.8 |
| 4 | 中东 | 1.26 | 10.0% | +42.3% | 72.4 |
| 5 | 拉美 | 0.86 | 6.8% | +55.2% | 44.2 |

### 2.2 东南亚细分市场

| 国家 | GMV（万元） | 同比 | 热门品类 | 增速最快品类 |
|------|------------|------|----------|-------------|
| 印尼 | 15,260 | +82.3% | 美妆个护 | 小家电 (+124%) |
| 泰国 | 10,880 | +65.1% | 家居日用 | 母婴用品 (+98%) |
| 越南 | 8,420 | +71.8% | 3C 配件 | 运动健身 (+86%) |
| 菲律宾 | 6,350 | +58.6% | 时尚服饰 | 美妆个护 (+92%) |
| 马来西亚 | 3,490 | +45.2% | 食品保健 | 宠物用品 (+78%) |

### 2.3 新兴市场布局

Q1 新增两个市场试运营：

- **沙特阿拉伯**（2025/02 上线）：首月 GMV 126 万元，客单价高达 68 美元，利润率优异
- **巴西**（2025/03 上线）：首月 GMV 85 万元，社交电商渠道占比 42%

---

## 三、品类与商品分析

### 3.1 品类销售占比

| 品类 | GMV（亿元） | 占比 | 同比 | 趋势 |
|------|------------|------|------|------|
| 美妆个护 | 2.77 | 22.0% | +38.5% | 📈 |
| 3C 电子配件 | 2.27 | 18.0% | +21.3% | 📈 |
| 家居日用 | 1.89 | 15.0% | +28.6% | 📈 |
| 时尚服饰 | 1.64 | 13.0% | +18.2% | ➡️ |
| 小家电 | 1.39 | 11.0% | +52.4% | 📈 |
| 母婴用品 | 1.01 | 8.0% | +35.8% | 📈 |
| 运动户外 | 0.88 | 7.0% | +42.1% | 📈 |
| 其他 | 0.76 | 6.0% | +12.4% | ➡️ |

### 3.2 爆款商品 Top 5

1. **便携式筋膜枪 Mini** — 销量 12.8 万件，覆盖 15 国，退货率仅 2.1%
2. **磁吸无线充电宝 10000mAh** — 销量 9.6 万件，北美站 Best Seller
3. **氨基酸洁面慕斯套装** — 销量 8.4 万件，东南亚直播爆款
4. **智能宠物喂食器 Pro** — 销量 6.2 万件，欧洲站增速最快
5. **可折叠旅行收纳袋 6 件套** — 销量 15.3 万件，复购率最高（38%）

### 3.3 新品上架数据

Q1 平台新增 SKU **46,820 个**：

| 来源 | 新增 SKU | 占比 | 上架成功率 | 合规通过率 |
|------|---------|------|-----------|-----------|
| 卖家自主上架 | 32,174 | 68.7% | 89.2% | 94.6% |
| AI 选品推荐 | 8,526 | 18.2% | 95.8% | 98.2% |
| 品牌入驻 | 6,120 | 13.1% | 97.4% | 99.1% |

---

## 四、卖家与运营分析

### 4.1 卖家生态

| 指标 | 数值 | 同比 |
|------|------|------|
| 注册卖家总数 | 52,680 | +32.1% |
| Q1 新增卖家 | 6,830 | +28.4% |
| 活跃卖家（月均） | 28,350 | +24.6% |
| 品牌卖家占比 | 22.6% | +4.8pp |
| 卖家月均 GMV | 4.44 万元 | +6.6% |

> **洞察**：品牌卖家虽仅占 22.6%，但贡献了 **41.2%** 的 GMV，且退货率比普通卖家低 3.8pp。Q2 应加大品牌招商力度。

### 4.2 Q1 营销活动复盘

| 活动 | 时间 | GMV 增量（万元） | 新增卖家 | 用户增长 |
|------|------|-----------------|---------|---------|
| 年货节（东南亚） | 1/10—1/25 | 8,250 | 680 | +42 万 |
| 情人节全球大促 | 2/10—2/16 | 4,860 | 320 | +28 万 |
| 斋月预热（中东） | 3/1—3/15 | 3,120 | 180 | +15 万 |
| 新卖家 0 佣金计划 | 全季度 | 2,680 | 2,450 | —  |

---

## 五、物流与合规

### 5.1 物流表现

| 指标 | Q1 实际 | 目标 | 同比 |
|------|---------|------|------|
| 海外仓覆盖国家 | 18 | 16 | +6 |
| 平均配送时效（天） | 6.8 | 7.5 | -2.3 |
| 物流时效达标率 | 92.8% | 90.0% | +4.6pp |
| 包裹破损率 | 0.6% | 1.0% | -0.3pp |
| 尾程妥投率 | 96.2% | 95.0% | +1.8pp |

### 5.2 合规与风控

- **知识产权侵权下架**：Q1 下架侵权商品 1,280 件，同比 -15%（风控前置效果显著）
- **税务合规**：完成欧盟 IOSS 税号自动代缴功能上线，覆盖 27 国
- **数据合规**：通过 GDPR 和泰国 PDPA 年度审计

---

## 六、下季度规划

### 6.1 业务目标

| 指标 | Q2 目标 | 较 Q1 变动 |
|------|---------|-----------|
| GMV（亿元） | 15.0 | +19.0% |
| 活跃卖家数 | 33,000 | +16.4% |
| 海外仓国家 | 22 | +4 |
| 物流时效达标率 | 94.0% | +1.2pp |

### 6.2 重点行动计划

1. **AI 选品引擎 v2**：基于实时销售数据和社交趋势的智能选品推荐，目标覆盖 60% 新卖家
2. **直播电商基建**：上线多语言 AI 直播翻译和虚拟主播，支持 6 语种实时互动
3. **物流网络扩展**：新增巴西、墨西哥、波兰、阿联酋 4 个海外仓节点
4. **卖家赋能**：推出"30 天出单计划"，为每位新卖家配备 AI 运营助手
5. **支付本地化**：接入 GrabPay、Dana、Momo 等 8 种东南亚本地支付方式

---

*本报告由 Hezor AI 自动生成，数据截止 2025年3月31日。*
`

// ── 示例函数 ─────────────────────────────────────────────────────────────────

async function publishV2Report() {
  console.log('  使用 V2 扁平结构发布综合报告\n')

  try {
    const sdk = createSdk()

    // 1. 生成 report ID
    const [reportId] = await sdk.generateReportId(1)
    console.log(`  ✓ reportId: ${reportId}`)

    // 2. 构造 V2 报告数据
    const creationResult: CreationGenerateResultV2 = {
      creation_id: reportId!,
      slug: 'universal_report',
      title: 'CloudNote Pro 2025年第一季度市场分析报告',
      summary:
        'Q1 付费用户 86.3 万，超目标 7.9%；MRR 3,215.8 万元，同比增长 22.1%；30 天留存率 78.6%，同比提升 4.2pp。AI 写作助手上线后渗透率达 68.4%，企业版收入占比升至 42%。',
      full_content: FULL_CONTENT,
      subject: 'CloudNote Pro',
      subject_code: 'cloudnote_pro',
      period: '2025Q1',
      data_coverage: '20250101-20250331',
      creation_name: '综合报告',
      creation_description: '产品季度市场分析报告',
      author_name: 'Hezor AI',
      contributors: ['数据分析团队', '产品团队', 'AI 报告引擎'],
      domain: 'saas',
      chapter_count: 6,
      original_query: '生成 CloudNote Pro 2025年第一季度的市场分析报告',
      prefix: reportId!,
      postfix: '',
      file_path: '',
    }

    // 3. 发布报告
    const resp = await sdk.publishCreationReport(creationResult, {
      taskId: `task_${Date.now()}`,
      executionId: `exec_${Date.now()}`,
    })

    console.log(`  ✓ status:      ${resp.status}`)
    console.log(`  ✓ report_id:   ${resp.report_id}`)
    console.log(`  ✓ task_id:     ${resp.task_id}`)
    console.log(`  ✓ execution_id:${resp.execution_id}`)
    console.log(`  ✓ message:     ${resp.message}`)
  } catch (err) {
    console.log(`  ✗ ${err}`)
  }
}

async function publishAndCheckStatus() {
  console.log('  发布报告后查询状态\n')

  try {
    const sdk = createSdk()

    // 1. 生成 report ID 并发布
    const [reportId] = await sdk.generateReportId(1)
    console.log(`  ✓ reportId: ${reportId}`)

    const creationResult: CreationGenerateResultV2 = {
      creation_id: reportId!,
      slug: 'universal_report',
      title: 'GlobeCart 2025年第一季度跨境电商市场分析报告',
      summary: 'Q1 GMV 12.6 亿元，超目标 14.5%；东南亚站点同比增长 68.4%。',
      full_content: FULL_CONTENT_2,
      subject: 'GlobeCart',
      subject_code: 'globecart',
      period: '2025Q1',
      data_coverage: '20250101-20250331',
      creation_name: '综合报告',
      author_name: 'Hezor AI',
      prefix: reportId!,
      postfix: '',
      file_path: '',
    }

    const publishResp = await sdk.publishCreationReport(creationResult)
    console.log(`  ✓ 报告已发布: ${publishResp.report_id}\n`)

    // 2. 等待平台处理完成后再查询
    console.log('  ⏳ 等待 3 秒，让平台处理报告…\n')
    await new Promise((resolve) => setTimeout(resolve, 3000))

    // 3. 查询报告状态
    const status = await sdk.getReportStatus(
      'universal_report',
      publishResp.report_id,
    )
    console.log(`  ── 报告状态 ──`)
    console.log(`  reportId:     ${status.reportId}`)
    console.log(`  reportTitle:  ${status.reportTitle}`)
    console.log(`  generatedAt:  ${status.generatedAt}`)
    console.log(`  status:       ${status.statusMessage}`)
    console.log(`  verification: ${status.verificationCode}`)
    if (status.summary) {
      console.log(`  summary:      ${status.summary.slice(0, 80)}…`)
    }
  } catch (err) {
    console.log(`  ✗ ${err}`)
  }
}

async function batchPublish() {
  console.log('  批量生成 report ID 并依次发布\n')

  const subjects = [
    { name: 'CloudNote Pro', code: 'cloudnote_pro' },
    { name: 'CloudNote Pro · 个人版', code: 'cloudnote_pro/personal' },
    { name: 'CloudNote Pro · 企业版', code: 'cloudnote_pro/enterprise' },
  ]

  try {
    const sdk = createSdk()

    // 批量生成 ID
    const reportIds = await sdk.generateReportId(subjects.length)
    console.log(`  ✓ 生成 ${reportIds.length} 个 reportId\n`)

    for (let i = 0; i < subjects.length; i++) {
      const sub = subjects[i]!
      const rid = reportIds[i]!

      const result: CreationGenerateResultV2 = {
        creation_id: rid,
        slug: 'universal_report',
        title: `${sub.name} 2025年Q1市场分析报告`,
        summary: `${sub.name}第一季度市场数据概览。`,
        full_content: `# ${sub.name} 2025年Q1市场分析报告\n\n本报告为自动生成的季度市场分析。\n\n## 核心指标\n\n| 指标 | 数值 |\n|------|------|\n| 付费用户 | 待填充 |\n| MRR | 待填充 |\n`,
        subject: sub.name,
        subject_code: sub.code,
        period: '2025Q1',
        data_coverage: '20250101-20250331',
        creation_name: '综合报告',
        author_name: 'Hezor AI',
        prefix: rid,
        postfix: '',
        file_path: '',
      }

      const resp = await sdk.publishCreationReport(result)
      console.log(`  ✓ [${i + 1}/${subjects.length}] ${sub.name} → ${resp.report_id} (${resp.status})`)
    }
  } catch (err) {
    console.log(`  ✗ ${err}`)
  }
}

runExamples('publish-creation', [
  { name: 'Publish V2 report (universal_report)', run: publishV2Report },
  { name: 'Publish & check status', run: publishAndCheckStatus },
  { name: 'Batch publish for multiple subjects', run: batchPublish },
])
