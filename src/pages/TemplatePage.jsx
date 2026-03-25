import './TemplatePage.css'

const COLUMNS = [
  { name: '* 应用', required: true, desc: '固定填「微信」', example: '微信' },
  { name: '* 联系人/群聊', required: true, desc: '精确的微信昵称或群名', example: '张三' },
  { name: '* 消息类型', required: true, desc: '文字 / 图片 / 文字+图片', example: '文字' },
  { name: '* 文字内容', required: true, desc: '要发送的文本内容', example: '你好！' },
  { name: '图片路径', required: false, desc: '本地图片绝对路径', example: '/Users/xx/pic.png' },
  { name: '发送时间', required: false, desc: '格式：2025-01-01 14:30，留空=立即', example: '2025-01-01 14:30' },
  { name: '重复', required: false, desc: 'daily / weekly / workday / 留空=不重复', example: 'daily' },
  { name: '备注', required: false, desc: '任意备注，不影响发送', example: '测试用' },
  { name: '状态', required: false, desc: '发送后自动填充，请勿手动编辑', example: '发送成功' },
]

const RISK_ITEMS = [
  { icon: '🔒', title: '关键词拦截', desc: '检测到转账、借钱、合同、发票等敏感词时自动跳过' },
  { icon: '⏱️', title: '速率限制', desc: '同联系人每分钟最多 N 条（可在偏好设置中配置）' },
  { icon: '🔥', title: '熔断保护', desc: '连续失败 3 次自动暂停 30 秒，防止异常连续操作' },
  { icon: '✅', title: '白名单模式', desc: '可设置仅对指定联系人启用自动化' },
]

export default function TemplatePage() {
  return (
    <div className="page">
      <h1 className="page-title"><span>📋</span> 表格说明</h1>

      <div className="card tpl-card">
        <div className="tpl-section-title">Excel 模板结构</div>
        <div className="tpl-note">
          Sheet 名称固定为「<strong>发送任务</strong>」，第 2 行为表头，数据从第 3 行开始
        </div>
        <div className="tpl-table-wrap">
          <table className="tpl-table">
            <thead>
              <tr>
                <th>列名</th>
                <th>必填</th>
                <th>说明</th>
                <th>示例</th>
              </tr>
            </thead>
            <tbody>
              {COLUMNS.map((col) => (
                <tr key={col.name}>
                  <td>
                    <span className={`col-name ${col.required ? 'required' : ''}`}>
                      {col.name}
                    </span>
                  </td>
                  <td>
                    {col.required
                      ? <span className="badge badge-success">必填</span>
                      : <span className="badge" style={{ background: '#F5F5F5', color: '#888' }}>可选</span>
                    }
                  </td>
                  <td className="col-desc">{col.desc}</td>
                  <td className="col-example">{col.example}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card tpl-card">
        <div className="tpl-section-title">风控说明</div>
        <div className="risk-grid">
          {RISK_ITEMS.map((item) => (
            <div className="risk-item" key={item.title}>
              <span className="risk-icon">{item.icon}</span>
              <div>
                <div className="risk-title">{item.title}</div>
                <div className="risk-desc">{item.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card tpl-card">
        <div className="tpl-section-title">状态字段说明</div>
        <div className="status-list">
          {[
            { status: '待发送', badge: 'badge-waiting', desc: '等待发送' },
            { status: '发送中', badge: 'badge-running', desc: '正在发送，自动设置' },
            { status: '发送成功 HH:MM', badge: 'badge-success', desc: '发送成功，附带时间戳' },
            { status: '发送失败: 原因', badge: 'badge-failed', desc: '发送失败，附带错误信息' },
          ].map(item => (
            <div className="status-row" key={item.status}>
              <span className={`badge ${item.badge}`}>{item.status}</span>
              <span className="status-desc">{item.desc}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="card tpl-card">
        <div className="tpl-section-title">常见问题</div>
        <div className="faq-list">
          {[
            {
              q: 'macOS 提示 "osascript 不允许发送按键" 或 error -1002',
              a: '需授予辅助功能权限：系统设置 → 隐私与安全性 → 辅助功能，勾选 Terminal 或本 App'
            },
            {
              q: 'Windows 找不到微信窗口',
              a: '请先打开 PC 微信并登录，确认窗口标题为「微信」，并以管理员身份运行本程序'
            },
            {
              q: '图片发送失败',
              a: 'Windows 请使用绝对路径（C:\\Users\\xx\\pic.png），图片格式支持 PNG/JPG/BMP'
            },
            {
              q: '被风控/封号怎么办',
              a: '降低发送频率（增大间隔、减少每分钟条数），避免短时间向大量陌生人发送相同内容'
            },
          ].map((faq, i) => (
            <div className="faq-item" key={i}>
              <div className="faq-q">Q: {faq.q}</div>
              <div className="faq-a">A: {faq.a}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
