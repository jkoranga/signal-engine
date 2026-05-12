import { useState, useCallback, useEffect, Component } from 'react'
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
  { id: 'settings', label: '⚙', color: 'var(--text2)', glow: 'transparent', isSettings: true },
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

function LogoMark({ size=26 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <rect width="28" height="28" rx="7" fill="#060a12"/>
      <rect x="5" y="9" width="5" height="10" rx="1" fill="#00e676"/>
      <line x1="7.5" y1="5" x2="7.5" y2="9" stroke="#00e676" strokeWidth="1.8"/>
      <line x1="7.5" y1="19" x2="7.5" y2="23" stroke="#00e676" strokeWidth="1.8"/>
      <rect x="18" y="7" width="5" height="11" rx="1" fill="#ff4757"/>
      <line x1="20.5" y1="3" x2="20.5" y2="7" stroke="#ff4757" strokeWidth="1.8"/>
      <line x1="20.5" y1="18" x2="20.5" y2="24" stroke="#ff4757" strokeWidth="1.8"/>
    </svg>
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

  return (
    <div className="app-shell-v2">
      <header className="topbar-v2">
        <div style={{ display:'flex',alignItems:'center',gap:9 }}>
          <LogoMark />
          <div>
            <div style={{ fontWeight:800,fontSize:16,color:'var(--text)',letterSpacing:'-.02em',lineHeight:1.1 }}>EMA Sigma</div>
            <div style={{ fontFamily:'var(--mono)',fontSize:9,color:'var(--text3)',letterSpacing:'.08em' }}>BINANCE · {VERSION}</div>
          </div>
        </div>
        <div style={{ display:'flex',alignItems:'center',gap:6,marginLeft:'auto' }}>
          {activeTab !== 'settings' && activeTabCfg && (
            <div style={{ display:'flex',alignItems:'center',gap:5,padding:'3px 10px',borderRadius:20,
              background:`${activeTabCfg.color}14`,border:`1px solid ${activeTabCfg.color}44` }}>
              <div style={{ width:6,height:6,borderRadius:'50%',background:activeTabCfg.color,
                boxShadow:`0 0 6px ${activeTabCfg.color}`,animation:'pulse 2s infinite' }}/>
              <span style={{ fontFamily:'var(--mono)',fontSize:11,fontWeight:700,color:activeTabCfg.color }}>{activeTab}</span>
            </div>
          )}
          {user && (
            <span style={{ fontSize:10,fontFamily:'var(--mono)',fontWeight:700,padding:'3px 8px',borderRadius:10,
              color: cloudSaving?'var(--amber)':cloudSynced?'var(--green)':'var(--text3)',
              background: cloudSaving?'rgba(255,167,38,.12)':cloudSynced?'var(--green-dim)':'rgba(255,255,255,0.05)',
              border:`1px solid ${cloudSaving?'var(--amber)':cloudSynced?'var(--green2)':'var(--border)'}` }}>
              {cloudSaving?'⟳':cloudSynced?'☁✓':'☁'}
            </span>
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
            <button key={tab.id} className="bottom-tab" onClick={() => setActiveTab(tab.id)}
              style={{ color: isActive?tab.color:'var(--text3)',
                background: isActive?`${tab.color}10`:'transparent',
                borderTop: isActive?`2px solid ${tab.color}`:'2px solid transparent' }}>
              <span className="bottom-tab-label">{tab.label}</span>
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
