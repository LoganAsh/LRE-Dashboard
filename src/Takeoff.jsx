import { useState, useMemo } from 'react';

// ── Constants ─────────────────────────────────────────────────────────────────
const CY_PER_CF = 1 / 27; // cubic feet -> cubic yards

const REBAR_WEIGHTS = { // lbs per linear foot, common sizes
  '#3': 0.376, '#4': 0.668, '#5': 1.043, '#6': 1.502,
  '#7': 2.044, '#8': 2.670, '#9': 3.400, '#10': 4.303,
};

const field = {
  width: '100%', padding: '7px 10px', background: 'var(--surface)',
  border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text)',
  fontFamily: 'var(--font-mono)', fontSize: 12, outline: 'none', boxSizing: 'border-box',
};

const Label = ({ children }) => (
  <label style={{ display: 'block', fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5 }}>{children}</label>
);

const Section = ({ title, color }) => (
  <div style={{ fontSize: 11, color: color || 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700, marginBottom: 10, marginTop: 4, paddingBottom: 6, borderBottom: '1px solid var(--border)' }}>{title}</div>
);

function NumField({ label, value, onChange, suffix, placeholder }) {
  return (
    <div>
      <Label>{label}</Label>
      <div style={{ position: 'relative' }}>
        <input type="number" step="0.01" value={value} onChange={e => onChange(e.target.value)} style={field} placeholder={placeholder || '0'} />
        {suffix && <span style={{ position: 'absolute', right: 10, top: 7, fontSize: 10, color: 'var(--muted)', pointerEvents: 'none' }}>{suffix}</span>}
      </div>
    </div>
  );
}

// ── Calculation helpers ────────────────────────────────────────────────────────
// Number of bars across a span given O.C. spacing and edge buffer on both sides
function barCount(span, spacing, buffer) {
  if (!span || !spacing || spacing <= 0) return 0;
  const usable = span - 2 * (buffer || 0);
  if (usable <= 0) return 0;
  return Math.floor(usable / spacing) + 1;
}

function fmtNum(n, decimals = 2) {
  if (!isFinite(n)) return '0';
  return n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

// ── Cross-Section SVG View ─────────────────────────────────────────────────────
function CrossSectionView({ footing, wall }) {
  const fW = parseFloat(footing.width) || 0;   // footing width (ft)
  const fH = parseFloat(footing.height) || 0;  // footing thickness (ft)
  const wW = parseFloat(wall.width) || 0;      // wall thickness (ft)
  const wH = parseFloat(wall.height) || 0;     // wall height (ft)

  if (fW <= 0 && wW <= 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 280, color: 'var(--muted)', fontSize: 13 }}>
        Enter dimensions to see the cross-section
      </div>
    );
  }

  // Scale to fit a viewbox — find the larger horizontal extent and total height
  const maxWidth = Math.max(fW, wW, 1);
  const totalHeight = fH + wH || 1;
  const padding = 1.5; // ft of padding around the drawing
  const vbWidth = maxWidth + padding * 2;
  const vbHeight = totalHeight + padding * 2;

  const scale = 60; // px per foot at 1:1 viewBox scaling (viewBox handles actual scale)

  // Footing rect centered horizontally
  const footingX = (vbWidth - fW) / 2;
  const footingY = vbHeight - padding - fH;
  // Wall rect centered on footing (or centered in view if no footing)
  const wallX = (vbWidth - wW) / 2;
  const wallY = footingY - wH;

  // Rebar visualization
  const fVertSpacing = parseFloat(footing.transverseSpacing) || 0;
  const fVertBuffer = parseFloat(footing.transverseBuffer) || 0;
  const fLongCount = barCount(fW, parseFloat(footing.longSpacing) || 0, parseFloat(footing.longBuffer) || 0);
  const fTransCount = barCount(footing.length ? parseFloat(footing.length) : 0, fVertSpacing, fVertBuffer);

  const wVertCount = barCount(wall.length ? parseFloat(wall.length) : 0, parseFloat(wall.vertSpacing) || 0, parseFloat(wall.vertBuffer) || 0);
  const wHorizCount = barCount(wH, parseFloat(wall.horizSpacing) || 0, parseFloat(wall.horizBuffer) || 0);

  // Footing longitudinal bars shown as dots along the width (cross-section view, running into the page)
  const fLongPositions = [];
  if (fLongCount > 0 && fW > 0) {
    const spacing = parseFloat(footing.longSpacing) || 0;
    const buffer = parseFloat(footing.longBuffer) || 0;
    for (let i = 0; i < fLongCount; i++) {
      fLongPositions.push(footingX + buffer + i * spacing);
    }
  }
  // Footing cover (concrete cover from bottom/sides) - assume 3" typical, shown visually only
  const cover = 0.25; // 3 inches in feet, just for visual dot placement inside the footing
  const barY = footingY + fH - cover - 0.05;

  // Wall vertical bars shown along the wall width (2 curtains if thick enough, else 1)
  const wallBarInset = 0.15;
  const wallBarXs = wW > 0.8 ? [wallX + wallBarInset, wallX + wW - wallBarInset] : [wallX + wW / 2];

  // Wall horizontal bar rows (shown as horizontal lines at intervals up the wall)
  const wHorizPositions = [];
  if (wHorizCount > 0 && wH > 0) {
    const spacing = parseFloat(wall.horizSpacing) || 0;
    const buffer = parseFloat(wall.horizBuffer) || 0;
    for (let i = 0; i < wHorizCount; i++) {
      wHorizPositions.push(wallY + wH - buffer - i * spacing);
    }
  }

  return (
    <svg viewBox={`0 0 ${vbWidth} ${vbHeight}`} style={{ width: '100%', height: 320, background: 'var(--surface2)', borderRadius: 8 }}>
      {/* Ground line */}
      <line x1={0} y1={footingY + fH} x2={vbWidth} y2={footingY + fH} stroke="var(--border)" strokeWidth={0.03} strokeDasharray="0.1,0.08" />

      {/* Footing */}
      {fW > 0 && fH > 0 && (
        <>
          <rect x={footingX} y={footingY} width={fW} height={fH} fill="rgba(122,130,152,0.25)" stroke="#7a8298" strokeWidth={0.04} />
          {/* Footing longitudinal bars (running into page - shown as dots) */}
          {fLongPositions.map((x, i) => (
            <circle key={`fl-${i}`} cx={x} cy={barY} r={0.055} fill="#e8c547" stroke="#0a0c10" strokeWidth={0.015} />
          ))}
          {/* dimension label */}
          <text x={footingX + fW / 2} y={footingY + fH + 0.55} fontSize={0.22} fill="var(--muted)" textAnchor="middle" fontFamily="monospace">{fmtNum(fW,1)}' W × {fmtNum(fH,1)}' H</text>
        </>
      )}

      {/* Wall */}
      {wW > 0 && wH > 0 && (
        <>
          <rect x={wallX} y={wallY} width={wW} height={wH} fill="rgba(59,111,232,0.18)" stroke="#3B6FE8" strokeWidth={0.04} />
          {/* Wall vertical bars (running up - shown as vertical lines) */}
          {wallBarXs.map((x, i) => (
            <line key={`wv-${i}`} x1={x} y1={wallY + 0.08} x2={x} y2={wallY + wH - 0.08} stroke="#2ebd7e" strokeWidth={0.05} />
          ))}
          {/* Wall horizontal bars (shown as dots at each row, at each vertical bar curtain position) */}
          {wHorizPositions.map((y, i) => (
            wallBarXs.map((x, j) => (
              <circle key={`wh-${i}-${j}`} cx={x} cy={y} r={0.05} fill="#facc15" stroke="#0a0c10" strokeWidth={0.015} />
            ))
          ))}
          <text x={wallX + wW / 2} y={wallY - 0.25} fontSize={0.22} fill="var(--muted)" textAnchor="middle" fontFamily="monospace">{fmtNum(wW,2)}' W × {fmtNum(wH,1)}' H</text>
        </>
      )}

      {/* Legend */}
      <g transform={`translate(${padding * 0.3}, ${padding * 0.3})`}>
        <circle cx={0.1} cy={0} r={0.05} fill="#e8c547" />
        <text x={0.25} y={0.08} fontSize={0.16} fill="var(--muted)" fontFamily="monospace">Footing rebar</text>
        <circle cx={0.1} cy={0.3} r={0.05} fill="#facc15" />
        <text x={0.25} y={0.38} fontSize={0.16} fill="var(--muted)" fontFamily="monospace">Wall horiz. rebar</text>
        <line x1={0.05} y1={0.55} x2={0.15} y2={0.55} stroke="#2ebd7e" strokeWidth={0.05} />
        <text x={0.25} y={0.6} fontSize={0.16} fill="var(--muted)" fontFamily="monospace">Wall vert. rebar</text>
      </g>
    </svg>
  );
}

// ── Main Takeoff Tool ─────────────────────────────────────────────────────────
export default function Takeoff() {
  const [footing, setFooting] = useState({
    length: '', width: '', height: '',
    longSpacing: '', longBuffer: '0.25',
    transverseSpacing: '', transverseBuffer: '0.25',
    longBarSize: '#4', transBarSize: '#4',
  });
  const [wall, setWall] = useState({
    length: '', width: '', height: '',
    vertSpacing: '', vertBuffer: '0.5',
    horizSpacing: '', horizBuffer: '0.25',
    vertBarSize: '#4', horizBarSize: '#4',
  });
  const [wasteFactor, setWasteFactor] = useState('5');

  const setF = (k, v) => setFooting(p => ({ ...p, [k]: v }));
  const setW = (k, v) => setWall(p => ({ ...p, [k]: v }));

  // ── Concrete volume ──────────────────────────────────────────────────────
  const results = useMemo(() => {
    const fL = parseFloat(footing.length) || 0;
    const fW = parseFloat(footing.width) || 0;
    const fH = parseFloat(footing.height) || 0;
    const wL = parseFloat(wall.length) || 0;
    const wW = parseFloat(wall.width) || 0;
    const wH = parseFloat(wall.height) || 0;

    const footingCF = fL * fW * fH;
    const wallCF = wL * wW * wH;
    const footingCY = footingCF * CY_PER_CF;
    const wallCY = wallCF * CY_PER_CF;
    const waste = (parseFloat(wasteFactor) || 0) / 100;
    const totalCY = (footingCY + wallCY) * (1 + waste);

    // ── Footing rebar ──
    const fLongCount = barCount(fW, parseFloat(footing.longSpacing) || 0, parseFloat(footing.longBuffer) || 0);
    const fTransCount = barCount(fL, parseFloat(footing.transverseSpacing) || 0, parseFloat(footing.transverseBuffer) || 0);
    const fLongLF = fLongCount * fL;
    const fTransLF = fTransCount * fW;
    const fLongWeight = fLongLF * (REBAR_WEIGHTS[footing.longBarSize] || 0);
    const fTransWeight = fTransLF * (REBAR_WEIGHTS[footing.transBarSize] || 0);

    // ── Wall rebar ──
    const wVertCount = barCount(wL, parseFloat(wall.vertSpacing) || 0, parseFloat(wall.vertBuffer) || 0);
    const wHorizCount = barCount(wH, parseFloat(wall.horizSpacing) || 0, parseFloat(wall.horizBuffer) || 0);
    const wVertLF = wVertCount * wH;
    const wHorizLF = wHorizCount * wL;
    const wVertWeight = wVertLF * (REBAR_WEIGHTS[wall.vertBarSize] || 0);
    const wHorizWeight = wHorizLF * (REBAR_WEIGHTS[wall.horizBarSize] || 0);

    const totalRebarLF = fLongLF + fTransLF + wVertLF + wHorizLF;
    const totalRebarWeight = fLongWeight + fTransWeight + wVertWeight + wHorizWeight;

    return {
      footingCY, wallCY, totalCY,
      fLongCount, fTransCount, fLongLF, fTransLF, fLongWeight, fTransWeight,
      wVertCount, wHorizCount, wVertLF, wHorizLF, wVertWeight, wHorizWeight,
      totalRebarLF, totalRebarWeight,
    };
  }, [footing, wall, wasteFactor]);

  const StatBox = ({ label, value, sub, color }) => (
    <div style={{ background: 'var(--surface2)', borderRadius: 6, padding: '10px 12px' }}>
      <div style={{ fontSize: 9, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>{label}</div>
      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16, color: color || 'var(--text)' }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>{sub}</div>}
    </div>
  );

  const barSizeSelect = (value, onChange) => (
    <select value={value} onChange={e => onChange(e.target.value)} style={{ ...field, padding: '6px 8px' }}>
      {Object.keys(REBAR_WEIGHTS).map(s => <option key={s} value={s}>{s}</option>)}
    </select>
  );

  return (
    <div className="page">
      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 20, marginBottom: 20 }}>Concrete Takeoff — Footing &amp; Wall</div>

      <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: 20, alignItems: 'start' }} className="takeoff-grid">
        {/* ── Input Panel ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

          {/* Footing inputs */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 16 }}>
            <Section title="Footing Dimensions" color="#7a8298" />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 14 }}>
              <NumField label="Length" value={footing.length} onChange={v => setF('length', v)} suffix="ft" />
              <NumField label="Width" value={footing.width} onChange={v => setF('width', v)} suffix="ft" />
              <NumField label="Height" value={footing.height} onChange={v => setF('height', v)} suffix="ft" />
            </div>

            <Section title="Footing Rebar" color="#e8c547" />
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 6 }}>Longitudinal (runs the length)</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 70px', gap: 8 }}>
                <NumField label="O.C. Spacing" value={footing.longSpacing} onChange={v => setF('longSpacing', v)} suffix="ft" />
                <NumField label="Edge Buffer" value={footing.longBuffer} onChange={v => setF('longBuffer', v)} suffix="ft" />
                <div><Label>Size</Label>{barSizeSelect(footing.longBarSize, v => setF('longBarSize', v))}</div>
              </div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 6 }}>Transverse (perpendicular)</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 70px', gap: 8 }}>
                <NumField label="O.C. Spacing" value={footing.transverseSpacing} onChange={v => setF('transverseSpacing', v)} suffix="ft" />
                <NumField label="Edge Buffer" value={footing.transverseBuffer} onChange={v => setF('transverseBuffer', v)} suffix="ft" />
                <div><Label>Size</Label>{barSizeSelect(footing.transBarSize, v => setF('transBarSize', v))}</div>
              </div>
            </div>
          </div>

          {/* Wall inputs */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 16 }}>
            <Section title="Wall Dimensions" color="#3B6FE8" />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 14 }}>
              <NumField label="Length" value={wall.length} onChange={v => setW('length', v)} suffix="ft" />
              <NumField label="Width" value={wall.width} onChange={v => setW('width', v)} suffix="ft" />
              <NumField label="Height" value={wall.height} onChange={v => setW('height', v)} suffix="ft" />
            </div>

            <Section title="Wall Rebar" color="#2ebd7e" />
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 6 }}>Vertical (runs the height)</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 70px', gap: 8 }}>
                <NumField label="O.C. Spacing" value={wall.vertSpacing} onChange={v => setW('vertSpacing', v)} suffix="ft" />
                <NumField label="End Buffer" value={wall.vertBuffer} onChange={v => setW('vertBuffer', v)} suffix="ft" />
                <div><Label>Size</Label>{barSizeSelect(wall.vertBarSize, v => setW('vertBarSize', v))}</div>
              </div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 6 }}>Horizontal (runs the length)</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 70px', gap: 8 }}>
                <NumField label="O.C. Spacing" value={wall.horizSpacing} onChange={v => setW('horizSpacing', v)} suffix="ft" />
                <NumField label="Top/Bot Buffer" value={wall.horizBuffer} onChange={v => setW('horizBuffer', v)} suffix="ft" />
                <div><Label>Size</Label>{barSizeSelect(wall.horizBarSize, v => setW('horizBarSize', v))}</div>
              </div>
            </div>
          </div>

          {/* Waste factor */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 16 }}>
            <Label>Concrete Waste Factor</Label>
            <div style={{ position: 'relative' }}>
              <input type="number" step="0.5" value={wasteFactor} onChange={e => setWasteFactor(e.target.value)} style={field} />
              <span style={{ position: 'absolute', right: 10, top: 7, fontSize: 10, color: 'var(--muted)' }}>%</span>
            </div>
          </div>
        </div>

        {/* ── Visual + Results Panel ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 16 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14, marginBottom: 12 }}>Cross-Section View</div>
            <CrossSectionView footing={footing} wall={wall} />
          </div>

          {/* Concrete Volume */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 16 }}>
            <Section title="Concrete Volume" />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: 10 }}>
              <StatBox label="Footing" value={`${fmtNum(results.footingCY)} CY`} />
              <StatBox label="Wall" value={`${fmtNum(results.wallCY)} CY`} />
              <StatBox label="Total (w/ waste)" value={`${fmtNum(results.totalCY)} CY`} color="var(--accent)" />
            </div>
          </div>

          {/* Footing Rebar Results */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 16 }}>
            <Section title="Footing Rebar" color="#e8c547" />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: 10, marginBottom: 10 }}>
              <StatBox label="Longitudinal Bars" value={results.fLongCount} sub={`${footing.longBarSize} · ${fmtNum(results.fLongLF)} LF`} />
              <StatBox label="Transverse Bars" value={results.fTransCount} sub={`${footing.transBarSize} · ${fmtNum(results.fTransLF)} LF`} />
              <StatBox label="Total LF" value={fmtNum(results.fLongLF + results.fTransLF)} />
              <StatBox label="Total Weight" value={`${fmtNum(results.fLongWeight + results.fTransWeight, 0)} lbs`} />
            </div>
          </div>

          {/* Wall Rebar Results */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 16 }}>
            <Section title="Wall Rebar" color="#2ebd7e" />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: 10, marginBottom: 10 }}>
              <StatBox label="Vertical Bars" value={results.wVertCount} sub={`${wall.vertBarSize} · ${fmtNum(results.wVertLF)} LF`} />
              <StatBox label="Horizontal Bars" value={results.wHorizCount} sub={`${wall.horizBarSize} · ${fmtNum(results.wHorizLF)} LF`} />
              <StatBox label="Total LF" value={fmtNum(results.wVertLF + results.wHorizLF)} />
              <StatBox label="Total Weight" value={`${fmtNum(results.wVertWeight + results.wHorizWeight, 0)} lbs`} />
            </div>
          </div>

          {/* Grand Totals */}
          <div style={{ background: 'var(--accent-light)', border: '1px solid var(--accent)', borderRadius: 10, padding: 16 }}>
            <Section title="Grand Totals" />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: 10 }}>
              <StatBox label="Total Concrete" value={`${fmtNum(results.totalCY)} CY`} color="var(--accent)" />
              <StatBox label="Total Rebar" value={`${fmtNum(results.totalRebarLF)} LF`} color="var(--accent)" />
              <StatBox label="Total Rebar Weight" value={`${fmtNum(results.totalRebarWeight, 0)} lbs`} color="var(--accent)" />
              <StatBox label="Rebar Tonnage" value={`${fmtNum(results.totalRebarWeight / 2000, 2)} tons`} color="var(--accent)" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
