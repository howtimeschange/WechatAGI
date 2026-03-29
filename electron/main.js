const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron')
const path = require('path')
const { spawn, spawnSync } = require('child_process')
const fs = require('fs')
const os = require('os')


function commandExists(command, args = ['--version']) {
  try {
    const result = spawnSync(command, args, {
      encoding: 'utf8',
      windowsHide: true,
      timeout: 8000,
    })
    return !result.error && result.status === 0
  } catch (_) {
    return false
  }
}

function isPythonAvailable(command) {
  if (!command) return false
  const isPathLike = path.isAbsolute(command) || command.includes('/') || command.includes('\\')
  if (isPathLike) return fs.existsSync(command)
  if (command === 'py') return commandExists('py', ['-3', '--version']) || commandExists('py')
  return commandExists(command)
}

function summarizeSendFailure(rawText = '') {
  const raw = String(rawText || '').replace(/\0/g, ' ').trim()
  const lines = raw.split(/\r?\n/).map(line => line.trim()).filter(Boolean)
  const focusLines = lines.filter(line => (
    /(\[ERROR\]|\[WARN\]|❌|ModuleNotFoundError|ImportError|No module named|未找到微信窗口|无法找到微信主窗口|等待微信窗口超时|微信未运行|图片不存在)/i.test(line)
  ))
  const detail = (focusLines.length > 0 ? focusLines : lines).slice(-6).join('\n')
  const compact = (focusLines[focusLines.length - 1] || lines[lines.length - 1] || '').replace(/\s+/g, ' ').trim()

  if (
    /(ENOENT|not recognized as an internal or external command|cannot find the file|No such file or directory)/i.test(compact) &&
    /(python|py\.exe|python\.exe)/i.test(compact)
  ) {
    return {
      category: 'python',
      title: '找不到 Python',
      message: '当前 Windows 环境没有可用的 Python，请先安装 Python，或使用带 bundle Python 的安装包。',
      detail,
    }
  }

  if (
    /(No module named|ModuleNotFoundError|ImportError|dependency bootstrap failed|pip install .*失败|Could not find a version that satisfies)/i.test(compact)
  ) {
    return {
      category: 'dependency',
      title: 'Python 依赖缺失',
      message: '发送依赖没有装完整，请执行 `python -m pip install -r python/requirements.txt`，或重新安装最新版本。',
      detail,
    }
  }

  if (/(未找到微信窗口|无法找到微信主窗口|等待微信窗口超时|微信未运行|已尝试 Ctrl\+Alt\+W 唤醒)/i.test(compact)) {
    return {
      category: 'wechat',
      title: '找不到微信窗口',
      message: '请确认微信 PC 版已启动并登录，且窗口没有最小化到托盘。',
      detail,
    }
  }

  if (/(图片不存在|图片消息缺少图片路径)/i.test(compact)) {
    return {
      category: 'image',
      title: '图片路径无效',
      message: '当前任务引用的图片不存在，或图片路径为空，请检查任务配置。',
      detail,
    }
  }

  return {
    category: 'generic',
    title: '发送失败',
    message: compact || '发送进程异常退出，请打开日志查看详细信息。',
    detail,
  }
}

function createPythonUnavailableSummary(pythonBin) {
  return summarizeSendFailure(`python not found: ${pythonBin}`)
}

// ─── Python 路径（运行时检测，避免 isPackaged 在模块加载时出错）───────────
function getPythonPath() {
  if (!app.isPackaged) {
    const devBundle = process.platform === 'win32'
      ? path.join(__dirname, '..', 'python', 'bundle', 'python.exe')
      : path.join(__dirname, '..', 'python', 'bundle', 'bin', 'python3')
    if (fs.existsSync(devBundle)) return devBundle

    if (process.platform === 'win32') {
      if (commandExists('python')) return 'python'
      if (commandExists('py', ['-3', '--version']) || commandExists('py')) return 'py'
      return 'python'
    }
    if (commandExists('python3')) return 'python3'
    if (commandExists('python')) return 'python'
    return 'python3'
  }
  // extraResources: python/bundle/ -> Resources/python/bundle/
  const base = path.join(process.resourcesPath, 'python')
  if (process.platform === 'win32') {
    const winPython = path.join(base, 'bundle', 'python.exe')
    if (fs.existsSync(winPython)) return winPython
    const fallback = path.join(base, 'python.exe')
    return fs.existsSync(fallback) ? fallback : 'python'
  }
  // macOS: python-build-standalone: python/bundle/bin/python3
  const macPython = path.join(base, 'bundle', 'bin', 'python3')
  if (fs.existsSync(macPython)) return macPython
  return 'python3'
}

// 启动时确保 openpyxl 已安装（兜底 afterPack 脚本未运行的场景）
function ensurePythonDeps() {
  if (!app.isPackaged) return
  const pythonPath = getPythonPath()
  const requiredModules = [
    { module: 'openpyxl', pkg: 'openpyxl' },
    { module: 'yaml', pkg: 'PyYAML' },
    { module: 'rich', pkg: 'rich' },
    { module: 'flask', pkg: 'flask' },
  ]
  if (process.platform === 'win32') {
    requiredModules.push(
      { module: 'pywinauto', pkg: 'pywinauto' },
      { module: 'psutil', pkg: 'psutil' },
      { module: 'pyperclip', pkg: 'pyperclip' },
      { module: 'win32clipboard', pkg: 'pywin32' },
      { module: 'PIL', pkg: 'Pillow' },
    )
  }
  const probeCode = [
    'import importlib.util',
    `mods = ${JSON.stringify(requiredModules.map(item => item.module))}`,
    'missing = [m for m in mods if importlib.util.find_spec(m) is None]',
    'print("\\n".join(missing))',
  ].join('; ')
  try {
    const probe = spawnSync(pythonPath, ['-c', probeCode], {
      encoding: 'utf8',
      windowsHide: true,
      timeout: 15000,
    })
    if (probe.error) throw probe.error
    if (probe.status !== 0) throw new Error(probe.stderr || 'dependency probe failed')

    const missingModules = probe.stdout
      .split(/\r?\n/)
      .map(item => item.trim())
      .filter(Boolean)
    if (missingModules.length === 0) return

    const missingPackages = [...new Set(
      requiredModules
        .filter(item => missingModules.includes(item.module))
        .map(item => item.pkg)
    )]
    console.log('[python-deps] missing modules:', missingModules.join(', '))
    console.log('[python-deps] installing packages:', missingPackages.join(', '))

    const install = spawnSync(pythonPath, ['-m', 'pip', 'install', '--user', ...missingPackages], {
      encoding: 'utf8',
      windowsHide: true,
      timeout: 120 * 1000,
    })
    if (install.error) throw install.error
    if (install.status !== 0) {
      throw new Error(install.stderr || install.stdout || 'pip install failed')
    }
    console.log('[python-deps] install output:', install.stdout || install.stderr || 'ok')
  } catch (e) {
    console.error('[python-deps] dependency bootstrap failed:', e.message)
  }
}

function getScriptPath(name) {
  // extraResources: python/ -> Resources/python/
  if (!app.isPackaged) {
    return path.join(__dirname, '..', 'python', name)
  }
  return path.join(process.resourcesPath, 'python', name)
}

// ─── 加载 dist/（生产）vs localhost:5173（开发）────────────────────────
function loadMainWindow(win) {
  const distIndex = path.join(__dirname, '..', 'dist', 'index.html')
  if (fs.existsSync(distIndex)) {
    win.loadFile(distIndex)
  } else {
    win.loadURL('http://localhost:5173')
  }
}

// ─── macOS Automation 权限检测 + 引导授权 ───────────────────────────
let automationChecked = false
function checkAutomationPermission() {
  if (process.platform !== 'darwin' || automationChecked) return
  automationChecked = true

  // 等窗口加载完再检测，不要阻塞启动
  setTimeout(() => {
    try {
      const { dialog, shell } = require('electron')
      const result = require('child_process').spawnSync(
        'osascript',
        ['-e', 'tell application "System Events"\n keystroke "x"\n end tell'],
        { timeout: 5000 }
      )
      if (result.status === 0) return // 已有权限
    } catch (_) {}

    const win = BrowserWindow.getAllWindows()[0]
    if (!win || win.isDestroyed()) return

    dialog.showMessageBox(win, {
      type: 'warning',
      title: '需要辅助功能权限',
      message: 'WechatAGI 需要「辅助功能」权限才能自动发送微信消息。',
      detail: '点击「打开系统设置」后，在「辅助功能」列表中找到「WechatAGI」并勾选启用。',
      buttons: ['打开系统设置', '稍后'],
      defaultId: 0,
      cancelId: 1,
    }).then(({ response }) => {
      if (response === 0) {
        shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_Automation')
      }
    })
  }, 2000) // 窗口加载完再检测
}

// ─── 主进程 ───────────────────────────────────────────────────────────
let daemonProcess = null
let apiProcess = null

function createWindow() {
  const win = new BrowserWindow({
    width: 980, height: 680,
    minWidth: 800, minHeight: 560,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    backgroundColor: '#F5F5F5',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    icon: path.join(__dirname, '..', 'assets', 'icon.png'),
  })
  loadMainWindow(win)
  return win
}

// ─── IPC ──────────────────────────────────────────────────────────────

ipcMain.handle('get-config', async () => {
  try {
    const p = path.join(os.homedir(), '.wechatagi', 'config.json')
    if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf8'))
  } catch (_) {}
  return { send_interval: 5, max_per_minute: 8, poll_seconds: 15, dry_run: false }
})

ipcMain.handle('save-config', async (_, cfg) => {
  try {
    const dir = path.join(os.homedir(), '.wechatagi')
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(path.join(dir, 'config.json'), JSON.stringify(cfg, null, 2), 'utf8')
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e.message }
  }
})

ipcMain.handle('parse-excel', async (_, bytes) => {
  const tmp = path.join(os.tmpdir(), 'wst_upload_' + Date.now() + '.xlsx')
  try {
    fs.writeFileSync(tmp, Buffer.from(bytes))
    const pythonBin = getPythonPath()
    const scriptPath = getScriptPath('app/parse_excel.py')
    console.log('[parse-excel] python:', pythonBin, 'script:', scriptPath, 'tmp:', tmp)
    const r = spawnSync(pythonBin, [scriptPath, tmp], {
      encoding: 'utf8', timeout: 15000,
      env: Object.assign({}, process.env, { PYTHONIOENCODING: 'utf-8' }),
    })
    fs.unlinkSync(tmp)
    if (r.status !== 0) {
      console.error('[parse-excel] python error:', r.stderr)
      return { error: r.stderr }
    }
    try {
      return JSON.parse(r.stdout)
    } catch (e) {
      console.error('[parse-excel] JSON parse error:', e, 'raw:', r.stdout.slice(0, 200))
      return { error: '返回数据格式错误: ' + e.message }
    }
  } catch (e) {
    console.error('[parse-excel] exception:', e)
    return { error: e.message }
  }
})

ipcMain.handle('download-template', async (event) => {
  const win = BrowserWindow.fromWebContents(event.sender)
  const result = await dialog.showSaveDialog(win, {
    title: '保存表格模版',
    defaultPath: path.join(os.homedir(), 'Desktop', 'wechat_template.xlsx'),
    filters: [{ name: 'Excel', extensions: ['xlsx'] }],
  })
  if (result.canceled) return
  const r = spawnSync(getPythonPath(), [getScriptPath('app/template_gen.py'), result.filePath], {
    encoding: 'utf8',
    env: Object.assign({}, process.env, { PYTHONIOENCODING: 'utf-8' }),
  })
  return r.status === 0
    ? { ok: true, path: result.filePath }
    : { ok: false, err: r.stderr }
})

ipcMain.handle('send-now', async (event) => {
  const win = BrowserWindow.fromWebContents(event.sender)
  const proc = spawn(getPythonPath(), [getScriptPath('app/cli.py'), 'send'], {
    env: Object.assign({}, process.env, { PYTHONIOENCODING: 'utf-8', PYTHONUNBUFFERED: '1' }),
    windowsHide: true,
  })
  proc.stdout.on('data', function(d) {
    win.webContents.send('send-progress', d.toString('utf8'))
  })
  proc.stderr.on('data', function(d) {
    win.webContents.send('send-progress', '[ERROR] ' + d.toString('utf8'))
  })
  proc.on('close', function(code) {
    win.webContents.send('send-done', { code: code })
  })
  return { ok: true }
})

ipcMain.handle('send-selected', async (event, taskData) => {
  const win = BrowserWindow.fromWebContents(event.sender)
  const jsonArg = Array.isArray(taskData) ? JSON.stringify(taskData) : '[]'
  const pythonBin = getPythonPath()
  const scriptPath = getScriptPath('app/cli.py')
  console.log('[send-selected] python:', pythonBin)
  console.log('[send-selected] script:', scriptPath)
  console.log('[send-selected] tasks:', jsonArg.slice(0, 80))

  if (!isPythonAvailable(pythonBin)) {
    const summary = createPythonUnavailableSummary(pythonBin)
    if (!win.isDestroyed()) {
      win.webContents.send('send-progress', `[ERROR] ${summary.title}: ${summary.message}`)
      win.webContents.send('send-done', { code: 1, ok: false, summary })
    }
    return { ok: false, error: summary.message, summary }
  }

  // ✅ 改为 spawn 异步方式，避免 execFileSync 同步阻塞主进程导致"未响应"
  const proc = spawn(pythonBin, [scriptPath, 'send', '--tasks-json', jsonArg], {
    env: Object.assign({}, process.env, { PYTHONIOENCODING: 'utf-8', PYTHONUNBUFFERED: '1' }),
    windowsHide: true,
  })

  let stdoutBuf = ''
  let stderrBuf = ''
  let finished = false

  function finishSend(payload) {
    if (finished) return
    finished = true
    if (!win.isDestroyed()) win.webContents.send('send-done', payload)
  }

  proc.stdout.on('data', function(d) {
    const text = d.toString('utf8')
    stdoutBuf += text
    if (!win.isDestroyed()) win.webContents.send('send-progress', text)
    // 实时逐行解析任务状态
    text.split('\n').forEach(function(line) {
      if (!line.trim()) return
      const hasSuccess = line.includes('✅')
      const hasFailed = line.includes('❌')
      if (hasSuccess || hasFailed) {
        const taskMatch = line.match(/^\[(\d+)\/(\d+)\] → (.+?) \[(.+?)\]/)
        if (taskMatch && !win.isDestroyed()) {
          win.webContents.send('task-status-update', {
            target: taskMatch[3].trim(),
            msg_type: taskMatch[4].trim(),
            status: hasSuccess ? 'success' : 'failed',
          })
        }
      }
    })
  })

  proc.stderr.on('data', function(d) {
    const text = d.toString('utf8')
    stderrBuf += text
    console.error('[send-selected] stderr:', text)
    if (!win.isDestroyed()) win.webContents.send('send-progress', '[ERROR] ' + text)
  })

  proc.on('close', function(code) {
    console.log('[send-selected] process exited with code', code)
    const exitCode = code || 0
    if (exitCode === 0) {
      finishSend({ code: 0, ok: true })
      return
    }
    const summary = summarizeSendFailure([stderrBuf, stdoutBuf].filter(Boolean).join('\n'))
    finishSend({ code: exitCode, ok: false, summary })
  })

  proc.on('error', function(err) {
    console.error('[send-selected] process error:', err.message)
    const summary = summarizeSendFailure(err.message)
    if (!win.isDestroyed()) {
      win.webContents.send('send-progress', '[ERROR] ' + err.message)
    }
    finishSend({ code: 1, ok: false, error: err.message, summary })
  })

  return { ok: true }
})

ipcMain.handle('stop-send', async () => {
  try {
    fs.writeFileSync(path.join(os.homedir(), '.wechatagi', 'stop_signal'), String(Date.now()))
  } catch (_) {}
  return { ok: true }
})

ipcMain.handle('daemon-start', async (event) => {
  if (daemonProcess) return { ok: false, error: '已在运行' }
  const win = BrowserWindow.fromWebContents(event.sender)
  daemonProcess = spawn(getPythonPath(), [getScriptPath('app/cli.py'), 'daemon'], {
    env: Object.assign({}, process.env, { PYTHONIOENCODING: 'utf-8', PYTHONUNBUFFERED: '1' }),
    windowsHide: true,
  })
  daemonProcess.stdout.on('data', function(d) {
    if (!win.isDestroyed()) win.webContents.send('daemon-log', d.toString('utf8'))
  })
  daemonProcess.stderr.on('data', function(d) {
    if (!win.isDestroyed()) win.webContents.send('daemon-log', '[ERR] ' + d.toString('utf8'))
  })
  daemonProcess.on('close', function() {
    daemonProcess = null
    if (!win.isDestroyed()) win.webContents.send('daemon-stopped')
  })
  return { ok: true }
})

ipcMain.handle('daemon-stop', async () => {
  if (daemonProcess) { daemonProcess.kill(); daemonProcess = null }
  return { ok: true }
})

ipcMain.handle('daemon-status', async () => ({ running: daemonProcess !== null }))

ipcMain.handle('add-schedule', async (_, schedule) => {
  const f = path.join(os.homedir(), '.wechatagi', 'schedules.json')
  let arr = []
  try { arr = JSON.parse(fs.readFileSync(f, 'utf8')) } catch (_) {}
  arr.push(schedule)
  fs.writeFileSync(f, JSON.stringify(arr, null, 2))
  return { ok: true }
})

ipcMain.handle('remove-schedule', async (_, id) => {
  const f = path.join(os.homedir(), '.wechatagi', 'schedules.json')
  let arr = []
  try { arr = JSON.parse(fs.readFileSync(f, 'utf8')) } catch (_) {}
  arr = arr.filter(function(s) { return s.id !== id })
  fs.writeFileSync(f, JSON.stringify(arr, null, 2))
  return { ok: true }
})

// ── 任务持久化：GUI 任务同步写回 Excel，供 daemon 读取 ──────────────────


// ── GUI 任务同步：写任务列表到 gui_tasks.json（daemon 会读取）─────────────
ipcMain.handle('save-gui-tasks', async (_, taskList) => {
  try {
    const dir = path.join(os.homedir(), '.wechatagi')
    fs.mkdirSync(dir, { recursive: true })
    const f = path.join(dir, 'gui_tasks.json')
    fs.writeFileSync(f, JSON.stringify(taskList, null, 2), 'utf8')
    return { ok: true }
  } catch (e) {
    return { ok: false, err: e.message }
  }
})

ipcMain.handle('load-gui-tasks', async () => {
  try {
    const f = path.join(os.homedir(), '.wechatagi', 'gui_tasks.json')
    if (fs.existsSync(f)) {
      return JSON.parse(fs.readFileSync(f, 'utf8'))
    }
  } catch (_) {}
  return []
})

ipcMain.handle('pick-file', async (event) => {
  const win = BrowserWindow.fromWebContents(event.sender)
  const r = await dialog.showOpenDialog(win, {
    filters: [{ name: 'Excel', extensions: ['xlsx', 'xls'] }],
    properties: ['openFile'],
  })
  return r.canceled ? null : r.filePaths[0]
})

ipcMain.handle('open-file', async (_, filePath) => {
  await shell.openPath(filePath)
})

ipcMain.handle('get-platform', () => process.platform)

ipcMain.handle('check-wechat', async () => {
  try {
    const pythonBin = getPythonPath()
    if (!isPythonAvailable(pythonBin)) {
      const summary = createPythonUnavailableSummary(pythonBin)
      return { alive: false, detail: summary.message, summary }
    }
    const r = spawnSync(getPythonPath(), [getScriptPath('app/cli.py'), 'check-wechat'], {
      encoding: 'utf8', timeout: 10000,
      env: Object.assign({}, process.env, { PYTHONIOENCODING: 'utf-8' }),
    })
    if (r.error) {
      const summary = summarizeSendFailure(r.error.message)
      return { alive: false, detail: summary.message, summary }
    }
    if (r.status === 0) {
      try { return JSON.parse(r.stdout) } catch (_) {}
    }
    const summary = summarizeSendFailure([r.stderr, r.stdout].filter(Boolean).join('\n'))
    return { alive: false, detail: summary.message, summary }
  } catch (e) {
    const summary = summarizeSendFailure(e.message)
    return { alive: false, detail: summary.message, summary }
  }
})

// ─── API 服务管理 ─────────────────────────────────────────────────────
ipcMain.handle('api-start', async (event, opts) => {
  if (apiProcess) return { ok: false, error: 'API 服务已在运行' }
  const win = BrowserWindow.fromWebContents(event.sender)
  const port = (opts && opts.port) || 9528
  apiProcess = spawn(getPythonPath(), [getScriptPath('app/cli.py'), 'api', '--port', String(port)], {
    env: Object.assign({}, process.env, { PYTHONIOENCODING: 'utf-8', PYTHONUNBUFFERED: '1' }),
    windowsHide: true,
  })
  apiProcess.stdout.on('data', function(d) {
    if (!win.isDestroyed()) win.webContents.send('api-log', d.toString('utf8'))
  })
  apiProcess.stderr.on('data', function(d) {
    if (!win.isDestroyed()) win.webContents.send('api-log', '[ERR] ' + d.toString('utf8'))
  })
  apiProcess.on('close', function() {
    apiProcess = null
    if (!win.isDestroyed()) win.webContents.send('api-stopped')
  })
  return { ok: true }
})

ipcMain.handle('api-stop', async () => {
  if (apiProcess) { apiProcess.kill(); apiProcess = null }
  return { ok: true }
})

ipcMain.handle('api-status', async () => ({ running: apiProcess !== null }))

// ─── App lifecycle ────────────────────────────────────────────────────
app.whenReady().then(function() {
  // 数据迁移：从旧 .wechat-sender 目录复制到新 .wechatagi 目录
  const oldDir = path.join(os.homedir(), '.wechat-sender')
  const newDir = path.join(os.homedir(), '.wechatagi')
  if (fs.existsSync(oldDir) && !fs.existsSync(newDir)) {
    try {
      fs.cpSync(oldDir, newDir, { recursive: true })
      console.log('[migration] Copied .wechat-sender → .wechatagi')
    } catch (e) {
      console.warn('[migration] Failed to copy old config:', e.message)
    }
  }

  ensurePythonDeps()
  createWindow()
  // 首次启动检测 Automation 权限（macOS）
  checkAutomationPermission()
  app.on('activate', function() {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', function() {
  if (daemonProcess) daemonProcess.kill()
  if (apiProcess) apiProcess.kill()
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', function() {
  if (daemonProcess) daemonProcess.kill()
  if (apiProcess) apiProcess.kill()
})
