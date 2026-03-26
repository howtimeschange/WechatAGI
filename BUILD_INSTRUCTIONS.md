# 构建说明

## 快速启动

```bash
cd wechatagi

# macOS
chmod +x start.sh && ./start.sh

# 或手动：
npm install
pip3 install openpyxl PyYAML
npm run build
npm run electron
```

## 首次构建问题排查

### macOS esbuild 被系统阻止

如果在 `npm run build` 阶段遇到 "Killed: 9" 或 esbuild 报错：

**原因**：macOS 12.3+ 限制了非 Apple 签名工具的 JIT 编译

**解决方案 A（推荐）：在系统设置中授权**
1. 系统设置 → 隐私与安全性 → 安全性与隐私
2. 找到 "esbuild" 被阻止的提示
3. 点击"仍要打开"

**解决方案 B：重新安装 esbuild**
```bash
npm install esbuild@0.17.11 --save-dev
# 如果仍被阻止：
xattr -rd com.apple.quarantine node_modules/esbuild/bin/esbuild
./node_modules/.bin/esbuild --version
```

**解决方案 C：使用 npx 强制刷新**
```bash
rm -rf node_modules/.vite
npm run build
```

## Windows 构建

```powershell
# 在 PowerShell 中以管理员身份运行
npm install
pip install openpyxl PyYAML
npm run build
npm run dist:win
```

## 功能说明

- **上传 Excel**：支持 .xlsx/.xls，自动解析"发送任务" Sheet
- **手动新建**：弹出表单，支持文字/图片/文字+图片
- **批量发送**：复选框选择，实时日志
- **守护进程**：后台持续监控，自动发送新任务
- **定时任务**：指定时间点自动触发发送
