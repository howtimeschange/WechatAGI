"""
WechatAGI — 消息队列 + 后台工作线程
线程安全的发送队列，支持进度回调和优雅停止。
"""
from __future__ import annotations

import queue
import random
import sys
import threading
import time
from typing import Callable, Optional


class SendQueue:
    """线程安全的消息发送队列。

    用法:
        sq = SendQueue(sender_fn=call_sender, cfg=get_cfg(), callback=on_progress)
        sq.start()
        sq.enqueue({"target": "张三", "msg_type": "文字", "text": "你好"})
        ...
        sq.stop()
    """

    def __init__(
        self,
        sender_fn: Callable,
        cfg: dict,
        callback: Optional[Callable[[dict], None]] = None,
    ):
        self._queue: queue.Queue = queue.Queue()
        self._stop_event = threading.Event()
        self._thread: Optional[threading.Thread] = None
        self._sender_fn = sender_fn
        self._cfg = cfg
        self._callback = callback or (lambda x: None)
        self._pending = 0
        self._lock = threading.Lock()

    @property
    def pending(self) -> int:
        with self._lock:
            return self._pending

    def start(self):
        if self._thread and self._thread.is_alive():
            return
        self._stop_event.clear()
        self._thread = threading.Thread(target=self._worker_loop, daemon=True)
        self._thread.start()

    def stop(self, timeout: float = 30.0):
        self._stop_event.set()
        if self._thread and self._thread.is_alive():
            self._thread.join(timeout)

    def enqueue(self, task_dict: dict):
        with self._lock:
            self._pending += 1
        self._queue.put(task_dict)

    def _worker_loop(self):
        # Windows COM 线程初始化
        if sys.platform == "win32":
            try:
                import pythoncom
                pythoncom.CoInitialize()
            except ImportError:
                pass

        send_interval = self._cfg.get("send_interval", 5)
        jitter_factor = self._cfg.get("jitter_delay_factor", 0.3)

        while not self._stop_event.is_set():
            try:
                task_dict = self._queue.get(timeout=1.0)
            except queue.Empty:
                continue

            target = task_dict.get("target", "")
            msg_type = task_dict.get("msg_type", "文字")
            text = task_dict.get("text", "")
            image_path = task_dict.get("image_path", "")

            try:
                self._callback({
                    "type": "sending",
                    "target": target,
                    "msg_type": msg_type,
                })
                self._sender_fn(target, msg_type, text, image_path)
                self._callback({
                    "type": "success",
                    "target": target,
                    "msg_type": msg_type,
                })
            except Exception as e:
                self._callback({
                    "type": "failed",
                    "target": target,
                    "msg_type": msg_type,
                    "error": str(e),
                })
            finally:
                with self._lock:
                    self._pending -= 1
                self._queue.task_done()

            # 发送间隔 + 随机抖动
            if not self._stop_event.is_set():
                jittered = send_interval * (1.0 + random.uniform(-jitter_factor, jitter_factor))
                # 用 stop_event.wait 代替 time.sleep，可被 stop() 中断
                self._stop_event.wait(max(0.5, jittered))

        # Windows COM 清理
        if sys.platform == "win32":
            try:
                import pythoncom
                pythoncom.CoUninitialize()
            except (ImportError, Exception):
                pass
