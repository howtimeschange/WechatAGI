# 微信发送助手 GUI

> Electron + React 开箱即用版，支持 macOS + Windows

## 功能

- **上传 Excel** — 拖拽或点击上传，自动解析"发送任务"Sheet
- **手动新建** — 弹出表单，字段与 Excel 完全一致
- **复选框批量发送** — 支持全选/单选，实时日志
- **守护进程** — 后台自动监控新任务并发送
- **定时任务** — 指定时间自动触发
- **微信设计规范** — 主色 #07C160 绿 + 灰底 #F5F5F5

## 快速开始

```bash
cd gui

# 1. 安装依赖
npm install

# 2. 安装 Python（macOS）
pip3 install openpyxl PyYAML

# 3. 安装 Python（Windows）
pip install openpyxl PyYAML

# 4. 构建前端
npm run build

# 5. 启动（macOS）
open dist/index.html
# 或 Windows: start dist\index.html

# 打包 macOS DMG
npm run dist:mac

# 打包 Windows NSIS
npm run dist:win
```

## macOS 辅助功能权限

首次运行需授予辅助功能权限：
系统设置 → 隐私与安全性 → 辅助功能 → 添加 Terminal（或本 App）

## 项目结构

```
gui/
├── electron/       # Electron 主进程 + IPC
├── src/            # React 前端
│   ├── pages/      # TasksPage / SettingsPage / TemplatePage
│   └── components/ # NewTaskModal / SendLogDrawer / Sidebar
├── python/         # Python CLI（被 Electron 调用）
│   └── app/        # cli.py / parse_excel.py / template_gen.py
└── dist/           # 构建产物
```
