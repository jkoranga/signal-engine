// firebase.js — EMA Sigma v2.0
// Firebase project: signal-engines

let _app = null
let _auth = null
let _db = null

export let isConfigured = false

// ── Hardcoded config (signal-engines) ────────────────────
const FIREBASE_CONFIG = {
  apiKey:            "AIzaSyAZahY8Ci0yGHHZcf5TLTakNod16Hihbqo",
  authDomain:        "signal-engines.firebaseapp.com",
  projectId:         "signal-engines",
  storageBucket:     "signal-engines.firebasestorage.app",
  messagingSenderId: "998907341980",
  appId:             "1:998907341980:web:84aea5bfe2f6238e049159"
}

async function init() {
  if (_app) return { auth: _auth, db: _db }

  // env vars take priority, fallback to hardcoded
  const apiKey     = import.meta.env.VITE_FB_API_KEY     || FIREBASE_CONFIG.apiKey
  const authDomain = import.meta.env.VITE_FB_AUTH_DOMAIN || FIREBASE_CONFIG.authDomain
  const projectId  = import.meta.env.VITE_FB_PROJECT_ID  || FIREBASE_CONFIG.projectId
  const appId      = import.meta.env.VITE_FB_APP_ID      || FIREBASE_CONFIG.appId

  const { initializeApp, getApps } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js')
  const { getAuth, GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword, signOut, onAuthStateChanged }
    = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js')
  const { getFirestore, doc, getDoc, setDoc }
    = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js')

  const cfg = { apiKey, authDomain, projectId, appId }
  _app  = getApps().length ? getApps()[0] : initializeApp(cfg)
  _auth = getAuth(_app)
  _db   = getFirestore(_app)
  isConfigured = true

  return { auth: _auth, db: _db, GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword, signOut, onAuthStateChanged, doc, getDoc, setDoc }
}

export async function loginWithGoogle() {
  const { auth, GoogleAuthProvider, signInWithPopup } = await init()
  const provider = new GoogleAuthProvider()
  const result = await signInWithPopup(auth, provider)
  return result.user
}

export async function loginWithEmail(email, password) {
  const { auth, signInWithEmailAndPassword } = await init()
  const result = await signInWithEmailAndPassword(auth, email, password)
  return result.user
}

export async function logout() {
  if (!_auth) return
  const { signOut } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js')
  await signOut(_auth)
}

// Save settings to Firestore: users/{uid}/settings/ema-sigma
export async function saveSettingsToCloud(uid, settings) {
  if (!uid) return
  try {
    const { db, doc, setDoc } = await init()
    const ref = doc(db, 'users', uid, 'settings', 'ema-sigma')
    await setDoc(ref, { ...settings, _savedAt: Date.now() }, { merge: true })
    return true
  } catch (e) {
    console.warn('[EMA Sigma] saveSettings failed:', e.message)
    return false
  }
}

// Load settings from Firestore
export async function loadSettingsFromCloud(uid) {
  if (!uid) return null
  try {
    const { db, doc, getDoc } = await init()
    const ref = doc(db, 'users', uid, 'settings', 'ema-sigma')
    const snap = await getDoc(ref)
    if (snap.exists()) return snap.data()
    return null
  } catch (e) {
    console.warn('[EMA Sigma] loadSettings failed:', e.message)
    return null
  }
}

// Subscribe to auth state changes
export async function onAuthChanged(callback) {
  const { auth, onAuthStateChanged } = await init().catch(() => ({ auth: null, onAuthStateChanged: null }))
  if (!auth) return () => {}
  return onAuthStateChanged(auth, callback)
}

// Always configured now (hardcoded fallback)
export function checkConfigured() {
  return true
}
