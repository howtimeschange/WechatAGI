import { useEffect, useRef } from 'react'
import './SendLogDrawer.css'

export default function SendLogDrawer({ logs, sending, onClose }) {
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  return (
    <div className="log-drawer">
      <div className="log-drawer-header">
        <div className="log-drawer-title">
          <span>📋 发送日志</span>
          {sending && <span className="live-indicator">● 运行中</span>}
        </div>
        <button className="btn-clear" onClick={onClose}>收起</button>
      </div>
      <div className="log-drawer-body">
        {logs.length === 0 && (
          <div className="log-empty">— 日志为空 —</div>
        )}
        {logs.map(log => (
          <div key={log.id} className={`log-line ${log.type ? `log-${log.type}` : ''}`}>
            {log.text}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
