#!/usr/bin/env bash
# 演示: 登录 hezor2 CLI 并查询公开报告
set -e

cd "$(dirname "$0")"

echo "=== hezor2 CLI — 登录 & 查询演示 ==="
echo

# 1. 检查登录状态
echo "📋 当前登录状态:"
npx hezor2 status
echo

# 2. 登录（如未登录则执行）
if npx hezor2 status 2>&1 | grep -q "未登录"; then
  HOST="${1:?用法: ./login-and-query.sh <host>}"
  echo "🔑 登录到 $HOST ..."
  npx hezor2 login "$HOST"
  echo
fi

# 3. 查询公开报告
echo "📄 查询公开报告 (top 3):"
npx hezor2 reports list --top-n 3
echo

# 4. 知识库检索
echo "🔍 知识库检索:"
npx hezor2 knowledge retrieve "什么是hezor" --top-k 3
echo

echo "✅ Done"
