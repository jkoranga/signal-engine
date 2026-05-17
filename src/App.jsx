import React, { useState, useCallback, useEffect, Component } from 'react'
import { useSettings } from './hooks/useSettings.js'
import TFScannerTab from './components/TFScannerTab.jsx'
import SettingsTab from './components/SettingsTab.jsx'
import PatternBuilderTab, { condFormula } from './components/PatternBuilder.jsx'
import { onAuthChanged, checkConfigured } from './firebase.js'
import { ALL_SCANNERS, TF_META } from './utils/scanners.js'

const VERSION = 'v2.5'

export const TF_TABS = [
  { id: '1m',  label: '1m',  color: '#ff6b6b', glow: 'rgba(255,107,107,0.3)'  },
  { id: '3m',  label: '3m',  color: '#ffa94d', glow: 'rgba(255,169,77,0.3)'   },
  { id: '5m',  label: '5m',  color: '#ffd43b', glow: 'rgba(255,212,59,0.3)'   },
  { id: '15m', label: '15m', color: '#69db7c', glow: 'rgba(105,219,124,0.3)'  },
  { id: '1h',  label: '1h',  color: '#4dabf7', glow: 'rgba(77,171,247,0.3)'   },
  { id: '4h',  label: '4h',  color: '#9775fa', glow: 'rgba(151,117,250,0.3)'  },
  { id: '1d',  label: 'Day', color: '#f783ac', glow: 'rgba(247,131,172,0.3)'  },
  { id: 'builder',  label: '🔧', color: 'var(--lime)', glow: 'var(--lime-dim)', isBuilder: true },
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

function LoginModal({ onClose, onUserChange }) {
  const [tab,     setTab]     = React.useState('signin')  // 'signin' | 'signup'
  const [email,   setEmail]   = React.useState('')
  const [pass,    setPass]    = React.useState('')
  const [name,    setName]    = React.useState('')
  const [confirm, setConfirm] = React.useState('')
  const [err,     setErr]     = React.useState('')
  const [loading, setLoading] = React.useState(false)

  React.useEffect(() => {
    const fn = e => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', fn)
    return () => document.removeEventListener('keydown', fn)
  }, [onClose])

  // Reset fields when switching tabs
  function switchTab(t) {
    setTab(t); setErr('')
    setEmail(''); setPass(''); setName(''); setConfirm('')
  }

  async function handleGoogle() {
    setErr(''); setLoading(true)
    try {
      const { loginWithGoogle, checkConfigured } = await import('./firebase.js')
      if (!checkConfigured()) { setErr('Firebase not configured. Add VITE_FB_* to .env'); return }
      const u = await loginWithGoogle()
      onUserChange(u); onClose()
    } catch(e) { setErr(e.message) }
    finally { setLoading(false) }
  }

  async function handleSignIn(e) {
    e.preventDefault(); setErr(''); setLoading(true)
    try {
      const { loginWithEmail, checkConfigured } = await import('./firebase.js')
      if (!checkConfigured()) { setErr('Firebase not configured.'); return }
      const u = await loginWithEmail(email, pass)
      onUserChange(u); onClose()
    } catch(e) { setErr(e.message) }
    finally { setLoading(false) }
  }

  async function handleSignUp(e) {
    e.preventDefault(); setErr('')
    if (!name.trim())          { setErr('Please enter your name.'); return }
    if (pass.length < 6)       { setErr('Password must be at least 6 characters.'); return }
    if (pass !== confirm)      { setErr('Passwords do not match.'); return }
    setLoading(true)
    try {
      const { signUpWithEmail, checkConfigured } = await import('./firebase.js')
      if (!checkConfigured()) { setErr('Firebase not configured.'); return }
      const u = await signUpWithEmail(email, pass, name)
      onUserChange(u); onClose()
    } catch(e) { setErr(e.message) }
    finally { setLoading(false) }
  }

  const isSignIn = tab === 'signin'
  const accent = isSignIn ? 'var(--green)' : 'var(--accent)'
  const accentDim = isSignIn ? 'var(--green-dim)' : 'var(--accent-dim)'

  const inputStyle = {
    width: '100%', boxSizing: 'border-box', padding: '9px 11px',
    borderRadius: 8, border: '1px solid var(--border2)',
    background: 'var(--bg3)', color: 'var(--text)',
    fontSize: 13, fontFamily: 'inherit', outline: 'none',
  }

  return (
    <div style={{
      position:'fixed', inset:0, zIndex:1000,
      display:'flex', alignItems:'center', justifyContent:'center',
      background:'rgba(0,0,0,0.72)', backdropFilter:'blur(5px)',
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background:'var(--bg2)', border:'1px solid var(--border2)',
        borderRadius:18, padding:'24px 22px', width:'min(360px, 94vw)',
        boxShadow:'0 16px 56px rgba(0,0,0,0.75)',
      }}>

        {/* Header */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
          <div>
            <div style={{ fontWeight:800, fontSize:17, color:'var(--text)' }}>
              {isSignIn ? 'Welcome Back' : 'Create Account'}
            </div>
            <div style={{ fontSize:11, color:'var(--text3)', fontFamily:'var(--mono)', marginTop:3 }}>
              {isSignIn ? 'Sync settings across devices' : 'Start tracking signals today'}
            </div>
          </div>
          <button onClick={onClose} style={{ width:28,height:28,borderRadius:'50%',border:'1px solid var(--border)',
            background:'var(--bg3)',color:'var(--text3)',cursor:'pointer',fontSize:16,display:'flex',
            alignItems:'center',justifyContent:'center' }}>✕</button>
        </div>

        {/* Tab switcher */}
        <div style={{
          display:'flex', borderRadius:10, overflow:'hidden',
          border:'1px solid var(--border2)', marginBottom:20,
          background:'var(--bg3)',
        }}>
          {[['signin','Sign In'],['signup','Sign Up']].map(([id, label]) => (
            <button key={id} onClick={() => switchTab(id)} style={{
              flex:1, padding:'9px', border:'none', cursor:'pointer',
              fontFamily:'var(--mono)', fontWeight:700, fontSize:12,
              background: tab === id ? (id === 'signin' ? 'var(--green-dim)' : 'var(--accent-dim)') : 'transparent',
              color: tab === id ? (id === 'signin' ? 'var(--green)' : 'var(--accent)') : 'var(--text3)',
              borderBottom: tab === id ? `2px solid ${id === 'signin' ? 'var(--green)' : 'var(--accent)'}` : '2px solid transparent',
              transition: 'all .15s',
            }}>{label}</button>
          ))}
        </div>

        {/* Google */}
        <button onClick={handleGoogle} disabled={loading} style={{
          display:'flex', alignItems:'center', justifyContent:'center', gap:9,
          width:'100%', padding:'11px', borderRadius:8,
          border:'1px solid var(--border2)', background:'var(--bg3)',
          color:'var(--text)', fontSize:13, fontWeight:600, cursor:'pointer',
          marginBottom:16, transition:'all .15s', boxSizing:'border-box',
        }}
          onMouseEnter={e=>{e.currentTarget.style.borderColor='var(--accent)';e.currentTarget.style.background='var(--accent-dim)'}}
          onMouseLeave={e=>{e.currentTarget.style.borderColor='var(--border2)';e.currentTarget.style.background='var(--bg3)'}}
        >
          <svg width="18" height="18" viewBox="0 0 48 48">
            <path fill="#4285F4" d="M44.5 20H24v8.5h11.7C34.1 33.5 29.6 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.1 8 3l6-6C34.1 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20c11 0 19.7-8 19.7-20 0-1.3-.1-2.7-.2-4z"/>
            <path fill="#34A853" d="M6.3 14.7l7 5.1C15 17.2 19.2 14 24 14c3.1 0 5.9 1.1 8 3l6-6C34.1 6.1 29.3 4 24 4c-7.6 0-14.2 4.2-17.7 10.7z"/>
            <path fill="#FBBC05" d="M24 44c5.2 0 9.8-1.7 13.4-4.7l-6.2-5.2C29.4 35.3 26.8 36 24 36c-5.6 0-10.1-3.5-11.7-8.4l-7 5.3C8 39.4 15.4 44 24 44z"/>
            <path fill="#EA4335" d="M44.5 20H24v8.5h11.7c-.9 2.5-2.5 4.6-4.7 6.1l6.2 5.2C40.8 36.3 44.5 30.6 44.5 24c0-1.3-.1-2.7-.2-4z"/>
          </svg>
          {loading ? (isSignIn ? 'Signing in…' : 'Creating…') : `Continue with Google`}
        </button>

        {/* Divider */}
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16 }}>
          <div style={{ flex:1, height:1, background:'var(--border)' }} />
          <span style={{ fontSize:11, color:'var(--text3)', fontFamily:'var(--mono)' }}>or email</span>
          <div style={{ flex:1, height:1, background:'var(--border)' }} />
        </div>

        {/* Sign In form */}
        {isSignIn && (
          <div style={{ display:'flex', flexDirection:'column', gap:9 }}>
            <input style={inputStyle} type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
            <input style={inputStyle} type="password" placeholder="Password" value={pass} onChange={e => setPass(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSignIn(e)} />
            <button onClick={handleSignIn} disabled={loading} style={{
              padding:'10px', borderRadius:8, border:`1px solid var(--green2)`,
              background:'var(--green-dim)', color:'var(--green)',
              fontSize:13, fontWeight:700, cursor:'pointer',
            }}>{loading ? 'Signing in…' : 'Sign In'}</button>
            <div style={{ textAlign:'center', fontSize:11, color:'var(--text3)', fontFamily:'var(--mono)', marginTop:2 }}>
              No account?{' '}
              <span onClick={() => switchTab('signup')} style={{ color:'var(--accent)', cursor:'pointer', fontWeight:700 }}>
                Create one →
              </span>
            </div>
          </div>
        )}

        {/* Sign Up form */}
        {!isSignIn && (
          <div style={{ display:'flex', flexDirection:'column', gap:9 }}>
            <input style={inputStyle} type="text"     placeholder="Your name"       value={name}    onChange={e => setName(e.target.value)} />
            <input style={inputStyle} type="email"    placeholder="Email"           value={email}   onChange={e => setEmail(e.target.value)} />
            <input style={inputStyle} type="password" placeholder="Password (6+ chars)"  value={pass}    onChange={e => setPass(e.target.value)} />
            <input style={inputStyle} type="password" placeholder="Confirm password" value={confirm} onChange={e => setConfirm(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSignUp(e)} />
            <button onClick={handleSignUp} disabled={loading} style={{
              padding:'10px', borderRadius:8, border:`1px solid var(--accent)`,
              background:'var(--accent-dim)', color:'var(--accent)',
              fontSize:13, fontWeight:700, cursor:'pointer',
            }}>{loading ? 'Creating account…' : 'Create Account'}</button>
            <div style={{ textAlign:'center', fontSize:11, color:'var(--text3)', fontFamily:'var(--mono)', marginTop:2 }}>
              Already have an account?{' '}
              <span onClick={() => switchTab('signin')} style={{ color:'var(--green)', cursor:'pointer', fontWeight:700 }}>
                Sign in →
              </span>
            </div>
          </div>
        )}

        {err && <div style={{ marginTop:10, fontSize:11, color:'var(--red)', fontFamily:'var(--mono)', lineHeight:1.5 }}>{err}</div>}
      </div>
    </div>
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
          border: open ? '2px solid var(--green)' : '2px solid var(--green)',
          background: user.photoURL ? 'transparent' : 'var(--green-dim)',
          padding:0, overflow:'hidden', cursor:'pointer',
          display:'flex', alignItems:'center', justifyContent:'center',
          boxShadow: open ? '0 0 0 3px var(--green-glow)' : '0 0 0 2px var(--green-glow)',
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


// ── Patterns Modal (bottom sheet) ─────────────────────────────────────────────
const PATTERN_TF_LIST = ['1m','3m','5m','15m','30m','1h','4h','1d']

function defaultTfs(s) { return s.tfs && s.tfs.length > 0 ? s.tfs : ['15m','1h'] }

function PatternsModal({ open, onClose, settings, update }) {
  const [expanded, setExpanded] = React.useState({})
  const [sideFilter, setSideFilter] = React.useState('all')

  // Enabled
  const scannerEnabled = React.useMemo(() => {
    const saved = settings.scannerEnabled || {}
    const m = {}
    ALL_SCANNERS.forEach(s => { m[s.id] = s.id in saved ? saved[s.id] : true })
    return m
  }, [settings.scannerEnabled])

  // Per-pattern TFs
  const patternTfs = React.useMemo(() => {
    const saved = settings.patternTfs || {}
    const m = {}
    ALL_SCANNERS.forEach(s => { m[s.id] = s.id in saved ? saved[s.id] : defaultTfs(s) })
    return m
  }, [settings.patternTfs])

  function setEnabled(id, val) { update({ scannerEnabled: { ...scannerEnabled, [id]: val } }) }
  function setTfs(id, tfs)     { update({ patternTfs: { ...(settings.patternTfs||{}), [id]: tfs } }) }

  const visible = ALL_SCANNERS.filter(s => sideFilter === 'all' || s.side === sideFilter)
  const enabledCount = visible.filter(s => scannerEnabled[s.id]).length

  // Trap body scroll while open
  React.useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null

  return (
    <div
      onClick={onClose}
      style={{
        position:'fixed', inset:0, zIndex:999,
        background:'rgba(0,0,0,0.6)',
        backdropFilter:'blur(3px)',
        display:'flex', flexDirection:'column', justifyContent:'flex-end',
        animation:'fadeIn .18s ease',
      }}
    >
      {/* Sheet */}
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background:'var(--bg1)',
          borderRadius:'18px 18px 0 0',
          border:'1.5px solid rgba(150,100,255,0.3)',
          borderBottom:'none',
          maxHeight:'88vh',
          display:'flex', flexDirection:'column',
          animation:'slideUp .22s cubic-bezier(.32,1.2,.5,1)',
        }}
      >
        {/* Handle + header */}
        <div style={{ padding:'12px 16px 10px', borderBottom:'1px solid var(--border)', flexShrink:0 }}>
          <div style={{ width:36,height:4,borderRadius:2,background:'var(--border2)',margin:'0 auto 12px' }}/>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <span style={{ fontSize:16 }}>🔬</span>
              <div>
                <div style={{ fontWeight:800, fontSize:15, letterSpacing:'-.01em' }}>Patterns</div>
                <div style={{ fontSize:10, fontFamily:'var(--mono)', color:'var(--text3)', marginTop:1 }}>
                  {enabledCount}/{visible.length} enabled · tap to configure TFs
                </div>
              </div>
            </div>
            <div style={{ display:'flex', gap:5, alignItems:'center' }}>
              {/* Side filter */}
              {[['all','All'],['bull','🟢'],['bear','🔴']].map(([id,lbl]) => (
                <button key={id} onClick={() => setSideFilter(id)} style={{
                  fontSize:10, fontFamily:'var(--mono)', fontWeight:700,
                  padding:'4px 8px', borderRadius:6, cursor:'pointer',
                  border:`1.5px solid ${sideFilter===id
                    ? id==='bull' ? 'var(--green2)' : id==='bear' ? 'var(--red2)' : 'rgba(150,100,255,0.6)'
                    : 'var(--border)'}`,
                  background: sideFilter===id
                    ? id==='bull' ? 'var(--green-dim)' : id==='bear' ? 'var(--red-dim)' : 'rgba(150,100,255,0.1)'
                    : 'var(--bg2)',
                  color: sideFilter===id
                    ? id==='bull' ? 'var(--green)' : id==='bear' ? 'var(--red)' : '#b388ff'
                    : 'var(--text3)',
                }}>
                  {lbl}
                </button>
              ))}
              {/* Close */}
              <button onClick={onClose} style={{
                width:30, height:30, borderRadius:8, border:'1.5px solid var(--border)',
                background:'var(--bg2)', cursor:'pointer', color:'var(--text3)',
                display:'flex', alignItems:'center', justifyContent:'center', fontSize:16,
              }}>×</button>
            </div>
          </div>
        </div>

        {/* Scrollable pattern list */}
        <div style={{ overflowY:'auto', padding:'10px 12px 24px', flex:1 }}>
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            {visible.map(s => {
              const isBull  = s.side === 'bull'
              const col     = isBull ? 'var(--green)' : 'var(--red)'
              const bd      = isBull ? 'rgba(0,200,100,0.45)' : 'rgba(255,60,80,0.45)'
              const bg      = isBull ? 'rgba(0,230,118,0.06)' : 'rgba(255,60,80,0.06)'
              const en      = scannerEnabled[s.id]
              const tfs     = patternTfs[s.id] || defaultTfs(s)
              const isExp   = !!expanded[s.id]

              return (
                <div key={s.id} style={{
                  borderRadius:10,
                  border:`1.5px solid ${en ? bd : 'var(--border)'}`,
                  background: en ? bg : 'var(--bg2)',
                  opacity: en ? 1 : 0.55,
                  transition:'all .18s',
                }}>
                  {/* Card header */}
                  <div
                    onClick={() => setExpanded(p => ({...p,[s.id]:!p[s.id]}))}
                    style={{ display:'flex', alignItems:'center', gap:9, padding:'10px 12px', cursor:'pointer' }}
                  >
                    <span style={{ fontSize:19, flexShrink:0 }}>{s.icon}</span>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontWeight:700, fontSize:13, color: en ? col : 'var(--text2)' }}>{s.name}</div>
                      {/* TF pills */}
                      <div style={{ display:'flex', flexWrap:'wrap', gap:3, marginTop:3 }}>
                        {tfs.length > 0 ? tfs.map(tf => {
                          const tfCol = en ? (TF_META[tf]?.color || col) : 'var(--text3)'
                          return (
                            <span key={tf} style={{
                              fontSize:8, fontFamily:'var(--mono)', fontWeight:700,
                              padding:'1px 5px', borderRadius:4,
                              background: en ? `${tfCol}18` : 'var(--bg3)',
                              color: en ? tfCol : 'var(--text3)',
                              border:`1px solid ${en ? tfCol+'44' : 'var(--border)'}`,
                            }}>{tf === '1d' ? 'Day' : tf}</span>
                          )
                        }) : <span style={{fontSize:8,fontFamily:'var(--mono)',color:'var(--red)',fontWeight:700}}>⚠ No TF</span>}
                      </div>
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:7, flexShrink:0 }} onClick={e=>e.stopPropagation()}>
                      {/* Toggle */}
                      <div
                        onClick={() => setEnabled(s.id, !en)}
                        style={{
                          width:36, height:20, borderRadius:10, cursor:'pointer',
                          background: en ? 'var(--green)' : 'var(--bg3)',
                          border:`1.5px solid ${en ? 'var(--green)' : 'var(--border)'}`,
                          position:'relative', transition:'all .2s', flexShrink:0,
                        }}
                      >
                        <div style={{
                          position:'absolute', top:2, left: en ? 17 : 2,
                          width:12, height:12, borderRadius:'50%',
                          background:'#fff', transition:'left .2s',
                          boxShadow:'0 1px 3px rgba(0,0,0,0.3)',
                        }}/>
                      </div>
                    </div>
                    <span style={{ color:'var(--text3)', fontSize:11, flexShrink:0 }}>{isExp ? '▲' : '▼'}</span>
                  </div>

                  {/* Expanded: TF selector + conditions */}
                  {isExp && (
                    <>
                      {/* TF chip selector */}
                      <div style={{ padding:'10px 12px 12px', borderTop:'1px solid var(--border)', background:'rgba(0,0,0,0.15)' }}>
                        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:7 }}>
                          <span style={{ fontSize:10, fontFamily:'var(--mono)', fontWeight:700, color:'var(--text3)', letterSpacing:'.05em' }}>TIMEFRAMES</span>
                          <div style={{ display:'flex', gap:4 }}>
                            <button onClick={() => setTfs(s.id, [...PATTERN_TF_LIST])} style={{
                              fontSize:9, fontFamily:'var(--mono)', fontWeight:700, padding:'2px 7px', borderRadius:4, cursor:'pointer',
                              border:'1px solid rgba(0,230,118,0.4)', background:'rgba(0,230,118,0.08)', color:'var(--green)',
                            }}>✓ All</button>
                            <button onClick={() => setTfs(s.id, [])} style={{
                              fontSize:9, fontFamily:'var(--mono)', fontWeight:700, padding:'2px 7px', borderRadius:4, cursor:'pointer',
                              border:'1px solid rgba(255,70,70,0.35)', background:'rgba(255,70,70,0.07)', color:'var(--red)',
                            }}>✗ Clear</button>
                          </div>
                        </div>
                        <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
                          {PATTERN_TF_LIST.map(tf => {
                            const checked  = tfs.includes(tf)
                            const tfMeta   = TF_META[tf] || {}
                            const chipCol  = checked ? (tfMeta.color || col) : 'var(--text3)'
                            return (
                              <button key={tf} onClick={() => {
                                const next = checked ? tfs.filter(t=>t!==tf) : [...tfs, tf]
                                setTfs(s.id, next)
                              }} style={{
                                display:'flex', alignItems:'center', gap:5,
                                fontSize:10, fontFamily:'var(--mono)', fontWeight: checked?800:500,
                                padding:'5px 9px', borderRadius:6, cursor:'pointer',
                                border:`1.5px solid ${checked ? chipCol : 'var(--border)'}`,
                                background: checked ? `${chipCol}20` : 'var(--bg2)',
                                color: checked ? chipCol : 'var(--text3)',
                                transition:'all .15s',
                                boxShadow: checked ? `0 0 7px ${chipCol}44` : 'none',
                              }}>
                                {/* Checkbox */}
                                <span style={{
                                  display:'inline-flex', alignItems:'center', justifyContent:'center',
                                  width:12, height:12, borderRadius:3, flexShrink:0,
                                  border:`1.5px solid ${checked ? chipCol : 'var(--border)'}`,
                                  background: checked ? chipCol : 'transparent', transition:'all .15s',
                                }}>
                                  {checked && <svg width="7" height="7" viewBox="0 0 8 8" fill="none">
                                    <polyline points="1,4 3.2,6.2 7,2" stroke="#000" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                  </svg>}
                                </span>
                                {tf === '1d' ? 'Day' : tf}
                              </button>
                            )
                          })}
                        </div>
                        <div style={{ fontSize:9, fontFamily:'var(--mono)', marginTop:6,
                          color: tfs.length===0 ? 'var(--red)' : 'var(--text3)', opacity: tfs.length===0 ? 1 : 0.6 }}>
                          {tfs.length === 0 ? '⚠ No TF — pattern will not scan' : `${tfs.length} of ${PATTERN_TF_LIST.length} TFs · scans only these`}
                        </div>
                      </div>
                      {/* Conditions */}
                      <div style={{ padding:'10px 12px', borderTop:`1px solid ${bd}`, background:'rgba(0,0,0,0.1)' }}>
                        <div style={{ fontSize:9, fontFamily:'var(--mono)', color:'var(--text3)', fontWeight:700, letterSpacing:'.05em', marginBottom:5 }}>CONDITIONS</div>
                        {s.conditions.map((cond,i) => (
                          <div key={i} style={{ display:'flex', alignItems:'flex-start', gap:7, padding:'3px 0' }}>
                            <span style={{ color:col, fontSize:10, marginTop:2, flexShrink:0 }}>◆</span>
                            <span style={{ fontSize:11, color:'var(--text2)', lineHeight:1.5 }}>{cond}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )
            })}
          </div>

          {/* ── My Patterns (user-built) ── */}
          {(() => {
            const custom = (settings.customPatterns || []).filter(p =>
              sideFilter === 'all' || p.side === sideFilter
            )
            if (custom.length === 0) return null

            function updateCustom(id, patch) {
              const updated = (settings.customPatterns || []).map(p =>
                p.id === id ? { ...p, ...patch } : p
              )
              update({ customPatterns: updated })
            }

            return (
              <div style={{ marginTop: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <div style={{ flex: 1, height: 1, background: 'var(--lime-dim)' }} />
                  <span style={{ fontSize: 9, fontFamily: 'var(--mono)', fontWeight: 800, letterSpacing: '.1em', color: 'var(--lime)', opacity: .8 }}>MY PATTERNS</span>
                  <div style={{ flex: 1, height: 1, background: 'var(--lime-dim)' }} />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {custom.map(p => {
                    const isBull = p.side === 'bull'
                    const col = isBull ? 'var(--green)' : 'var(--red)'
                    const bd  = isBull ? 'rgba(0,200,100,0.45)' : 'rgba(255,60,80,0.45)'
                    const bg  = isBull ? 'rgba(0,230,118,0.06)' : 'rgba(255,60,80,0.06)'
                    const en  = p.enabled !== false
                    const isExp = !!expanded['c_' + p.id]
                    const activeConds = (p.conditions || []).filter(c => c.enabled)
                    const tfs = p.tfs || []

                    return (
                      <div key={p.id} style={{
                        borderRadius: 10,
                        border: `1.5px solid ${en ? bd : 'var(--border)'}`,
                        background: en ? bg : 'var(--bg2)',
                        opacity: en ? 1 : 0.55,
                        transition: 'all .18s',
                      }}>
                        {/* Header row */}
                        <div
                          onClick={() => setExpanded(prev => ({ ...prev, ['c_' + p.id]: !prev['c_' + p.id] }))}
                          style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '10px 12px', cursor: 'pointer' }}
                        >
                          <span style={{ fontSize: 19, flexShrink: 0 }}>{p.icon || '🔧'}</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 700, fontSize: 13, color: en ? col : 'var(--text2)' }}>{p.name}</div>
                            <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginTop: 3 }}>
                              {tfs.length > 0 ? tfs.map(tf => (
                                <span key={tf} style={{
                                  fontSize: 8, fontFamily: 'var(--mono)', fontWeight: 700,
                                  padding: '1px 5px', borderRadius: 4,
                                  background: en ? `${col}18` : 'var(--bg3)',
                                  color: en ? col : 'var(--text3)',
                                  border: `1px solid ${en ? col + '44' : 'var(--border)'}`,
                                }}>{tf}</span>
                              )) : <span style={{ fontSize: 8, fontFamily: 'var(--mono)', color: 'var(--red)', fontWeight: 700 }}>⚠ No TF</span>}
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                            {/* Enable toggle */}
                            <div onClick={() => updateCustom(p.id, { enabled: !en })} style={{
                              width: 36, height: 20, borderRadius: 10, cursor: 'pointer',
                              background: en ? 'var(--green)' : 'var(--bg3)',
                              border: `1.5px solid ${en ? 'var(--green)' : 'var(--border)'}`,
                              position: 'relative', transition: 'all .2s', flexShrink: 0,
                            }}>
                              <div style={{
                                position: 'absolute', top: 2, left: en ? 17 : 2,
                                width: 12, height: 12, borderRadius: '50%',
                                background: '#fff', transition: 'left .2s',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                              }} />
                            </div>
                          </div>
                          <span style={{ color: 'var(--text3)', fontSize: 11, flexShrink: 0 }}>{isExp ? '▲' : '▼'}</span>
                        </div>

                        {/* Expanded body */}
                        {isExp && (
                          <>
                            {/* TF selector */}
                            <div style={{ padding: '10px 12px 12px', borderTop: '1px solid var(--border)', background: 'rgba(0,0,0,0.15)' }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 }}>
                                <span style={{ fontSize: 10, fontFamily: 'var(--mono)', fontWeight: 700, color: 'var(--text3)', letterSpacing: '.05em' }}>TIMEFRAMES</span>
                                <div style={{ display: 'flex', gap: 4 }}>
                                  <button onClick={() => updateCustom(p.id, { tfs: ['1m','3m','5m','15m','30m','1h','4h','1d'] })} style={{
                                    fontSize: 9, fontFamily: 'var(--mono)', fontWeight: 700, padding: '2px 7px', borderRadius: 4, cursor: 'pointer',
                                    border: '1px solid rgba(0,230,118,0.4)', background: 'rgba(0,230,118,0.08)', color: 'var(--green)',
                                  }}>✓ All</button>
                                  <button onClick={() => updateCustom(p.id, { tfs: [] })} style={{
                                    fontSize: 9, fontFamily: 'var(--mono)', fontWeight: 700, padding: '2px 7px', borderRadius: 4, cursor: 'pointer',
                                    border: '1px solid rgba(255,70,70,0.35)', background: 'rgba(255,70,70,0.07)', color: 'var(--red)',
                                  }}>✗ Clear</button>
                                </div>
                              </div>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                                {['1m','3m','5m','15m','30m','1h','4h','1d'].map(tf => {
                                  const checked = tfs.includes(tf)
                                  const tfMeta  = TF_META[tf] || {}
                                  const chipCol = checked ? (tfMeta.color || col) : 'var(--text3)'
                                  return (
                                    <button key={tf} onClick={() => {
                                      const next = checked ? tfs.filter(t => t !== tf) : [...tfs, tf]
                                      updateCustom(p.id, { tfs: next })
                                    }} style={{
                                      display: 'flex', alignItems: 'center', gap: 5,
                                      fontSize: 10, fontFamily: 'var(--mono)', fontWeight: checked ? 800 : 500,
                                      padding: '5px 9px', borderRadius: 6, cursor: 'pointer',
                                      border: `1.5px solid ${checked ? chipCol : 'var(--border)'}`,
                                      background: checked ? `${chipCol}20` : 'var(--bg2)',
                                      color: checked ? chipCol : 'var(--text3)',
                                      transition: 'all .15s',
                                      boxShadow: checked ? `0 0 7px ${chipCol}44` : 'none',
                                    }}>
                                      <span style={{
                                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                        width: 12, height: 12, borderRadius: 3, flexShrink: 0,
                                        border: `1.5px solid ${checked ? chipCol : 'var(--border)'}`,
                                        background: checked ? chipCol : 'transparent', transition: 'all .15s',
                                      }}>
                                        {checked && <svg width="7" height="7" viewBox="0 0 8 8" fill="none">
                                          <polyline points="1,4 3.2,6.2 7,2" stroke="#000" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                        </svg>}
                                      </span>
                                      {tf === '1d' ? 'Day' : tf}
                                    </button>
                                  )
                                })}
                              </div>
                              <div style={{ fontSize: 9, fontFamily: 'var(--mono)', marginTop: 6,
                                color: tfs.length === 0 ? 'var(--red)' : 'var(--text3)', opacity: tfs.length === 0 ? 1 : 0.6 }}>
                                {tfs.length === 0 ? '⚠ No TF — pattern will not scan' : `${tfs.length} TF${tfs.length > 1 ? 's' : ''} active`}
                              </div>
                            </div>

                            {/* Conditions */}
                            <div style={{ padding: '10px 12px', borderTop: `1px solid ${bd}`, background: 'rgba(0,0,0,0.1)' }}>
                              <div style={{ fontSize: 9, fontFamily: 'var(--mono)', color: 'var(--text3)', fontWeight: 700, letterSpacing: '.05em', marginBottom: 6 }}>
                                CONDITIONS · {activeConds.length} active
                              </div>
                              {activeConds.length === 0 ? (
                                <div style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--text3)', opacity: .6 }}>No active conditions</div>
                              ) : (
                                activeConds.map((cond, i) => {
                                  const isLast = i === activeConds.length - 1
                                  return (
                                    <React.Fragment key={cond.id || i}>
                                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 7, padding: '3px 0' }}>
                                        <span style={{ color: col, fontSize: 10, marginTop: 2, flexShrink: 0 }}>◆</span>
                                        <span style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--text2)', lineHeight: 1.5 }}>
                                          {condFormula(cond)}
                                        </span>
                                      </div>
                                      {!isLast && (
                                        <div style={{ paddingLeft: 17, fontSize: 9, fontFamily: 'var(--mono)', color: 'var(--text3)', marginBottom: 2 }}>
                                          {cond.joinNext || 'AND'}
                                        </div>
                                      )}
                                    </React.Fragment>
                                  )
                                })
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })()}
        </div>
      </div>
    </div>
  )
}

export default function App() {
  const [activeTab,      setActiveTab]      = useState('15m')
  const [user,           setUser]           = useState(null)
  const [authReady,      setAuthReady]      = useState(false)
  const [alertCounts,    setAlertCounts]    = useState({})
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [scanProgress,   setScanProgress]   = useState({ pct: -1, color: 'var(--green)' })
  const [settingsOpenCount, setSettingsOpenCount] = useState(0)
  const [showPatterns, setShowPatterns] = useState(false)
  const [prevTab, setPrevTab] = useState('15m')
  const [showExitWarning, setShowExitWarning] = useState(false)

  // Back button: go home first press, show exit warning second press
  const HOME_TAB = '15m'
  const activeTabRef = React.useRef(activeTab)
  const showExitRef  = React.useRef(false)
  activeTabRef.current  = activeTab
  showExitRef.current   = showExitWarning

  useEffect(() => {
    // Push an extra history entry so we can intercept popstate
    window.history.pushState({ signalEngine: true }, '')

    function handlePop() {
      // Always push state back so back button keeps working
      window.history.pushState({ signalEngine: true }, '')

      if (showExitRef.current) {
        // Overlay is open — pressing back = Cancel
        setShowExitWarning(false)
        return
      }

      const tab = activeTabRef.current
      if (tab !== HOME_TAB) {
        // Not on home — navigate to home
        setActiveTab(HOME_TAB)
        setPrevTab(tab)
      } else {
        // Already on home — show exit overlay
        setShowExitWarning(true)
      }
    }

    window.addEventListener('popstate', handlePop)
    return () => window.removeEventListener('popstate', handlePop)
  }, [])

  const { settings, update, reset, cloudSynced, cloudSaving, saveNow, saveNowWithPatch, isFirstVisit } = useSettings(user)

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

  const handleScanProgress = useCallback((pct, color) => {
    setScanProgress({ pct, color })
  }, [])

  function navigateTo(tab) {
    if (tab === 'settings') {
      if (activeTab === 'settings') {
        // toggle off — go back to previous tab
        setActiveTab(prevTab)
        return
      }
      setPrevTab(activeTab)
      setSettingsOpenCount(c => c + 1)
    }
    if (tab === 'builder') {
      if (activeTab === 'builder') {
        setActiveTab(prevTab)
        return
      }
      setPrevTab(activeTab)
    }
    setActiveTab(tab)
  }

  function togglePatterns() {
    setShowPatterns(v => !v)
  }

  const activeTabCfg = TF_TABS.find(t => t.id === activeTab)

  async function handleLogout() {
    const { logout } = await import('./firebase.js')
    await logout()
    setUser(null)
  }

  return (
    <div className="app-shell-v2">
      {showLoginModal && (
        <LoginModal onClose={() => setShowLoginModal(false)} onUserChange={u => { setUser(u); setShowLoginModal(false) }} />
      )}

      {/* Exit confirmation overlay */}
      {showExitWarning && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 3000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)',
          animation: 'fadeIn .15s ease',
        }}>
          <div style={{
            background: 'var(--bg2)', border: '1.5px solid rgba(255,200,60,0.45)',
            borderRadius: 20, padding: '28px 24px', width: 'min(300px, 88vw)',
            boxShadow: '0 20px 60px rgba(0,0,0,0.8)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
            animation: 'scaleIn .18s cubic-bezier(.34,1.56,.64,1)',
          }}>
            <div style={{ fontSize: 42, lineHeight: 1 }}>⚠️</div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--text)', marginBottom: 6 }}>Exit Signal Engine?</div>
              <div style={{ fontSize: 12, color: 'var(--text3)', fontFamily: 'var(--mono)', lineHeight: 1.5 }}>
                {scanProgress.pct >= 0 ? 'A scan is currently running.\nExiting will stop it.' : 'Are you sure you want to exit?'}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, width: '100%' }}>
              <button
                onClick={() => setShowExitWarning(false)}
                style={{
                  flex: 1, padding: '12px', borderRadius: 10, cursor: 'pointer',
                  border: '1.5px solid var(--border2)', background: 'var(--bg3)',
                  color: 'var(--text2)', fontSize: 14, fontWeight: 700, fontFamily: 'var(--mono)',
                }}
              >Cancel</button>
              <button
                onClick={() => {
                  setShowExitWarning(false)
                  // Try all exit methods for PWA / Capacitor / WebView / browser
                  try { window.history.go(-(window.history.length)) } catch(_) {}
                  try { if (window.navigator?.app?.exitApp) { window.navigator.app.exitApp(); return } } catch(_) {}
                  try { if (window.Capacitor?.Plugins?.App) { window.Capacitor.Plugins.App.exitApp(); return } } catch(_) {}
                  try { window.close() } catch(_) {}
                  // Fallback: blank the page so it looks closed
                  document.body.innerHTML = ''
                  document.body.style.background = '#000'
                }}
                style={{
                  flex: 1, padding: '12px', borderRadius: 10, cursor: 'pointer',
                  border: '1.5px solid rgba(255,60,60,0.6)', background: 'rgba(255,60,60,0.15)',
                  color: 'var(--red)', fontSize: 14, fontWeight: 800, fontFamily: 'var(--mono)',
                  boxShadow: '0 0 16px rgba(255,60,60,0.2)',
                }}
              >Exit</button>
            </div>
          </div>
        </div>
      )}
      <header className="topbar-v2" style={{
        borderBottom: 'none',
        boxShadow: scanProgress.pct >= 0
          ? `inset 0 -2px 0 var(--border), inset 0 -2px 0 transparent`
          : 'inset 0 -1px 0 var(--border)',
        position: 'relative',
      }}>
        {/* Progress bar — replaces bottom border, no layout shift */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          height: 2, overflow: 'hidden', zIndex: 1,
        }}>
          {/* Track (always visible as border) */}
          <div style={{ position:'absolute', inset:0, background:'var(--border)' }}/>
          {/* Fill */}
          {scanProgress.pct >= 0 && (
            <div style={{
              position:'absolute', top:0, left:0, bottom:0,
              width: `${scanProgress.pct}%`,
              background: scanProgress.color,
              boxShadow: `0 0 8px ${scanProgress.color}cc`,
              transition: 'width .2s linear',
            }}/>
          )}
        </div>
        {/* Logo acts as Home button → goes to 15m tab */}
        <button onClick={() => setActiveTab('15m')} title="Home · go to 15m"
          style={{ display:'flex',alignItems:'center',gap:8,background:'none',border:'none',
            cursor:'pointer',padding:'3px 6px 3px 0',borderRadius:8,flexShrink:0,
            opacity:1,transition:'opacity .15s' }}
          onMouseEnter={e=>e.currentTarget.style.opacity='.7'}
          onMouseLeave={e=>e.currentTarget.style.opacity='1'}>
          <LogoMark size={32} />
          <div style={{ textAlign:'left' }}>
            <div style={{ fontWeight:800,fontSize:19,color:'var(--text)',letterSpacing:'-.02em',lineHeight:1.15 }}>Signal Engine</div>
          </div>
        </button>

        <div style={{ display:'flex',alignItems:'center',gap:6,marginLeft:'auto' }}>
          {/* Patterns button — jumps directly to Patterns accordion in Settings */}
          <button
            onClick={togglePatterns}
            title={showPatterns ? 'Close Patterns' : 'Open Patterns'}
            style={{
              height:32, padding:'0 10px', borderRadius:8, flexShrink:0,
              border: `1.5px solid ${showPatterns ? 'var(--lime)' : 'var(--lime-border)'}`,
              background: showPatterns ? 'var(--lime-dim)' : 'transparent',
              display:'flex', alignItems:'center', gap:5,
              cursor:'pointer', transition:'all .15s',
              color: showPatterns ? 'var(--lime)' : 'var(--lime-border)',
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
              style={{ transition: 'transform .2s', transform: showPatterns ? 'rotate(45deg)' : 'rotate(0deg)' }}>
              <circle cx="6" cy="6" r="2"/><circle cx="18" cy="6" r="2"/><circle cx="6" cy="18" r="2"/><circle cx="18" cy="18" r="2"/>
              <line x1="6" y1="8" x2="6" y2="16"/><line x1="18" y1="8" x2="18" y2="16"/>
              <line x1="8" y1="6" x2="16" y2="6"/><line x1="8" y1="18" x2="16" y2="18"/>
            </svg>
            <span style={{fontSize:10,fontFamily:'var(--mono)',fontWeight:700,letterSpacing:'.04em'}}>PATTERNS</span>
          </button>

          {/* Settings button */}
          <button
            onClick={() => navigateTo('settings')}
            title={activeTab === 'settings' ? 'Close Settings' : 'Settings'}
            style={{
              width:32, height:32, borderRadius:8, flexShrink:0,
              border: activeTab==='settings' ? '1.5px solid var(--accent)' : '1.5px solid var(--border2)',
              background: activeTab==='settings' ? 'var(--accent-dim)' : 'var(--bg2)',
              display:'flex', alignItems:'center', justifyContent:'center',
              cursor:'pointer', transition:'all .15s',
              color: activeTab==='settings' ? 'var(--accent)' : 'var(--text3)',
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              style={{transition:'transform .3s',transform:activeTab==='settings'?'rotate(45deg)':'rotate(0deg)'}}>
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
          </button>

          {/* User icon — opens login modal when logged out, user menu when logged in */}
          {user ? (
            <UserMenu user={user} onLogout={handleLogout} onGoToSettings={() => navigateTo('settings')} />
          ) : (
            <button
              onClick={() => setShowLoginModal(true)}
              title="Sign in"
              style={{
                width:32, height:32, borderRadius:'50%', flexShrink:0,
                border:'1.5px solid var(--border2)', background:'var(--bg2)',
                display:'flex', alignItems:'center', justifyContent:'center',
                cursor:'pointer', transition:'border-color .15s, background .15s',
              }}
              onMouseEnter={e=>{e.currentTarget.style.borderColor='var(--green)';e.currentTarget.style.background='var(--green-dim)'}}
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
        {TF_TABS.filter(t => !t.isSettings && !t.isBuilder).map(tab => (
          <div key={tab.id} style={{ display: activeTab===tab.id?'block':'none', height:'100%' }}>
            <ErrorBoundary>
              <TFScannerTab
                timeframe={tab.id}
                tabColor={tab.color}
                settings={settings}
                update={update}
                saveNowWithPatch={saveNowWithPatch}
                user={user}
                isFirstVisit={isFirstVisit && tab.id==='15m'}
                isActive={activeTab===tab.id}
                onAlertCount={handleAlertCount}
                onScanProgress={handleScanProgress}
              />
            </ErrorBoundary>
          </div>
        ))}
        {activeTab === 'settings' && (
          <ErrorBoundary>
            <SettingsTab settings={settings} set={set} update={update} reset={reset}
              user={user} onUserChange={setUser} cloudSynced={cloudSynced}
              cloudSaving={cloudSaving} onSaveNow={saveNow} openCount={settingsOpenCount} />
          </ErrorBoundary>
        )}
        {activeTab === 'builder' && (
          <ErrorBoundary>
            <PatternBuilderTab settings={settings} update={update} saveNowWithPatch={saveNowWithPatch} />
          </ErrorBoundary>
        )}
      </main>

      <nav className="bottom-nav-v2">
        {TF_TABS.map(tab => {
          const isActive = activeTab === tab.id
          const isPatternActive = tab.isBuilder && showPatterns
          const count = (!tab.isSettings && !tab.isBuilder) ? (alertCounts[tab.id] || 0) : 0
          return (
            <button
              key={tab.id}
              className={`bottom-tab${tab.isSettings?' bottom-tab-settings':''}${tab.isBuilder&&isActive?' bottom-tab-builder-active':''}`}
              onClick={() => {
                if (tab.isBuilder) {
                  // P tab: if patterns modal open, close it first
                  if (showPatterns) { setShowPatterns(false); return }
                  navigateTo('builder')
                } else {
                  navigateTo(tab.id)
                }
              }}
              style={{
                color: isActive ? tab.color : 'var(--text3)',
                background: isActive ? `${tab.color}10` : 'transparent',
                borderTop: isActive ? `2px solid ${tab.color}` : '2px solid transparent',
              }}>
              {tab.isSettings ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                  style={{transition:'transform .3s',transform:isActive?'rotate(45deg)':'rotate(0deg)'}}>
                  <circle cx="12" cy="12" r="3"/>
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                </svg>
              ) : tab.isBuilder ? (
                <span style={{
                  fontFamily: 'Georgia, "Times New Roman", serif',
                  fontSize: 20, fontWeight: 900, lineHeight: 1,
                  color: isActive ? 'var(--lime)' : 'currentColor',
                  letterSpacing: '-1px',
                  display: 'block',
                }}>P</span>
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

      {/* Patterns bottom sheet modal */}
      <PatternsModal
        open={showPatterns}
        onClose={togglePatterns}
        settings={settings}
        update={update}
      />
    </div>
  )
}
