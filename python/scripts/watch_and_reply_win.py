#!/usr/bin/env python3
"""
WechatAGI — Windows 自动回复监控
依赖: pip install uiautomation pyperclip pywin32 Pillow
用法: python scripts/watch_and_reply_win.py --contact 文件传输助手 --poll 2 --dry
"""
from __future__ import annotations
import argparse
import sys
import time
from pathlib import Path

try:
    import uiautomation as auto
    import pyperclip
except ImportError:
    print("[信息] 正在安装 Windows 自动化依赖...")
    import subprocess
    subprocess.run([sys.executable, "-m", "pip", "install", "uiautomation", "pyperclip", "-q"])
    import uiautomation as auto
    import pyperclip

WECHAT_WIN_TITLE = "微信"


def activate_wechat():
    win = auto.WindowControl(Name=WECHAT_WIN_TITLE, searchDepth=1)
    if not win.Exists(3):
        raise RuntimeError("未找到微信窗口，请先打开并登录 PC 微信")
    win.SetActive()
    time.sleep(0.4)
    return win


def open_contact(name: str):
    auto.SendKeys("{Ctrl}f")
    time.sleep(0.25)
    pyperclip.copy(name)
    auto.SendKeys("{Ctrl}v")
    time.sleep(0.2)
    auto.SendKeys("{Enter}")
    time.sleep(0.6)
    auto.SendKeys("{Escape}")
    time.sleep(0.1)


def get_last_message() -> str:
    """尝试读取最后一条消息文本"""
    try:
        win = auto.WindowControl(Name=WECHAT_WIN_TITLE, searchDepth=1)
        msgs = win.ListControl(searchDepth=5)
        if msgs.Exists(1):
            items = msgs.GetChildren()
            if items:
                return items[-1].Name or ""
    except Exception:
        pass
    return ""


def send_reply(text: str, dry: bool):
    if dry:
        print(f"  [dry] 模拟回复: {text}")
        return
    pyperclip.copy(text)
    auto.SendKeys("{Ctrl}v")
    time.sleep(0.1)
    auto.SendKeys("{Enter}")
    time.sleep(0.3)


def watch_loop(contact: str, poll: int, dry: bool):
    print(f"监控启动 | 联系人: {contact} | 轮询: {poll}s | dry={dry}")
    try:
        activate_wechat()
        open_contact(contact)
    except Exception as e:
        print(f"❌ 初始化失败: {e}")
        return

    last_msg = ""
    while True:
        try:
            msg = get_last_message()
            if msg and msg != last_msg:
                print(f"[新消息] {msg}")
                last_msg = msg
                # 简单示例：收到消息后回复"已收到"
                send_reply("已收到", dry)
        except Exception as e:
            print(f"轮询错误: {e}")
        time.sleep(poll)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="微信自动回复 — Windows 版")
    parser.add_argument("--contact", default="文件传输助手", help="监控的联系人")
    parser.add_argument("--poll", type=int, default=2, help="轮询间隔（秒）")
    parser.add_argument("--dry", action="store_true", help="模拟运行，不真实发送")
    args = parser.parse_args()
    watch_loop(args.contact, args.poll, args.dry)
