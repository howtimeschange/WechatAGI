import { useState, useEffect, useRef } from 'react'
import './NewTaskModal.css'

const EMPTY = {
  app: '微信',
  target: '',
  msg_type: '文字',
  text: '',
  image_path: '',
  send_time: '',
  repeat: '',
}

export default function NewTaskModal({ initial, onConfirm, onClose }) {
  const [form, setForm] = useState(initial ? { ...EMPTY, ...initial } : { ...EMPTY })
  const [errors, setErrors] = useState({})
  const firstRef = useRef()

  useEffect(() => {
    firstRef.current?.focus()
  }, [])

  const set = (k, v) => {
    setForm(f => ({ ...f, [k]: v }))
    setErrors(e => ({ ...e, [k]: undefined }))
  }

  const validate = () => {
    const e = {}
    if (!form.target.trim()) e.target = '联系人/群聊不能为空'
    if (!form.msg_type) e.msg_type = '请选择消息类型'
    if ((form.msg_type === '文字' || form.msg_type === '文字+图片') && !form.text.trim())
      e.text = '文字内容不能为空'
    if ((form.msg_type === '图片' || form.msg_type === '文字+图片') && !form.image_path.trim())
      e.image_path = '图片路径不能为空'
    if (form.send_time) {
      const d = new Date(form.send_time)
      if (isNaN(d.getTime())) e.send_time = '时间格式错误'
    }
    return e
  }

  const submit = (e) => {
    e.preventDefault()
    const e2 = validate()
    if (Object.keys(e2).length) { setErrors(e2); return }
    onConfirm({ ...form })
  }

  const isEdit = !!initial

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box">
        <div className="modal-header">
          <h2 className="modal-title">{isEdit ? '✏️ 编辑任务' : '➕ 新建任务'}</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <form className="modal-form" onSubmit={submit}>
          <div className="form-row">
            <label className="form-label">联系人/群聊 *</label>
            <div className="form-input-wrap">
              <input
                ref={firstRef}
                className={`input ${errors.target ? 'input-error' : ''}`}
                value={form.target}
                onChange={e => set('target', e.target.value)}
                placeholder="精确的微信昵称或群名"
              />
              {errors.target && <span className="form-error">{errors.target}</span>}
            </div>
          </div>

          <div className="form-row">
            <label className="form-label">消息类型 *</label>
            <div className="type-selector">
              {['文字', '图片', '文字+图片'].map(t => (
                <button
                  key={t}
                  type="button"
                  className={`type-btn ${form.msg_type === t ? 'active' : ''}`}
                  onClick={() => set('msg_type', t)}
                >
                  {t}
                </button>
              ))}
            </div>
            {errors.msg_type && <span className="form-error">{errors.msg_type}</span>}
          </div>

          {(form.msg_type === '文字' || form.msg_type === '文字+图片') && (
            <div className="form-row">
              <label className="form-label">文字内容 *</label>
              <div className="form-input-wrap">
                <textarea
                  className={`input textarea ${errors.text ? 'input-error' : ''}`}
                  value={form.text}
                  onChange={e => set('text', e.target.value)}
                  placeholder="输入要发送的文本内容..."
                  rows={3}
                />
                {errors.text && <span className="form-error">{errors.text}</span>}
              </div>
            </div>
          )}

          {(form.msg_type === '图片' || form.msg_type === '文字+图片') && (
            <div className="form-row">
              <label className="form-label">图片路径 *</label>
              <div className="form-input-wrap">
                <input
                  className={`input ${errors.image_path ? 'input-error' : ''}`}
                  value={form.image_path}
                  onChange={e => set('image_path', e.target.value)}
                  placeholder="/Users/xxx/picture.png"
                />
                {errors.image_path && <span className="form-error">{errors.image_path}</span>}
              </div>
            </div>
          )}

          <div className="form-row-inline">
            <div className="form-row-half">
              <label className="form-label">发送时间</label>
              <input
                type="datetime-local"
                className={`input ${errors.send_time ? 'input-error' : ''}`}
                value={form.send_time}
                onChange={e => set('send_time', e.target.value)}
              />
              {errors.send_time && <span className="form-error">{errors.send_time}</span>}
            </div>

            <div className="form-row-half">
              <label className="form-label">重复</label>
              <select
                className="input select"
                value={form.repeat}
                onChange={e => set('repeat', e.target.value)}
              >
                <option value="">不重复</option>
                <option value="daily">每天</option>
                <option value="weekly">每周</option>
                <option value="workday">每个工作日</option>
              </select>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>取消</button>
            <button type="submit" className="btn btn-primary">
              {isEdit ? '保存修改' : '添加任务'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
