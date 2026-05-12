import { useState, useEffect, useCallback, useRef } from 'react'
import { saveSettingsToCloud, loadSettingsFromCloud } from '../firebase.js'

const STORAGE_KEY = 'cfa_settings_v4'

const DEFAULT_30_PAIRS = [
  'BTCUSDT','ETHUSDT','BNBUSDT','SOLUSDT','XRPUSDT',
  'ADAUSDT','DOGEUSDT','AVAXUSDT','MATICUSDT','DOTUSDT',
  'LINKUSDT','UNIUSDT','LTCUSDT','ATOMUSDT','NEARUSDT',
  'APTUSDT','ARBUSDT','OPUSDT','INJUSDT','SUIUSDT',
  'SHIBUSDT','TRXUSDT','TONUSDT','FETUSDT','RNDRUSDT',
  'WIFUSDT','PEPEUSDT','FLOKIUSDT','TIAUSDT','JUPUSDT',
]

export const DEFAULTS = {
  timeframe:    '15m',
  scanInterval: '1m',
  darkMode:     true,
  symbolSet:    'top200',
  customPairs:  DEFAULT_30_PAIRS,
  scanMode:       'all',
  autoScan:       false,
  viewMode:       'list',
  dedupInterval:  '1m',
  scannerEnabled: {},
  volumeFilter:  '500k',
  resultFilter:  'all',
  patternsMode:  'all',
  soundEnabled: true,
  tgOn:         false,
  tgToken:      '',
  tgChatId:     '',
  wickEnabled:   true,
  wickTouchPct:  1.5,
  scoreFilterEnabled: false,
  scoreMin:           5,
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { settings: DEFAULTS, isFirstVisit: true }
    return { settings: { ...DEFAULTS, ...JSON.parse(raw) }, isFirstVisit: false }
  } catch { return { settings: DEFAULTS, isFirstVisit: true } }
}

export function useSettings(firebaseUser) {
  const loaded = load()
  const [settings, setSettings] = useState(loaded.settings)
  const isFirstVisit = useRef(loaded.isFirstVisit)
  const [cloudSynced, setCloudSynced] = useState(false)
  const [cloudSaving, setCloudSaving] = useState(false)
  const saveTimeoutRef = useRef(null)
  const prevUidRef = useRef(null)

  // Persist to localStorage
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)) } catch {}
  }, [settings])

  // When user logs in: pull cloud settings
  useEffect(() => {
    const uid = firebaseUser?.uid
    if (!uid || uid === prevUidRef.current) return
    prevUidRef.current = uid
    setCloudSynced(false)
    loadSettingsFromCloud(uid).then(cloud => {
      if (cloud) {
        const { _savedAt, ...clean } = cloud
        setSettings(prev => ({ ...prev, ...clean }))
        setCloudSynced(true)
      }
    })
  }, [firebaseUser])

  useEffect(() => {
    if (!firebaseUser) { prevUidRef.current = null; setCloudSynced(false) }
  }, [firebaseUser])

  const update = useCallback((patch) => {
    setSettings(prev => typeof patch === 'function' ? patch(prev) : { ...prev, ...patch })
  }, [])

  // Debounced auto-save to cloud
  useEffect(() => {
    const uid = firebaseUser?.uid
    if (!uid) return
    clearTimeout(saveTimeoutRef.current)
    setCloudSaving(true)
    saveTimeoutRef.current = setTimeout(async () => {
      const ok = await saveSettingsToCloud(uid, settings)
      if (ok) setCloudSynced(true)
      setCloudSaving(false)
    }, 2000)
    return () => clearTimeout(saveTimeoutRef.current)
  }, [settings, firebaseUser])

  const saveNow = useCallback(async () => {
    const uid = firebaseUser?.uid
    if (!uid) return false
    clearTimeout(saveTimeoutRef.current)
    setCloudSaving(true)
    const ok = await saveSettingsToCloud(uid, settings)
    if (ok) setCloudSynced(true)
    setCloudSaving(false)
    return ok
  }, [firebaseUser, settings])

  const updateNested = useCallback((key, patch) => {
    setSettings(prev => ({ ...prev, [key]: { ...prev[key], ...patch } }))
  }, [])

  const reset = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY)
    setSettings(DEFAULTS)
  }, [])

  return { settings, update, updateNested, reset, cloudSynced, cloudSaving, saveNow, isFirstVisit: isFirstVisit.current }
}
