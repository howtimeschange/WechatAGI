import './TitleBar.css'

export default function TitleBar() {
  const isMac = navigator.platform.includes('Mac')

  return (
    <div className={`titlebar ${isMac ? 'mac' : 'win'}`}>
      {isMac && <div className="titlebar-mac-space" />}
      <div className="titlebar-icon">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" fill="#07C160"/>
          <path d="M7 12.5C7 10 9 8.5 12 8.5C15 8.5 17 10 17 12.5C17 15 15 16.5 12 16.5C11.2 16.5 10.4 16.3 9.8 16L7.5 17L8 14.8C7.3 14.1 7 13.3 7 12.5Z" fill="white"/>
        </svg>
      </div>
      <span className="titlebar-title">微信发送助手</span>
    </div>
  )
}
