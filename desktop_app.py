import atexit
import os
import socket
import sys
import threading
import time
import urllib.request

os.environ.setdefault("REPORT_TOOL_LOCAL_DEV", "0")
from typing import Optional

import pystray
import uvicorn
import webview
from PIL import Image

from backend.config import log_event, is_frozen_exe
from backend.main import app

SERVER_HOST = "127.0.0.1"
SERVER_PORT = 8392
SERVER_URL = f"http://{SERVER_HOST}:{SERVER_PORT}"

log_event(f"Desktop app started. frozen={is_frozen_exe()} cwd={os.getcwd()}")

_backend_server: Optional[uvicorn.Server] = None
_tray_icon: Optional[pystray.Icon] = None
_window_instance = None


def get_resource_path(filename: str) -> str:
    if hasattr(sys, "_MEIPASS"):
        return os.path.join(sys._MEIPASS, filename)
    return os.path.join(os.path.dirname(os.path.abspath(__file__)), filename)


def is_port_in_use(host: str, port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.settimeout(1)
        return sock.connect_ex((host, port)) == 0


def wait_for_server_ready(timeout_seconds: int = 15) -> bool:
    deadline = time.time() + timeout_seconds
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(f"http://{SERVER_HOST}:{SERVER_PORT}/api/settings", timeout=2) as response:
                if response.status == 200:
                    return True
        except Exception:
            time.sleep(0.25)
    return False


def start_backend() -> None:
    global _backend_server
    if is_port_in_use(SERVER_HOST, SERVER_PORT):
        return
    config = uvicorn.Config(
        app,
        host=SERVER_HOST,
        port=SERVER_PORT,
        log_level="warning",
        access_log=False,
    )
    _backend_server = uvicorn.Server(config)
    _backend_server.run()


def stop_backend() -> None:
    global _backend_server
    if _backend_server is not None:
        _backend_server.should_exit = True
        _backend_server = None


def create_tray_icon(window) -> pystray.Icon:
    global _tray_icon, _window_instance
    _window_instance = window

    icon_path = get_resource_path("app.ico")
    image = Image.open(icon_path)
    icon = pystray.Icon("Report Tool", image, "Report Tool")

    def show_window() -> None:
        log_event("Tray icon 'Show' selected; attempting to restore window")

        def _restore_window() -> None:
            target = _window_instance
            if target is None:
                log_event("Tray icon show skipped: no active window reference")
                return
            try:
                target.show()
                time.sleep(0.15)
                try:
                    target.restore()
                except Exception:
                    pass
                time.sleep(0.10)
                try:
                    target.focus()
                except Exception:
                    pass
                try:
                    target.move_to_front()
                except Exception:
                    pass
            except Exception as exc:
                log_event(f"Tray icon restore failed: {exc}")

        threading.Thread(target=_restore_window, daemon=True).start()

    def exit_app() -> None:
        stop_backend()
        if _tray_icon is not None:
            try:
                _tray_icon.stop()
            except Exception:
                pass
        try:
            window.destroy()
        except Exception:
            pass

    icon.menu = pystray.Menu(
        pystray.MenuItem("Show", show_window),
        pystray.MenuItem("Exit", exit_app),
    )
    _tray_icon = icon
    return icon


def main() -> None:
    global _tray_icon, _window_instance

    if not is_port_in_use(SERVER_HOST, SERVER_PORT):
        backend_thread = threading.Thread(target=start_backend, daemon=True)
        backend_thread.start()
        if not wait_for_server_ready():
            print("Backend did not become ready on time; continuing with browser startup anyway.")

    window = webview.create_window(
        "Report Tool",
        SERVER_URL,
        width=1450,
        height=950,
        min_size=(1100, 700),
        resizable=True,
        confirm_close=False,
        background_color="#0f172a",
        maximized=True,
    )
    _window_instance = window

    tray_icon = create_tray_icon(window)

    exit_requested = {"value": False}

    def on_close():
        if exit_requested["value"]:
            return
        try:
            window.hide()
        except Exception:
            pass

    try:
        window.events.closing += on_close
    except AttributeError:
        pass

    def on_exit():
        exit_requested["value"] = True
        stop_backend()
        if _tray_icon is not None:
            try:
                _tray_icon.stop()
            except Exception:
                pass

    atexit.register(on_exit)

    tray_icon.run_detached()
    webview.start(debug=False, gui="windows")


if __name__ == "__main__":
    main()
