import { useState, useEffect, useRef } from 'react'
import './SettingsPage.css'

const DEFAULT_CFG = {
  send_interval: 5,
  max_per_minute: 8,
  poll_seconds: 15,
  dry_run: false,
  // 高级配置
  silent_mode: false,
  jitter_delay_factor: 0.3,
  clipboard_verify_retries: 3,
  // API 服务
  api_port: 9528,
  api_token: '',
}

export default function SettingsPage() {
  const [cfg, setCfg] = useState(DEFAULT_CFG)
  const [saved, setSaved] = useState(false)
  const [daemonOn, setDaemonOn] = useState(false)
  const [platform, setPlatform] = useState('')
  const logEndRef = useRef(null)
  const [daemonLogs, setDaemonLogs] = useState([])
  const [apiOn, setApiOn] = useState(false)
  const [apiLogs, setApiLogs] = useState([])
  const apiLogEndRef = useRef(null)

  useEffect(() => {
    if (window.api) {
      window.api.getPlatform().then(p => setPlatform(p))
      window.api.getConfig().then(data => {
        if (data && !data.error) setCfg({ ...DEFAULT_CFG, ...data })
      })
      window.api.daemonStatus().then(({ running }) => setDaemonOn(running))
      if (window.api.apiStatus) {
        window.api.apiStatus().then(({ running }) => setApiOn(running))
      }

      const unsub1 = window.api.onDaemonLog(data => {
        const ts = new Date().toLocaleTimeString('zh-CN', { hour12: false })
        setDaemonLogs(prev => [...prev.slice(-300), { text: `[${ts}] ${data.trim()}`, id: Date.now() + Math.random() }])
      })
      const unsub2 = window.api.onDaemonStopped(() => {
        setDaemonOn(false)
        setDaemonLogs(prev => [...prev, { text: '— 守护进程已停止 —', id: Date.now() }])
      })
      const unsub3 = window.api.onApiLog ? window.api.onApiLog(data => {
        const ts = new Date().toLocaleTimeString('zh-CN', { hour12: false })
        setApiLogs(prev => [...prev.slice(-300), { text: `[${ts}] ${data.trim()}`, id: Date.now() + Math.random() }])
      }) : null
      const unsub4 = window.api.onApiStopped ? window.api.onApiStopped(() => {
        setApiOn(false)
        setApiLogs(prev => [...prev, { text: '— API 服务已停止 —', id: Date.now() }])
      }) : null
      return () => { unsub1?.(); unsub2?.(); unsub3?.(); unsub4?.() }
    }
  }, [])

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [daemonLogs])

  useEffect(() => {
    apiLogEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [apiLogs])

  const save = async () => {
    if (window.api) await window.api.saveConfig(cfg)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  const set = (k, v) => { setCfg(c => ({ ...c, [k]: v })); setSaved(false) }

  // ── 守护进程 ──────────────────────────────
  const toggleDaemon = async () => {
    if (!window.api) { setDaemonOn(v => !v); return }
    if (daemonOn) {
      await window.api.daemonStop()
      setDaemonOn(false)
    } else {
      const r = await window.api.daemonStart()
      if (r.ok) { setDaemonOn(true); setDaemonLogs(prev => [...prev, { text: '▶ 守护进程启动中...', id: Date.now() }]) }
      else setDaemonLogs(prev => [...prev, { text: `❌ ${r.error}`, id: Date.now() }])
    }
  }

  const toggleApi = async () => {
    if (!window.api?.apiStart) { setApiOn(v => !v); return }
    if (apiOn) {
      await window.api.apiStop()
      setApiOn(false)
    } else {
      const port = cfg.api_port || 9528
      const r = await window.api.apiStart({ port })
      if (r.ok) { setApiOn(true); setApiLogs(prev => [...prev, { text: `▶ API 服务启动中 (端口 ${port})...`, id: Date.now() }]) }
      else setApiLogs(prev => [...prev, { text: `❌ ${r.error}`, id: Date.now() }])
    }
  }

  return (
    <div className="settings-page page">
      <h1 className="page-title">⚙️ 设置</h1>

      {/* 发送参数 */}
      <div className="card settings-card">
        <div className="settings-section-title">发送参数</div>

        <div className="cfg-row">
          <div className="cfg-label">
            <span>发送间隔</span>
            <span className="cfg-hint">两条消息之间的等待时间（秒）</span>
          </div>
          <div className="cfg-value">
            <div className="cfg-number-row">
              <input type="range" min="1" max="30" step="1" value={cfg.send_interval}
                onChange={e => set('send_interval', Number(e.target.value))} className="cfg-slider" />
              <span className="cfg-number-badge">{cfg.send_interval}s</span>
            </div>
          </div>
        </div>

        <div className="cfg-row">
          <div className="cfg-label">
            <span>每分钟上限</span>
            <span className="cfg-hint">防止发送过快导致封号</span>
          </div>
          <div className="cfg-value">
            <div className="cfg-number-row">
              <input type="range" min="1" max="30" step="1" value={cfg.max_per_minute}
                onChange={e => set('max_per_minute', Number(e.target.value))} className="cfg-slider" />
              <span className="cfg-number-badge">{cfg.max_per_minute}条</span>
            </div>
          </div>
        </div>

        <div className="cfg-row">
          <div className="cfg-label">
            <span>轮询间隔</span>
            <span className="cfg-hint">守护进程检查新任务的频率（秒）</span>
          </div>
          <div className="cfg-value">
            <div className="cfg-number-row">
              <input type="range" min="5" max="120" step="5" value={cfg.poll_seconds}
                onChange={e => set('poll_seconds', Number(e.target.value))} className="cfg-slider" />
              <span className="cfg-number-badge">{cfg.poll_seconds}s</span>
            </div>
          </div>
        </div>

        <div className="cfg-row cfg-toggle-row">
          <div className="cfg-label">
            <span>模拟运行</span>
            <span className="cfg-hint">开启后不真实发送消息</span>
          </div>
          <label className="toggle">
            <input type="checkbox" checked={cfg.dry_run}
              onChange={e => set('dry_run', e.target.checked)} />
            <span className="toggle-slider" />
          </label>
        </div>

        {cfg.dry_run && (
          <div className="dry-run-warning">⚠️ 模拟运行模式开启，不会真实发送任何消息</div>
        )}
      </div>

      {/* 高级参数 */}
      <div className="card settings-card">
        <div className="settings-section-title-row">
          <span className="settings-section-title-text">高级参数</span>
          <span className="platform-badge">{platform === 'win32' ? 'Windows' : platform === 'darwin' ? 'macOS' : ''}</span>
        </div>

        <div className="cfg-row">
          <div className="cfg-label">
            <span>防检测抖动强度</span>
            <span className="cfg-hint">两条消息之间的随机延迟波动幅度</span>
          </div>
          <div className="cfg-value">
            <div className="cfg-number-row">
              <input type="range" min="0" max="100" step="5"
                value={Math.round((cfg.jitter_delay_factor || 0) * 100)}
                onChange={e => set('jitter_delay_factor', Number(e.target.value) / 100)}
                className="cfg-slider" />
              <span className="cfg-number-badge">{Math.round((cfg.jitter_delay_factor || 0) * 100)}%</span>
            </div>
          </div>
        </div>

        {platform === 'win32' && (
          <div className="cfg-row">
            <div className="cfg-label">
              <span>剪贴板重试次数</span>
              <span className="cfg-hint">剪贴板写入验证失败后的重试次数</span>
            </div>
            <div className="cfg-value">
              <div className="cfg-number-row">
                <input type="range" min="1" max="5" step="1" value={cfg.clipboard_verify_retries}
                  onChange={e => set('clipboard_verify_retries', Number(e.target.value))} className="cfg-slider" />
                <span className="cfg-number-badge">{cfg.clipboard_verify_retries}次</span>
              </div>
            </div>
          </div>
        )}

        {platform === 'win32' && (
          <div className="cfg-row cfg-toggle-row">
            <div className="cfg-label">
              <span>静默发送模式 <span className="cfg-experimental-tag">实验性</span></span>
              <span className="cfg-hint">后台发送消息，不需要微信窗口在前台</span>
            </div>
            <label className="toggle">
              <input type="checkbox" checked={cfg.silent_mode}
                onChange={e => set('silent_mode', e.target.checked)} />
              <span className="toggle-slider" />
            </label>
          </div>
        )}
      </div>

      {/* 守护进程 */}
      <div className="card settings-card">
        <div className="settings-section-title">守护进程</div>

        <div className="daemon-row">
          <div className="daemon-status">
            <div className={`daemon-dot ${daemonOn ? 'dot-running' : 'dot-stopped'}`} />
            <div>
              <div className="daemon-status-label">{daemonOn ? '运行中' : '已停止'}</div>
              <div className="daemon-status-sub">
                {daemonOn
                  ? `每 ${cfg.poll_seconds}s 检查一次任务，到时立即发送`
                  : '监控任务发送时间，到点自动执行'}
              </div>
            </div>
          </div>
          <button className={`btn ${daemonOn ? 'btn-danger' : 'btn-primary'} daemon-toggle-btn`} onClick={toggleDaemon}>
            {daemonOn ? '⏹ 停止' : '▶ 启动'}
          </button>
        </div>

        {daemonLogs.length > 0 && (
          <div className="daemon-log-mini">
            {daemonLogs.slice(-6).map(l => (
              <div key={l.id} className="log-mini-line">{l.text}</div>
            ))}
            <div ref={logEndRef} />
          </div>
        )}
      </div>

      {/* API 服务 */}
      <div className="card settings-card">
        <div className="settings-section-title">API 服务</div>

        <div className="daemon-row">
          <div className="daemon-status">
            <div className={`daemon-dot ${apiOn ? 'dot-running' : 'dot-stopped'}`} />
            <div>
              <div className="daemon-status-label">{apiOn ? '运行中' : '已停止'}</div>
              <div className="daemon-status-sub">
                {apiOn
                  ? `HTTP API 监听端口 ${cfg.api_port || 9528}`
                  : '启动后可通过 HTTP API 发送消息（供 LLM Agent 调用）'}
              </div>
            </div>
          </div>
          <button className={`btn ${apiOn ? 'btn-danger' : 'btn-primary'} daemon-toggle-btn`} onClick={toggleApi}>
            {apiOn ? '⏹ 停止' : '▶ 启动'}
          </button>
        </div>

        <div className="cfg-row">
          <div className="cfg-label">
            <span>API 端口</span>
            <span className="cfg-hint">HTTP API 服务监听端口</span>
          </div>
          <div className="cfg-value">
            <div className="cfg-number-row">
              <input type="number" min="1024" max="65535" value={cfg.api_port || 9528}
                onChange={e => set('api_port', Number(e.target.value))}
                style={{ width: 90, padding: '4px 8px', borderRadius: 6, border: '1px solid var(--wx-border)', fontSize: 13 }} />
            </div>
          </div>
        </div>

        <div className="cfg-row">
          <div className="cfg-label">
            <span>API Token</span>
            <span className="cfg-hint">留空则不启用认证（不推荐）</span>
          </div>
          <div className="cfg-value">
            <input type="text" value={cfg.api_token || ''}
              onChange={e => set('api_token', e.target.value)}
              placeholder="设置访问 Token"
              style={{ width: '100%', padding: '4px 8px', borderRadius: 6, border: '1px solid var(--wx-border)', fontSize: 13 }} />
          </div>
        </div>

        {apiLogs.length > 0 && (
          <div className="daemon-log-mini">
            {apiLogs.slice(-6).map(l => (
              <div key={l.id} className="log-mini-line">{l.text}</div>
            ))}
            <div ref={apiLogEndRef} />
          </div>
        )}
      </div>

      {/* 定时说明 */}
      <div className="card settings-card">
        <div className="settings-section-title">定时说明</div>
        <p className="settings-note">
          每个任务可设置「发送时间」，守护进程会在指定时间自动发送。<br/>
          轮询间隔决定检查频率，建议 15–30 秒。<br/>
          发送后任务状态变为「发送成功」，重复任务（repeat）会在下一周期重新生效。
        </p>
      </div>

      {/* 保存 */}
      <div className="save-row">
        <button className="btn btn-primary save-btn" onClick={save}>保存设置</button>
        {saved && <span className="saved-tip">✅ 已保存</span>}
      </div>
    </div>
  )
}
