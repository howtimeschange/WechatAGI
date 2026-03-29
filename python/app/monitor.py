"""
WechatAGI — 微信断线监控模块
检测微信桌面端是否正在运行。
"""
from __future__ import annotations

import platform
import subprocess
import sys
from pathlib import Path


def _load_script_module(name: str, file_path: Path):
    import importlib.util

    existing = sys.modules.get(name)
    if existing is not None and getattr(existing, "__file__", None) == str(file_path):
        return existing

    spec = importlib.util.spec_from_file_location(name, str(file_path))
    if spec is None or spec.loader is None:
        raise ImportError(f"无法加载模块: {name} <- {file_path}")

    mod = importlib.util.module_from_spec(spec)
    sys.modules[name] = mod
    try:
        spec.loader.exec_module(mod)
    except Exception:
        sys.modules.pop(name, None)
        raise
    return mod


def check_wechat_alive() -> dict:
    """检测微信是否在线。返回 {"alive": bool, "detail": str}。"""
    if platform.system() == "Darwin":
        return _check_mac()
    elif platform.system() == "Windows":
        return _check_windows()
    return {"alive": False, "detail": "不支持的操作系统"}


def _check_mac() -> dict:
    """macOS: 通过 osascript 检查 WeChat / 微信 进程是否存在。"""
    script = (
        'tell application "System Events"\n'
        '  set plist to name of every process\n'
        '  if plist contains "WeChat" or plist contains "微信" then\n'
        '    return "running"\n'
        '  else\n'
        '    return "not_running"\n'
        '  end if\n'
        'end tell'
    )
    try:
        r = subprocess.run(
            ["osascript", "-e", script],
            capture_output=True, text=True, timeout=5,
        )
        if r.returncode == 0 and "running" in r.stdout:
            return {"alive": True, "detail": "微信正在运行"}
        return {"alive": False, "detail": "微信未运行"}
    except Exception as e:
        return {"alive": False, "detail": f"检测失败: {e}"}


def _check_windows() -> dict:
    """Windows: 复用 wechat_send_win._find_wechat_window() 检测窗口。"""
    try:
        scripts_dir = Path(__file__).resolve().parent.parent / "scripts"
        win_script = scripts_dir / "wechat_send_win.py"
        mod = _load_script_module("wechat_send_win", win_script)
        win = mod._find_wechat_window()
        if win is not None:
            return {"alive": True, "detail": "微信窗口已找到"}
        return {"alive": False, "detail": "未找到微信窗口"}
    except Exception as e:
        return {"alive": False, "detail": f"检测失败: {e}"}
