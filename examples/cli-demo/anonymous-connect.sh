#!/usr/bin/env bash
# 演示: 匿名微信扫码连接并查询公开报告
set -e

cd "$(dirname "$0")"

HOST="${1:?用法: ./anonymous-connect.sh <host>}"
PROFILE="anonymous"

echo "=== hezor2 CLI — 匿名微信扫码连接 ==="
echo

# 1. 通过微信扫码获取 caller_id
echo "🔗 连接到 $HOST (匿名模式)..."
npx hezor2 connect "$HOST" --profile "$PROFILE"
echo

# 2. 查看连接状态
echo "📋 连接状态:"
npx hezor2 status
echo

# 3. 使用匿名身份查询公开报告
echo "📄 查询公开报告 (top 3):"
npx hezor2 reports list --top-n 3
echo

echo "✅ Done"
