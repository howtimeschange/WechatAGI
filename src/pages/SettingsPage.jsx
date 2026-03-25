import { useState, useEffect, useRef } from 'react'
import './SettingsPage.css'

const REPEAT_LABELS = { '': '不重复', daily: '每天', weekly: '每周', workday: '每个工作日' }

const DEFAULT_CFG = {
  send_interval: 5,
  max_per_minute: 8,
  poll_seconds: 15,
  dry_run: false,
}

export default function SettingsPage() {
  const [cfg, setCfg] = useState(DEFAULT_CFG)
  const [saved, setSaved] = useState(false)
  const [schedules, setSchedules] = useState([]) // { id, time, repeat, enabled }
  const [showAdd, setShowAdd] = useState(false)
  const [newTime, setNewTime] = useState('')
  const [newRepeat, setNewRepeat] = useState('')
  const [daemonOn, setDaemonOn] = useState(false)
  const logEndRef = useRef(null)
  const [daemonLogs, setDaemonLogs] = useState([])

  useEffect(() => {
    if (window.api) {
      window.api.getConfig().then(data => {
        if (data && !data.error) setCfg({ ...DEFAULT_CFG, ...data })
      })
      window.api.daemonStatus().then(({ running }) => setDaemonOn(running))

      const unsub1 = window.api.onDaemonLog(data => {
        const ts = new Date().toLocaleTimeString('zh-CN', { hour12: false })
        setDaemonLogs(prev => [...prev.slice(-300), { text: `[${ts}] ${data.trim()}`, id: Date.now() + Math.random() }])
      })
      const unsub2 = window.api.onDaemonStopped(() => {
        setDaemonOn(false)
        setDaemonLogs(prev => [...prev, { text: '— 守护进程已停止 —', id: Date.now() }])
      })
      return () => { unsub1?.(); unsub2?.() }
    }
  }, [])

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [daemonLogs])

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

  // ── 定时任务 ──────────────────────────────
  const addSchedule = () => {
    if (!newTime) return
    const s = { id: Date.now(), time: newTime, repeat: newRepeat, enabled: true }
    setSchedules(prev => [...prev, s])
    setNewTime(''); setNewRepeat(''); setShowAdd(false)

    // 注册 cron 任务（如果支持）
    if (window.api?.addSchedule) {
      window.api.addSchedule(s)
    }
  }

  const removeSchedule = (id) => {
    setSchedules(prev => prev.filter(s => s.id !== id))
    if (window.api?.removeSchedule) window.api.removeSchedule(id)
  }

  const toggleSchedule = (id) => {
    setSchedules(prev => prev.map(s => s.id === id ? { ...s, enabled: !s.enabled } : s))
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

      {/* 守护进程 */}
      <div className="card settings-card">
        <div className="settings-section-title">守护进程</div>

        <div className="daemon-row">
          <div className="daemon-status">
            <div className={`daemon-dot ${daemonOn ? 'dot-running' : 'dot-stopped'}`} />
            <div>
              <div className="daemon-status-label">{daemonOn ? '运行中' : '已停止'}</div>
              <div className="daemon-status-sub">
                {daemonOn ? `轮询间隔 ${cfg.poll_seconds}s` : '自动监控任务，到时立即发送'}
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

      {/* 定时任务 */}
      <div className="card settings-card">
        <div className="settings-section-title-row">
          <div className="settings-section-title" style={{ marginBottom: '0' }}>定时任务</div>
          <button className="btn btn-ghost btn-sm" onClick={() => setShowAdd(v => !v)}>
            {showAdd ? '取消' : '+ 添加定时'}
          </button>
        </div>
        <p className="settings-note">在指定时间自动执行「发送选中任务」，适合定期推送场景。</p>

        {showAdd && (
          <div className="add-schedule-row">
            <input type="datetime-local" className="input" value={newTime}
              onChange={e => setNewTime(e.target.value)} />
            <select className="input select" value={newRepeat}
              onChange={e => setNewRepeat(e.target.value)} style={{ width: '130px' }}>
              <option value="">单次</option>
              <option value="daily">每天</option>
              <option value="weekly">每周</option>
              <option value="workday">每个工作日</option>
            </select>
            <button className="btn btn-primary btn-sm" onClick={addSchedule}>确认</button>
          </div>
        )}

        {schedules.length === 0 && !showAdd && (
          <div className="schedules-empty">暂无定时任务</div>
        )}

        {schedules.map(s => (
          <div className="schedule-item" key={s.id}>
            <label className="toggle">
              <input type="checkbox" checked={s.enabled}
                onChange={() => toggleSchedule(s.id)} />
              <span className="toggle-slider" />
            </label>
            <div className="schedule-info">
              <span className="schedule-time">{s.time}</span>
              <span className="schedule-repeat">{REPEAT_LABELS[s.repeat] || s.repeat}</span>
            </div>
            <button className="icon-btn icon-btn-danger" onClick={() => removeSchedule(s.id)}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
              </svg>
            </button>
          </div>
        ))}
      </div>

      {/* 保存 */}
      <div className="save-row">
        <button className="btn btn-primary save-btn" onClick={save}>保存设置</button>
        {saved && <span className="saved-tip">✅ 已保存</span>}
      </div>
    </div>
  )
}
