// firebase.js — Signal Engine v2.0
// Firebase project: signal-engines

import { initializeApp, getApps } from 'firebase/app'
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from 'firebase/auth'
import {
  getFirestore,
  doc,
  getDoc,
  setDoc
} from 'firebase/firestore'

// ── Config ────────────────────────────────────────────────
const FIREBASE_CONFIG = {
  apiKey:            "AIzaSyAZahY8Ci0yGHHZcf5TLTakNod16Hihbqo",
  authDomain:        "signal-engines.firebaseapp.com",
  projectId:         "signal-engines",
  storageBucket:     "signal-engines.firebasestorage.app",
  messagingSenderId: "998907341980",
  appId:             "1:998907341980:web:84aea5bfe2f6238e049159"
}

// ── Init ──────────────────────────────────────────────────
const app  = getApps().length ? getApps()[0] : initializeApp(FIREBASE_CONFIG)
const auth = getAuth(app)
const db   = getFirestore(app)

export const isConfigured = true
export function checkConfigured() { return true }

// ── Auth ──────────────────────────────────────────────────
export async function loginWithGoogle() {
  const provider = new GoogleAuthProvider()
  const result = await signInWithPopup(auth, provider)
  return result.user
}

export async function loginWithEmail(email, password) {
  const result = await signInWithEmailAndPassword(auth, email, password)
  return result.user
}

export async function logout() {
  await signOut(auth)
}

export async function onAuthChanged(callback) {
  return onAuthStateChanged(auth, callback)
}

// ── Firestore ─────────────────────────────────────────────
export async function saveSettingsToCloud(uid, settings) {
  if (!uid) return false
  try {
    const ref = doc(db, 'users', uid, 'settings', 'ema-sigma')
    await setDoc(ref, { ...settings, _savedAt: Date.now() }, { merge: true })
    return true
  } catch (e) {
    console.warn('[Signal Engine] saveSettings failed:', e.message)
    return false
  }
}

export async function loadSettingsFromCloud(uid) {
  if (!uid) return null
  try {
    const ref = doc(db, 'users', uid, 'settings', 'ema-sigma')
    const snap = await getDoc(ref)
    return snap.exists() ? snap.data() : null
  } catch (e) {
    console.warn('[Signal Engine] loadSettings failed:', e.message)
    return null
  }
}
