import { useState } from 'react'
import { Toggle } from './UI.jsx'
import { ALL_SCANNERS } from '../utils/scanners.js'
import { sendTelegram } from '../utils/scanner.js'
import { AppearanceSection, AlertsSection } from './sections/GeneralSections.jsx'
import { SignalStrengthSection } from './sections/FilterSections.jsx'
import CustomPairsSection from './sections/CustomPairsSection.jsx'
import AccountSection from './sections/AccountSection.jsx'

// ── Accordion ─────────────────────────────────────────────
function Accordion({ title, icon, badge, defaultOpen=false, children, accentColor }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div style={{
      border:`1.5px solid ${open&&accentColor?accentColor:'var(--border)'}`,
      borderRadius:'var(--radius)',marginBottom:10,
      background:'var(--bg1)',overflow:'hidden',transition:'border-color .2s',
    }}>
      <button onClick={()=>setOpen(o=>!o)} style={{
        width:'100%',display:'flex',alignItems:'center',gap:10,
        padding:'13px 16px',background:'none',border:'none',cursor:'pointer',
        borderBottom:open?'1px solid var(--border)':'none',
      }}>
        {icon&&<span style={{fontSize:17}}>{icon}</span>}
        <span style={{flex:1,fontWeight:700,fontSize:14,color:'var(--text)',textAlign:'left'}}>{title}</span>
        {badge&&<span style={{fontSize:9,fontFamily:'var(--mono)',fontWeight:700,padding:'2px 7px',borderRadius:8,
          letterSpacing:'.06em',background:'var(--accent-dim)',color:'var(--accent)',border:'1px solid var(--accent)'}}>{badge}</span>}
        <span style={{color:'var(--text3)',fontSize:12,display:'inline-block',transition:'transform .2s',transform:open?'rotate(180deg)':'rotate(0deg)'}}>▼</span>
      </button>
      {open&&<div style={{padding:'14px'}}>{children}</div>}
    </div>
  )
}

// ── Scanner def card ──────────────────────────────────────
function ScannerDefCard({ scanner, expanded, onTap, enabled, onToggle }) {
  const isBull = scanner.side==='bull'
  const col = isBull?'var(--green)':'var(--red)'
  const bd  = isBull?'rgba(0,200,100,0.5)':'rgba(255,60,80,0.5)'
  const bg  = isBull?'rgba(0,230,118,0.07)':'rgba(255,60,80,0.07)'
  const isAdv = scanner.group==='advanced'
  return (
    <div style={{
      borderRadius:10, border:`1.5px solid ${enabled?bd:'var(--border)'}`,
      background:enabled?bg:'var(--bg2)', opacity:enabled?1:0.55, transition:'all .18s', flexShrink:0,
    }}>
      <div style={{display:'flex',alignItems:'center',gap:10,padding:'11px 13px',cursor:'pointer',minHeight:54}} onClick={onTap}>
        <span style={{fontSize:20,flexShrink:0}}>{scanner.icon}</span>
        <div style={{flex:1,minWidth:0}}>
          <div style={{display:'flex',alignItems:'center',gap:5,marginBottom:2}}>
            <div style={{fontWeight:700,fontSize:13,color:enabled?col:'var(--text2)',letterSpacing:'-.01em'}}>{scanner.name}</div>
            {isAdv&&<span style={{fontSize:8,fontFamily:'var(--mono)',fontWeight:800,padding:'1px 5px',borderRadius:4,background:'rgba(150,100,255,0.15)',color:'#b388ff',border:'1px solid rgba(150,100,255,0.3)',flexShrink:0}}>ADV</span>}
          </div>
          <div style={{fontSize:10,color:'var(--text3)',fontFamily:'var(--mono)',lineHeight:1.4}}>{scanner.sub}</div>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:7,flexShrink:0}} onClick={e=>e.stopPropagation()}>
          <span className={`badge ${isBull?'badge-green':'badge-red'}`} style={{fontSize:9}}>{scanner.badge}</span>
          <Toggle checked={!!enabled} onChange={v=>onToggle?.(v)}/>
        </div>
        <span style={{color:'var(--text3)',fontSize:11,flexShrink:0}}>{expanded?'▲':'▼'}</span>
      </div>
      {expanded&&(
        <div style={{borderTop:`1px solid ${bd}`,background:'rgba(0,0,0,0.18)',padding:'10px 14px'}}>
          {scanner.conditions.map((cond,i)=>(
            <div key={i} style={{display:'flex',alignItems:'flex-start',gap:8,padding:'4px 0'}}>
              <span style={{color:col,fontSize:11,marginTop:2,flexShrink:0}}>◆</span>
              <span style={{fontSize:11,color:'var(--text2)',lineHeight:1.5}}>{cond}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Scan Settings section ─────────────────────────────────
function ScanSettingsSection({ settings, update }) {
  function set(key, val) { update({ [key]: val }) }

  const DEDUP_OPTIONS = [['1m','1m'],['3m','3m'],['5m','5m'],['15m','15m'],['30m','30m'],['1h','1h'],['4h','4h'],['1d','Daily']]
  const VOLUME_FILTERS = [
    {id:'all',label:'All'},
    {id:'500k',label:'>500K'},
    {id:'1m',label:'>1M'},
    {id:'5m',label:'>5M'},
    {id:'10m',label:'>10M'},
  ]

  return (
    <div>
      {/* Symbol set */}
      <div className="setting-row">
        <div className="row-label">
          <span>Symbol Set</span>
          <small>Default for all TF scanners</small>
        </div>
        <div style={{display:'flex',gap:4,flexWrap:'wrap',justifyContent:'flex-end'}}>
          {[['top30','30'],['top100','100'],['top200','200'],['top500','500'],['all','All']].map(([s,l])=>(
            <button key={s} className={`btn-small ${settings.symbolSet===s?'active':''}`}
              onClick={()=>set('symbolSet',s)}
              style={settings.symbolSet===s?{borderColor:'var(--accent)',color:'var(--accent)',background:'var(--accent-dim)'}:{}}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* Scan interval */}
      <div className="setting-row">
        <div className="row-label">
          <span>Scan Interval</span>
          <small>How often auto-scan repeats</small>
        </div>
        <div style={{display:'flex',gap:4,flexWrap:'wrap',justifyContent:'flex-end'}}>
          {['1m','5m','15m','30m','1h'].map(si=>(
            <button key={si} className={`btn-small ${settings.scanInterval===si?'active':''}`}
              onClick={()=>set('scanInterval',si)}
              style={settings.scanInterval===si?{borderColor:'var(--green2)',color:'var(--green)',background:'var(--green-dim)'}:{}}>
              {si}
            </button>
          ))}
        </div>
      </div>

      {/* Dedup */}
      <div className="setting-row">
        <div className="row-label">
          <span>Repeat Filter</span>
          <small>Hide same signal for N minutes</small>
        </div>
        <div style={{display:'flex',gap:4,flexWrap:'wrap',justifyContent:'flex-end'}}>
          {DEDUP_OPTIONS.map(([v,l])=>(
            <button key={v} className={`btn-small ${settings.dedupInterval===v?'active':''}`}
              onClick={()=>set('dedupInterval',v)}
              style={settings.dedupInterval===v?{borderColor:'var(--amber)',color:'var(--amber)',background:'rgba(255,180,0,.1)'}:{}}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* Volume default */}
      <div className="setting-row" style={{borderBottom:'none',paddingBottom:0}}>
        <div className="row-label">
          <span>Default Volume Filter</span>
          <small>Applied to all TF tabs</small>
        </div>
        <div style={{display:'flex',gap:4,flexWrap:'wrap',justifyContent:'flex-end'}}>
          {VOLUME_FILTERS.map(f=>(
            <button key={f.id} className={`btn-small ${settings.volumeFilter===f.id?'active':''}`}
              onClick={()=>set('volumeFilter',f.id)}
              style={settings.volumeFilter===f.id?{borderColor:'var(--purple)',color:'var(--purple)',background:'var(--purple-dim)'}:{}}>
              {f.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Pattern Manager ───────────────────────────────────────
function PatternManager({ settings, update }) {
  const [expanded, setExpanded] = useState({})
  const [sideFilter, setSideFilter] = useState('all')

  const scannerEnabled = (() => {
    const saved = settings.scannerEnabled || {}
    const merged = {}
    ALL_SCANNERS.forEach(s => { merged[s.id] = s.id in saved ? saved[s.id] : true })
    return merged
  })()

  function setScannerEnabled(fn) {
    const next = typeof fn==='function' ? fn(scannerEnabled) : fn
    update({ scannerEnabled: next })
  }

  const enabledCount = ALL_SCANNERS.filter(s=>scannerEnabled[s.id]).length
  const visible = ALL_SCANNERS.filter(s=>sideFilter==='all'||s.side===sideFilter)

  return (
    <div>
      <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',gap:8,marginBottom:12,flexWrap:'wrap' }}>
        <div style={{ display:'flex',gap:5,flexWrap:'wrap' }}>
          <button className="btn-small" onClick={()=>setScannerEnabled(()=>{const n={};ALL_SCANNERS.forEach(s=>n[s.id]=true);return n})}
            style={{background:'rgba(0,230,118,0.12)',borderColor:'rgba(0,192,96,0.5)',color:'var(--green)',fontWeight:700}}>✓ All On</button>
          <button className="btn-small" onClick={()=>setScannerEnabled(()=>{const n={};ALL_SCANNERS.forEach(s=>n[s.id]=false);return n})}
            style={{background:'rgba(255,70,70,0.08)',borderColor:'rgba(255,70,70,0.35)',color:'var(--red)',fontWeight:700}}>✗ All Off</button>
          <button className="btn-small"
            onClick={()=>setScannerEnabled(p=>{const n={...p};ALL_SCANNERS.forEach(s=>{if(s.side==='bull')n[s.id]=true});return n})}
            style={{background:'rgba(0,230,118,0.07)',borderColor:'rgba(0,192,96,0.35)',color:'var(--green)'}}>🟢 Bull</button>
          <button className="btn-small"
            onClick={()=>setScannerEnabled(p=>{const n={...p};ALL_SCANNERS.forEach(s=>{if(s.side==='bear')n[s.id]=true});return n})}
            style={{background:'rgba(255,70,70,0.07)',borderColor:'rgba(255,70,70,0.3)',color:'var(--red)'}}>🔴 Bear</button>
        </div>
        <div style={{ display:'flex',gap:4 }}>
          {[['all','All'],['bull','🟢'],['bear','🔴']].map(([id,lbl])=>(
            <button key={id} className="btn-small" onClick={()=>setSideFilter(id)}
              style={sideFilter===id?{borderColor:id==='bull'?'var(--green2)':id==='bear'?'var(--red2)':'var(--border2)',
                color:id==='bull'?'var(--green)':id==='bear'?'var(--red)':'var(--text)',
                background:id==='bull'?'var(--green-dim)':id==='bear'?'var(--red-dim)':'var(--bg3)',fontWeight:700}:{}}>{lbl}</button>
          ))}
        </div>
      </div>

      <div style={{ fontSize:10,fontFamily:'var(--mono)',color:'var(--text3)',marginBottom:10 }}>
        {enabledCount}/{ALL_SCANNERS.length} patterns active · applies to all TF tabs
      </div>

      <div style={{ display:'flex',flexDirection:'column',gap:7 }}>
        {visible.map(s=>(
          <ScannerDefCard key={s.id} scanner={s}
            expanded={!!expanded[s.id]} onTap={()=>setExpanded(p=>({...p,[s.id]:!p[s.id]}))}
            enabled={scannerEnabled[s.id]} onToggle={v=>setScannerEnabled(p=>({...p,[s.id]:v}))}/>
        ))}
      </div>
    </div>
  )
}

// ── Main SettingsTab ──────────────────────────────────────
export default function SettingsTab({ settings, set, update, reset, user, onUserChange, cloudSynced, cloudSaving, onSaveNow }) {
  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom:16 }}>
        <h2 style={{ fontSize:20,fontWeight:800,letterSpacing:'-.02em',marginBottom:3 }}>Settings</h2>
        <p style={{ fontSize:11,color:'var(--text3)',fontFamily:'var(--mono)' }}>
          All configuration · applies globally to all TF tabs
        </p>
      </div>

      {/* Account */}
      <Accordion title="Account & Sync" icon="👤" defaultOpen={false} accentColor="var(--accent)">
        <AccountSection user={user} onUserChange={onUserChange}
          cloudSynced={cloudSynced} cloudSaving={cloudSaving} onSaveNow={onSaveNow}/>
      </Accordion>

      {/* Scan settings */}
      <Accordion title="Scan Settings" icon="⬡" badge="GLOBAL" defaultOpen={true} accentColor="var(--accent)">
        <ScanSettingsSection settings={settings} update={update}/>
      </Accordion>

      {/* Pattern manager */}
      <Accordion title={`Patterns (${ALL_SCANNERS.length} total)`} icon="🔬" defaultOpen={false} accentColor="rgba(150,100,255,0.6)">
        <div style={{background:'rgba(150,100,255,0.07)',border:'1px solid rgba(150,100,255,0.22)',borderRadius:8,padding:'9px 12px',marginBottom:12}}>
          <div style={{fontSize:11,fontFamily:'var(--mono)',color:'#b388ff',fontWeight:700,marginBottom:3}}>⚡ EMA + RSI Patterns</div>
          <div style={{fontSize:11,color:'var(--text3)',lineHeight:1.6}}>Toggle patterns on/off. Changes apply to all TF scanners simultaneously.</div>
        </div>
        <PatternManager settings={settings} update={update}/>
      </Accordion>

      {/* Alerts */}
      <Accordion title="Alerts & Notifications" icon="◈" defaultOpen={false} accentColor="rgba(255,167,38,0.5)">
        <AlertsSection cfg={settings} set={set}/>
      </Accordion>

      {/* Appearance */}
      <Accordion title="Appearance" icon="◑" defaultOpen={false}>
        <AppearanceSection cfg={settings} set={set}/>
      </Accordion>

      {/* Signal strength */}
      <Accordion title="Signal Strength Filters" icon="◉" defaultOpen={false} accentColor="rgba(0,184,217,0.4)">
        <SignalStrengthSection cfg={settings} set={set}/>
      </Accordion>

      {/* Custom pairs */}
      <Accordion title="Custom Pairs" icon="⊞" defaultOpen={false} accentColor="rgba(179,136,255,0.4)">
        <CustomPairsSection cfg={settings} set={set}/>
      </Accordion>

      {/* Reset */}
      <div style={{ marginTop:20,padding:'14px 16px',background:'var(--bg1)',border:'1.5px solid var(--border)',borderRadius:'var(--radius)' }}>
        <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between' }}>
          <div>
            <div style={{ fontWeight:700,fontSize:14,color:'var(--text)',marginBottom:3 }}>Reset All Settings</div>
            <div style={{ fontSize:11,fontFamily:'var(--mono)',color:'var(--text3)' }}>Restore defaults across all tabs</div>
          </div>
          <button onClick={reset} style={{ padding:'8px 16px',borderRadius:8,border:'1.5px solid var(--red2)',
            background:'var(--red-dim)',color:'var(--red)',fontSize:13,fontWeight:700,cursor:'pointer' }}>
            ↺ Reset
          </button>
        </div>
      </div>

      <div style={{ height:20 }}/>
    </div>
  )
}
