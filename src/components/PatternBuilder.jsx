// ─── Pattern Builder ──────────────────────────────────────────────────────────
// Visual editor: build custom scan patterns with EMA/RSI/OHLCV conditions
// on any candle offset. Compiles to a live logic() function at runtime.

import React, { useState, useCallback, useMemo, useRef } from 'react'

// ── Candle fields the user can pick ──────────────────────────────────────────
const CANDLE_FIELDS = [
  { id: 'close',  label: 'Close',   group: 'OHLCV' },
  { id: 'open',   label: 'Open',    group: 'OHLCV' },
  { id: 'high',   label: 'High',    group: 'OHLCV' },
  { id: 'low',    label: 'Low',     group: 'OHLCV' },
  { id: 'volume', label: 'Volume',  group: 'OHLCV' },
  { id: 'ema9',   label: 'EMA 9',   group: 'EMA' },
  { id: 'ema20',  label: 'EMA 20',  group: 'EMA' },
  { id: 'ema40',  label: 'EMA 40',  group: 'EMA' },
  { id: 'ema16',  label: 'EMA 16',  group: 'EMA' },
  { id: 'ema25',  label: 'EMA 25',  group: 'EMA' },
  { id: 'ema50',  label: 'EMA 50',  group: 'EMA' },
  { id: 'rsi',    label: 'RSI 14',  group: 'RSI' },
  // Computed shortcuts
  { id: 'body',         label: 'Body Size',      group: 'Calc', computed: c => Math.abs(c.close - c.open) },
  { id: 'range',        label: 'Full Range',      group: 'Calc', computed: c => c.high - c.low },
  { id: 'bodyPct',      label: 'Body %',          group: 'Calc', computed: c => c.high !== c.low ? Math.abs(c.close - c.open) / (c.high - c.low) * 100 : 0 },
  { id: 'isGreen',      label: 'Is Green (1/0)',  group: 'Calc', computed: c => c.close > c.open ? 1 : 0 },
  { id: 'isRed',        label: 'Is Red (1/0)',    group: 'Calc', computed: c => c.close < c.open ? 1 : 0 },
  { id: 'upperWick',    label: 'Upper Wick',      group: 'Calc', computed: c => c.high - Math.max(c.close, c.open) },
  { id: 'lowerWick',    label: 'Lower Wick',      group: 'Calc', computed: c => Math.min(c.close, c.open) - c.low },
]
const FIELD_MAP = Object.fromEntries(CANDLE_FIELDS.map(f => [f.id, f]))

// Right-hand side: either another candle field or a literal number / multiplier
const RHS_TYPES = [
  { id: 'number',   label: 'Number'       },
  { id: 'field',    label: 'Candle Field' },
  { id: 'multiply', label: 'Field × Mult' },
  { id: 'pct',      label: 'Field + %'   },
]

const OPERATORS = [
  { id: '>',  label: '>'  },
  { id: '>=', label: '>=' },
  { id: '<',  label: '<'  },
  { id: '<=', label: '<=' },
  { id: '==', label: '='  },
  { id: '!=', label: '≠'  },
]

const CANDLE_OFFSETS = Array.from({ length: 11 }, (_, i) => ({
  id: -i,
  label: i === 0 ? 'Current [0]' : `Previous [-${i}]`,
}))

// ── Colours ───────────────────────────────────────────────────────────────────
const GREEN  = 'var(--green)'
const RED    = 'var(--red)'
const ACCENT = '#b388ff'

// ── New blank condition ───────────────────────────────────────────────────────
function blankCond() {
  return {
    id: Date.now() + Math.random(),
    lhsField: 'close',
    lhsOffset: 0,
    op: '>',
    rhsType: 'number',
    rhsNumber: 0,
    rhsField: 'close',
    rhsOffset: 0,
    rhsMult: 1,
    rhsPct: 0,
    enabled: true,
  }
}

// ── New blank pattern ─────────────────────────────────────────────────────────
export function blankPattern() {
  return {
    id: `custom_${Date.now()}`,
    name: 'My Pattern',
    side: 'bull',
    icon: '⭐',
    tfs: ['15m', '1h'],
    conditions: [blankCond()],
    enabled: true,
    createdAt: Date.now(),
  }
}

// ── Compile a pattern's condition array → a logic(candles) function ───────────
export function compilePattern(pattern) {
  return function logic(candles) {
    if (!candles || candles.length < 10) return null
    const len = candles.length

    function getC(offset) {
      const idx = len - 1 + offset  // offset is 0 or negative
      if (idx < 0) return null
      return candles[idx]
    }

    function getVal(candle, fieldId) {
      if (!candle) return null
      const f = FIELD_MAP[fieldId]
      if (!f) return null
      if (f.computed) return f.computed(candle)
      const v = candle[fieldId]
      return v == null ? null : v
    }

    for (const cond of pattern.conditions) {
      if (!cond.enabled) continue

      const lhsC = getC(cond.lhsOffset)
      const lhsV = getVal(lhsC, cond.lhsField)
      if (lhsV == null) return null

      let rhsV
      if (cond.rhsType === 'number') {
        rhsV = parseFloat(cond.rhsNumber) || 0
      } else if (cond.rhsType === 'field') {
        const rhsC = getC(cond.rhsOffset)
        rhsV = getVal(rhsC, cond.rhsField)
        if (rhsV == null) return null
      } else if (cond.rhsType === 'multiply') {
        const rhsC = getC(cond.rhsOffset)
        const base = getVal(rhsC, cond.rhsField)
        if (base == null) return null
        rhsV = base * (parseFloat(cond.rhsMult) || 1)
      } else if (cond.rhsType === 'pct') {
        const rhsC = getC(cond.rhsOffset)
        const base = getVal(rhsC, cond.rhsField)
        if (base == null) return null
        rhsV = base * (1 + (parseFloat(cond.rhsPct) || 0) / 100)
      }

      let pass = false
      if (cond.op === '>')  pass = lhsV >  rhsV
      if (cond.op === '>=') pass = lhsV >= rhsV
      if (cond.op === '<')  pass = lhsV <  rhsV
      if (cond.op === '<=') pass = lhsV <= rhsV
      if (cond.op === '==') pass = Math.abs(lhsV - rhsV) < 1e-9
      if (cond.op === '!=') pass = Math.abs(lhsV - rhsV) >= 1e-9

      if (!pass) return null
    }

    // All conditions passed — build result object like built-in scanners
    const curr = candles[len - 1]
    const prev = candles[len - 2] || curr
    const refLow  = pattern.side === 'bull' ? Math.min(curr.low, prev.low) : null
    const refHigh = pattern.side === 'bear' ? Math.max(curr.high, prev.high) : null
    const gainPct = pattern.side === 'bull'
      ? ((curr.close - (refLow || curr.low)) / (refLow || curr.low) * 100).toFixed(2)
      : (((refHigh || curr.high) - curr.close) / curr.close * 100).toFixed(2)

    return {
      candleCount: 5,
      gainPct,
      highestClose: curr.close,
      lowestOpen: curr.open,
      conds: pattern.conditions
        .filter(c => c.enabled)
        .map(c => `✓ ${condLabel(c)}`),
      run: candles.slice(len - 8, len),
      ema9:  curr.ema9,
      ema20: curr.ema20,
      rsi:   curr.rsi,
    }
  }
}

// ── Human-readable label for a condition ─────────────────────────────────────
function condLabel(cond) {
  const lhsName = FIELD_MAP[cond.lhsField]?.label || cond.lhsField
  const lhsOff  = cond.lhsOffset === 0 ? '' : `[${cond.lhsOffset}]`
  const opStr   = cond.op
  let rhsStr = ''
  if (cond.rhsType === 'number') {
    rhsStr = String(cond.rhsNumber)
  } else {
    const rhsName = FIELD_MAP[cond.rhsField]?.label || cond.rhsField
    const rhsOff  = cond.rhsOffset === 0 ? '' : `[${cond.rhsOffset}]`
    if (cond.rhsType === 'field') rhsStr = `${rhsName}${rhsOff}`
    if (cond.rhsType === 'multiply') rhsStr = `${rhsName}${rhsOff} × ${cond.rhsMult}`
    if (cond.rhsType === 'pct') {
      const sign = cond.rhsPct >= 0 ? '+' : ''
      rhsStr = `${rhsName}${rhsOff} ${sign}${cond.rhsPct}%`
    }
  }
  return `${lhsName}${lhsOff} ${opStr} ${rhsStr}`
}

// ── Tiny styled select ────────────────────────────────────────────────────────
function Sel({ value, onChange, children, style = {} }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{
        background: 'var(--bg3)', border: '1px solid var(--border2)',
        color: 'var(--text)', borderRadius: 6, padding: '5px 7px',
        fontSize: 11, fontFamily: 'var(--mono)', cursor: 'pointer',
        ...style,
      }}
    >
      {children}
    </select>
  )
}

// Tiny number input
function Num({ value, onChange, step = 'any', style = {} }) {
  return (
    <input
      type="number"
      value={value}
      step={step}
      onChange={e => onChange(e.target.value)}
      style={{
        background: 'var(--bg3)', border: '1px solid var(--border2)',
        color: 'var(--text)', borderRadius: 6, padding: '5px 7px',
        fontSize: 11, fontFamily: 'var(--mono)', width: 80,
        ...style,
      }}
    />
  )
}

// ── Single condition row ──────────────────────────────────────────────────────
function CondRow({ cond, onChange, onRemove, color }) {
  function set(key, val) { onChange({ ...cond, [key]: val }) }

  const groups = useMemo(() => {
    const g = {}
    CANDLE_FIELDS.forEach(f => { (g[f.group] = g[f.group] || []).push(f) })
    return g
  }, [])

  function FieldSel({ value, onChange: onCh }) {
    return (
      <Sel value={value} onChange={onCh}>
        {Object.entries(groups).map(([grp, fields]) => (
          <optgroup key={grp} label={grp}>
            {fields.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
          </optgroup>
        ))}
      </Sel>
    )
  }

  return (
    <div style={{
      background: 'rgba(0,0,0,0.18)', borderRadius: 9,
      border: `1px solid ${cond.enabled ? color + '44' : 'var(--border)'}`,
      padding: '10px 10px 10px 12px', opacity: cond.enabled ? 1 : 0.45,
      transition: 'all .15s',
    }}>
      {/* Header row: enabled toggle + remove */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          {/* Toggle */}
          <div
            onClick={() => set('enabled', !cond.enabled)}
            style={{
              width: 30, height: 17, borderRadius: 9, cursor: 'pointer',
              background: cond.enabled ? color : 'var(--bg3)',
              border: `1.5px solid ${cond.enabled ? color : 'var(--border)'}`,
              position: 'relative', transition: 'all .18s', flexShrink: 0,
            }}
          >
            <div style={{
              position: 'absolute', top: 2, left: cond.enabled ? 14 : 2,
              width: 10, height: 10, borderRadius: '50%',
              background: '#fff', transition: 'left .18s',
            }} />
          </div>
          <span style={{ fontSize: 9, fontFamily: 'var(--mono)', fontWeight: 700, color: 'var(--text3)', letterSpacing: '.06em' }}>
            {cond.enabled ? 'ON' : 'OFF'}
          </span>
        </div>
        <button onClick={onRemove} style={{
          width: 22, height: 22, borderRadius: 6, border: '1px solid var(--border)',
          background: 'rgba(255,60,60,0.08)', color: 'var(--red)',
          cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>×</button>
      </div>

      {/* LHS */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, alignItems: 'center', marginBottom: 7 }}>
        <span style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--text3)', minWidth: 26 }}>IF</span>
        <FieldSel value={cond.lhsField} onChange={v => set('lhsField', v)} />
        <Sel value={cond.lhsOffset} onChange={v => set('lhsOffset', parseInt(v))}>
          {CANDLE_OFFSETS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
        </Sel>
      </div>

      {/* Operator */}
      <div style={{ display: 'flex', gap: 5, alignItems: 'center', marginBottom: 7 }}>
        <span style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--text3)', minWidth: 26 }}>IS</span>
        <div style={{ display: 'flex', gap: 3 }}>
          {OPERATORS.map(op => (
            <button key={op.id} onClick={() => set('op', op.id)} style={{
              padding: '4px 8px', borderRadius: 5, cursor: 'pointer', fontSize: 11,
              fontFamily: 'var(--mono)', fontWeight: 700,
              border: `1.5px solid ${cond.op === op.id ? color : 'var(--border)'}`,
              background: cond.op === op.id ? `${color}22` : 'var(--bg2)',
              color: cond.op === op.id ? color : 'var(--text3)',
              transition: 'all .12s',
            }}>{op.label}</button>
          ))}
        </div>
      </div>

      {/* RHS type */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, alignItems: 'center' }}>
        <span style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--text3)', minWidth: 26 }}>TO</span>
        <Sel value={cond.rhsType} onChange={v => set('rhsType', v)}>
          {RHS_TYPES.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
        </Sel>

        {cond.rhsType === 'number' && (
          <Num value={cond.rhsNumber} onChange={v => set('rhsNumber', v)} />
        )}

        {cond.rhsType === 'field' && (<>
          <FieldSel value={cond.rhsField} onChange={v => set('rhsField', v)} />
          <Sel value={cond.rhsOffset} onChange={v => set('rhsOffset', parseInt(v))}>
            {CANDLE_OFFSETS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
          </Sel>
        </>)}

        {cond.rhsType === 'multiply' && (<>
          <FieldSel value={cond.rhsField} onChange={v => set('rhsField', v)} />
          <Sel value={cond.rhsOffset} onChange={v => set('rhsOffset', parseInt(v))}>
            {CANDLE_OFFSETS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
          </Sel>
          <span style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>×</span>
          <Num value={cond.rhsMult} onChange={v => set('rhsMult', v)} step="0.0001" style={{ width: 72 }} />
        </>)}

        {cond.rhsType === 'pct' && (<>
          <FieldSel value={cond.rhsField} onChange={v => set('rhsField', v)} />
          <Sel value={cond.rhsOffset} onChange={v => set('rhsOffset', parseInt(v))}>
            {CANDLE_OFFSETS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
          </Sel>
          <span style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>+</span>
          <Num value={cond.rhsPct} onChange={v => set('rhsPct', v)} step="0.1" style={{ width: 65 }} />
          <span style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>%</span>
        </>)}
      </div>

      {/* Preview label */}
      <div style={{ marginTop: 8, fontSize: 9, fontFamily: 'var(--mono)', color: color, opacity: 0.75 }}>
        → {condLabel(cond)}
      </div>
    </div>
  )
}

// ── Pattern editor panel (one pattern) ───────────────────────────────────────
const ICONS = ['⭐','💹','📈','📉','🚀','💣','🎯','⚡','🔥','💎','🌊','🧲']
const TF_LIST = ['1m','3m','5m','15m','30m','1h','4h','1d']

function PatternEditor({ pattern, onChange, onDelete, isNew }) {
  const [collapsed, setCollapsed] = useState(!isNew)
  const color = pattern.side === 'bull' ? GREEN : RED

  function set(key, val) { onChange({ ...pattern, [key]: val }) }

  function setCond(idx, newCond) {
    const conds = [...pattern.conditions]
    conds[idx] = newCond
    set('conditions', conds)
  }

  function removeCond(idx) {
    set('conditions', pattern.conditions.filter((_, i) => i !== idx))
  }

  function addCond() {
    set('conditions', [...pattern.conditions, blankCond()])
  }

  function toggleTf(tf) {
    const tfs = pattern.tfs.includes(tf)
      ? pattern.tfs.filter(t => t !== tf)
      : [...pattern.tfs, tf]
    set('tfs', tfs)
  }

  const enabledConds = pattern.conditions.filter(c => c.enabled).length

  return (
    <div style={{
      borderRadius: 12,
      border: `1.5px solid ${pattern.enabled ? color + '55' : 'var(--border)'}`,
      background: pattern.enabled
        ? pattern.side === 'bull' ? 'rgba(0,230,118,0.05)' : 'rgba(255,60,80,0.05)'
        : 'var(--bg2)',
      opacity: pattern.enabled ? 1 : 0.6,
      transition: 'all .18s',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '11px 13px', cursor: 'pointer' }}
        onClick={() => setCollapsed(c => !c)}>
        <span style={{ fontSize: 20 }}>{pattern.icon}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: pattern.enabled ? color : 'var(--text2)',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {pattern.name}
          </div>
          <div style={{ fontSize: 9, fontFamily: 'var(--mono)', color: 'var(--text3)', marginTop: 2 }}>
            {pattern.side.toUpperCase()} · {enabledConds} condition{enabledConds !== 1 ? 's' : ''} · {pattern.tfs.join(', ') || 'no TF'}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }} onClick={e => e.stopPropagation()}>
          {/* Enable toggle */}
          <div onClick={() => set('enabled', !pattern.enabled)} style={{
            width: 34, height: 19, borderRadius: 10, cursor: 'pointer',
            background: pattern.enabled ? color : 'var(--bg3)',
            border: `1.5px solid ${pattern.enabled ? color : 'var(--border)'}`,
            position: 'relative', transition: 'all .2s', flexShrink: 0,
          }}>
            <div style={{
              position: 'absolute', top: 2.5, left: pattern.enabled ? 16 : 2.5,
              width: 11, height: 11, borderRadius: '50%',
              background: '#fff', transition: 'left .2s',
            }} />
          </div>
          {/* Delete */}
          <button onClick={onDelete} style={{
            width: 26, height: 26, borderRadius: 7,
            border: '1px solid rgba(255,60,60,0.3)', background: 'rgba(255,60,60,0.08)',
            color: 'var(--red)', cursor: 'pointer', fontSize: 13,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>🗑</button>
        </div>
        <span style={{ color: 'var(--text3)', fontSize: 11, flexShrink: 0, marginLeft: 2 }}>
          {collapsed ? '▼' : '▲'}
        </span>
      </div>

      {/* Body */}
      {!collapsed && (
        <div style={{ borderTop: '1px solid var(--border)', padding: '13px' }}>

          {/* Name + icon + side */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 13 }}>
            {/* Icon picker */}
            <div>
              <div style={{ fontSize: 9, fontFamily: 'var(--mono)', color: 'var(--text3)', marginBottom: 4, fontWeight: 700 }}>ICON</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                {ICONS.map(ic => (
                  <button key={ic} onClick={() => set('icon', ic)} style={{
                    width: 28, height: 28, borderRadius: 6, cursor: 'pointer', fontSize: 14,
                    border: `1.5px solid ${pattern.icon === ic ? color : 'var(--border)'}`,
                    background: pattern.icon === ic ? `${color}18` : 'var(--bg2)',
                  }}>{ic}</button>
                ))}
              </div>
            </div>

            {/* Name */}
            <div style={{ flex: 1, minWidth: 140 }}>
              <div style={{ fontSize: 9, fontFamily: 'var(--mono)', color: 'var(--text3)', marginBottom: 4, fontWeight: 700 }}>NAME</div>
              <input
                value={pattern.name}
                onChange={e => set('name', e.target.value)}
                style={{
                  background: 'var(--bg3)', border: '1px solid var(--border2)',
                  color: 'var(--text)', borderRadius: 7, padding: '7px 10px',
                  fontSize: 13, fontWeight: 700, width: '100%', boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Side */}
            <div>
              <div style={{ fontSize: 9, fontFamily: 'var(--mono)', color: 'var(--text3)', marginBottom: 4, fontWeight: 700 }}>DIRECTION</div>
              <div style={{ display: 'flex', gap: 5 }}>
                {['bull', 'bear'].map(s => (
                  <button key={s} onClick={() => set('side', s)} style={{
                    padding: '6px 14px', borderRadius: 7, cursor: 'pointer',
                    fontSize: 11, fontFamily: 'var(--mono)', fontWeight: 700,
                    border: `1.5px solid ${pattern.side === s ? (s === 'bull' ? GREEN : RED) : 'var(--border)'}`,
                    background: pattern.side === s ? (s === 'bull' ? 'rgba(0,230,118,0.12)' : 'rgba(255,60,80,0.12)') : 'var(--bg2)',
                    color: pattern.side === s ? (s === 'bull' ? GREEN : RED) : 'var(--text3)',
                  }}>{s === 'bull' ? '🟢 BULL' : '🔴 BEAR'}</button>
                ))}
              </div>
            </div>
          </div>

          {/* Timeframes */}
          <div style={{ marginBottom: 13 }}>
            <div style={{ fontSize: 9, fontFamily: 'var(--mono)', color: 'var(--text3)', marginBottom: 6, fontWeight: 700 }}>SCAN ON TIMEFRAMES</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {TF_LIST.map(tf => {
                const on = pattern.tfs.includes(tf)
                return (
                  <button key={tf} onClick={() => toggleTf(tf)} style={{
                    padding: '5px 10px', borderRadius: 6, cursor: 'pointer',
                    fontSize: 10, fontFamily: 'var(--mono)', fontWeight: on ? 800 : 500,
                    border: `1.5px solid ${on ? color : 'var(--border)'}`,
                    background: on ? `${color}18` : 'var(--bg2)',
                    color: on ? color : 'var(--text3)',
                    transition: 'all .12s',
                  }}>{tf}</button>
                )
              })}
            </div>
            {pattern.tfs.length === 0 && (
              <div style={{ fontSize: 9, fontFamily: 'var(--mono)', color: 'var(--red)', marginTop: 4 }}>
                ⚠ No TF selected — pattern won't scan
              </div>
            )}
          </div>

          {/* Conditions */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 }}>
              <div style={{ fontSize: 9, fontFamily: 'var(--mono)', color: 'var(--text3)', fontWeight: 700 }}>
                CONDITIONS (all must pass)
              </div>
              <span style={{ fontSize: 9, fontFamily: 'var(--mono)', color: 'var(--text3)' }}>
                {enabledConds} active
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {pattern.conditions.map((cond, idx) => (
                <CondRow
                  key={cond.id}
                  cond={cond}
                  color={color}
                  onChange={c => setCond(idx, c)}
                  onRemove={() => removeCond(idx)}
                />
              ))}
            </div>

            <button onClick={addCond} style={{
              marginTop: 8, width: '100%', padding: '8px',
              borderRadius: 7, cursor: 'pointer', fontSize: 11,
              fontFamily: 'var(--mono)', fontWeight: 700,
              border: `1.5px dashed ${color}55`,
              background: `${color}08`,
              color: color,
              transition: 'all .15s',
            }}>
              + Add Condition
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main Pattern Builder Tab ──────────────────────────────────────────────────
export default function PatternBuilderTab({ settings, update }) {
  const patterns = useMemo(() => settings.customPatterns || [], [settings.customPatterns])
  const [newId, setNewId] = useState(null)

  function savePatterns(ps) {
    update({ customPatterns: ps })
  }

  function addPattern() {
    const p = blankPattern()
    setNewId(p.id)
    savePatterns([...patterns, p])
  }

  function updatePattern(idx, p) {
    const ps = [...patterns]
    ps[idx] = p
    savePatterns(ps)
  }

  function deletePattern(idx) {
    savePatterns(patterns.filter((_, i) => i !== idx))
  }

  const bullCount = patterns.filter(p => p.side === 'bull' && p.enabled).length
  const bearCount = patterns.filter(p => p.side === 'bear' && p.enabled).length

  return (
    <div style={{ padding: '16px 12px 80px', maxWidth: 680, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 18, letterSpacing: '-.02em' }}>🔧 Pattern Builder</div>
            <div style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--text3)', marginTop: 3 }}>
              Build custom scan patterns with visual conditions
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <span style={{ fontSize: 10, fontFamily: 'var(--mono)', fontWeight: 700,
              padding: '3px 8px', borderRadius: 5,
              background: 'rgba(0,230,118,0.1)', color: GREEN,
              border: '1px solid rgba(0,230,118,0.3)' }}>🟢 {bullCount}</span>
            <span style={{ fontSize: 10, fontFamily: 'var(--mono)', fontWeight: 700,
              padding: '3px 8px', borderRadius: 5,
              background: 'rgba(255,60,80,0.1)', color: RED,
              border: '1px solid rgba(255,60,80,0.3)' }}>🔴 {bearCount}</span>
          </div>
        </div>

        {/* Info card */}
        <div style={{
          padding: '10px 12px', borderRadius: 9,
          background: 'rgba(150,100,255,0.07)', border: '1px solid rgba(150,100,255,0.25)',
          fontSize: 10, fontFamily: 'var(--mono)', color: ACCENT, lineHeight: 1.6,
        }}>
          Each pattern runs all enabled conditions on every scanned candle. All must pass for a signal.<br/>
          Use <b>Candle Field × Mult</b> for EMA buffer (e.g. EMA20 × 1.001), or <b>Field + %</b> for slope checks.
        </div>
      </div>

      {/* Pattern list */}
      {patterns.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text3)',
          fontFamily: 'var(--mono)', fontSize: 12 }}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>🔬</div>
          No custom patterns yet.<br/>
          <span style={{ fontSize: 10 }}>Tap "New Pattern" below to create your first.</span>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 12 }}>
          {patterns.map((p, idx) => (
            <PatternEditor
              key={p.id}
              pattern={p}
              isNew={p.id === newId}
              onChange={np => updatePattern(idx, np)}
              onDelete={() => deletePattern(idx)}
            />
          ))}
        </div>
      )}

      {/* Add button */}
      <button onClick={addPattern} style={{
        width: '100%', padding: '13px',
        borderRadius: 10, cursor: 'pointer', fontSize: 13,
        fontFamily: 'var(--mono)', fontWeight: 800,
        border: '2px dashed rgba(150,100,255,0.45)',
        background: 'rgba(150,100,255,0.07)',
        color: ACCENT,
        transition: 'all .15s',
        letterSpacing: '.03em',
      }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(150,100,255,0.8)'; e.currentTarget.style.background = 'rgba(150,100,255,0.13)' }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(150,100,255,0.45)'; e.currentTarget.style.background = 'rgba(150,100,255,0.07)' }}
      >
        + New Pattern
      </button>
    </div>
  )
}
