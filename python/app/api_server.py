"""
WechatAGI — HTTP API 服务（Flask）
供外部 LLM Agent 或自动化脚本调用的 RESTful API。
"""
from __future__ import annotations

import importlib.util
import json
import os
import sys
from functools import wraps
from pathlib import Path

try:
    from flask import Flask, request, jsonify
except ImportError:
    Flask = None

_SELF_DIR = Path(__file__).resolve().parent


def _load_module(name: str, filename: str):
    """动态加载同目录下的模块。"""
    path = _SELF_DIR / filename
    existing = sys.modules.get(name)
    if existing is not None and getattr(existing, "__file__", None) == str(path):
        return existing

    spec = importlib.util.spec_from_file_location(name, str(path))
    if spec is None or spec.loader is None:
        raise ImportError(f"无法加载模块: {name} <- {path}")

    mod = importlib.util.module_from_spec(spec)
    sys.modules[name] = mod
    try:
        spec.loader.exec_module(mod)
    except Exception:
        sys.modules.pop(name, None)
        raise
    return mod


def create_app(api_token: str = "", cfg: dict | None = None) -> Flask:
    """创建 Flask 应用实例。"""
    if Flask is None:
        raise ImportError("flask 未安装，请运行: pip install flask>=3.0")

    app = Flask(__name__)
    app.config["JSON_AS_ASCII"] = False

    # 懒加载依赖模块
    cli_mod = _load_module("cli", "cli.py")
    monitor_mod = _load_module("monitor", "monitor.py")

    # 初始化发送队列
    queue_mod = _load_module("queue_worker", "queue_worker.py")
    _cfg = cfg or cli_mod.get_cfg()
    send_queue = queue_mod.SendQueue(
        sender_fn=cli_mod.call_sender,
        cfg=_cfg,
        callback=lambda ev: print(
            f"[API] {ev.get('type', '')} → {ev.get('target', '')} [{ev.get('msg_type', '')}]"
            + (f" error={ev.get('error', '')}" if ev.get("error") else ""),
            flush=True,
        ),
    )
    send_queue.start()

    def require_token(f):
        @wraps(f)
        def decorated(*args, **kwargs):
            if not api_token:
                return f(*args, **kwargs)
            token = request.headers.get("Authorization", "").replace("Bearer ", "")
            if not token:
                token = request.json.get("token", "") if request.is_json else ""
            if token != api_token:
                return jsonify({"ok": False, "error": "invalid token"}), 401
            return f(*args, **kwargs)
        return decorated

    @app.route("/api/health", methods=["GET"])
    def health():
        return jsonify({"ok": True})

    @app.route("/api/status", methods=["GET"])
    @require_token
    def status():
        wechat = monitor_mod.check_wechat_alive()
        return jsonify({
            "ok": True,
            "queue_pending": send_queue.pending,
            "wechat": wechat,
        })

    @app.route("/api/send", methods=["POST"])
    @require_token
    def send():
        data = request.get_json(force=True)
        target = data.get("target", "")
        msg_type = data.get("msg_type", "文字")
        text = data.get("text", "")
        image_path = data.get("image_path", "")

        if not target:
            return jsonify({"ok": False, "error": "target is required"}), 400

        send_queue.enqueue({
            "target": target,
            "msg_type": msg_type,
            "text": text,
            "image_path": image_path,
        })
        return jsonify({"ok": True, "queued": 1})

    @app.route("/api/batch", methods=["POST"])
    @require_token
    def batch():
        data = request.get_json(force=True)
        tasks = data.get("tasks", [])
        if not tasks:
            return jsonify({"ok": False, "error": "tasks array is required"}), 400

        count = 0
        for task in tasks:
            if not task.get("target"):
                continue
            send_queue.enqueue({
                "target": task.get("target", ""),
                "msg_type": task.get("msg_type", "文字"),
                "text": task.get("text", ""),
                "image_path": task.get("image_path", ""),
            })
            count += 1
        return jsonify({"ok": True, "queued": count})

    @app.teardown_appcontext
    def shutdown_queue(exception=None):
        send_queue.stop(timeout=5)

    return app
