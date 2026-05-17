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
  patternTfs:    {},   // { [scannerId]: string[] } — per-pattern TF selections
  soundEnabled: true,
  tgOn:         false,
  tgToken:      '',
  tgChatId:     '',
  wickEnabled:   true,
  wickTouchPct:  1.5,
  scoreFilterEnabled: false,
  scoreMin:           5,
  // Timestamps to resolve cloud vs local conflicts for pattern fields
  _customPatternsAt:  0,
  _deletedPatternsAt: 0,
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
  // Track updates that happen while cloud load is in-flight
  const cloudLoadingRef = useRef(false)
  const localUpdatedDuringLoadRef = useRef(false)

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
    cloudLoadingRef.current = true
    localUpdatedDuringLoadRef.current = false
    loadSettingsFromCloud(uid).then(cloud => {
      cloudLoadingRef.current = false
      if (cloud) {
        const { _savedAt, ...clean } = cloud
        setSettings(prev => {
          const merged = { ...prev, ...clean }

          // Always keep whichever version of customPatterns is newer.
          // _customPatternsAt is a timestamp written every time patterns are saved.
          const localPatternsAt = prev._customPatternsAt  || 0
          const cloudPatternsAt = clean._customPatternsAt || 0
          if (localPatternsAt >= cloudPatternsAt) {
            // Local is same age or newer — keep local patterns
            merged.customPatterns    = prev.customPatterns
            merged._customPatternsAt = prev._customPatternsAt
          }

          // Same treatment for deleted/trash patterns
          const localTrashAt = prev._deletedPatternsAt  || 0
          const cloudTrashAt = clean._deletedPatternsAt || 0
          if (localTrashAt >= cloudTrashAt) {
            merged.deletedPatterns    = prev.deletedPatterns
            merged._deletedPatternsAt = prev._deletedPatternsAt
          }

          return merged
        })
        setCloudSynced(true)
      }
    })
  }, [firebaseUser])

  useEffect(() => {
    if (!firebaseUser) { prevUidRef.current = null; setCloudSynced(false) }
  }, [firebaseUser])

  const update = useCallback((patch) => {
    if (cloudLoadingRef.current) {
      localUpdatedDuringLoadRef.current = true
    }
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

  // Save immediately with a patch merged in — use this when you need to save
  // right after update() before React has flushed the new state
  const saveNowWithPatch = useCallback(async (patch) => {
    const uid = firebaseUser?.uid
    if (!uid) return false
    clearTimeout(saveTimeoutRef.current)
    setCloudSaving(true)
    const merged = { ...settings, ...patch }
    const ok = await saveSettingsToCloud(uid, merged)
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

  return { settings, update, updateNested, reset, cloudSynced, cloudSaving, saveNow, saveNowWithPatch, isFirstVisit: isFirstVisit.current }
}
