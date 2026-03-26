"""
WechatAGI — 图片 URL 下载 + MD5 缓存模块
支持 HTTP/HTTPS 图片 URL 自动下载并缓存到本地。
"""
from __future__ import annotations

import hashlib
import os
import sys
import urllib.request
from pathlib import Path


def _real_home() -> Path:
    if sys.platform == "win32":
        return Path(os.environ.get("USERPROFILE",
                    os.environ.get("HOMEDRIVE", "C:\\") + "\\Users\\" + os.environ.get("USERNAME", "")))
    return Path(os.path.expanduser("~"))


CACHE_DIR = _real_home() / ".wechatagi" / "image_cache"


def resolve_image(path_or_url: str) -> str:
    """将图片路径或 URL 解析为本地文件路径。

    - http/https URL → 下载并缓存到 ~/.wechatagi/image_cache/，文件名为 md5(url) + 扩展名
    - 本地路径 → 原样返回
    """
    if not path_or_url:
        return path_or_url

    stripped = path_or_url.strip()
    if not stripped.startswith(("http://", "https://")):
        return path_or_url

    # 计算 URL 的 MD5 作为缓存文件名
    url_hash = hashlib.md5(stripped.encode("utf-8")).hexdigest()

    # 推断扩展名
    ext = _guess_ext(stripped)
    cache_name = f"{url_hash}{ext}"
    cache_path = CACHE_DIR / cache_name

    if cache_path.exists():
        return str(cache_path)

    # 下载
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    try:
        urllib.request.urlretrieve(stripped, str(cache_path))
    except Exception as e:
        raise RuntimeError(f"图片下载失败: {stripped} → {e}")

    return str(cache_path)


def _guess_ext(url: str) -> str:
    """从 URL 路径中猜测文件扩展名。"""
    from urllib.parse import urlparse
    path = urlparse(url).path.lower()
    for ext in (".png", ".jpg", ".jpeg", ".gif", ".bmp", ".webp"):
        if path.endswith(ext):
            return ext
    return ".png"  # 默认
