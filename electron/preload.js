const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('api', {
  // 配置
  getConfig: () => ipcRenderer.invoke('get-config'),
  saveConfig: (config) => ipcRenderer.invoke('save-config', config),
  getStatus: () => ipcRenderer.invoke('get-status'),
  getPlatform: () => ipcRenderer.invoke('get-platform'),

  // Excel 解析 & 模版
  parseExcel: (bytes) => ipcRenderer.invoke('parse-excel', bytes),
  downloadTemplate: () => ipcRenderer.invoke('download-template'),

  // 发送
  sendNow: () => ipcRenderer.invoke('send-now'),
  sendSelected: (taskIds) => ipcRenderer.invoke('send-selected', taskIds),
  stopSend: () => ipcRenderer.invoke('stop-send'),

  // 守护进程
  daemonStart: () => ipcRenderer.invoke('daemon-start'),
  daemonStop: () => ipcRenderer.invoke('daemon-stop'),
  daemonStatus: () => ipcRenderer.invoke('daemon-status'),

  // 定时任务
  addSchedule: (schedule) => ipcRenderer.invoke('add-schedule', schedule),
  removeSchedule: (id) => ipcRenderer.invoke('remove-schedule', id),

  // 文件
  pickFile: () => ipcRenderer.invoke('pick-file'),
  openFile: (path) => ipcRenderer.invoke('open-file', path),

  // 事件监听
  onSendProgress: (cb) => {
    ipcRenderer.on('send-progress', (_, data) => cb(data))
    return () => ipcRenderer.removeAllListeners('send-progress')
  },
  onSendDone: (cb) => {
    ipcRenderer.on('send-done', (_, data) => cb(data))
    return () => ipcRenderer.removeAllListeners('send-done')
  },
  onTaskStatusUpdate: (cb) => {
    ipcRenderer.on('task-status-update', (_, data) => cb(data))
    return () => ipcRenderer.removeAllListeners('task-status-update')
  },
  onDaemonLog: (cb) => {
    ipcRenderer.on('daemon-log', (_, data) => cb(data))
    return () => ipcRenderer.removeAllListeners('daemon-log')
  },
  onDaemonStopped: (cb) => {
    ipcRenderer.on('daemon-stopped', () => cb())
    return () => ipcRenderer.removeAllListeners('daemon-stopped')
  },
})
