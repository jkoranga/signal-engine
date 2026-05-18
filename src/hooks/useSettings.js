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
  // Pattern lists — always present so Firestore full-overwrites never miss them
  customPatterns:  [],
  deletedPatterns: [],
  // Timestamps: track when critical fields were last saved locally
  _customPatternsAt:  0,
  _deletedPatternsAt: 0,
}

// Fields that must be saved to cloud immediately (no debounce)
const CRITICAL_KEYS = new Set([
  // Pattern data
  'customPatterns', 'deletedPatterns',
  '_customPatternsAt', '_deletedPatternsAt',
  // Scanner toggles & TF assignments
  'scannerEnabled', 'patternTfs',
  // Scan settings (Settings tab)
  'symbolSet', 'scanInterval', 'dedupInterval', 'volumeFilter',
  'resultFilter', 'scanMode', 'patternsMode',
  // Alert / notification settings
  'soundEnabled', 'tgOn', 'tgToken', 'tgChatId',
  // Appearance
  'darkMode',
  // Signal strength
  'wickEnabled', 'wickTouchPct', 'scoreFilterEnabled', 'scoreMin',
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
  // Always holds the latest settings — readable synchronously in callbacks
  const settingsRef = useRef(loaded.settings)

  // Keep settingsRef in sync AND persist to localStorage on every state change
  useEffect(() => {
    settingsRef.current = settings
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)) } catch {}
  }, [settings])

  // ── Direct cloud save (no debounce) ───────────────────────
  const saveNow = useCallback(async (overrideSettings) => {
    const uid = firebaseUser?.uid
    if (!uid) return false
    clearTimeout(saveTimeoutRef.current)
    const toSave = overrideSettings ?? settingsRef.current
    setCloudSaving(true)
    const ok = await saveSettingsToCloud(uid, toSave)
    if (ok) setCloudSynced(true)
    setCloudSaving(false)
    return ok
  }, [firebaseUser])

  // ── Cloud load on login ────────────────────────────────────
  useEffect(() => {
    const uid = firebaseUser?.uid
    if (!uid || uid === prevUidRef.current) return
    prevUidRef.current = uid
    setCloudSynced(false)

    loadSettingsFromCloud(uid).then(cloud => {
      if (!cloud) {
        // First time user — push whatever is in local storage up to cloud
        saveNow()
        return
      }
      const { _savedAt, ...clean } = cloud
      setSettings(prev => {
        const merged = { ...prev, ...clean }

        // customPatterns: keep strictly newer side (by timestamp).
        // Both 0 means neither was ever explicitly saved — cloud wins (it has data).
        const localAt = prev._customPatternsAt  || 0
        const cloudAt = clean._customPatternsAt || 0
        if (localAt > cloudAt) {
          merged.customPatterns    = prev.customPatterns
          merged._customPatternsAt = localAt
        }

        // Same for trash
        const localTrAt = prev._deletedPatternsAt  || 0
        const cloudTrAt = clean._deletedPatternsAt || 0
        if (localTrAt > cloudTrAt) {
          merged.deletedPatterns    = prev.deletedPatterns
          merged._deletedPatternsAt = localTrAt
        }

        // Keep settingsRef in sync immediately — do NOT wait for the useEffect.
        // update() reads settingsRef.current synchronously, so if any update()
        // call happens before the next render, it must see the merged state,
        // not the pre-login state.
        settingsRef.current = merged
        return merged
      })
      // Push merged state back to Firestore immediately after every login.
      // This corrects any stale cloud state (e.g. from old merge:true bugs)
      // and ensures the cloud always reflects the authoritative merged result.
      saveSettingsToCloud(uid, settingsRef.current).then(() => setCloudSynced(true))
    })
  }, [firebaseUser, saveNow])

  useEffect(() => {
    if (!firebaseUser) { prevUidRef.current = null; setCloudSynced(false) }
  }, [firebaseUser])

  // ── update(): the single entry point for all setting changes ──
  // For critical keys (patterns, scanners, etc.) — saves to Firebase immediately.
  // For non-critical — debounces 2 seconds.
  const update = useCallback((patch) => {
    // Compute next state
    const next = typeof patch === 'function'
      ? patch(settingsRef.current)
      : { ...settingsRef.current, ...patch }

    // Update ref immediately so subsequent calls in the same tick see latest state
    settingsRef.current = next

    // Update React state (triggers re-render + localStorage persist via useEffect)
    setSettings(next)

    // Cloud save
    const uid = firebaseUser?.uid
    if (!uid) return

    const isCritical = typeof patch === 'function'
      ? true  // function patches always treated as critical (e.g. complex updates)
      : hasCriticalKey(patch)

    if (isCritical) {
      clearTimeout(saveTimeoutRef.current)
      setCloudSaving(true)
      saveSettingsToCloud(uid, next).then(ok => {
        if (ok) setCloudSynced(true)
        setCloudSaving(false)
      })
    } else {
      clearTimeout(saveTimeoutRef.current)
      setCloudSaving(true)
      saveTimeoutRef.current = setTimeout(() => {
        saveSettingsToCloud(uid, settingsRef.current).then(ok => {
          if (ok) setCloudSynced(true)
          setCloudSaving(false)
        })
      }, 2000)
    }
  }, [firebaseUser])

  // saveNowWithPatch — kept for API compatibility, merges patch and saves immediately
  const saveNowWithPatch = useCallback(async (patch) => {
    const uid = firebaseUser?.uid
    if (!uid) return false
    clearTimeout(saveTimeoutRef.current)
    const merged = { ...settingsRef.current, ...patch }
    settingsRef.current = merged
    setCloudSaving(true)
    const ok = await saveSettingsToCloud(uid, merged)
    if (ok) setCloudSynced(true)
    setCloudSaving(false)
    return ok
  }, [firebaseUser])

  const updateNested = useCallback((key, patch) => {
    update(prev => ({ ...prev, [key]: { ...prev[key], ...patch } }))
  }, [update])

  const reset = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY)
    settingsRef.current = DEFAULTS
    setSettings(DEFAULTS)
  }, [])

  return { settings, update, updateNested, reset, cloudSynced, cloudSaving, saveNow, saveNowWithPatch, isFirstVisit: isFirstVisit.current }
}
