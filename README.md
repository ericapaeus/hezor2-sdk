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
