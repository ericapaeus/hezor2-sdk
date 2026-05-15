# @hezor/hezor2-sdk

[![npm version](https://img.shields.io/npm/v/@hezor/hezor2-sdk.svg)](https://www.npmjs.com/package/@hezor/hezor2-sdk)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Hezor2 SDK，供第三方项目引入使用。

## 安装

```bash
# npm
npm install @hezor/hezor2-sdk

# yarn
yarn add @hezor/hezor2-sdk

# pnpm
pnpm add @hezor/hezor2-sdk
```

## 使用

```ts
import { greet, VERSION } from '@hezor/hezor2-sdk'

console.log(VERSION)         // '0.1.0'
console.log(greet('Alice'))  // 'Hello from @hezor/hezor2-sdk, Alice!'
```

## OAuth 2.0 客户端

`OAuthClient` 封装了 hezor2 后端 `/oauth/*` 全部端点，覆盖两类典型用法：

- **Authorization Code + PKCE**：浏览器跳转 / 服务端代用户授权（第三方 Web/移动应用）。
- **Device Authorization Grant（RFC 8628）**：无浏览器环境（CLI、starship、嵌入式 runtime）。

两种流程都支持 `refresh_token` 续期与 RFC 7009 `revoke`。

### Authorization Code + PKCE（第三方应用）

```ts
import { OAuthClient, generatePKCEPair, generateState } from '@hezor/hezor2-sdk'

const client = new OAuthClient({
  baseUrl: 'https://hezor.example.com',
  clientId: 'your-client-id',
  redirectUri: 'https://your-app.example.com/callback',
})

// 1) 跳转用户去授权
const pkce = await generatePKCEPair()
const state = generateState()
// 把 pkce.code_verifier / state 存到 session，回调时取回
const url = client.buildAuthorizeUrl({
  state,
  codeChallenge: pkce.code_challenge,
  scope: 'base:user-info base:llm-invoke',
})
// window.location.href = url

// 2) 回调拿到 code 后换 token
const token = await client.exchangeAuthorizationCode({
  code: 'CODE_FROM_CALLBACK',
  codeVerifier: pkce.code_verifier,
})

// 3) 续期 / 撤销
const refreshed = await client.refreshToken(token.refresh_token!)
await client.revokeToken(refreshed.refresh_token!, 'refresh_token')
```

### Device Authorization Grant（代理进程 / starship）

```ts
import { OAuthClient } from '@hezor/hezor2-sdk'

const client = new OAuthClient({
  baseUrl: 'https://hezor.example.com',
  clientId: 'your-device-client-id',
})

// 1) 申请 device_code
const dc = await client.requestDeviceCode({
  deviceId: 'demo-host-1234',
  hostname: 'demo-host',
  os: 'darwin',
  runtimeKind: 'starship',
  vendor: 'hezor',
  scope: 'device:bind silicon:proxy base:llm-invoke',
})

// 2) 提示用户在浏览器输入 user_code
console.log(`请打开：${dc.verification_uri_complete}`)
console.log(`输入码：${dc.user_code}`)

// 3) 轮询 token（自动处理 authorization_pending / slow_down）
const token = await client.pollDeviceToken({
  deviceCode: dc.device_code,
  interval: dc.interval,
  expiresIn: dc.expires_in,
})
```

完整可运行示例：[`examples/oauth-auth-code.ts`](./examples/oauth-auth-code.ts) / [`examples/oauth-device-flow.ts`](./examples/oauth-device-flow.ts)。

错误处理：协议错误以 `OAuthError` 抛出（`code` 字段为 RFC 6749 错误码）；`invalid_grant` 单独以 `OAuthInvalidGrantError` 抛出，便于上层针对失效 token 做特殊处理。

## 开发

```bash
# 安装依赖
pnpm install

# 构建
pnpm build

# 开发模式（监听变更）
pnpm dev

# 类型检查
pnpm typecheck

# 运行测试
pnpm test

# 运行测试（监听模式）
pnpm test:watch

# 测试覆盖率
pnpm test:coverage

# Lint
pnpm lint

# 格式化
pnpm format
```

## 发布

```bash
# 先登录 npm
npm login

# 发布（自动执行 build + typecheck）
npm publish --access public
```

## License

[MIT](./LICENSE)
