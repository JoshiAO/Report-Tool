from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os
import json
import asyncio
import urllib.request
import urllib.error
from typing import Dict, List
from config import load_settings, save_settings, AppSettings, update_settings
from etl_processor import ETLJob
from datetime import datetime

app = FastAPI(title="Report Tool Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory storage for websocket connection and category mapping coordination
active_connections: List[WebSocket] = []
category_events: Dict[str, asyncio.Event] = {}
pending_categories: Dict[str, List[dict]] = {}
resolved_categories: Dict[str, List[dict]] = {}

file_events: Dict[str, asyncio.Event] = {}
resolved_files: Dict[str, str] = {}

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    active_connections.append(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            # keepalive or basic messages
    except WebSocketDisconnect:
        active_connections.remove(websocket)

async def broadcast_progress(message: str):
    for connection in active_connections:
        try:
            await connection.send_json({"type": "progress", "message": message})
        except:
            pass
    # Force the event loop to flush the websocket buffer before returning to CPU-bound tasks
    await asyncio.sleep(0.05)

async def request_categories_from_ui(missing_list: List[dict], existing_categories: List[str]) -> List[dict]:
    # Send a request to the UI
    job_id = "job_1"
    event = asyncio.Event()
    category_events[job_id] = event
    pending_categories[job_id] = missing_list
    
    for connection in active_connections:
        try:
            await connection.send_json({
                "type": "category_request",
                "job_id": job_id,
                "missing": missing_list,
                "existing": existing_categories
            })
        except:
            pass
            
    # Wait until resolved
    await event.wait()
    res = resolved_categories.get(job_id, [])
    
    # Cleanup
    if job_id in category_events: del category_events[job_id]
    if job_id in pending_categories: del pending_categories[job_id]
    if job_id in resolved_categories: del resolved_categories[job_id]
    
    return res

class CategoryResolution(BaseModel):
    job_id: str
    mappings: List[dict]

@app.post("/api/resolve_categories")
async def resolve_categories(resolution: CategoryResolution):
    if resolution.job_id in category_events:
        resolved_categories[resolution.job_id] = resolution.mappings
        category_events[resolution.job_id].set()
        return {"status": "ok"}
    raise HTTPException(status_code=404, detail="Job not found or already resolved")

async def request_missing_file_from_ui(filename: str, expected_path: str) -> str:
    job_id = f"file_{filename}"
    event = asyncio.Event()
    file_events[job_id] = event
    
    for connection in active_connections:
        try:
            await connection.send_json({
                "type": "file_request",
                "job_id": job_id,
                "filename": filename,
                "expected_path": expected_path
            })
        except:
            pass
            
    await event.wait()
    res = resolved_files.get(job_id, "")
    
    if job_id in file_events: del file_events[job_id]
    if job_id in resolved_files: del resolved_files[job_id]
    
    return res

class FileResolution(BaseModel):
    job_id: str
    resolved_path: str

@app.post("/api/resolve_file")
async def resolve_file(resolution: FileResolution):
    if resolution.job_id in file_events:
        resolved_files[resolution.job_id] = resolution.resolved_path
        file_events[resolution.job_id].set()
        return {"status": "ok"}
    raise HTTPException(status_code=404, detail="Job not found or already resolved")

@app.get("/api/settings", response_model=AppSettings)
async def get_settings():
    return load_settings()

@app.post("/api/settings")
async def set_settings(settings: dict):
    return update_settings(settings)

class ETLRequest(BaseModel):
    report_date: str
    base_import_dir: str = ""
    base_export_dir: str = ""
    dummy_code: str = "Y"

FIREBASE_FUNCTION_URL = "https://getcoremapping-pj6nqcygta-uc.a.run.app"

def verify_activation(activation_code: str):
    if not activation_code:
        raise HTTPException(status_code=403, detail="Activation code is missing.")
    
    data = json.dumps({"activationCode": activation_code}).encode('utf-8')
    req = urllib.request.Request(FIREBASE_FUNCTION_URL, data=data, headers={'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(req) as response:
            res_data = json.loads(response.read().decode('utf-8'))
            return res_data.get('mapping')
    except urllib.error.HTTPError as e:
        if e.code == 403:
            raise HTTPException(status_code=403, detail="Invalid or disabled activation code.")
        raise HTTPException(status_code=500, detail=f"Activation server error: {e.reason}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to connect to activation server: {str(e)}")

class ActivateRequest(BaseModel):
    activation_code: str

@app.post("/api/activate")
async def activate_software(req: ActivateRequest):
    # Verify it works
    mapping = verify_activation(req.activation_code)
    if mapping:
        # Save to settings
        settings = load_settings()
        settings.activation_code = req.activation_code
        save_settings(settings)
        return {"status": "success", "message": "Software activated successfully!"}
    raise HTTPException(status_code=500, detail="Failed to retrieve mapping.")

@app.post("/api/run_etl")
async def run_etl(request: ETLRequest):
    settings = load_settings()
    try:
        dt = datetime.strptime(request.report_date, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format, use YYYY-MM-DD")
        
    # Verify activation before running ETL
    try:
        net_inv_mapping = verify_activation(settings.activation_code)
    except HTTPException as e:
        return {"status": "error", "message": f"Activation Error: {e.detail}"}

    job = ETLJob(
        report_date=dt,
        settings=settings,
        base_import_dir=request.base_import_dir,
        base_export_dir=request.base_export_dir,
        dummy_code=request.dummy_code,
        send_progress=broadcast_progress,
        request_categories=request_categories_from_ui,
        request_missing_file=request_missing_file_from_ui,
        net_inv_mapping=net_inv_mapping
    )
    
    # Run in background to avoid blocking the request thread
    asyncio.create_task(job.run())
    return {"status": "started"}

@app.get("/api/browse")
async def browse_path(path: str = ""):
    try:
        if not path:
            path = os.path.expanduser("~")
        
        path = os.path.abspath(path)
        
        if os.path.isfile(path):
            path = os.path.dirname(path)
            
        items = []
        for p in os.listdir(path):
            full_path = os.path.join(path, p)
            items.append({
                "name": p,
                "path": full_path,
                "is_dir": os.path.isdir(full_path)
            })
        items.sort(key=lambda x: (not x["is_dir"], x["name"].lower()))
        return {"current_path": path, "parent_path": os.path.dirname(path), "items": items}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

import sys
import threading
import webbrowser
import time

# Serve static files (React frontend)
if hasattr(sys, '_MEIPASS'):
    # PyInstaller execution
    frontend_path = os.path.join(sys._MEIPASS, "frontend_dist")
else:
    # Normal execution
    frontend_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend", "dist")

if os.path.exists(frontend_path):
    app.mount("/", StaticFiles(directory=frontend_path, html=True), name="static")

def open_browser():
    time.sleep(1.5)
    webbrowser.open("http://localhost:8000")

if __name__ == "__main__":
    threading.Thread(target=open_browser, daemon=True).start()
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
