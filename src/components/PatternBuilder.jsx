// ─── Pattern Builder v2 ───────────────────────────────────────────────────────
import React, { useState, useMemo } from 'react'

// ── Field catalogue ───────────────────────────────────────────────────────────
const FIELDS = [
  { id: 'close',     label: 'Close',      short: 'Close',  group: 'Price' },
  { id: 'open',      label: 'Open',       short: 'Open',   group: 'Price' },
  { id: 'high',      label: 'High',       short: 'High',   group: 'Price' },
  { id: 'low',       label: 'Low',        short: 'Low',    group: 'Price' },
  { id: 'volume',    label: 'Volume',     short: 'Vol',    group: 'Price' },
  { id: 'ema9',      label: 'EMA 9',      short: 'EMA9',   group: 'EMA' },
  { id: 'ema20',     label: 'EMA 20',     short: 'EMA20',  group: 'EMA' },
  { id: 'ema40',     label: 'EMA 40',     short: 'EMA40',  group: 'EMA' },
  { id: 'ema16',     label: 'EMA 16',     short: 'EMA16',  group: 'EMA' },
  { id: 'ema25',     label: 'EMA 25',     short: 'EMA25',  group: 'EMA' },
  { id: 'ema50',     label: 'EMA 50',     short: 'EMA50',  group: 'EMA' },
  { id: 'rsi',       label: 'RSI 14',     short: 'RSI',    group: 'Indicator' },
  { id: 'bodyPct',   label: 'Body %',     short: 'Body%',  group: 'Calc', computed: c => c.high !== c.low ? Math.abs(c.close - c.open) / (c.high - c.low) * 100 : 0 },
  { id: 'body',      label: 'Body Size',  short: 'Body',   group: 'Calc', computed: c => Math.abs(c.close - c.open) },
  { id: 'range',     label: 'Range H-L',  short: 'Range',  group: 'Calc', computed: c => c.high - c.low },
  { id: 'upperWick', label: 'Upper Wick', short: 'UWick',  group: 'Calc', computed: c => c.high - Math.max(c.close, c.open) },
  { id: 'lowerWick', label: 'Lower Wick', short: 'LWick',  group: 'Calc', computed: c => Math.min(c.close, c.open) - c.low },
  { id: 'isGreen',   label: 'Is Green',   short: 'Green?', group: 'Calc', computed: c => c.close > c.open ? 1 : 0 },
  { id: 'isRed',     label: 'Is Red',     short: 'Red?',   group: 'Calc', computed: c => c.close < c.open ? 1 : 0 },
]
const FIELD_MAP = Object.fromEntries(FIELDS.map(f => [f.id, f]))
const FIELD_GROUPS = FIELDS.reduce((g, f) => { (g[f.group] = g[f.group] || []).push(f); return g }, {})

const OPS = ['>', '>=', '<', '<=', '=', '≠']
const OP_SYM = { '=': '==', '≠': '!=' }

// RHS modes
const RHS_MODES = [
  { id: 'number',  label: 'Value',       hint: 'A fixed number' },
  { id: 'field',   label: 'Field',       hint: 'Another candle field' },
  { id: 'mult',    label: '× Mult',      hint: 'Field × multiplier  e.g. EMA20[-2] × 1.5' },
  { id: 'pct',     label: '± %',         hint: 'Field ± percent  e.g. EMA20[-2] + 0.35%' },
  { id: 'pctdiff', label: '% Diff',      hint: '% gap between left and right field' },
]

const OFFSETS = Array.from({ length: 11 }, (_, i) =>
  i === 0 ? { v: 0, label: '[0] Current' } : { v: -i, label: `[-${i}] Prev ${i}` }
)

const TF_LIST = ['1m','3m','5m','15m','30m','1h','4h','1d']
const ICONS   = ['⭐','💹','📈','📉','🚀','💣','🎯','⚡','🔥','💎','🌊','🧲','🔔','🏹']

const G = 'var(--green)'
const R = 'var(--red)'
const A = '#b388ff'
const BLU = '#4dabf7'
const AMB = '#ffa000'

// Per-condition colour palette (cycles if more than palette length)
const COND_COLORS = [
  '#4dabf7', // blue
  '#b388ff', // violet
  '#ffa000', // amber
  '#26c6da', // cyan
  '#f06292', // pink
  '#a5d6a7', // mint green
  '#ffb74d', // orange
  '#80cbc4', // teal
  '#ce93d8', // lavender
  '#ef9a9a', // soft red
]
function condColor(idx) { return COND_COLORS[idx % COND_COLORS.length] }

// Mirror an operator (flip comparison direction)
const MIRROR_OP = { '>': '<', '>=': '<=', '<': '>', '<=': '>=', '=': '=', '≠': '≠' }
function mirrorCond(cond) {
  return {
    ...cond,
    id: uid(),
    op: MIRROR_OP[cond.op] ?? cond.op,
    label: cond.label ? `Mirror of ${cond.label}` : 'Mirrored condition',
  }
}

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2,6) }

// ── Formula label ─────────────────────────────────────────────────────────────
export function condFormula(c) {
  const lhsF = FIELD_MAP[c.lhsField]?.short || c.lhsField
  const lhsO = c.lhsOffset === 0 ? '' : `[${c.lhsOffset}]`
  const lhs  = `${lhsF}${lhsO}`
  const op   = c.op

  if (c.rhsMode === 'number')  return `${lhs} ${op} ${c.rhsNum ?? 0}`

  const rhsF = FIELD_MAP[c.rhsField]?.short || (c.rhsField || '?')
  const rhsO = (c.rhsOffset ?? 0) === 0 ? '' : `[${c.rhsOffset}]`
  const rhs  = `${rhsF}${rhsO}`

  if (c.rhsMode === 'field')   return `${lhs} ${op} ${rhs}`
  if (c.rhsMode === 'mult')    return `${lhs} ${op} ${rhs} × ${c.rhsMult ?? 1}`
  if (c.rhsMode === 'pct') {
    const s = (c.rhsPct ?? 0) >= 0 ? '+' : ''
    return `${lhs} ${op} ${rhs} ${s}${c.rhsPct ?? 0}%`
  }
  if (c.rhsMode === 'pctdiff') return `(${lhs}/${rhs}−1)×100 ${op} ${c.rhsNum ?? 0}%`
  return `${lhs} ${op} ?`
}

// ── Blank items ───────────────────────────────────────────────────────────────
function blankCond() {
  return {
    id: uid(), enabled: true, joinNext: 'AND',
    label: '',
    lhsField: 'ema20', lhsOffset: 0,
    op: '>',
    rhsMode: 'mult', rhsField: 'ema20', rhsOffset: -2,
    rhsNum: 0, rhsMult: 1, rhsPct: 0,
  }
}

export function blankPattern() {
  return {
    id: `custom_${uid()}`,
    name: 'My Pattern', side: 'bull', icon: '⭐',
    tfs: ['15m','1h'],
    conditions: [blankCond()],
    enabled: true, createdAt: Date.now(),
  }
}

// ── Compile pattern → logic(candles) ─────────────────────────────────────────
export function compilePattern(pattern) {
  return function logic(candles) {
    if (!candles || candles.length < 5) return null
    const len = candles.length

    function getC(offset) {
      const idx = len - 1 + offset
      return idx >= 0 ? candles[idx] : null
    }
    function getVal(candle, fieldId) {
      if (!candle) return null
      const f = FIELD_MAP[fieldId]
      if (!f) return null
      if (f.computed) return f.computed(candle)
      const v = candle[fieldId]
      return v == null ? null : v
    }

    const active = pattern.conditions.filter(c => c.enabled)
    if (!active.length) return null

    function evalCond(cond) {
      const lhsV = getVal(getC(cond.lhsOffset), cond.lhsField)
      if (lhsV == null) return null

      let rhsV
      const rhsBase = cond.rhsField ? getVal(getC(cond.rhsOffset ?? 0), cond.rhsField) : null

      if (cond.rhsMode === 'number')  { rhsV = parseFloat(cond.rhsNum) || 0 }
      else if (cond.rhsMode === 'field')   { if (rhsBase == null) return null; rhsV = rhsBase }
      else if (cond.rhsMode === 'mult')    { if (rhsBase == null) return null; rhsV = rhsBase * (parseFloat(cond.rhsMult) || 1) }
      else if (cond.rhsMode === 'pct')     { if (rhsBase == null) return null; rhsV = rhsBase * (1 + (parseFloat(cond.rhsPct) || 0) / 100) }
      else if (cond.rhsMode === 'pctdiff') {
        if (rhsBase == null || rhsBase === 0) return null
        const diff = (lhsV / rhsBase - 1) * 100
        const num  = parseFloat(cond.rhsNum) || 0
        const op   = OP_SYM[cond.op] || cond.op
        if (op === '>')  return diff >  num
        if (op === '>=') return diff >= num
        if (op === '<')  return diff <  num
        if (op === '<=') return diff <= num
        if (op === '==') return Math.abs(diff - num) < 1e-9
        return Math.abs(diff - num) >= 1e-9
      }

      const op = OP_SYM[cond.op] || cond.op
      if (op === '>')  return lhsV >  rhsV
      if (op === '>=') return lhsV >= rhsV
      if (op === '<')  return lhsV <  rhsV
      if (op === '<=') return lhsV <= rhsV
      if (op === '==') return Math.abs(lhsV - rhsV) < 1e-9
      return Math.abs(lhsV - rhsV) >= 1e-9
    }

    // Fold AND/OR left→right
    let acc = evalCond(active[0])
    if (acc == null) return null
    for (let i = 1; i < active.length; i++) {
      const r = evalCond(active[i])
      if (r == null) return null
      acc = active[i-1].joinNext === 'OR' ? acc || r : acc && r
    }
    if (!acc) return null

    const curr = candles[len - 1]
    const prev = candles[len - 2] || curr
    const lo = Math.min(curr.low, prev.low)
    const hi = Math.max(curr.high, prev.high)
    const gainPct = pattern.side === 'bull'
      ? ((curr.close - lo) / lo * 100).toFixed(2)
      : ((hi - curr.close) / curr.close * 100).toFixed(2)

    return {
      candleCount: 5, gainPct,
      highestClose: curr.close, lowestOpen: curr.open,
      conds: active.map((c, i) => {
        const pre = i > 0 ? `${active[i-1].joinNext} ` : ''
        return `✓ ${pre}${condFormula(c)}`
      }),
      run: candles.slice(len - 8, len),
      ema9: curr.ema9, ema20: curr.ema20, rsi: curr.rsi,
    }
  }
}

// ── UI primitives ─────────────────────────────────────────────────────────────
function Pill({ active, color = A, onClick, children, sm }) {
  return (
    <button onClick={onClick} style={{
      padding: sm ? '4px 9px' : '6px 12px',
      borderRadius: 20, cursor: 'pointer',
      fontSize: sm ? 10 : 11, fontFamily: 'var(--mono)', fontWeight: active ? 800 : 500,
      border: `1.5px solid ${active ? color : 'var(--border)'}`,
      background: active ? `${color}1e` : 'transparent',
      color: active ? color : 'var(--text3)',
      transition: 'all .12s', whiteSpace: 'nowrap', flexShrink: 0,
    }}>{children}</button>
  )
}

function Lbl({ children }) {
  return <div style={{ fontSize: 9, fontFamily: 'var(--mono)', fontWeight: 700, color: 'var(--text3)', letterSpacing: '.07em', marginBottom: 5 }}>{children}</div>
}

function FSelect({ value, offset, onField, onOffset, color }) {
  return (
    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
      <select value={value} onChange={e => onField(e.target.value)} style={{
        background: 'var(--bg3)', border: `1.5px solid ${color}55`,
        color, borderRadius: 8, padding: '6px 9px',
        fontSize: 12, fontFamily: 'var(--mono)', fontWeight: 700, cursor: 'pointer',
      }}>
        {Object.entries(FIELD_GROUPS).map(([grp, fs]) => (
          <optgroup key={grp} label={grp}>
            {fs.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
          </optgroup>
        ))}
      </select>
      <select value={offset ?? 0} onChange={e => onOffset(parseInt(e.target.value))} style={{
        background: 'var(--bg3)', border: '1.5px solid var(--border)',
        color: 'var(--text2)', borderRadius: 8, padding: '6px 8px',
        fontSize: 11, fontFamily: 'var(--mono)', cursor: 'pointer',
      }}>
        {OFFSETS.map(o => <option key={o.v} value={o.v}>{o.label}</option>)}
      </select>
    </div>
  )
}

function NInput({ value, onChange, suffix, step = 'any', w = 80 }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <input type="number" value={value ?? 0} step={step}
        onChange={e => onChange(e.target.value)}
        style={{
          width: w, background: 'var(--bg3)', border: '1.5px solid var(--border2)',
          color: 'var(--text)', borderRadius: 8, padding: '6px 9px',
          fontSize: 12, fontFamily: 'var(--mono)',
        }} />
      {suffix && <span style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>{suffix}</span>}
    </div>
  )
}

function IBtn({ onClick, title, children, col = 'var(--text3)' }) {
  return (
    <button onClick={onClick} title={title} style={{
      width: 26, height: 26, borderRadius: 7, border: '1px solid var(--border)',
      background: 'var(--bg2)', color: col, cursor: 'pointer',
      fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'var(--mono)', fontWeight: 700, flexShrink: 0,
    }}>{children}</button>
  )
}

function JoinBadge({ value, onChange }) {
  const isAnd = value === 'AND'
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, margin: '1px 0' }}>
      <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
      <button onClick={() => onChange(isAnd ? 'OR' : 'AND')} style={{
        padding: '3px 14px', borderRadius: 20, cursor: 'pointer',
        fontSize: 10, fontFamily: 'var(--mono)', fontWeight: 800,
        border: `1.5px solid ${isAnd ? BLU + '90' : AMB + '90'}`,
        background: isAnd ? BLU + '18' : AMB + '18',
        color: isAnd ? BLU : AMB,
        letterSpacing: '.07em', transition: 'all .15s',
      }}>{value}</button>
      <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
    </div>
  )
}

// ── Condition card ────────────────────────────────────────────────────────────
function CondCard({ cond, idx, total, color, onChange, onRemove, onCopy, onMoveUp, onMoveDown }) {
  const [open, setOpen] = useState(true)
  function s(k, v) { onChange({ ...cond, [k]: v }) }
  const formula = condFormula(cond)

  return (
    <div style={{
      borderRadius: 10,
      border: `1.5px solid ${cond.enabled ? color + '50' : 'var(--border)'}`,
      background: cond.enabled ? `${color}08` : 'rgba(0,0,0,0.1)',
      opacity: cond.enabled ? 1 : 0.5,
      transition: 'opacity .15s',
      overflow: 'hidden',
    }}>
      {/* Topbar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '7px 9px', background: 'rgba(0,0,0,0.2)',
      }}>
        {/* Enable dot */}
        <div onClick={() => s('enabled', !cond.enabled)} style={{
          width: 11, height: 11, borderRadius: '50%', cursor: 'pointer', flexShrink: 0,
          background: cond.enabled ? color : 'var(--border)',
          boxShadow: cond.enabled ? `0 0 7px ${color}` : 'none',
          transition: 'all .15s',
        }} />

        {/* Formula — tap to expand */}
        <div onClick={() => setOpen(o => !o)} style={{
          flex: 1, fontFamily: 'var(--mono)', fontWeight: 700,
          fontSize: 11, color: cond.enabled ? color : 'var(--text3)',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          cursor: 'pointer',
        }}>
          {cond.label ? <span style={{ color: color, opacity: .85 }}>[{cond.label}] </span> : null}
          {formula}
        </div>

        {/* Action icons */}
        <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
          {idx > 0        && <IBtn onClick={onMoveUp}   title="Move up">↑</IBtn>}
          {idx < total-1  && <IBtn onClick={onMoveDown} title="Move down">↓</IBtn>}
          <IBtn onClick={onCopy}   title="Duplicate condition" col={BLU}>⧉</IBtn>
          <IBtn onClick={onRemove} title="Delete" col="var(--red)">×</IBtn>
        </div>
        <span onClick={() => setOpen(o => !o)} style={{ color:'var(--text3)', fontSize:11, cursor:'pointer', flexShrink:0 }}>
          {open ? '▲' : '▼'}
        </span>
      </div>

      {/* Body */}
      {open && (
        <div style={{ padding: '10px 11px 12px', display: 'flex', flexDirection: 'column', gap: 11 }}>

          {/* LABEL / ALERT NAME */}
          <div style={{ padding: '8px 10px', borderRadius: 8, background: `${color}12`, border: `1px solid ${color}30` }}>
            <Lbl>CONDITION LABEL / ALERT NAME</Lbl>
            <input
              value={cond.label || ''}
              onChange={e => s('label', e.target.value)}
              placeholder="e.g. EMA crossover (shows in alert)"
              style={{
                width: '100%', boxSizing: 'border-box',
                background: 'var(--bg3)', border: `1.5px solid ${color}40`,
                color: 'var(--text)', borderRadius: 7, padding: '6px 9px',
                fontSize: 12, fontFamily: 'var(--mono)',
              }}
            />
          </div>

          {/* LEFT SIDE */}
          <div style={{ padding: '9px 10px', borderRadius: 8, background: 'rgba(0,0,0,0.18)' }}>
            <Lbl>LEFT — candle field</Lbl>
            <FSelect
              value={cond.lhsField} offset={cond.lhsOffset}
              onField={v => s('lhsField', v)} onOffset={v => s('lhsOffset', v)}
              color={color}
            />
          </div>

          {/* OPERATOR */}
          <div>
            <Lbl>OPERATOR</Lbl>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {OPS.map(op => (
                <Pill key={op} active={cond.op === op} color={color} onClick={() => s('op', op)}>{op}</Pill>
              ))}
            </div>
          </div>

          {/* RIGHT SIDE — mode select */}
          <div style={{ padding: '9px 10px', borderRadius: 8, background: 'rgba(0,0,0,0.18)' }}>
            <Lbl>RIGHT — compare to</Lbl>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 9 }}>
              {RHS_MODES.map(m => (
                <Pill key={m.id} active={cond.rhsMode === m.id} color={color}
                  onClick={() => s('rhsMode', m.id)} sm>{m.label}</Pill>
              ))}
            </div>

            {/* hint */}
            <div style={{ fontSize: 9, fontFamily:'var(--mono)', color:'var(--text3)', marginBottom: 8, opacity:.75 }}>
              {RHS_MODES.find(m => m.id === cond.rhsMode)?.hint}
            </div>

            {/* Value inputs per mode */}
            {cond.rhsMode === 'number' && (
              <NInput value={cond.rhsNum} onChange={v => s('rhsNum', v)} />
            )}

            {cond.rhsMode === 'field' && (
              <FSelect
                value={cond.rhsField || 'ema20'} offset={cond.rhsOffset ?? 0}
                onField={v => s('rhsField', v)} onOffset={v => s('rhsOffset', v)}
                color={color}
              />
            )}

            {cond.rhsMode === 'mult' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                <FSelect
                  value={cond.rhsField || 'ema20'} offset={cond.rhsOffset ?? 0}
                  onField={v => s('rhsField', v)} onOffset={v => s('rhsOffset', v)}
                  color={color}
                />
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <span style={{ fontFamily:'var(--mono)', color:'var(--text3)', fontSize:13 }}>×</span>
                  <NInput value={cond.rhsMult ?? 1} onChange={v => s('rhsMult', v)} step="0.0001" />
                  <span style={{ fontSize:9, color:'var(--text3)', fontFamily:'var(--mono)' }}>1.5 = ×1.5 · 1.005 = +0.5%</span>
                </div>
              </div>
            )}

            {cond.rhsMode === 'pct' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                <FSelect
                  value={cond.rhsField || 'ema20'} offset={cond.rhsOffset ?? 0}
                  onField={v => s('rhsField', v)} onOffset={v => s('rhsOffset', v)}
                  color={color}
                />
                <NInput value={cond.rhsPct ?? 0} onChange={v => s('rhsPct', v)} step="0.01" suffix="%" />
              </div>
            )}

            {cond.rhsMode === 'pctdiff' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                <FSelect
                  value={cond.rhsField || 'ema20'} offset={cond.rhsOffset ?? 0}
                  onField={v => s('rhsField', v)} onOffset={v => s('rhsOffset', v)}
                  color={color}
                />
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize:11, fontFamily:'var(--mono)', color:'var(--text3)' }}>{cond.op}</span>
                  <NInput value={cond.rhsNum ?? 0} onChange={v => s('rhsNum', v)} step="0.01" suffix="%" />
                </div>
                <div style={{ fontSize:9, fontFamily:'var(--mono)', color:'var(--text3)' }}>
                  (Left / Right − 1) × 100 {cond.op} {cond.rhsNum ?? 0}%
                </div>
              </div>
            )}
          </div>

          {/* Live formula */}
          <div style={{
            fontSize: 10, fontFamily: 'var(--mono)', color: color,
            padding: '5px 9px', borderRadius: 6,
            background: `${color}10`, border: `1px solid ${color}30`,
          }}>
            → {formula}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Pattern editor ────────────────────────────────────────────────────────────
function PatternEditor({ pattern, onChange, onDelete, onMirrorPattern, defaultOpen, allPatternNames }) {
  const [open, setOpen] = useState(!!defaultOpen)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [mirrorPopup, setMirrorPopup] = useState(false)
  const [mirrorName, setMirrorName] = useState('')
  const [mirrorNameAlert, setMirrorNameAlert] = useState('')
  const mirrorInputRef = React.useRef(null)
  const color = pattern.side === 'bull' ? G : R
  const nameRef = React.useRef(null)

  React.useEffect(() => {
    if (defaultOpen && nameRef.current) {
      const t = setTimeout(() => {
        nameRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        nameRef.current?.focus()
        nameRef.current?.select()
      }, 120)
      return () => clearTimeout(t)
    }
  }, [])

  React.useEffect(() => {
    if (mirrorPopup) {
      setMirrorName(pattern.name)
      setTimeout(() => { mirrorInputRef.current?.focus(); mirrorInputRef.current?.select() }, 60)
    }
  }, [mirrorPopup])

  function handleMirrorSave() {
    const name = mirrorName.trim()
    if (!name) {
      setMirrorNameAlert('Please enter a name.')
      return
    }
    if ((allPatternNames || []).some(n => n.toLowerCase() === name.toLowerCase())) {
      setMirrorNameAlert('A pattern with this name already exists.')
      return
    }
    onMirrorPattern(name)
    setMirrorPopup(false)
  }

  const mirroredSide = pattern.side === 'bull' ? 'bear' : 'bull'

  function s(k, v) { onChange({ ...pattern, [k]: v }) }
  function setCond(i, c) { const cs = [...pattern.conditions]; cs[i] = c; s('conditions', cs) }
  function delCond(i)    { s('conditions', pattern.conditions.filter((_,j) => j !== i)) }
  function copyCond(i)   {
    const cs = [...pattern.conditions]
    cs.splice(i + 1, 0, { ...cs[i], id: uid() })
    s('conditions', cs)
  }
  function moveCond(from, to) {
    const cs = [...pattern.conditions]
    const [item] = cs.splice(from, 1); cs.splice(to, 0, item)
    s('conditions', cs)
  }
  function setJoin(i, v) { setCond(i, { ...pattern.conditions[i], joinNext: v }) }
  function toggleTf(tf)  { s('tfs', pattern.tfs.includes(tf) ? pattern.tfs.filter(t => t !== tf) : [...pattern.tfs, tf]) }

  const active = pattern.conditions.filter(c => c.enabled).length

  return (
    <div style={{ position: 'relative' }}>

      {/* ── Mirror rename popup ── */}
      {mirrorPopup && (
        <>
          {/* Backdrop */}
          <div onClick={() => setMirrorPopup(false)} style={{
            position: 'fixed', inset: 0, zIndex: 99, background: 'rgba(0,0,0,0.45)',
          }} />
          {/* Card */}
          <div style={{
            position: 'absolute', top: 6, left: 0, right: 0, zIndex: 100,
            borderRadius: 13, padding: '18px 16px',
            background: 'var(--bg1)',
            border: `1.5px solid ${BLU}70`,
            boxShadow: `0 10px 40px rgba(0,0,0,0.65), 0 0 0 1px ${BLU}18`,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 18 }}>⇄</span>
              <div style={{ fontFamily: 'var(--mono)', fontWeight: 800, fontSize: 14, color: BLU }}>
                Mirror Pattern
              </div>
            </div>
            <div style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--text3)', marginBottom: 14, lineHeight: 1.6 }}>
              Creates a new {mirroredSide === 'bull' ? '🟢 Bull' : '🔴 Bear'} pattern with all operators flipped.
              Give it a name before saving.
            </div>
            <div style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--text3)', fontWeight: 700,
              letterSpacing: '.07em', marginBottom: 6 }}>NAME</div>
            <input
              ref={mirrorInputRef}
              value={mirrorName}
              onChange={e => { setMirrorName(e.target.value); setMirrorNameAlert('') }}
              onKeyDown={e => { if (e.key === 'Enter') handleMirrorSave(); if (e.key === 'Escape') setMirrorPopup(false) }}
              placeholder="Enter a new name…"
              style={{
                width: '100%', boxSizing: 'border-box',
                background: 'var(--bg3)',
                border: `1.5px solid ${mirrorNameAlert ? 'var(--red)' : BLU + '80'}`,
                color: 'var(--text)', borderRadius: 8, padding: '10px 12px',
                fontSize: 13, fontWeight: 700, fontFamily: 'inherit',
                boxShadow: mirrorNameAlert ? '0 0 0 3px rgba(255,60,60,0.18)' : `0 0 0 3px ${BLU}18`,
                outline: 'none', marginBottom: mirrorNameAlert ? 6 : 13,
                transition: 'border .2s, box-shadow .2s',
              }}
            />
            {mirrorNameAlert && (
              <div style={{
                fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--red)',
                marginBottom: 10, padding: '5px 8px', borderRadius: 6,
                background: 'rgba(255,60,60,0.08)', border: '1px solid rgba(255,60,60,0.25)',
              }}>
                ⚠ {mirrorNameAlert}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={handleMirrorSave} style={{
                flex: 1, padding: '10px', borderRadius: 8, cursor: 'pointer',
                fontFamily: 'var(--mono)', fontWeight: 800, fontSize: 12,
                border: `1.5px solid ${BLU}70`, background: `${BLU}25`, color: BLU,
              }}>✓ Save &amp; Add Pattern</button>
              <button onClick={() => setMirrorPopup(false)} style={{
                padding: '10px 15px', borderRadius: 8, cursor: 'pointer',
                fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 12,
                border: '1px solid var(--border)', background: 'var(--bg3)', color: 'var(--text3)',
              }}>Cancel</button>
            </div>
          </div>
        </>
      )}

    <div style={{
      borderRadius: 13,
      border: `1.5px solid ${pattern.enabled ? color + '55' : 'var(--border)'}`,
      background: 'var(--bg1)', overflow: 'hidden',
      opacity: mirrorPopup ? 0.3 : 1,
      transition: 'opacity .15s',
      pointerEvents: mirrorPopup ? 'none' : 'auto',
    }}>
      {/* Header */}
      <div
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 9, padding: '12px 13px', cursor: 'pointer',
          background: pattern.enabled
            ? pattern.side === 'bull' ? 'rgba(0,230,118,0.07)' : 'rgba(255,60,80,0.07)'
            : 'transparent',
        }}
      >
        <span style={{ fontSize: 22 }}>{pattern.icon}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 14, color: pattern.enabled ? color : 'var(--text2)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pattern.name}</div>
          <div style={{ fontSize: 9, fontFamily: 'var(--mono)', color: 'var(--text3)', marginTop: 3 }}>
            {pattern.side.toUpperCase()} · {active} cond{active !== 1 ? 's' : ''} · {pattern.tfs.join(' ') || 'no TF'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }} onClick={e => e.stopPropagation()}>
          <div onClick={() => s('enabled', !pattern.enabled)} style={{
            width: 36, height: 20, borderRadius: 10, cursor: 'pointer', flexShrink: 0,
            background: pattern.enabled ? color : 'var(--bg3)',
            border: `1.5px solid ${pattern.enabled ? color : 'var(--border)'}`,
            position: 'relative', transition: 'all .2s',
          }}>
            <div style={{
              position: 'absolute', top: 3, left: pattern.enabled ? 17 : 3,
              width: 12, height: 12, borderRadius: '50%', background: '#fff', transition: 'left .2s',
            }} />
          </div>
          <button onClick={() => setMirrorPopup(true)} title="Create mirrored pattern (flips Bull↔Bear + all operators)" style={{
            width: 28, height: 28, borderRadius: 7,
            border: '1px solid rgba(100,180,255,0.35)', background: 'rgba(100,180,255,0.08)',
            color: BLU, cursor: 'pointer', fontSize: 15,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 700,
          }}>⇄</button>

          {confirmDelete ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--red)', whiteSpace: 'nowrap' }}>Delete?</span>
              <button onClick={onDelete} style={{
                padding: '3px 8px', borderRadius: 6, cursor: 'pointer',
                fontSize: 10, fontFamily: 'var(--mono)', fontWeight: 800,
                border: '1px solid rgba(255,60,60,0.5)', background: 'rgba(255,60,60,0.18)',
                color: 'var(--red)',
              }}>Yes</button>
              <button onClick={() => setConfirmDelete(false)} style={{
                padding: '3px 8px', borderRadius: 6, cursor: 'pointer',
                fontSize: 10, fontFamily: 'var(--mono)', fontWeight: 800,
                border: '1px solid var(--border)', background: 'var(--bg3)',
                color: 'var(--text2)',
              }}>No</button>
            </div>
          ) : (
            <button onClick={() => setConfirmDelete(true)} style={{
              width: 28, height: 28, borderRadius: 7,
              border: '1px solid rgba(255,60,60,0.3)', background: 'rgba(255,60,60,0.07)',
              color: 'var(--red)', cursor: 'pointer', fontSize: 16,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>🗑</button>
          )}
        </div>
        <span style={{ color: 'var(--text3)', fontSize: 12 }}>{open ? '▲' : '▼'}</span>
      </div>

      {/* Body */}
      {open && (
        <div style={{ borderTop: '1px solid var(--border)', padding: '13px', display: 'flex', flexDirection: 'column', gap: 13 }}>

          {/* Name + icon */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <div>
              <Lbl>ICON</Lbl>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {ICONS.map(ic => (
                  <button key={ic} onClick={() => s('icon', ic)} style={{
                    width: 32, height: 32, borderRadius: 8, cursor: 'pointer', fontSize: 16,
                    border: `1.5px solid ${pattern.icon === ic ? color : 'var(--border)'}`,
                    background: pattern.icon === ic ? `${color}22` : 'var(--bg2)',
                  }}>{ic}</button>
                ))}
              </div>
            </div>
            <div style={{ flex: 1, minWidth: 140 }}>
              <Lbl>NAME</Lbl>
              <input ref={nameRef} value={pattern.name} onChange={e => s('name', e.target.value)} style={{
                width: '100%', boxSizing: 'border-box',
                background: 'var(--bg3)', border: `1.5px solid ${defaultOpen ? BLU + 'cc' : 'var(--border2)'}`,
                color: 'var(--text)', borderRadius: 8, padding: '8px 10px',
                fontSize: 13, fontWeight: 700,
                boxShadow: defaultOpen ? `0 0 0 2px ${BLU}33` : 'none',
                transition: 'border .3s, box-shadow .3s',
              }} />
            </div>
          </div>

          {/* Side + TF */}
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            <div>
              <Lbl>DIRECTION</Lbl>
              <div style={{ display: 'flex', gap: 5 }}>
                {['bull','bear'].map(sd => (
                  <Pill key={sd} active={pattern.side === sd} color={sd === 'bull' ? G : R}
                    onClick={() => s('side', sd)}>{sd === 'bull' ? '🟢 Bull' : '🔴 Bear'}</Pill>
                ))}
              </div>
            </div>
            <div style={{ flex: 1 }}>
              <Lbl>SCAN ON TIMEFRAMES</Lbl>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {TF_LIST.map(tf => (
                  <Pill key={tf} active={pattern.tfs.includes(tf)} color={color}
                    onClick={() => toggleTf(tf)} sm>{tf}</Pill>
                ))}
              </div>
              {pattern.tfs.length === 0 && (
                <div style={{ fontSize: 9, color: 'var(--red)', fontFamily: 'var(--mono)', marginTop: 4 }}>⚠ No TF — won't scan</div>
              )}
            </div>
          </div>

          {/* Conditions */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <Lbl>CONDITIONS</Lbl>
              <span style={{ fontSize: 9, fontFamily: 'var(--mono)', color: 'var(--text3)' }}>
                {active} active · all must pass (per AND/OR)
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {pattern.conditions.map((cond, idx) => (
                <React.Fragment key={cond.id}>
                  <CondCard
                    cond={cond} idx={idx} total={pattern.conditions.length} color={condColor(idx)}
                    onChange={c => setCond(idx, c)}
                    onRemove={() => delCond(idx)}
                    onCopy={() => copyCond(idx)}
                    onMoveUp={() => moveCond(idx, idx - 1)}
                    onMoveDown={() => moveCond(idx, idx + 1)}
                  />
                  {idx < pattern.conditions.length - 1 && (
                    <JoinBadge value={cond.joinNext || 'AND'} onChange={v => setJoin(idx, v)} />
                  )}
                </React.Fragment>
              ))}
            </div>

            <button
              onClick={() => s('conditions', [...pattern.conditions, blankCond()])}
              style={{
                marginTop: 8, width: '100%', padding: '9px',
                borderRadius: 8, cursor: 'pointer', fontSize: 12,
                fontFamily: 'var(--mono)', fontWeight: 700,
                border: `1.5px dashed ${color}55`,
                background: `${color}08`, color,
              }}
            >+ Add Condition</button>
          </div>
        </div>
      )}
    </div>
    </div>
  )
}

// ── Main tab ──────────────────────────────────────────────────────────────────
export default function PatternBuilderTab({ settings, update }) {
  const patterns = useMemo(() => settings.customPatterns || [], [settings.customPatterns])
  const trash    = useMemo(() => settings.deletedPatterns || [], [settings.deletedPatterns])
  const [newId, setNewId] = useState(null)
  const [trashOpen, setTrashOpen] = useState(false)

  function savePatterns(ps) { update({ customPatterns: ps }) }
  function saveTrash(ts)    { update({ deletedPatterns: ts }) }

  function add() { const p = blankPattern(); setNewId(p.id); savePatterns([...patterns, p]) }
  function upd(i, p) { const ps = [...patterns]; ps[i] = p; savePatterns(ps) }

  function del(i) {
    const removed = { ...patterns[i], deletedAt: Date.now() }
    const newTrash = [removed, ...trash].slice(0, 50)
    savePatterns(patterns.filter((_, j) => j !== i))
    saveTrash(newTrash)
  }

  function restore(i) {
    const p = { ...trash[i], deletedAt: undefined }
    setNewId(p.id)
    savePatterns([...patterns, p])
    saveTrash(trash.filter((_, j) => j !== i))
  }

  function purgeOne(i) {
    saveTrash(trash.filter((_, j) => j !== i))
  }

  function purgeAll() {
    saveTrash([])
  }

  function mirrorPattern(i, customName) {
    const src = patterns[i]
    const mirrored = {
      ...src,
      id: `custom_${uid()}`,
      name: customName,
      side: src.side === 'bull' ? 'bear' : 'bull',
      conditions: src.conditions.map(c => ({
        ...c,
        id: uid(),
        op: MIRROR_OP[c.op] ?? c.op,
        label: c.label ? `Mirror of ${c.label}` : '',
      })),
      createdAt: Date.now(),
    }
    const ps = [...patterns]
    ps.splice(i + 1, 0, mirrored)
    setNewId(null)   // don't auto-open — stay at pattern list home
    savePatterns(ps)
  }

  const bull = patterns.filter(p => p.side === 'bull' && p.enabled).length
  const bear = patterns.filter(p => p.side === 'bear' && p.enabled).length

  return (
    <div style={{ padding: '14px 10px 90px', maxWidth: 620, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 17 }}>🔧 Pattern Builder</div>
          <div style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--mono)', marginTop: 2 }}>
            Visual condition editor · live on every scan
          </div>
        </div>
        <div style={{ display: 'flex', gap: 5 }}>
          <span style={{ fontSize: 10, fontFamily: 'var(--mono)', fontWeight: 700, padding: '3px 9px', borderRadius: 6,
            background: 'rgba(0,230,118,0.1)', color: G, border: '1px solid rgba(0,230,118,0.3)' }}>🟢 {bull}</span>
          <span style={{ fontSize: 10, fontFamily: 'var(--mono)', fontWeight: 700, padding: '3px 9px', borderRadius: 6,
            background: 'rgba(255,60,80,0.1)', color: R, border: '1px solid rgba(255,60,80,0.3)' }}>🔴 {bear}</span>
        </div>
      </div>

      {/* Quick reference */}
      <div style={{
        marginBottom: 12, padding: '9px 12px', borderRadius: 9,
        background: 'rgba(179,136,255,0.07)', border: '1px solid rgba(179,136,255,0.22)',
        fontSize: 10, fontFamily: 'var(--mono)', color: A, lineHeight: 1.75,
      }}>
        <b>× Mult</b>: EMA20[0] &gt; EMA20[-2] × 1.5 &nbsp;·&nbsp;
        <b>± %</b>: EMA20[0] &gt; EMA20[-2] + 0.35% &nbsp;·&nbsp;
        <b>% Diff</b>: how many % LHS is above/below RHS<br/>
        Tap <b style={{color: BLU}}>AND</b>/<b style={{color:AMB}}>OR</b> badge between conditions to switch logic · <b>⧉</b> copies a condition
      </div>

      {/* List */}
      {patterns.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--text3)', fontFamily: 'var(--mono)' }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>🔬</div>
          <div style={{ fontSize: 13 }}>No custom patterns yet</div>
          <div style={{ fontSize: 10, marginTop: 5, opacity: .7 }}>Tap + New Pattern to start</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginBottom: 10 }}>
          {patterns.map((p, i) => (
            <PatternEditor
              key={p.id} pattern={p} defaultOpen={p.id === newId}
              onChange={np => upd(i, np)} onDelete={() => del(i)}
              onMirrorPattern={(name) => mirrorPattern(i, name)}
              allPatternNames={patterns.map(x => x.name)}
            />
          ))}
        </div>
      )}

      {/* Add button */}
      <button onClick={add} style={{
        width: '100%', padding: '13px', borderRadius: 10, cursor: 'pointer',
        fontSize: 13, fontFamily: 'var(--mono)', fontWeight: 800,
        border: '2px dashed rgba(179,136,255,0.4)',
        background: 'rgba(179,136,255,0.06)', color: A,
      }}
        onMouseEnter={e => e.currentTarget.style.background = 'rgba(179,136,255,0.13)'}
        onMouseLeave={e => e.currentTarget.style.background = 'rgba(179,136,255,0.06)'}
      >+ New Pattern</button>

      {/* ── Trash Bin ── */}
      <div style={{ marginTop: 22 }}>
        {/* Trash header toggle */}
        <button
          onClick={() => setTrashOpen(o => !o)}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 8,
            padding: '10px 13px', borderRadius: 10, cursor: 'pointer',
            border: '1.5px solid rgba(255,160,0,0.25)',
            background: trashOpen ? 'rgba(255,160,0,0.07)' : 'rgba(255,160,0,0.03)',
            color: AMB, fontFamily: 'var(--mono)', fontWeight: 800, fontSize: 13,
            transition: 'background .15s',
          }}
        >
          <span style={{ fontSize: 16 }}>🗑</span>
          <span style={{ flex: 1, textAlign: 'left' }}>Trash Bin</span>
          <span style={{
            fontSize: 10, padding: '2px 7px', borderRadius: 5,
            background: trash.length ? 'rgba(255,160,0,0.18)' : 'rgba(255,255,255,0.05)',
            border: `1px solid ${trash.length ? 'rgba(255,160,0,0.4)' : 'var(--border)'}`,
          }}>{trash.length} / 50</span>
          <span style={{ fontSize: 11, opacity: .6 }}>{trashOpen ? '▲' : '▼'}</span>
        </button>

        {trashOpen && (
          <div style={{
            marginTop: 6, borderRadius: 10, overflow: 'hidden',
            border: '1.5px solid rgba(255,160,0,0.2)',
            background: 'rgba(255,160,0,0.03)',
          }}>
            {trash.length === 0 ? (
              <div style={{ padding: '28px 16px', textAlign: 'center', fontFamily: 'var(--mono)', color: 'var(--text3)', fontSize: 11 }}>
                Trash is empty
              </div>
            ) : (
              <>
                {/* Purge all */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '8px 10px 4px' }}>
                  <button onClick={purgeAll} style={{
                    fontSize: 10, fontFamily: 'var(--mono)', fontWeight: 700,
                    padding: '4px 11px', borderRadius: 6, cursor: 'pointer',
                    border: '1px solid rgba(255,60,60,0.3)', background: 'rgba(255,60,60,0.07)',
                    color: 'var(--red)',
                  }}>Clear all</button>
                </div>

                {/* Trash items */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {trash.map((p, i) => {
                    const c = p.side === 'bull' ? G : R
                    const ago = p.deletedAt
                      ? (() => {
                          const s = Math.floor((Date.now() - p.deletedAt) / 1000)
                          if (s < 60) return `${s}s ago`
                          if (s < 3600) return `${Math.floor(s/60)}m ago`
                          if (s < 86400) return `${Math.floor(s/3600)}h ago`
                          return `${Math.floor(s/86400)}d ago`
                        })()
                      : ''
                    return (
                      <div key={p.id} style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '9px 11px',
                        borderBottom: i < trash.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                        background: 'transparent',
                      }}>
                        <span style={{ fontSize: 18, flexShrink: 0 }}>{p.icon}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 700, fontSize: 12, color: c,
                            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {p.name}
                          </div>
                          <div style={{ fontSize: 9, fontFamily: 'var(--mono)', color: 'var(--text3)', marginTop: 2 }}>
                            {p.side.toUpperCase()} · {p.conditions?.length ?? 0} conds · {p.tfs?.join(' ') || 'no TF'} · deleted {ago}
                          </div>
                        </div>
                        <button onClick={() => restore(i)} title="Restore pattern" style={{
                          fontSize: 10, fontFamily: 'var(--mono)', fontWeight: 700,
                          padding: '4px 10px', borderRadius: 6, cursor: 'pointer', flexShrink: 0,
                          border: '1px solid rgba(0,230,118,0.35)', background: 'rgba(0,230,118,0.08)',
                          color: G,
                        }}>↩ Restore</button>
                        <button onClick={() => purgeOne(i)} title="Delete permanently" style={{
                          width: 26, height: 26, borderRadius: 6, cursor: 'pointer', flexShrink: 0,
                          border: '1px solid rgba(255,60,60,0.25)', background: 'rgba(255,60,60,0.06)',
                          color: 'var(--red)', fontSize: 13,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>×</button>
                      </div>
                    )
                  })}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
