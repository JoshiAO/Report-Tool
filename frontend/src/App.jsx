import React, { useState, useEffect, useRef } from 'react';
import { FolderOpen, Settings, Play, Terminal, Database, Save, FileSpreadsheet, X, CheckCircle, Palette } from 'lucide-react';

const APP_ORIGIN = typeof window !== 'undefined' ? `${window.location.protocol}//${window.location.hostname}:${window.location.port}` : 'http://localhost:8392';
const API_BASE = `${APP_ORIGIN}/api`;
const WS_URL = `ws://${window.location.hostname}:${window.location.port}/ws`;

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [settings, setSettings] = useState(null);
  const [settingsError, setSettingsError] = useState('');
  const [runtimeMode, setRuntimeMode] = useState({ is_exe: false, require_activation: false });
  const [logs, setLogs] = useState([]);
  const [processing, setProcessing] = useState(false);
  const [reportDate, setReportDate] = useState(new Date().toISOString().split('T')[0]);
  const [procedures, setProcedures] = useState({
    net_invoiced: true,
    sales_orders: true,
    served_invoice: true,
    special_sellout: true,
    special_sellout_mode: 'general',
    pricelist_m0: true,
    pricelist_m3: true,
    cml: true,
  });
  const [specialCondition, setSpecialCondition] = useState('');
  const [conditionSaved, setConditionSaved] = useState(false);
  
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
    const loadSettings = async () => {
      try {
        const modeRes = await fetch(`${API_BASE}/runtime_mode`);
        const modeData = modeRes.ok ? await modeRes.json() : { is_exe: false, require_activation: false };
        setRuntimeMode(modeData);

        const res = await fetch(`${API_BASE}/settings`);
        if (!res.ok) {
          throw new Error('Settings request failed');
        }
        const data = await res.json();

        const requireActivation = Boolean(modeData?.require_activation);

        if (requireActivation && data?.activation_code) {
          const verifyRes = await fetch(`${API_BASE}/verify_activation`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ activation_code: data.activation_code })
          });
          const verifyData = await verifyRes.json();

          if (!verifyRes.ok || verifyData?.valid === false) {
            const cleared = { ...data, activation_code: '' };
            setSettings(cleared);
            setSettingsError('Saved activation expired or is invalid. Please activate again.');

            try {
              await fetch(`${API_BASE}/settings`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(cleared)
              });
            } catch (persistError) {
              console.warn('Failed to clear stale activation code from settings:', persistError);
            }
            return;
          }
        }

        setSettings(data);
        setSpecialCondition(data?.special_sellout_condition || '');
        setSettingsError('');
      } catch (error) {
        setSettings({
          activation_code: '',
          app_theme: 'slate',
          terminal_theme: 'custom',
          terminal_custom_bg: '#000000',
          terminal_custom_text: '#ffffff'
        });
        setSettingsError(runtimeMode.require_activation ? 'Unable to reach backend yet. Activation is required.' : '');
      }
    };

    loadSettings();
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

  const allProceduresChecked =
    procedures.net_invoiced &&
    procedures.sales_orders &&
    procedures.served_invoice &&
    procedures.special_sellout &&
    procedures.pricelist_m0 &&
    procedures.pricelist_m3 &&
    procedures.cml;

  const anyProcedureChecked =
    procedures.net_invoiced ||
    procedures.sales_orders ||
    procedures.served_invoice ||
    procedures.special_sellout ||
    procedures.pricelist_m0 ||
    procedures.pricelist_m3 ||
    procedures.cml;

  const toggleAllProcedures = () => {
    const nextVal = !allProceduresChecked;
    setProcedures(prev => ({
      ...prev,
      net_invoiced: nextVal,
      sales_orders: nextVal,
      served_invoice: nextVal,
      special_sellout: nextVal,
      pricelist_m0: nextVal,
      pricelist_m3: nextVal,
      cml: nextVal,
    }));
  };

  const saveSpecialConditionToSettings = async () => {
    const updated = { ...(settings || {}), special_sellout_condition: specialCondition };
    setSettings(updated);
    try {
      await fetch(`${API_BASE}/settings`, {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify(updated)
      });
      setConditionSaved(true);
      setTimeout(() => setConditionSaved(false), 2000);
    } catch (e) {
      console.error('Failed to save special condition:', e);
    }
  };

  const saveSettings = async () => {
    const payload = { ...settings, special_sellout_condition: specialCondition };
    setSettings(payload);
    await fetch(`${API_BASE}/settings`, {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify(payload)
    });
    alert('Settings saved!');
  };

  const startETL = async () => {
    if (!anyProcedureChecked) {
      setLogs([`[${new Date().toLocaleTimeString()}] Please select at least one procedure before launching.`]);
      return;
    }
    setLogs([]);
    setProcessing(true);
    const req = {
      report_date: reportDate,
      dummy_code: procedures.special_sellout_mode === 'specials' ? "Y" : "N",
      base_import_dir: settings?.default_import_folder || "",
      base_export_dir: settings?.default_export_folder || "",
      procedures: {
        ...procedures,
        special_sellout_condition: specialCondition
      }
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
      setLogs(l => [...l, `[Error] Backend is not responding. Close any duplicate Report Tool window and try again.`]);
      setProcessing(false);
    }
  };

  const handleActivate = async () => {
    const normalizedCode = activationInput.trim();
    if (!normalizedCode) {
      setActivationError('Please enter your activation code.');
      return;
    }

    setActivating(true);
    setActivationError('');
    try {
      const res = await fetch(`${API_BASE}/activate`, {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ activation_code: normalizedCode })
      });
      const data = await res.json();
      if(res.ok) {
        setActivationInput(normalizedCode);
        setSettings({...settings, activation_code: normalizedCode});
        setSettingsError('');
      } else {
        setActivationError(data.detail || 'Activation failed');
        setSettingsError(data.detail || 'Activation failed');
      }
    } catch(e) {
      setActivationError('Server error: backend is not responding or the activation service is unavailable.');
    }
    setActivating(false);
  };

  const requiresActivation = Boolean(runtimeMode?.require_activation);
  const needsActivation = requiresActivation && (!settings || !settings.activation_code || String(settings.activation_code).trim() === '');
  const activationStatus = settingsError
    ? 'Needs activation'
    : settings?.activation_code
      ? 'Verified'
      : 'Fresh install';

  if (needsActivation) {
    return (
      <div className="app-container" style={{display: 'flex', justifyContent: 'center', alignItems: 'center'}}>
        <div className="glass-panel" style={{maxWidth: '400px', width: '100%', textAlign: 'center'}}>
           <div style={{display: 'flex', justifyContent: 'center', marginBottom: '1rem'}}>
             <span style={{padding: '0.45rem 0.85rem', borderRadius: '999px', background: settingsError ? 'rgba(245, 158, 11, 0.12)' : 'rgba(239, 68, 68, 0.12)', border: settingsError ? '1px solid rgba(245, 158, 11, 0.4)' : '1px solid rgba(239, 68, 68, 0.35)', color: settingsError ? '#fbbf24' : '#f87171', fontSize: '0.78rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase'}}>
               Activation status: {activationStatus}
             </span>
           </div>
           <h2 style={{display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem'}}>
             <Settings size={24}/> Activation Required
           </h2>
           <p style={{color: 'var(--text-muted)'}}>Please enter your activation code to unlock this software.</p>
           {settingsError && <p style={{color: '#fbbf24', marginBottom: '1rem'}}>{settingsError}</p>}
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

        <div style={{margin: '0 0.75rem 0.75rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(148, 163, 184, 0.2)'}}>
          <span style={{display: 'inline-flex', width: '100%', justifyContent: 'center', padding: '0.45rem 0.75rem', borderRadius: '999px', background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.35)', color: '#4ade80', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase'}}>
            Activation status: Verified
          </span>
        </div>
        
        <div className="sidebar-footer">
          &copy; 2026 Joshua Alforque Ocampo
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="main-content">
      {activeTab === 'dashboard' && (
        <div className="dashboard-grid">
          <div className="glass-panel" style={{height:'100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', marginBottom: 0}}>
            <h2 className="panel-title" style={{marginBottom: '0.5rem'}}><Database size={24}/> ETL Pipeline Engine</h2>
            <p style={{color:'var(--text-muted)', marginBottom:'1rem', fontSize:'0.85rem', lineHeight: 1.4}}>
              Initialize the ETL sequence. Ensure references are configured before running.
            </p>
            
            <div style={{background: 'rgba(0,0,0,0.2)', padding: '1rem 1.25rem', borderRadius: '12px', marginBottom: '1rem', border: '1px solid var(--glass-border)'}}>
              <h4 style={{marginBottom:'0.65rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--accent)'}}>
                Target Date
              </h4>
              <div className="form-group" style={{marginBottom: 0}}>
                <label style={{fontSize: '0.82rem'}}>Report Execution Date</label>
                <input type="date" value={reportDate} onChange={e => setReportDate(e.target.value)} style={{width: '100%', padding: '0.45rem 0.75rem', fontSize: '0.95rem'}} />
              </div>
            </div>

            <div className="procedures-container">
              <div className="procedures-header">
                <h4>Procedures</h4>
                <button
                  type="button"
                  className="btn-toggle-all"
                  onClick={toggleAllProcedures}
                >
                  {allProceduresChecked ? 'Uncheck All' : 'Check All'}
                </button>
              </div>

              <div className="procedures-list">
                {/* 1. Net Invoiced */}
                <label className="proc-item">
                  <input
                    type="checkbox"
                    checked={procedures.net_invoiced}
                    onChange={e => setProcedures(p => ({ ...p, net_invoiced: e.target.checked }))}
                  />
                  <span>1. Net Invoiced</span>
                </label>

                {/* 2. Sales Orders */}
                <label className="proc-item">
                  <input
                    type="checkbox"
                    checked={procedures.sales_orders}
                    onChange={e => setProcedures(p => ({ ...p, sales_orders: e.target.checked }))}
                  />
                  <span>2. Sales Orders</span>
                </label>

                {/* 3. Served Invoice */}
                <label className="proc-item">
                  <input
                    type="checkbox"
                    checked={procedures.served_invoice}
                    onChange={e => setProcedures(p => ({ ...p, served_invoice: e.target.checked }))}
                  />
                  <span>3. Served Invoice</span>
                </label>

                {/* 4. Special Sellout (NET DMS Sellout) */}
                <div className="proc-group">
                  <label className="proc-item">
                    <input
                      type="checkbox"
                      checked={procedures.special_sellout}
                      onChange={e => setProcedures(p => ({ ...p, special_sellout: e.target.checked }))}
                    />
                    <span>4. Special Sellout (NET DMS Sellout)</span>
                  </label>
                  <div className={`proc-sublist ${!procedures.special_sellout ? 'disabled' : ''}`}>
                    <label className="proc-subitem">
                      <input
                        type="radio"
                        name="special_sellout_mode"
                        checked={procedures.special_sellout_mode === 'general'}
                        onChange={() => setProcedures(p => ({ ...p, special_sellout: true, special_sellout_mode: 'general' }))}
                      />
                      <span>a. General (Default)</span>
                    </label>
                    <label className="proc-subitem">
                      <input
                        type="radio"
                        name="special_sellout_mode"
                        checked={procedures.special_sellout_mode === 'specials'}
                        onChange={() => setProcedures(p => ({ ...p, special_sellout: true, special_sellout_mode: 'specials' }))}
                      />
                      <span>b. Specials</span>
                    </label>
                    {procedures.special_sellout && procedures.special_sellout_mode === 'specials' && (
                      <div className="special-cond-box">
                        <input
                          type="text"
                          placeholder="Condition (e.g. KNE)"
                          value={specialCondition}
                          onChange={e => setSpecialCondition(e.target.value)}
                        />
                        <button
                          type="button"
                          className="btn-save-cond"
                          onClick={saveSpecialConditionToSettings}
                          title="Save special condition to settings"
                        >
                          {conditionSaved ? 'Saved!' : 'Save'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* 5. Pricelist */}
                <div className="proc-group">
                  <label className="proc-item">
                    <input
                      type="checkbox"
                      checked={procedures.pricelist_m0 && procedures.pricelist_m3}
                      ref={el => {
                        if (el) {
                          el.indeterminate =
                            (procedures.pricelist_m0 || procedures.pricelist_m3) &&
                            !(procedures.pricelist_m0 && procedures.pricelist_m3);
                        }
                      }}
                      onChange={e => {
                        const checked = e.target.checked;
                        setProcedures(p => ({ ...p, pricelist_m0: checked, pricelist_m3: checked }));
                      }}
                    />
                    <span>5. Pricelist</span>
                  </label>
                  <div className="proc-sublist">
                    <label className="proc-subitem">
                      <input
                        type="checkbox"
                        checked={procedures.pricelist_m0}
                        onChange={e => setProcedures(p => ({ ...p, pricelist_m0: e.target.checked }))}
                      />
                      <span>a. M0</span>
                    </label>
                    <label className="proc-subitem">
                      <input
                        type="checkbox"
                        checked={procedures.pricelist_m3}
                        onChange={e => setProcedures(p => ({ ...p, pricelist_m3: e.target.checked }))}
                      />
                      <span>b. M3</span>
                    </label>
                  </div>
                </div>

                {/* 6. Customer Master List (CML) */}
                <label className="proc-item">
                  <input
                    type="checkbox"
                    checked={procedures.cml}
                    onChange={e => setProcedures(p => ({ ...p, cml: e.target.checked }))}
                  />
                  <span>6. Customer Master List (CML)</span>
                </label>
              </div>
            </div>
            
            <div style={{marginTop: 'auto', paddingTop: '0.5rem'}}>
              <button className="btn btn-success" onClick={startETL} disabled={processing || !anyProcedureChecked} style={{width:'100%', padding: '0.75rem', fontSize: '1rem', fontWeight: 600, display: 'flex', justifyContent: 'center', gap: '0.5rem', alignItems: 'center'}}>
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
