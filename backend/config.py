import json
import os
import subprocess
import sys
import base64
import hashlib
from datetime import datetime
from cryptography.fernet import Fernet
from pydantic import BaseModel
from typing import Optional


def is_frozen_exe() -> bool:
    return getattr(sys, "frozen", False) or hasattr(sys, "_MEIPASS")


def resolve_settings_path() -> str:
    if is_frozen_exe():
        app_data_dir = os.path.join(os.environ.get("LOCALAPPDATA", os.path.expanduser("~")), "ReportTool")
        os.makedirs(app_data_dir, exist_ok=True)
        return os.path.join(app_data_dir, "settings.json")

    repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    return os.path.join(repo_root, "settings.json")


def resolve_log_path() -> str:
    if is_frozen_exe():
        app_data_dir = os.path.join(os.environ.get("LOCALAPPDATA", os.path.expanduser("~")), "ReportTool")
        os.makedirs(app_data_dir, exist_ok=True)
        return os.path.join(app_data_dir, "reporttool.log")
    repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    return os.path.join(repo_root, "reporttool.log")


APP_DATA_DIR = os.path.join(os.environ.get("LOCALAPPDATA", os.path.expanduser("~")), "ReportTool")
SETTINGS_FILE = resolve_settings_path()
LOG_FILE = resolve_log_path()


def ensure_app_data_dir():
    if is_frozen_exe():
        os.makedirs(APP_DATA_DIR, exist_ok=True)
    return APP_DATA_DIR


def log_event(message: str):
    try:
        log_path = resolve_log_path()
        os.makedirs(os.path.dirname(log_path), exist_ok=True)
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        with open(log_path, "a", encoding="utf-8") as f:
            f.write(f"[{timestamp}] {message}\n")
    except Exception:
        pass

class AppSettings(BaseModel):
    reference_path_category: str = ""
    reference_path_fs: str = ""
    reference_path_week: str = ""
    reference_path_cdam: str = ""
    reference_path_gt_channel: str = ""
    reference_path_new_customer: str = ""
    reference_path_wrong_ci: str = ""
    reference_path_freegoods: str = ""
    default_import_folder: str = ""
    default_export_folder: str = ""
    export_prefix: str = "KENEA"
    export_name_net_invoiced: str = "Net Invoiced"
    export_name_sales_order: str = "Sales Order"
    export_name_served_invoice: str = "Served Invoice"
    export_name_cml: str = "CML"
    default_ci_folder: str = ""
    app_theme: str = "slate"
    terminal_theme: str = "matrix"
    terminal_custom_bg: str = "#000000"
    terminal_custom_bg: str = "#000000"
    terminal_custom_text: str = "#ffffff"
    activation_code: str = ""

def get_machine_id():
    try:
        if os.name == 'nt':
            output = subprocess.check_output('wmic csproduct get uuid', shell=True).decode().split('\n')[1].strip()
            return output if output else "default_machine_id"
        else:
            return "default_machine_id"
    except Exception:
        return "default_machine_id"

def get_cipher():
    machine_id = get_machine_id()
    key = hashlib.sha256(machine_id.encode()).digest()
    return Fernet(base64.urlsafe_b64encode(key))

def ensure_default_settings_file() -> str:
    if is_frozen_exe():
        ensure_app_data_dir()
        if not os.path.exists(SETTINGS_FILE):
            default_settings = AppSettings()
            save_settings(default_settings)
            log_event(f"Created default settings file at: {SETTINGS_FILE}")
    return SETTINGS_FILE


def load_settings() -> AppSettings:
    ensure_app_data_dir()
    log_event(f"Loading settings from: {SETTINGS_FILE}")
    if os.path.exists(SETTINGS_FILE):
        try:
            with open(SETTINGS_FILE, "r") as f:
                data = json.load(f)
                if data.get("activation_code"):
                    try:
                        cipher = get_cipher()
                        data["activation_code"] = cipher.decrypt(data["activation_code"].encode()).decode()
                    except Exception:
                        data["activation_code"] = ""
                log_event(f"Loaded settings with activation_code={bool(data.get('activation_code'))}")
                return AppSettings(**data)
        except Exception as e:
            log_event(f"Error loading settings: {e}")
            print(f"Error loading settings: {e}")
    ensure_default_settings_file()
    log_event("No settings file found; returning defaults")
    return AppSettings()


def save_settings(settings: AppSettings):
    ensure_app_data_dir()
    data = settings.model_dump()
    if data.get("activation_code"):
        try:
            cipher = get_cipher()
            data["activation_code"] = cipher.encrypt(data["activation_code"].encode()).decode()
        except Exception:
            pass
    os.makedirs(os.path.dirname(SETTINGS_FILE), exist_ok=True)
    with open(SETTINGS_FILE, "w") as f:
        json.dump(data, f, indent=4)
    log_event(f"Saved settings to: {SETTINGS_FILE}")


def update_settings(new_settings: dict) -> AppSettings:
    ensure_app_data_dir()
    settings = load_settings()
    for k, v in new_settings.items():
        if hasattr(settings, k):
            setattr(settings, k, v)
    with open(SETTINGS_FILE, "w") as f:
        f.write(settings.model_dump_json())
    log_event(f"Updated settings payload: {list(new_settings.keys())}")
    return settings
