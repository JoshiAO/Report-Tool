import json
import os
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
    terminal_custom_text: str = "#ffffff"

def load_settings() -> AppSettings:
    if os.path.exists(SETTINGS_FILE):
        try:
            with open(SETTINGS_FILE, "r") as f:
                data = json.load(f)
                return AppSettings(**data)
        except Exception as e:
            print(f"Error loading settings: {e}")
    return AppSettings()

def save_settings(settings: AppSettings):
    with open(SETTINGS_FILE, "w") as f:
        json.write(settings.model_dump_json(), f)

def update_settings(new_settings: dict) -> AppSettings:
    settings = load_settings()
    for k, v in new_settings.items():
        if hasattr(settings, k):
            setattr(settings, k, v)
    with open(SETTINGS_FILE, "w") as f:
        f.write(settings.model_dump_json())
    return settings
