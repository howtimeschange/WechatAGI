#!/bin/bash
# Wechat Sender GUI — 构建并运行脚本（macOS / Windows）

set -e

echo "=== 微信发送助手 — 开始构建 ==="

# 检测平台
PLATFORM="$(uname -s)"
NODE_VERSION=$(node --version)
PYTHON_VERSION=$(python3 --version 2>/dev/null || echo "未安装")
echo "平台: $PLATFORM | Node: $NODE_VERSION | Python: $PYTHON_VERSION"

# 1. 安装 Node 依赖
if [ ! -d "node_modules" ]; then
  echo "[1/4] 安装 Node 依赖..."
  npm install
else
  echo "[1/4] Node 依赖已安装，跳过"
fi

# 2. 安装 Python 依赖
echo "[2/4] 检查 Python 依赖..."
python3 -c "import openpyxl" 2>/dev/null || pip3 install openpyxl
python3 -c "import yaml" 2>/dev/null || pip3 install PyYAML
echo "  Python 依赖就绪"

# 3. 构建前端
echo "[3/4] 构建前端 (Vite)..."
npm run build

# 4. 启动 Electron
echo "[4/4] 启动 Electron..."
if [ "$PLATFORM" = "Darwin" ]; then
  open "dist/index.html" 2>/dev/null || echo "请手动打开 dist/index.html"
fi
npm run electron

echo "=== 完成 ==="
