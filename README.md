# WechatAGI — 微信智能发送助手

跨平台 Electron 桌面工具，支持 Excel 批量导入、手动创建任务、Daemon 守护模式、定时发送、HTTP API、图片 URL 缓存、微信断线监控。

![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Version](https://img.shields.io/badge/version-v2.0.0-blue)

## 功能特性

- **Excel 批量导入** — 下载标准模板，填写后一键导入任务列表
- **手动创建任务** — 直接在应用内添加单个发送目标
- **多选发送** — 勾选任务后批量发送，实时日志
- **Daemon 守护模式** — 后台常驻，自动检测定时任务并执行
- **微信断线监控** — 发送前自动检测微信是否在线，断线及时提示
- **图片 URL 下载** — 图片路径支持 HTTP/HTTPS URL，自动下载并 MD5 缓存
- **消息队列** — 后台工作线程异步处理发送任务，支持进度回调
- **HTTP API** — Flask 服务端点，供外部 LLM Agent 或自动化脚本调用
- **跨平台原生自动化** — macOS AppleScript / Windows pywinauto

## 系统要求

- macOS 10.15+（Apple Silicon + Intel 均支持）
- Windows 10/11（64 位）
- 已安装并登录微信 PC 版

## 安装包下载

Releases：https://github.com/howtimeschange/WechatAGI/releases

| 版本 | 说明 |
|------|------|
| `.dmg`（macOS） | 双击安装，自动识别 Apple Silicon / Intel |
| `.exe`（Windows NSIS） | 一键安装 |

## 技术架构

### macOS
- **自动化引擎**：AppleScript `osascript`
- **剪贴板**：`pyperclip` → `osascript`

### Windows
- **自动化引擎**：pywinauto（Windows UI Automation API）
- **键盘输入**：`keyboard.send_keys()` → `SendMessage(WM_SETTEXT)`，不走剪贴板
- **窗口识别**：进程名 + 类名 + 面积评分

## 开发

```bash
npm install
npm run dev           # 开发热重载
npm run dist:mac      # 构建 macOS DMG
npm run dist:win      # 构建 Windows NSIS
```

### 依赖

| 平台 | Python 依赖 |
|------|------------|
| macOS | openpyxl, PyYAML, rich |
| Windows | openpyxl, pywinauto, psutil, pyperclip, pywin32, Pillow |
| API 服务 | flask>=3.0 |

## HTTP API

启动 API 服务后，可通过 HTTP 调用发送消息：

```bash
python3 python/app/cli.py api --port 9528
```

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/send` | POST | 单条发送 |
| `/api/batch` | POST | 批量发送 |
| `/api/status` | GET | 队列状态 + 微信连接 |
| `/api/health` | GET | 健康检查 |

## 项目结构

```
WechatAGI/
├── electron/              # Electron 主进程
│   ├── main.js            # IPC handlers、窗口管理
│   └── preload.js         # 上下文桥接 API
├── python/
│   ├── app/
│   │   ├── cli.py         # 核心 CLI（跨平台统一入口）
│   │   ├── monitor.py     # 微信断线监控
│   │   ├── image_cache.py # 图片 URL 下载 + MD5 缓存
│   │   ├── queue_worker.py# 消息队列 + 后台工作线程
│   │   ├── api_server.py  # Flask HTTP API 服务
│   │   ├── parse_excel.py # Excel 解析
│   │   └── template_gen.py # 模板生成
│   └── scripts/
│       ├── wechat_send_mac.applescript  # macOS AppleScript
│       └── wechat_send_win.py           # Windows pywinauto
├── src/                   # React 页面
├── scripts/
│   └── afterPack.js       # electron-builder hook
└── package.json
```

## 常见问题

**Q: Windows 提示"找不到微信窗口"？**
确保微信 PC 版已启动并登录，且窗口未最小化到托盘。

**Q: macOS 发送失败，提示权限？**
系统设置 → 隐私与安全性 → 自动化 → 允许「WechatAGI」控制「微信」。

**Q: 批量发送频率限制？**
默认每分钟最多 8 条，间隔 5 秒。可在设置中调整。

## 许可证

MIT
