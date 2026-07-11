import json
import os
import subprocess
import base64
import hashlib
from cryptography.fernet import Fernet
from pydantic import BaseModel
from typing import Optional

SETTINGS_FILE = "settings.json"

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

def load_settings() -> AppSettings:
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
                return AppSettings(**data)
        except Exception as e:
            print(f"Error loading settings: {e}")
    return AppSettings()

def save_settings(settings: AppSettings):
    data = settings.model_dump()
    if data.get("activation_code"):
        try:
            cipher = get_cipher()
            data["activation_code"] = cipher.encrypt(data["activation_code"].encode()).decode()
        except Exception:
            pass
    with open(SETTINGS_FILE, "w") as f:
        json.dump(data, f, indent=4)

def update_settings(new_settings: dict) -> AppSettings:
    settings = load_settings()
    for k, v in new_settings.items():
        if hasattr(settings, k):
            setattr(settings, k, v)
    with open(SETTINGS_FILE, "w") as f:
        f.write(settings.model_dump_json())
    return settings
