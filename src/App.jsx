import React, { useState, useCallback, useEffect, Component } from 'react'
import { useSettings } from './hooks/useSettings.js'
import TFScannerTab from './components/TFScannerTab.jsx'
import SettingsTab from './components/SettingsTab.jsx'
import { onAuthChanged, checkConfigured } from './firebase.js'

const VERSION = 'v2.0'

export const TF_TABS = [
  { id: '1m',  label: '1m',  color: '#ff6b6b', glow: 'rgba(255,107,107,0.3)'  },
  { id: '3m',  label: '3m',  color: '#ffa94d', glow: 'rgba(255,169,77,0.3)'   },
  { id: '5m',  label: '5m',  color: '#ffd43b', glow: 'rgba(255,212,59,0.3)'   },
  { id: '15m', label: '15m', color: '#69db7c', glow: 'rgba(105,219,124,0.3)'  },
  { id: '1h',  label: '1h',  color: '#4dabf7', glow: 'rgba(77,171,247,0.3)'   },
  { id: '4h',  label: '4h',  color: '#9775fa', glow: 'rgba(151,117,250,0.3)'  },
  { id: '1d',  label: 'Day', color: '#f783ac', glow: 'rgba(247,131,172,0.3)'  },
  { id: 'settings', label: 'settings', color: '#00b8d9', glow: 'rgba(0,184,217,0.3)', isSettings: true },
]

class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null } }
  static getDerivedStateFromError(error) { return { error } }
  componentDidCatch(error, info) { console.error('[ErrBnd]', error, info) }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding:'24px 20px',margin:'16px',borderRadius:12,
          background:'rgba(255,71,87,0.08)',border:'1.5px solid rgba(255,71,87,0.4)',fontFamily:'var(--mono)' }}>
          <div style={{ fontSize:18,marginBottom:8 }}>⚠️ Error</div>
          <div style={{ fontSize:12,color:'var(--red)',marginBottom:12,wordBreak:'break-word' }}>{this.state.error.message}</div>
          <button onClick={()=>this.setState({error:null})} style={{ padding:'7px 18px',borderRadius:6,cursor:'pointer',
            border:'1px solid var(--red)',background:'var(--red-dim)',color:'var(--red)',fontSize:12,fontWeight:700 }}>↺ Retry</button>
        </div>
      )
    }
    return this.props.children
  }
}

function LogoMark({ size=32 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <rect width="32" height="32" rx="8" fill="#060c14"/>
      <rect x="1" y="1" width="30" height="30" rx="7.5" stroke="#00e676" strokeOpacity="0.18" strokeWidth="1"/>
      {/* Signal waveform: flat → spike → flat */}
      <polyline
        points="3,20 8,20 10,12 12,24 14,16 16,8 18,22 20,18 22,14 24,20 29,20"
        stroke="#00e676"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {/* Highlight dot at the peak */}
      <circle cx="16" cy="8" r="2" fill="#00e676" opacity="0.9"/>
    </svg>
  )
}

function UserMenu({ user, onLogout, onGoToSettings }) {
  const [open, setOpen] = React.useState(false)
  const ref = React.useRef(null)

  React.useEffect(() => {
    if (!open) return
    function handler(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    document.addEventListener('touchstart', handler)
    return () => { document.removeEventListener('mousedown', handler); document.removeEventListener('touchstart', handler) }
  }, [open])

  const initial = (user.displayName || user.email || '?')[0].toUpperCase()

  return (
    <div ref={ref} style={{ position:'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        title={user.displayName || user.email}
        style={{
          width:34, height:34, borderRadius:'50%',
          border: open ? '2px solid var(--green)' : '2px solid var(--green2)',
          background: user.photoURL ? 'transparent' : 'var(--green-dim)',
          padding:0, overflow:'hidden', cursor:'pointer',
          display:'flex', alignItems:'center', justifyContent:'center',
          boxShadow: open ? '0 0 0 3px var(--green-glow)' : 'none',
          transition:'box-shadow .15s, border-color .15s',
          flexShrink:0,
        }}
      >
        {user.photoURL
          ? <img src={user.photoURL} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
          : <span style={{ fontWeight:800, fontSize:14, color:'var(--green)', fontFamily:'var(--font)' }}>{initial}</span>
        }
      </button>

      {open && (
        <div style={{
          position:'absolute', top:'calc(100% + 8px)', right:0,
          background:'var(--bg2)', border:'1px solid var(--border2)',
          borderRadius:10, padding:6, minWidth:200,
          boxShadow:'0 8px 32px rgba(0,0,0,.6)', zIndex:200,
        }}>
          {/* User info row */}
          <div style={{ padding:'8px 10px 10px', borderBottom:'1px solid var(--border)' }}>
            <div style={{ fontWeight:700, fontSize:13, color:'var(--text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
              {user.displayName || 'User'}
            </div>
            <div style={{ fontFamily:'var(--mono)', fontSize:10, color:'var(--text3)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', marginTop:2 }}>
              {user.email}
            </div>
          </div>

          {/* Account settings link */}
          <button
            onClick={() => { setOpen(false); onGoToSettings() }}
            style={{
              display:'flex', alignItems:'center', gap:9, width:'100%',
              padding:'9px 10px', borderRadius:7, marginTop:4,
              fontSize:13, fontWeight:500, color:'var(--text2)',
              background:'transparent', transition:'background .1s',
            }}
            onMouseEnter={e => e.currentTarget.style.background='var(--bg3)'}
            onMouseLeave={e => e.currentTarget.style.background='transparent'}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
            </svg>
            Account &amp; Sync
          </button>

          {/* Sign out */}
          <button
            onClick={() => { setOpen(false); onLogout() }}
            style={{
              display:'flex', alignItems:'center', gap:9, width:'100%',
              padding:'9px 10px', borderRadius:7, marginTop:2,
              fontSize:13, fontWeight:500, color:'var(--red)',
              background:'transparent', transition:'background .1s',
            }}
            onMouseEnter={e => e.currentTarget.style.background='var(--red-dim)'}
            onMouseLeave={e => e.currentTarget.style.background='transparent'}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            Sign Out
          </button>
        </div>
      )}
    </div>
  )
}

export default function App() {
  const [activeTab,   setActiveTab]   = useState('15m')
  const [user,        setUser]        = useState(null)
  const [authReady,   setAuthReady]   = useState(false)
  const [alertCounts, setAlertCounts] = useState({})

  const { settings, update, reset, cloudSynced, cloudSaving, saveNow, isFirstVisit } = useSettings(user)

  useEffect(() => {
    if (!checkConfigured()) { setAuthReady(true); return }
    let unsub
    onAuthChanged(u => { setUser(u); setAuthReady(true) }).then(fn => { unsub = fn })
    return () => unsub?.()
  }, [])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', settings.darkMode === false ? 'light' : 'dark')
  }, [settings.darkMode])

  function set(path, value) {
    const parts = path.split('.')
    if (parts.length === 1) { update({ [path]: value }); return }
    update(prev => {
      function setIn(obj, keys, val) {
        const [h, ...t] = keys
        if (!t.length) return { ...obj, [h]: val }
        return { ...obj, [h]: setIn(obj[h] || {}, t, val) }
      }
      return setIn(prev, parts, value)
    })
  }

  const handleAlertCount = useCallback((tf, count) => {
    setAlertCounts(prev => ({ ...prev, [tf]: count }))
  }, [])

  const activeTabCfg = TF_TABS.find(t => t.id === activeTab)

  async function handleLogout() {
    const { logout } = await import('./firebase.js')
    await logout()
    setUser(null)
  }

  return (
    <div className="app-shell-v2">
      <header className="topbar-v2">
        {/* Logo acts as Home button → goes to 15m tab */}
        <button onClick={() => setActiveTab('15m')} title="Home · go to 15m"
          style={{ display:'flex',alignItems:'center',gap:8,background:'none',border:'none',
            cursor:'pointer',padding:'3px 6px 3px 0',borderRadius:8,flexShrink:0,
            opacity:1,transition:'opacity .15s' }}
          onMouseEnter={e=>e.currentTarget.style.opacity='.7'}
          onMouseLeave={e=>e.currentTarget.style.opacity='1'}>
          <LogoMark size={27} />
          <div style={{ textAlign:'left' }}>
            <div style={{ fontWeight:800,fontSize:14,color:'var(--text)',letterSpacing:'-.02em',lineHeight:1.15 }}>Signal Engine</div>
            <div style={{ fontFamily:'var(--mono)',fontSize:8,color:'var(--text3)',letterSpacing:'.08em' }}>BINANCE · {VERSION}</div>
          </div>
        </button>

        <div style={{ display:'flex',alignItems:'center',gap:6,marginLeft:'auto' }}>
          {/* Active TF indicator pill */}
          {activeTab !== 'settings' && activeTabCfg && (
            <div style={{ display:'flex',alignItems:'center',gap:4,padding:'3px 9px',borderRadius:20,
              background:`${activeTabCfg.color}14`,border:`1px solid ${activeTabCfg.color}44` }}>
              <div style={{ width:5,height:5,borderRadius:'50%',background:activeTabCfg.color,
                boxShadow:`0 0 6px ${activeTabCfg.color}`,animation:'pulse 2s infinite' }}/>
              <span style={{ fontFamily:'var(--mono)',fontSize:10,fontWeight:700,color:activeTabCfg.color }}>{activeTab}</span>
            </div>
          )}
          {/* Cloud sync badge */}
          {user && (
            <span style={{ fontSize:10,fontFamily:'var(--mono)',fontWeight:700,padding:'3px 7px',borderRadius:10,
              color: cloudSaving?'var(--amber)':cloudSynced?'var(--green)':'var(--text3)',
              background: cloudSaving?'rgba(255,167,38,.12)':cloudSynced?'var(--green-dim)':'rgba(255,255,255,0.05)',
              border:`1px solid ${cloudSaving?'var(--amber)':cloudSynced?'var(--green2)':'var(--border)'}` }}>
              {cloudSaving?'⟳':cloudSynced?'☁✓':'☁'}
            </span>
          )}
          {/* User icon — ALWAYS visible. Shows login icon when logged out */}
          {user ? (
            <UserMenu user={user} onLogout={handleLogout} onGoToSettings={() => setActiveTab('settings')} />
          ) : (
            <button
              onClick={() => setActiveTab('settings')}
              title="Sign in"
              style={{
                width:32, height:32, borderRadius:'50%', flexShrink:0,
                border:'1.5px solid var(--border2)', background:'var(--bg2)',
                display:'flex', alignItems:'center', justifyContent:'center',
                cursor:'pointer', transition:'border-color .15s, background .15s',
              }}
              onMouseEnter={e=>{e.currentTarget.style.borderColor='var(--accent)';e.currentTarget.style.background='var(--accent-dim)'}}
              onMouseLeave={e=>{e.currentTarget.style.borderColor='var(--border2)';e.currentTarget.style.background='var(--bg2)'}}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--text3)" strokeWidth="2" strokeLinecap="round">
                <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
              </svg>
            </button>
          )}
        </div>
      </header>

      <main className="content-scroll-v2">
        {TF_TABS.filter(t => !t.isSettings).map(tab => (
          <div key={tab.id} style={{ display: activeTab===tab.id?'block':'none', height:'100%' }}>
            <ErrorBoundary>
              <TFScannerTab
                timeframe={tab.id}
                tabColor={tab.color}
                settings={settings}
                update={update}
                user={user}
                isFirstVisit={isFirstVisit && tab.id==='15m'}
                isActive={activeTab===tab.id}
                onAlertCount={handleAlertCount}
              />
            </ErrorBoundary>
          </div>
        ))}
        {activeTab === 'settings' && (
          <ErrorBoundary>
            <SettingsTab settings={settings} set={set} update={update} reset={reset}
              user={user} onUserChange={setUser} cloudSynced={cloudSynced}
              cloudSaving={cloudSaving} onSaveNow={saveNow} />
          </ErrorBoundary>
        )}
      </main>

      <nav className="bottom-nav-v2">
        {TF_TABS.map(tab => {
          const isActive = activeTab === tab.id
          const count = !tab.isSettings ? (alertCounts[tab.id] || 0) : 0
          return (
            <button key={tab.id} className={`bottom-tab${tab.isSettings?' bottom-tab-settings':''}`} onClick={() => setActiveTab(tab.id)}
              style={{ color: isActive?tab.color:'var(--text3)',
                background: isActive?`${tab.color}10`:'transparent',
                borderTop: isActive?`2px solid ${tab.color}`:'2px solid transparent' }}>
              {tab.isSettings ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                  style={{transition:'transform .3s',transform:isActive?'rotate(45deg)':'rotate(0deg)'}}>
                  <circle cx="12" cy="12" r="3"/>
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                </svg>
              ) : (
                <span className="bottom-tab-label">{tab.label}</span>
              )}
              {count > 0 && (
                <span className="bottom-tab-badge" style={{ background:tab.color,color:'#000' }}>
                  {count > 99 ? '99+' : count}
                </span>
              )}
            </button>
          )
        })}
      </nav>
    </div>
  )
}
