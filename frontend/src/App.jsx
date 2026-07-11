import React, { useState, useEffect, useRef } from 'react';
import { FolderOpen, Settings, Play, Terminal, Database, Save, FileSpreadsheet, X, CheckCircle, Palette } from 'lucide-react';

const API_BASE = 'http://localhost:8392/api';
const WS_URL = 'ws://localhost:8392/ws';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [settings, setSettings] = useState(null);
  const [logs, setLogs] = useState([]);
  const [processing, setProcessing] = useState(false);
  const [reportDate, setReportDate] = useState(new Date().toISOString().split('T')[0]);
  
  // Activation State
  const [activationInput, setActivationInput] = useState('');
  const [activationError, setActivationError] = useState('');
  const [activating, setActivating] = useState(false);
  
  // Modals
  const [browseModal, setBrowseModal] = useState(null); // { title, currentPath, onSelect }
  const [categoryModal, setCategoryModal] = useState(null); // { jobId, missing, existing }
  const [fileModal, setFileModal] = useState(null); // { jobId, filename, expectedPath }
  
  // WS
  const wsRef = useRef(null);

  useEffect(() => {
    fetch(`${API_BASE}/settings`)
      .then(r => r.json())
      .then(data => setSettings(data));
      
    connectWS();
    return () => { if(wsRef.current) wsRef.current.close(); }
  }, []);

  useEffect(() => {
    if (!settings) return;
    
    // Apply App Theme
    const root = document.documentElement;
    if (settings.app_theme === 'midnight') {
      root.style.setProperty('--bg-gradient', 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)');
      root.style.setProperty('--accent', '#8b5cf6');
      root.style.setProperty('--accent-hover', '#7c3aed');
      root.style.setProperty('--accent-glow', 'rgba(139, 92, 246, 0.5)');
    } else if (settings.app_theme === 'ocean') {
      root.style.setProperty('--bg-gradient', 'linear-gradient(135deg, #083344 0%, #0c4a6e 100%)');
      root.style.setProperty('--accent', '#0ea5e9');
      root.style.setProperty('--accent-hover', '#0284c7');
      root.style.setProperty('--accent-glow', 'rgba(14, 165, 233, 0.5)');
    } else if (settings.app_theme === 'cherry') {
      root.style.setProperty('--bg-gradient', 'linear-gradient(135deg, #4c0519 0%, #881337 100%)');
      root.style.setProperty('--accent', '#f43f5e');
      root.style.setProperty('--accent-hover', '#e11d48');
      root.style.setProperty('--accent-glow', 'rgba(244, 63, 94, 0.5)');
    } else {
      // Default Slate
      root.style.setProperty('--bg-gradient', 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)');
      root.style.setProperty('--accent', '#3b82f6');
      root.style.setProperty('--accent-hover', '#2563eb');
      root.style.setProperty('--accent-glow', 'rgba(59, 130, 246, 0.5)');
    }

    // Apply Terminal Theme
    if (settings.terminal_theme === 'cyberpunk') {
      root.style.setProperty('--term-bg', '#0f0f1a');
      root.style.setProperty('--term-text', '#f0f');
    } else if (settings.terminal_theme === 'ubuntu') {
      root.style.setProperty('--term-bg', '#300a24');
      root.style.setProperty('--term-text', '#ffffff');
    } else if (settings.terminal_theme === 'hacker') {
      root.style.setProperty('--term-bg', '#000000');
      root.style.setProperty('--term-text', '#ffb000');
    } else if (settings.terminal_theme === 'custom') {
      root.style.setProperty('--term-bg', settings.terminal_custom_bg || '#000000');
      root.style.setProperty('--term-text', settings.terminal_custom_text || '#ffffff');
    } else {
      // Default Matrix
      root.style.setProperty('--term-bg', '#000000');
      root.style.setProperty('--term-text', '#10b981');
    }

  }, [settings?.app_theme, settings?.terminal_theme, settings?.terminal_custom_bg, settings?.terminal_custom_text]);

  useEffect(() => {
    const box = document.getElementById('terminal-box');
    if (box) {
      setTimeout(() => {
        box.scrollTop = box.scrollHeight;
      }, 10);
    }
  }, [logs]);

  const connectWS = () => {
    const ws = new WebSocket(WS_URL);
    ws.onmessage = (e) => {
      const data = JSON.parse(e.data);
      if (data.type === 'progress') {
        setLogs(l => [...l, `[${new Date().toLocaleTimeString()}] ${data.message}`]);
        if (data.message.includes('ETL successfully processed!') || data.message.includes('Error:')) {
          setProcessing(false);
        }
      } else if (data.type === 'category_request') {
        setCategoryModal(data);
      } else if (data.type === 'file_request') {
        setFileModal(data);
      }
    };
    ws.onclose = () => setTimeout(connectWS, 2000);
    wsRef.current = ws;
  };

  const handleBrowse = async (path = '') => {
    try {
      const res = await fetch(`${API_BASE}/browse?path=${encodeURIComponent(path)}`);
      if (!res.ok) {
        throw new Error("Failed to fetch directory");
      }
      return await res.json();
    } catch(e) {
      console.error(e);
      return { current_path: path, parent_path: path, items: [] };
    }
  };

  const openBrowser = async (title, fieldName) => {
    const data = await handleBrowse(settings[fieldName] || '');
    setBrowseModal({ title, fieldName, data });
  };

  const saveSettings = async () => {
    await fetch(`${API_BASE}/settings`, {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify(settings)
    });
    alert('Settings saved!');
  };

  const startETL = async () => {
    setLogs([]);
    setProcessing(true);
    const req = {
      report_date: reportDate,
      dummy_code: "Y",
      base_import_dir: settings?.default_import_folder || "",
      base_export_dir: settings?.default_export_folder || ""
    };
    
    try {
      const res = await fetch(`${API_BASE}/run_etl`, {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify(req)
      });
      if(!res.ok) {
        const error = await res.json();
        const errorMsg = typeof error.detail === 'object' ? JSON.stringify(error.detail) : error.detail;
        setLogs(l => [...l, `[Error] ${errorMsg}`]);
        setProcessing(false);
      } else {
        const result = await res.json();
        if (result.status === "error") {
            setLogs(l => [...l, `[Error] ${result.message}`]);
            setProcessing(false);
        }
      }
    } catch(e) {
      setLogs(l => [...l, `[Error] Failed to connect to server.`]);
      setProcessing(false);
    }
  };

  const handleActivate = async () => {
    setActivating(true);
    setActivationError('');
    try {
      const res = await fetch(`${API_BASE}/activate`, {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ activation_code: activationInput })
      });
      const data = await res.json();
      if(res.ok) {
        setSettings({...settings, activation_code: activationInput});
      } else {
        setActivationError(data.detail || 'Activation failed');
      }
    } catch(e) {
      setActivationError('Server error');
    }
    setActivating(false);
  };

  if (settings && !settings.activation_code) {
    return (
      <div className="app-container" style={{display: 'flex', justifyContent: 'center', alignItems: 'center'}}>
        <div className="glass-panel" style={{maxWidth: '400px', width: '100%', textAlign: 'center'}}>
           <h2 style={{display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem'}}>
             <Settings size={24}/> Activation Required
           </h2>
           <p style={{color: 'var(--text-muted)'}}>Please enter your activation code to unlock this software.</p>
           <input type="text" value={activationInput} onChange={e => setActivationInput(e.target.value)} style={{width: '100%', padding: '0.75rem', marginBottom: '1rem', marginTop: '1rem'}} placeholder="Enter code here..."/>
           {activationError && <p style={{color: '#f43f5e', marginBottom: '1rem'}}>{activationError}</p>}
           <button className="btn btn-success" onClick={handleActivate} disabled={activating} style={{width: '100%', padding: '0.75rem'}}>
             {activating ? 'Verifying with Server...' : 'Activate Software'}
           </button>
           <a href="https://eikofisherman.web.app/contact" target="_blank" rel="noopener noreferrer" style={{color: 'var(--text-muted)', textDecoration: 'none'}}>
             <p style={{fontSize: '0.85rem', marginTop: '1.5rem', cursor: 'pointer'}} onMouseOver={(e) => e.currentTarget.style.color = 'var(--brand-primary)'} onMouseOut={(e) => e.currentTarget.style.color = 'var(--text-muted)'}>
               Need an activation code? Contact the developer.
             </p>
           </a>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      {/* Sidebar Navigation */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <h1>Report Tool</h1>
          <p>Dynamic Data Processing</p>
        </div>
        
        <nav className="sidebar-nav">
          <button className={`nav-item ${activeTab==='dashboard'?'active':''}`} onClick={() => setActiveTab('dashboard')}>
            <Play size={18}/> Dashboard
          </button>
          <button className={`nav-item ${activeTab==='settings'?'active':''}`} onClick={() => setActiveTab('settings')}>
            <Settings size={18}/> Configuration
          </button>
          <button className={`nav-item ${activeTab==='appearance'?'active':''}`} onClick={() => setActiveTab('appearance')}>
            <Palette size={18}/> Appearance
          </button>
        </nav>
        
        <div className="sidebar-footer">
          &copy; 2026 Joshua Alforque Ocampo
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="main-content">
      {activeTab === 'dashboard' && (
        <div className="dashboard-grid">
          <div className="glass-panel" style={{height:'100%', display: 'flex', flexDirection: 'column'}}>
            <h2 className="panel-title"><Database size={24}/> ETL Pipeline Engine</h2>
            <p style={{color:'var(--text-muted)', marginBottom:'2rem', fontSize:'0.9rem', lineHeight: 1.5}}>
              Initialize the ETL sequence. Ensure references are configured before running.
            </p>
            
            <div style={{background: 'rgba(0,0,0,0.2)', padding: '1.5rem', borderRadius: '12px', marginBottom: '2rem', border: '1px solid var(--glass-border)'}}>
              <h4 style={{marginBottom:'1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--accent)'}}>
                Target Date
              </h4>
              <div className="form-group" style={{marginBottom: 0}}>
                <label>Report Execution Date</label>
                <input type="date" value={reportDate} onChange={e => setReportDate(e.target.value)} style={{width: '100%', padding: '0.5rem', fontSize: '1rem'}} />
              </div>
            </div>
            
            <div style={{marginTop: 'auto'}}>
              <button className="btn btn-success" onClick={startETL} disabled={processing} style={{width:'100%', padding: '0.75rem', fontSize: '1rem', fontWeight: 600, display: 'flex', justifyContent: 'center', gap: '0.5rem', alignItems: 'center'}}>
                {processing ? (
                  <><span className="pulse"></span> Executing Pipeline...</>
                ) : (
                  <><Play size={18}/> Launch Processing Engine</>
                )}
              </button>
              {processing && (
                <p style={{textAlign: 'center', marginTop: '1rem', color: 'var(--text-muted)', fontSize: '0.85rem'}}>
                  Do not close the application while the pipeline is active.
                </p>
              )}
            </div>
          </div>

          <div className="terminal-box" id="terminal-box">
            {logs.length === 0 && <span style={{color:'#6b7280'}}>Awaiting start...</span>}
            {logs.map((log, i) => <div key={i} className="terminal-line">{log}</div>)}
          </div>
        </div>
      )}

      {activeTab === 'settings' && settings && (
        <div style={{display: 'flex', flexDirection: 'column', gap: '2rem'}}>
          
          <div className="glass-panel">
            <h2 className="panel-title" style={{marginBottom: '0.5rem'}}><FolderOpen size={24}/> Directories & Locations</h2>
            <p style={{color:'var(--text-muted)', marginBottom:'1.5rem'}}>Base folders for reading and exporting data.</p>
            
            <div className="grid-2">
              <div className="form-group">
                <label>Default Import Folder (COB Data/Date)</label>
                <div className="input-container">
                  <input type="text" value={settings.default_import_folder} onChange={(e) => setSettings({...settings, default_import_folder: e.target.value})} />
                  <button className="btn btn-secondary btn-icon" onClick={() => openBrowser('Select Import Folder', 'default_import_folder')}><FolderOpen size={18}/></button>
                </div>
              </div>
              <div className="form-group">
                <label>Default Export Folder</label>
                <div className="input-container">
                  <input type="text" value={settings.default_export_folder} onChange={(e) => setSettings({...settings, default_export_folder: e.target.value})} />
                  <button className="btn btn-secondary btn-icon" onClick={() => openBrowser('Select Export Folder', 'default_export_folder')}><FolderOpen size={18}/></button>
                </div>
              </div>
            </div>
          </div>

          <div className="glass-panel">
            <h2 className="panel-title" style={{marginBottom: '0.5rem'}}><Database size={24}/> Reference Datasets</h2>
            <p style={{color:'var(--text-muted)', marginBottom:'1.5rem'}}>Paths to static Excel reference files used in mapping.</p>
            
            <div className="grid-2">
              <div className="form-group">
                <label>Category Reference (.xlsx)</label>
                <div className="input-container">
                  <input type="text" value={settings.reference_path_category} onChange={(e) => setSettings({...settings, reference_path_category: e.target.value})} />
                  <button className="btn btn-secondary btn-icon" onClick={() => openBrowser('Select Category File', 'reference_path_category')}><FileSpreadsheet size={18}/></button>
                </div>
              </div>
              <div className="form-group">
                <label>Field Supervisors Reference</label>
                <div className="input-container">
                  <input type="text" value={settings.reference_path_fs} onChange={(e) => setSettings({...settings, reference_path_fs: e.target.value})} />
                  <button className="btn btn-secondary btn-icon" onClick={() => openBrowser('Select FS File', 'reference_path_fs')}><FileSpreadsheet size={18}/></button>
                </div>
              </div>
              <div className="form-group">
                <label>Week Reference</label>
                <div className="input-container">
                  <input type="text" value={settings.reference_path_week} onChange={(e) => setSettings({...settings, reference_path_week: e.target.value})} />
                  <button className="btn btn-secondary btn-icon" onClick={() => openBrowser('Select Week File', 'reference_path_week')}><FileSpreadsheet size={18}/></button>
                </div>
              </div>
              <div className="form-group">
                <label>CDAM Reference</label>
                <div className="input-container">
                  <input type="text" value={settings.reference_path_cdam} onChange={(e) => setSettings({...settings, reference_path_cdam: e.target.value})} />
                  <button className="btn btn-secondary btn-icon" onClick={() => openBrowser('Select CDAM File', 'reference_path_cdam')}><FileSpreadsheet size={18}/></button>
                </div>
              </div>
              <div className="form-group">
                <label>GT Channel Reference</label>
                <div className="input-container">
                  <input type="text" value={settings.reference_path_gt_channel || ''} onChange={(e) => setSettings({...settings, reference_path_gt_channel: e.target.value})} />
                  <button className="btn btn-secondary btn-icon" onClick={() => openBrowser('Select GT Channel File', 'reference_path_gt_channel')}><FileSpreadsheet size={18}/></button>
                </div>
              </div>
              <div className="form-group">
                <label>New Customer Reference</label>
                <div className="input-container">
                  <input type="text" value={settings.reference_path_new_customer || ''} onChange={(e) => setSettings({...settings, reference_path_new_customer: e.target.value})} />
                  <button className="btn btn-secondary btn-icon" onClick={() => openBrowser('Select New Customer File', 'reference_path_new_customer')}><FileSpreadsheet size={18}/></button>
                </div>
              </div>
              <div className="form-group">
                <label>Wrong C.I. Reference (.xlsx)</label>
                <div className="input-container">
                  <input type="text" value={settings.reference_path_wrong_ci || ''} onChange={(e) => setSettings({...settings, reference_path_wrong_ci: e.target.value})} />
                  <button className="btn btn-secondary btn-icon" onClick={() => openBrowser('Select Wrong C.I. File', 'reference_path_wrong_ci')}><FileSpreadsheet size={18}/></button>
                </div>
              </div>
              <div className="form-group">
                <label>Freegoods Reference (.xlsx)</label>
                <div className="input-container">
                  <input type="text" value={settings.reference_path_freegoods || ''} onChange={(e) => setSettings({...settings, reference_path_freegoods: e.target.value})} />
                  <button className="btn btn-secondary btn-icon" onClick={() => openBrowser('Select Freegoods File', 'reference_path_freegoods')}><FileSpreadsheet size={18}/></button>
                </div>
              </div>
            </div>
          </div>

          <div className="glass-panel">
            <h2 className="panel-title" style={{marginBottom: '0.5rem'}}><FileSpreadsheet size={24}/> Export Naming Conventions</h2>
            <p style={{color:'var(--text-muted)', marginBottom:'1.5rem'}}>Customize the names of the final generated reports.</p>
            
            <div className="grid-2">
              <div className="form-group">
                <label>Export Prefix</label>
                <div className="input-container">
                  <input type="text" value={settings.export_prefix !== undefined ? settings.export_prefix : "KENEA"} onChange={(e) => setSettings({...settings, export_prefix: e.target.value})} />
                </div>
              </div>
              <div className="form-group">
                <label>Net Invoiced Name</label>
                <div className="input-container">
                  <input type="text" value={settings.export_name_net_invoiced !== undefined ? settings.export_name_net_invoiced : "Net Invoiced"} onChange={(e) => setSettings({...settings, export_name_net_invoiced: e.target.value})} />
                </div>
              </div>
              <div className="form-group">
                <label>Sales Order Name</label>
                <div className="input-container">
                  <input type="text" value={settings.export_name_sales_order !== undefined ? settings.export_name_sales_order : "Sales Order"} onChange={(e) => setSettings({...settings, export_name_sales_order: e.target.value})} />
                </div>
              </div>
              <div className="form-group">
                <label>Served Invoice Name</label>
                <div className="input-container">
                  <input type="text" value={settings.export_name_served_invoice !== undefined ? settings.export_name_served_invoice : "Served Invoice"} onChange={(e) => setSettings({...settings, export_name_served_invoice: e.target.value})} />
                </div>
              </div>
              <div className="form-group">
                <label>CML Name</label>
                <div className="input-container">
                  <input type="text" value={settings.export_name_cml !== undefined ? settings.export_name_cml : "CML"} onChange={(e) => setSettings({...settings, export_name_cml: e.target.value})} />
                </div>
              </div>
            </div>

            <div style={{marginTop:'2rem', display: 'flex', gap: '1rem', borderTop: '1px solid var(--glass-border)', paddingTop: '1.5rem'}}>
              <button className="btn btn-primary" onClick={saveSettings}><Save size={18}/> Save Settings</button>
              <button className="btn btn-secondary" onClick={() => {
                setSettings({
                  ...settings,
                  export_prefix: "KENEA",
                  export_name_net_invoiced: "Net Invoiced",
                  export_name_sales_order: "Sales Order",
                  export_name_served_invoice: "Served Invoice",
                  export_name_cml: "CML"
                });
              }}>Restore Default Names</button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'appearance' && settings && (
        <div className="glass-panel">
          <h2 className="panel-title"><Palette size={24}/> Theme & Appearance</h2>
          <p style={{color:'var(--text-muted)', marginBottom:'1.5rem'}}>
            Customize the global colors and terminal aesthetic.
          </p>

          <div style={{marginBottom: '2rem'}}>
            <h4 style={{marginBottom:'1rem'}}>App Theme</h4>
            <div className="theme-grid">
              <div className={`theme-card ${settings.app_theme === 'slate' ? 'active' : ''}`} onClick={() => setSettings({...settings, app_theme: 'slate'})}>
                <div style={{display:'flex', alignItems:'center', gap:'0.75rem'}}>
                  <div className="theme-preview-circle" style={{background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)'}}></div>
                  <strong>Slate</strong>
                </div>
                <span style={{fontSize:'0.8rem', color:'var(--text-muted)'}}>Default blue aesthetics</span>
              </div>
              <div className={`theme-card ${settings.app_theme === 'midnight' ? 'active' : ''}`} onClick={() => setSettings({...settings, app_theme: 'midnight'})}>
                <div style={{display:'flex', alignItems:'center', gap:'0.75rem'}}>
                  <div className="theme-preview-circle" style={{background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)'}}></div>
                  <strong>Midnight Purp</strong>
                </div>
                <span style={{fontSize:'0.8rem', color:'var(--text-muted)'}}>Deep indigo and violet</span>
              </div>
              <div className={`theme-card ${settings.app_theme === 'ocean' ? 'active' : ''}`} onClick={() => setSettings({...settings, app_theme: 'ocean'})}>
                <div style={{display:'flex', alignItems:'center', gap:'0.75rem'}}>
                  <div className="theme-preview-circle" style={{background: 'linear-gradient(135deg, #083344 0%, #0c4a6e 100%)'}}></div>
                  <strong>Ocean Blue</strong>
                </div>
                <span style={{fontSize:'0.8rem', color:'var(--text-muted)'}}>Vibrant teal accents</span>
              </div>
              <div className={`theme-card ${settings.app_theme === 'cherry' ? 'active' : ''}`} onClick={() => setSettings({...settings, app_theme: 'cherry'})}>
                <div style={{display:'flex', alignItems:'center', gap:'0.75rem'}}>
                  <div className="theme-preview-circle" style={{background: 'linear-gradient(135deg, #4c0519 0%, #881337 100%)'}}></div>
                  <strong>Dark Cherry</strong>
                </div>
                <span style={{fontSize:'0.8rem', color:'var(--text-muted)'}}>Rich crimson tones</span>
              </div>
            </div>
          </div>

          <div style={{marginBottom: '2rem'}}>
            <h4 style={{marginBottom:'1rem'}}>Terminal Theme</h4>
            <div className="theme-grid">
              <div className={`theme-card ${settings.terminal_theme === 'matrix' ? 'active' : ''}`} onClick={() => setSettings({...settings, terminal_theme: 'matrix'})}>
                <strong>Matrix</strong>
                <div className="term-preview" style={{background: '#000', color: '#10b981'}}>
                  &gt;_ Executing...
                </div>
              </div>
              <div className={`theme-card ${settings.terminal_theme === 'cyberpunk' ? 'active' : ''}`} onClick={() => setSettings({...settings, terminal_theme: 'cyberpunk'})}>
                <strong>Cyberpunk</strong>
                <div className="term-preview" style={{background: '#0f0f1a', color: '#f0f'}}>
                  &gt;_ SYS_OVERRIDE
                </div>
              </div>
              <div className={`theme-card ${settings.terminal_theme === 'ubuntu' ? 'active' : ''}`} onClick={() => setSettings({...settings, terminal_theme: 'ubuntu'})}>
                <strong>Ubuntu</strong>
                <div className="term-preview" style={{background: '#300a24', color: '#fff'}}>
                  joshua@report:~$
                </div>
              </div>
              <div className={`theme-card ${settings.terminal_theme === 'hacker' ? 'active' : ''}`} onClick={() => setSettings({...settings, terminal_theme: 'hacker'})}>
                <strong>Hacker</strong>
                <div className="term-preview" style={{background: '#000', color: '#ffb000'}}>
                  [OK] Access Granted
                </div>
              </div>
              <div className={`theme-card ${settings.terminal_theme === 'custom' ? 'active' : ''}`} onClick={() => setSettings({...settings, terminal_theme: 'custom'})}>
                <strong>Custom Colors</strong>
                <div className="term-preview" style={{background: settings.terminal_custom_bg || '#000', color: settings.terminal_custom_text || '#fff'}}>
                  &gt;_ Custom Paint
                </div>
              </div>
            </div>
            
            {settings.terminal_theme === 'custom' && (
              <div className="grid-2" style={{marginTop: '1.5rem'}}>
                <div className="color-picker-wrapper">
                  <input type="color" value={settings.terminal_custom_bg || '#000000'} onChange={(e) => setSettings({...settings, terminal_custom_bg: e.target.value})} />
                  <label style={{margin: 0, fontWeight: 500}}>Background Color</label>
                </div>
                <div className="color-picker-wrapper">
                  <input type="color" value={settings.terminal_custom_text || '#ffffff'} onChange={(e) => setSettings({...settings, terminal_custom_text: e.target.value})} />
                  <label style={{margin: 0, fontWeight: 500}}>Text Color</label>
                </div>
              </div>
            )}
          </div>

          <div style={{marginTop:'2rem'}}>
            <button className="btn btn-primary" onClick={saveSettings}><Save size={18}/> Save Theme</button>
          </div>
        </div>
      )}

      {/* File Browser Modal */}
      {browseModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div style={{display:'flex', justifyContent:'space-between', marginBottom:'1rem'}}>
              <h3>{browseModal.title}</h3>
              <button className="btn btn-secondary btn-icon" onClick={()=>setBrowseModal(null)}><X size={18}/></button>
            </div>
            <div style={{marginBottom:'1rem', display:'flex', gap:'0.5rem'}}>
              <button className="btn btn-secondary" onClick={async () => {
                const data = await handleBrowse(browseModal.data.parent_path);
                setBrowseModal(m => ({...m, data}));
              }}>Up</button>
              <input type="text" value={browseModal.data.current_path} 
                onChange={(e) => setBrowseModal(m => ({...m, data: {...m.data, current_path: e.target.value}}))}
                onKeyDown={async (e) => {
                  if (e.key === 'Enter') {
                    const data = await handleBrowse(browseModal.data.current_path);
                    setBrowseModal(m => ({...m, data}));
                  }
                }}
                style={{flex:1}}
              />
              <button className="btn" onClick={async () => {
                const data = await handleBrowse(browseModal.data.current_path);
                setBrowseModal(m => ({...m, data}));
              }}>Go</button>
              <button className="btn btn-success" onClick={() => {
                setSettings(s => ({...s, [browseModal.fieldName]: browseModal.data.current_path}));
                setBrowseModal(null);
              }}><CheckCircle size={18}/> Select Current</button>
            </div>
            <div style={{maxHeight:'300px', overflowY:'auto', background:'rgba(0,0,0,0.2)', padding:'0.5rem', borderRadius:'8px'}}>
              {browseModal.data?.items?.map(item => (
                <div key={item.name}  
                     style={{padding:'0.5rem', cursor:'pointer', display:'flex', gap:'0.5rem', borderBottom:'1px solid var(--glass-border)'}}
                     onClick={async () => {
                       if(item.is_dir) {
                         const data = await handleBrowse(item.path);
                         setBrowseModal(m => ({...m, data}));
                       } else {
                         setSettings(s => ({...s, [browseModal.fieldName]: item.path}));
                         setBrowseModal(null);
                       }
                     }}>
                  {item.is_dir ? <FolderOpen size={18} color="var(--accent)"/> : <FileSpreadsheet size={18} color="var(--text-muted)"/>}
                  {item.name}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Category Mapper Modal */}
      {categoryModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3><Database size={20}/> Missing Categories Found</h3>
            <p style={{color:'var(--text-muted)'}}>Please map the following new SKUs to an existing category.</p>
            
            <table className="data-table">
              <thead>
                <tr>
                  <th>SKU Code</th>
                  <th>SKU Name</th>
                  <th>Category</th>
                </tr>
              </thead>
              <tbody>
                {categoryModal.missing.map((item, idx) => (
                  <tr key={idx}>
                    <td>{item['SKU CODE']}</td>
                    <td>{item['SKU NAME']}</td>
                    <td>
                      <select onChange={(e) => {
                        const newMissing = [...categoryModal.missing];
                        newMissing[idx]['CATEGORY'] = e.target.value;
                        setCategoryModal({...categoryModal, missing: newMissing});
                      }}>
                        <option value="">Select Category...</option>
                        {categoryModal.existing.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            
            <div style={{marginTop:'1.5rem', textAlign:'right'}}>
              <button className="btn btn-success" onClick={async () => {
                await fetch(`${API_BASE}/resolve_categories`, {
                  method: 'POST',
                  headers: {'Content-Type':'application/json'},
                  body: JSON.stringify({
                    job_id: categoryModal.job_id,
                    mappings: categoryModal.missing
                  })
                });
                setCategoryModal(null);
              }}><CheckCircle size={18}/> Resume Processing</button>
            </div>
          </div>
        </div>
      )}

      {/* Missing File Modal */}
      {fileModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3><FolderOpen size={20}/> Missing File Detected</h3>
            <p style={{color:'var(--text-muted)'}}>
              The file <strong>{fileModal.filename}</strong> was not found at:<br/>
              <code>{fileModal.expected_path}</code>
            </p>
            <div style={{marginTop:'1.5rem'}}>
              <button className="btn btn-secondary" onClick={() => {
                openBrowser('Select Missing File', 'temp_missing_file').then(() => {
                  // We'll hijack the browseModal onSelect later, but for now let's just let them browse
                  // Wait, openBrowser sets browseModal which is globally handled.
                  // The easiest way is to let them pick it, which saves to settings, then we read it.
                  // Actually, let's just add an input and let them use the browser to fill it.
                });
              }}>Browse...</button>
              
              <div style={{marginTop: '1rem'}}>
                <input type="text" id="missingFileInput" placeholder="Paste the exact file path here" style={{width: '100%', marginBottom: '1rem'}} />
                <button className="btn btn-success" onClick={async () => {
                  const inputVal = document.getElementById('missingFileInput').value;
                  if (!inputVal) return alert('Please enter a path');
                  
                  await fetch(`${API_BASE}/resolve_file`, {
                    method: 'POST',
                    headers: {'Content-Type':'application/json'},
                    body: JSON.stringify({
                      job_id: fileModal.job_id,
                      resolved_path: inputVal
                    })
                  });
                  setFileModal(null);
                }}><CheckCircle size={18}/> Submit & Resume</button>
              </div>
            </div>
          </div>
        </div>
      )}
      </main>
    </div>
  );
}
