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
  symbolSet:    'all',
  customPairs:  DEFAULT_30_PAIRS,
  scanMode:       'all',
  autoScan:       false,
  viewMode:       'list',
  dedupInterval:  '1m',
  scannerEnabled: {},
  volumeFilter:  '500k',
  resultFilter:  'all',
  patternsMode:  'all',
  patternTfs:    {},
  soundEnabled: true,
  tgOn:         false,
  tgToken:      '',
  tgChatId:     '',
  wickEnabled:   true,
  wickTouchPct:  1.5,
  scoreFilterEnabled: false,
  scoreMin:           5,
  // Timestamps: track when critical fields were last saved locally
  _customPatternsAt:  0,
  _deletedPatternsAt: 0,
}

// Fields that must be saved to cloud immediately (no debounce)
const CRITICAL_KEYS = new Set([
  'customPatterns', 'deletedPatterns', 'scannerEnabled', 'patternTfs',
  '_customPatternsAt', '_deletedPatternsAt',
])

function hasCriticalKey(patch) {
  if (typeof patch !== 'object' || patch === null) return false
  return Object.keys(patch).some(k =>
    CRITICAL_KEYS.has(k) ||
    // Per-TF scannerEnabled keys like "scannerEnabled_15m"
    k.startsWith('scannerEnabled_') ||
    k.startsWith('patternTfs_')
  )
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
  // Latest settings ref — always current even inside async callbacks
  const settingsRef = useRef(settings)
  useEffect(() => { settingsRef.current = settings }, [settings])

  // Persist to localStorage on every change
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)) } catch {}
  }, [settings])

  // ── Cloud load on login ────────────────────────────────────
  useEffect(() => {
    const uid = firebaseUser?.uid
    if (!uid || uid === prevUidRef.current) return
    prevUidRef.current = uid
    setCloudSynced(false)

    loadSettingsFromCloud(uid).then(cloud => {
      if (!cloud) {
        // No cloud data yet — push local settings to cloud immediately
        saveSettingsToCloud(uid, settingsRef.current)
        setCloudSynced(true)
        return
      }
      const { _savedAt, ...clean } = cloud
      setSettings(prev => {
        const merged = { ...prev, ...clean }

        // For customPatterns: keep whichever is STRICTLY newer.
        // If equal (both 0 = first time), cloud wins so we load saved data.
        const localPatternsAt = prev._customPatternsAt  || 0
        const cloudPatternsAt = clean._customPatternsAt || 0
        if (localPatternsAt > cloudPatternsAt) {
          merged.customPatterns    = prev.customPatterns
          merged._customPatternsAt = prev._customPatternsAt
        }

        // Same for deleted/trash patterns
        const localTrashAt = prev._deletedPatternsAt  || 0
        const cloudTrashAt = clean._deletedPatternsAt || 0
        if (localTrashAt > cloudTrashAt) {
          merged.deletedPatterns    = prev.deletedPatterns
          merged._deletedPatternsAt = prev._deletedPatternsAt
        }

        return merged
      })
      setCloudSynced(true)
    })
  }, [firebaseUser])

  useEffect(() => {
    if (!firebaseUser) { prevUidRef.current = null; setCloudSynced(false) }
  }, [firebaseUser])

  // ── Immediate cloud save helper ────────────────────────────
  const saveToCloud = useCallback(async (settingsToSave) => {
    const uid = firebaseUser?.uid
    if (!uid) return false
    setCloudSaving(true)
    const ok = await saveSettingsToCloud(uid, settingsToSave)
    if (ok) setCloudSynced(true)
    setCloudSaving(false)
    return ok
  }, [firebaseUser])

  // ── update(): save critical fields immediately, debounce the rest ──
  const update = useCallback((patch) => {
    setSettings(prev => {
      const next = typeof patch === 'function' ? patch(prev) : { ...prev, ...patch }
      // Fire immediate cloud save for critical fields
      const uid = firebaseUser?.uid
      if (uid && hasCriticalKey(typeof patch === 'function' ? next : patch)) {
        clearTimeout(saveTimeoutRef.current)
        setCloudSaving(true)
        saveSettingsToCloud(uid, next).then(ok => {
          if (ok) setCloudSynced(true)
          setCloudSaving(false)
        })
      } else if (uid) {
        // Debounce non-critical changes
        clearTimeout(saveTimeoutRef.current)
        setCloudSaving(true)
        saveTimeoutRef.current = setTimeout(async () => {
          const ok = await saveSettingsToCloud(uid, settingsRef.current)
          if (ok) setCloudSynced(true)
          setCloudSaving(false)
        }, 2000)
      }
      return next
    })
  }, [firebaseUser, saveToCloud])

  const saveNow = useCallback(async () => {
    const uid = firebaseUser?.uid
    if (!uid) return false
    clearTimeout(saveTimeoutRef.current)
    return saveToCloud(settingsRef.current)
  }, [firebaseUser, saveToCloud])

  // Save immediately with a patch merged in — use when you need to save
  // right after update() before React has flushed the new state
  const saveNowWithPatch = useCallback(async (patch) => {
    const uid = firebaseUser?.uid
    if (!uid) return false
    clearTimeout(saveTimeoutRef.current)
    const merged = { ...settingsRef.current, ...patch }
    return saveToCloud(merged)
  }, [firebaseUser, saveToCloud])

  const updateNested = useCallback((key, patch) => {
    update(prev => ({ ...prev, [key]: { ...prev[key], ...patch } }))
  }, [update])

  const reset = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY)
    setSettings(DEFAULTS)
  }, [])

  return { settings, update, updateNested, reset, cloudSynced, cloudSaving, saveNow, saveNowWithPatch, isFirstVisit: isFirstVisit.current }
}
