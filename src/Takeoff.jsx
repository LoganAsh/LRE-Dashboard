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
function barCountFromSpacing(span, spacing, buffer) {
  if (!span || !spacing || spacing <= 0) return 0;
  const usable = span - 2 * (buffer || 0);
  if (usable <= 0) return 0;
  return Math.floor(usable / spacing) + 1;
}

// Equal spacing: given a span, buffer, and desired bar count, compute the O.C. spacing
function equalSpacing(span, buffer, count) {
  if (!span || count < 2) return 0;
  const usable = span - 2 * (buffer || 0);
  if (usable <= 0) return 0;
  return usable / (count - 1);
}

// Bar positions along a span (0 = start edge), using equal spacing given a count
function barPositions(span, buffer, count) {
  if (!span || count <= 0) return [];
  if (count === 1) return [span / 2];
  const spacing = equalSpacing(span, buffer, count);
  const positions = [];
  for (let i = 0; i < count; i++) positions.push((buffer || 0) + i * spacing);
  return positions;
}

function fmtNum(n, decimals = 2) {
  if (!isFinite(n)) return '0';
  return n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

// ── Cross-Section SVG View ─────────────────────────────────────────────────────
function CrossSectionView({ footing, wall, calc }) {
  const fW = parseFloat(footing.width) || 0;
  const fH = parseFloat(footing.height) || 0;
  const wW = parseFloat(wall.width) || 0;
  const wH = parseFloat(wall.height) || 0;
  const embedment = parseFloat(wall.embedment) || 0;

  if (fW <= 0 && wW <= 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, color: 'var(--muted)', fontSize: 13 }}>
        Enter dimensions to see the cross-section
      </div>
    );
  }

  const maxWidth = Math.max(fW, wW, 1);
  const totalHeight = fH + wH || 1;
  const padding = 1.5;
  const vbWidth = maxWidth + padding * 2;
  const vbHeight = totalHeight + padding * 2;

  const footingX = (vbWidth - fW) / 2;
  const footingY = vbHeight - padding - fH;
  const wallX = (vbWidth - wW) / 2;
  const wallY = footingY - wH;

  // Footing longitudinal bars (fixed O.C. spacing across width) — dots, one row per stacked "row"
  const fLongSpacingVal = parseFloat(footing.longSpacing) || 0;
  const fLongBufferVal = parseFloat(footing.longBuffer) || 0;
  const fLongPositions = [];
  for (let i = 0; i < calc.fLongCount; i++) fLongPositions.push(fLongBufferVal + i * fLongSpacingVal);
  const fLongRows = Math.max(1, parseInt(footing.longRows) || 1);
  const cover = 0.2;

  // Footing transverse bars — shown as dashed lines across the width, one per row
  const fTransRows = Math.max(1, parseInt(footing.transverseRows) || 1);

  // Wall vertical bars — 1 or 2 curtains depending on thickness, extending into footing by embedment
  const wallBarInset = 0.15;
  const wallBarXs = wW > 0.8 ? [wallX + wallBarInset, wallX + wW - wallBarInset] : [wallX + wW / 2];
  const vertBarTop = wallY + 0.08;
  const embedBottomLimit = footingY + cover; // don't draw past the footing's own cover
  const vertBarBottom = embedment > 0
    ? Math.max(embedBottomLimit, footingY + fH - embedment)
    : wallY + wH - 0.08;

  // Wall horizontal bars — positions along the wall height (equal or fixed spacing), per row/curtain
  const wHorizPositions = barPositions ? [] : [];
  const wHorizPos = (() => {
    if (!wH || calc.wHorizCount <= 0) return [];
    const buf = parseFloat(wall.horizBuffer) || 0;
    const spacing = wH && calc.wHorizCount > 1 ? (wH - 2 * buf) / (calc.wHorizCount - 1) : 0;
    const arr = [];
    for (let i = 0; i < calc.wHorizCount; i++) arr.push(wallY + wH - buf - i * spacing);
    return arr;
  })();
  const wHorizRows = Math.max(1, parseInt(wall.horizRows) || 1);

  return (
    <svg viewBox={`0 0 ${vbWidth} ${vbHeight}`} style={{ width: '100%', height: 340, background: 'var(--surface2)', borderRadius: 8 }}>
      {/* Ground line */}
      <line x1={0} y1={footingY + fH} x2={vbWidth} y2={footingY + fH} stroke="var(--border)" strokeWidth={0.03} strokeDasharray="0.1,0.08" />

      {/* Footing */}
      {fW > 0 && fH > 0 && (
        <>
          <rect x={footingX} y={footingY} width={fW} height={fH} fill="rgba(122,130,152,0.25)" stroke="#7a8298" strokeWidth={0.04} />

          {/* Footing longitudinal bars — dots, one row per stacked layer within footing depth */}
          {Array.from({ length: fLongRows }).map((_, r) => {
            const rowY = fLongRows === 1
              ? footingY + fH - cover
              : footingY + cover + r * ((fH - cover * 2) / Math.max(fLongRows - 1, 1));
            return fLongPositions.map((x, i) => (
              <circle key={`fl-${r}-${i}`} cx={footingX + x} cy={rowY} r={0.055} fill="#e8c547" stroke="#0a0c10" strokeWidth={0.015} />
            ));
          })}

          {/* Footing transverse bars — dashed horizontal lines across the width, one per row */}
          {Array.from({ length: fTransRows }).map((_, r) => {
            const rowY = fTransRows === 1
              ? footingY + fH - cover - 0.12
              : footingY + cover + 0.12 + r * ((fH - cover * 2 - 0.24) / Math.max(fTransRows - 1, 1));
            return (
              <line key={`ft-${r}`} x1={footingX + 0.05} y1={rowY} x2={footingX + fW - 0.05} y2={rowY} stroke="#f97316" strokeWidth={0.03} strokeDasharray="0.12,0.08" />
            );
          })}

          <text x={footingX + fW / 2} y={footingY + fH + 0.55} fontSize={0.2} fill="var(--muted)" textAnchor="middle" fontFamily="monospace">{fmtNum(fW,1)}' W × {fmtNum(fH,1)}' H</text>
        </>
      )}

      {/* Wall */}
      {wW > 0 && wH > 0 && (
        <>
          <rect x={wallX} y={wallY} width={wW} height={wH} fill="rgba(59,111,232,0.18)" stroke="#3B6FE8" strokeWidth={0.04} />

          {/* Wall vertical bars — extend down into footing by embedment amount */}
          {wallBarXs.map((x, i) => (
            <line key={`wv-${i}`} x1={x} y1={vertBarTop} x2={x} y2={vertBarBottom} stroke="#2ebd7e" strokeWidth={0.05} />
          ))}

          {/* Embedment dimension marker */}
          {embedment > 0 && fH > 0 && (
            <>
              <line x1={wallX - 0.15} y1={footingY + fH} x2={wallX - 0.15} y2={vertBarBottom} stroke="#2ebd7e" strokeWidth={0.02} strokeDasharray="0.06,0.05" />
              <text x={wallX - 0.22} y={(footingY + fH + vertBarBottom) / 2} fontSize={0.15} fill="#2ebd7e" textAnchor="end" fontFamily="monospace">{fmtNum(embedment,2)}' emb.</text>
            </>
          )}

          {/* Wall horizontal bars — dots at each position, per row/curtain */}
          {wHorizPos.map((y, i) => (
            Array.from({ length: wHorizRows }).map((_, r) => (
              wallBarXs.map((x, j) => (
                <circle key={`wh-${i}-${r}-${j}`} cx={x} cy={y} r={0.05} fill="#facc15" stroke="#0a0c10" strokeWidth={0.015} />
              ))
            ))
          ))}

          <text x={wallX + wW / 2} y={wallY - 0.25} fontSize={0.2} fill="var(--muted)" textAnchor="middle" fontFamily="monospace">{fmtNum(wW,2)}' W × {fmtNum(wH,1)}' H</text>
        </>
      )}

      {/* Legend */}
      <g transform={`translate(${padding * 0.25}, ${padding * 0.25})`}>
        <circle cx={0.1} cy={0} r={0.05} fill="#e8c547" />
        <text x={0.25} y={0.08} fontSize={0.15} fill="var(--muted)" fontFamily="monospace">Footing long.</text>
        <line x1={0.05} y1={0.28} x2={0.15} y2={0.28} stroke="#f97316" strokeWidth={0.03} strokeDasharray="0.06,0.04" />
        <text x={0.25} y={0.33} fontSize={0.15} fill="var(--muted)" fontFamily="monospace">Footing trans.</text>
        <circle cx={0.1} cy={0.53} r={0.05} fill="#facc15" />
        <text x={0.25} y={0.61} fontSize={0.15} fill="var(--muted)" fontFamily="monospace">Wall horiz.</text>
        <line x1={0.05} y1={0.78} x2={0.15} y2={0.78} stroke="#2ebd7e" strokeWidth={0.05} />
        <text x={0.25} y={0.83} fontSize={0.15} fill="var(--muted)" fontFamily="monospace">Wall vert. (+ embed.)</text>
      </g>
    </svg>
  );
}

// ── Main Takeoff Tool ─────────────────────────────────────────────────────────
export default function Takeoff() {
  const [footing, setFooting] = useState({
    length: '', width: '', height: '',
    longSpacing: '', longBuffer: '0.25', longRows: '1', longBarSize: '#4',
    transverseSpacing: '', transverseBuffer: '0.25', transverseRows: '1', transBarSize: '#4',
  });
  const [wall, setWall] = useState({
    length: '', width: '', height: '',
    vertSpacing: '', vertBuffer: '0.5', vertBarSize: '#4',
    horizSpacing: '', horizBuffer: '0.25', horizRows: '1', horizBarSize: '#4',
    embedment: '',
  });
  const [wasteFactor, setWasteFactor] = useState('5');

  const setF = (k, v) => setFooting(p => ({ ...p, [k]: v }));
  const setW = (k, v) => setWall(p => ({ ...p, [k]: v }));

  const results = useMemo(() => {
    const fL = parseFloat(footing.length) || 0;
    const fW = parseFloat(footing.width) || 0;
    const fH = parseFloat(footing.height) || 0;
    const wL = parseFloat(wall.length) || 0;
    const wW = parseFloat(wall.width) || 0;
    const wH = parseFloat(wall.height) || 0;
    const embedment = parseFloat(wall.embedment) || 0;

    const footingCF = fL * fW * fH;
    const wallCF = wL * wW * wH;
    const footingCY = footingCF * CY_PER_CF;
    const wallCY = wallCF * CY_PER_CF;
    const waste = (parseFloat(wasteFactor) || 0) / 100;
    const totalCY = (footingCY + wallCY) * (1 + waste);

    // Footing longitudinal — fixed O.C. spacing, across width, running the length
    const fLongRows = Math.max(1, parseInt(footing.longRows) || 1);
    const fLongCount = barCountFromSpacing(fW, parseFloat(footing.longSpacing) || 0, parseFloat(footing.longBuffer) || 0);
    const fLongLF = fLongCount * fL * fLongRows;
    const fLongWeight = fLongLF * (REBAR_WEIGHTS[footing.longBarSize] || 0);

    // Footing transverse — fixed spacing, across length, running the width
    const fTransRows = Math.max(1, parseInt(footing.transverseRows) || 1);
    const fTransCount = barCountFromSpacing(fL, parseFloat(footing.transverseSpacing) || 0, parseFloat(footing.transverseBuffer) || 0);
    const fTransLF = fTransCount * fW * fTransRows;
    const fTransWeight = fTransLF * (REBAR_WEIGHTS[footing.transBarSize] || 0);

    // Wall vertical — fixed O.C. spacing, across length, running height + embedment
    const vertCount = barCountFromSpacing(wL, parseFloat(wall.vertSpacing) || 0, parseFloat(wall.vertBuffer) || 0);
    const barsPerCurtain = wW > 0.8 ? 2 : 1;
    const wVertLF = vertCount * (wH + embedment) * barsPerCurtain;
    const wVertWeight = wVertLF * (REBAR_WEIGHTS[wall.vertBarSize] || 0);

    // Wall horizontal — fixed spacing, across height, running the length
    const wHorizRows = Math.max(1, parseInt(wall.horizRows) || 1);
    const wHorizCount = barCountFromSpacing(wH, parseFloat(wall.horizSpacing) || 0, parseFloat(wall.horizBuffer) || 0);
    const wHorizLF = wHorizCount * wL * wHorizRows * barsPerCurtain;
    const wHorizWeight = wHorizLF * (REBAR_WEIGHTS[wall.horizBarSize] || 0);

    const totalRebarLF = fLongLF + fTransLF + wVertLF + wHorizLF;
    const totalRebarWeight = fLongWeight + fTransWeight + wVertWeight + wHorizWeight;

    return {
      footingCY, wallCY, totalCY,
      fLongCount, fLongLF, fLongWeight, fLongRows,
      fTransCount, fTransLF, fTransWeight, fTransRows,
      vertCount, wVertLF, wVertWeight,
      wHorizCount, wHorizLF, wHorizWeight, wHorizRows,
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

      <div style={{ display: 'grid', gridTemplateColumns: '400px 1fr', gap: 20, alignItems: 'start' }} className="takeoff-grid">
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
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 6 }}>Longitudinal (runs the length)</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 60px', gap: 8 }}>
                <NumField label="O.C. Spacing" value={footing.longSpacing} onChange={v => setF('longSpacing', v)} suffix="ft" />
                <NumField label="Edge Buffer" value={footing.longBuffer} onChange={v => setF('longBuffer', v)} suffix="ft" />
                <NumField label="Rows" value={footing.longRows} onChange={v => setF('longRows', v)} placeholder="1" />
                <div><Label>Size</Label>{barSizeSelect(footing.longBarSize, v => setF('longBarSize', v))}</div>
              </div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 6 }}>Transverse (perpendicular, ties the mat)</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 60px', gap: 8 }}>
                <NumField label="O.C. Spacing" value={footing.transverseSpacing} onChange={v => setF('transverseSpacing', v)} suffix="ft" />
                <NumField label="Edge Buffer" value={footing.transverseBuffer} onChange={v => setF('transverseBuffer', v)} suffix="ft" />
                <NumField label="Rows" value={footing.transverseRows} onChange={v => setF('transverseRows', v)} placeholder="1" />
                <div><Label>Size</Label>{barSizeSelect(footing.transBarSize, v => setF('transBarSize', v))}</div>
              </div>
            </div>
          </div>

          {/* Wall inputs */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 16 }}>
            <Section title="Wall Dimensions" color="#3B6FE8" />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 8 }}>
              <NumField label="Length" value={wall.length} onChange={v => setW('length', v)} suffix="ft" />
              <NumField label="Width" value={wall.width} onChange={v => setW('width', v)} suffix="ft" />
              <NumField label="Height" value={wall.height} onChange={v => setW('height', v)} suffix="ft" />
            </div>
            <div style={{ marginBottom: 14 }}>
              <NumField label="Vertical Bar Embedment into Footing" value={wall.embedment} onChange={v => setW('embedment', v)} suffix="ft" placeholder="e.g. 1.5" />
            </div>

            <Section title="Wall Rebar" color="#2ebd7e" />
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 6 }}>Vertical (runs the height + embedment)</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 60px', gap: 8 }}>
                <NumField label="O.C. Spacing" value={wall.vertSpacing} onChange={v => setW('vertSpacing', v)} suffix="ft" />
                <NumField label="End Buffer" value={wall.vertBuffer} onChange={v => setW('vertBuffer', v)} suffix="ft" />
                <div><Label>Size</Label>{barSizeSelect(wall.vertBarSize, v => setW('vertBarSize', v))}</div>
              </div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 6 }}>Horizontal (runs the length)</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 60px', gap: 8 }}>
                <NumField label="O.C. Spacing" value={wall.horizSpacing} onChange={v => setW('horizSpacing', v)} suffix="ft" />
                <NumField label="Top/Bot Buffer" value={wall.horizBuffer} onChange={v => setW('horizBuffer', v)} suffix="ft" />
                <NumField label="Rows" value={wall.horizRows} onChange={v => setW('horizRows', v)} placeholder="1" />
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
            <CrossSectionView footing={footing} wall={wall} calc={results} />
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
              <StatBox label="Longitudinal Bars" value={`${results.fLongCount} × ${results.fLongRows} row(s)`} sub={`${footing.longBarSize} · ${fmtNum(results.fLongLF)} LF`} />
              <StatBox label="Transverse Bars" value={`${results.fTransCount} × ${results.fTransRows} row(s)`} sub={`${footing.transBarSize} · ${fmtNum(results.fTransLF)} LF`} />
              <StatBox label="Total LF" value={fmtNum(results.fLongLF + results.fTransLF)} />
              <StatBox label="Total Weight" value={`${fmtNum(results.fLongWeight + results.fTransWeight, 0)} lbs`} />
            </div>
          </div>

          {/* Wall Rebar Results */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 16 }}>
            <Section title="Wall Rebar" color="#2ebd7e" />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: 10, marginBottom: 10 }}>
              <StatBox label="Vertical Bars" value={results.vertCount} sub={`${wall.vertBarSize} · ${fmtNum(results.wVertLF)} LF (incl. embed.)`} />
              <StatBox label="Horizontal Bars" value={`${results.wHorizCount} × ${results.wHorizRows} row(s)`} sub={`${wall.horizBarSize} · ${fmtNum(results.wHorizLF)} LF`} />
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
