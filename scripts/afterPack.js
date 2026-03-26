/**
 * afterPack.js — electron-builder hook
 * 在打包完成后，将系统 Python 的 openpyxl 等依赖复制到 app bundle 的
 * Resources/python/lib/<version>/site-packages/，让打包后的 Python 能 import 它们。
 */
const { execSync } = require('child_process')
const path = require('path')
const fs = require('fs')

module.exports = function afterPack(context) {
  const { appOutDir, packager } = context
  const platform = packager.platform.name

  if (platform !== 'Mac OS X') return

  // 动态检测 Python 版本（如 3.14）
  let pythonVersion
  try {
    pythonVersion = execSync('python3 -c "import sys; print(f\'python{sys.version_info.major}.{sys.version_info.minor}\')"', {
      encoding: 'utf8'
    }).trim()
  } catch {
    pythonVersion = 'python3.14' // fallback
  }
  console.log('[afterPack] Detected Python version:', pythonVersion)

  // 找到系统 Python 的 site-packages（优先 user site-packages）
  let sitePackages
  try {
    sitePackages = execSync(
      'python3 -c "import site; print(site.getusersitepackages() or site.getsitepackages()[0])"',
      { encoding: 'utf8' }
    ).trim()
  } catch {
    try {
      sitePackages = execSync('python3 -c "import sys; print(sys.path[1])"', { encoding: 'utf8' }).trim()
    } catch {
      console.warn('[afterPack] Cannot detect Python site-packages, skipping openpyxl copy')
      return
    }
  }
  console.log('[afterPack] Source site-packages:', sitePackages)

  // 目标目录：Resources/python/lib/<version>/site-packages/
  const destLib = path.join(
    appOutDir,
    'WechatAGI.app',
    'Contents',
    'Resources',
    'python',
    'lib',
    pythonVersion,
    'site-packages'
  )

  fs.mkdirSync(destLib, { recursive: true })

  // 要打包的包（openpyxl + 其核心依赖）
  const pkgs = ['openpyxl', 'PyYAML', 'rich', 'et_xmlfile', 'jinja2', 'markupsafe', 'charset_normalizer', 'idna']

  for (const pkg of pkgs) {
    const src = path.join(sitePackages, pkg)
    const dst = path.join(destLib, pkg)
    if (fs.existsSync(src)) {
      console.log(`[afterPack] Copying ${pkg}...`)
      fs.rmSync(dst, { recursive: true, force: true })
      fs.cpSync(src, dst, { recursive: true })
    }
  }

  // 复制必要文件
  for (const fname of ['easy_install.py', 'site.py']) {
    const src = path.join(sitePackages, fname)
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, path.join(destLib, fname))
    }
  }

  console.log(`[afterPack] Done — openpyxl & deps copied to ${destLib}`)
}
