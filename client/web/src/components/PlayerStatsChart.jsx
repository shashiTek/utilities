import React, { useState, useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine, Dot
} from 'recharts';

// ─── Colour palette ──────────────────────────────────────────────────────────
const PLAYER_COLORS = [
  { line: '#E8472A', fill: 'rgba(232,71,42,0.08)',  dot: '#E8472A', name: 'Player 1' },
  { line: '#1A6B4A', fill: 'rgba(26,107,74,0.08)',  dot: '#1A6B4A', name: 'Player 2' },
  { line: '#2563EB', fill: 'rgba(37,99,235,0.08)',  dot: '#2563EB', name: 'Player 3' },
  { line: '#9333EA', fill: 'rgba(147,51,234,0.08)', dot: '#9333EA', name: 'Player 4' },
];

// ─── Stat definitions ────────────────────────────────────────────────────────
const SKATER_STATS = [
  { key: 'gp',          label: 'GP',    desc: 'Games Played'          },
  { key: 'g',           label: 'G',     desc: 'Goals'                 },
  { key: 'a',           label: 'A',     desc: 'Assists'               },
  { key: 'pts',         label: 'PTS',   desc: 'Points'                },
  { key: 'plus_minus',  label: '+/-',   desc: 'Plus / Minus'          },
  { key: 'pim',         label: 'PIM',   desc: 'Penalty Minutes'       },
  { key: 'ppg',         label: 'PPG',   desc: 'Power Play Goals'      },
];

const GOALIE_STATS = [
  { key: 'gp',     label: 'GP',  desc: 'Games Played'   },
  { key: 'w',      label: 'W',   desc: 'Wins'           },
  { key: 'l',      label: 'L',   desc: 'Losses'         },
  { key: 'ot',     label: 'OT',  desc: 'OT Losses'      },
  { key: 'gaa',    label: 'GAA', desc: 'Goals Ag. Avg'  },
  { key: 'sv_pct', label: 'SV%', desc: 'Save Percentage'},
  { key: 'so',     label: 'SO',  desc: 'Shutouts'       },
];

// ─── Normalise to 0-100 per stat so all axes share the same scale ────────────
function normalise(players, statKeys) {
  const maxes = {};
  const mins  = {};
  statKeys.forEach(k => {
    const vals = players.map(p => p.stats?.[k] ?? 0);
    maxes[k] = Math.max(...vals, 0.0001);
    mins[k]  = Math.min(...vals, 0);
  });

  return players.map(p => {
    const norm = {};
    statKeys.forEach(k => {
      const v   = p.stats?.[k] ?? 0;
      const range = maxes[k] - mins[k] || 1;
      norm[k] = ((v - mins[k]) / range) * 100;
    });
    return { ...p, _norm: norm };
  });
}

// ─── Custom tooltip ───────────────────────────────────────────────────────────
function CustomTooltip({ active, payload, label, statDefs, rawPlayers }) {
  if (!active || !payload?.length) return null;
  const statDef = statDefs.find(s => s.label === label);
  return (
    <div style={{
      background: '#fff',
      border: '1px solid #e5e5e0',
      borderRadius: 8,
      padding: '10px 14px',
      boxShadow: '0 4px 16px rgba(0,0,0,0.10)',
      minWidth: 160,
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
        {statDef?.desc || label}
      </div>
      {payload.map((entry, i) => {
        const player = rawPlayers.find(p => p.player_name === entry.name);
        const raw    = player?.stats?.[statDef ? statDefs.find(s => s.label === label)?.key : ''];
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: entry.color, flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: '#444', flex: 1, fontWeight: 500 }}>{entry.name}</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: entry.color }}>
              {raw ?? '—'}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Custom dot with hover state ──────────────────────────────────────────────
function ActiveDot({ cx, cy, fill, r = 5 }) {
  return (
    <circle cx={cx} cy={cy} r={r} fill={fill} stroke="#fff" strokeWidth={2}
      style={{ filter: `drop-shadow(0 0 4px ${fill}88)` }} />
  );
}

// ─── Legend renderer ──────────────────────────────────────────────────────────
function ChartLegend({ players }) {
  return (
    <div style={{ display: 'flex', gap: 20, justifyContent: 'center', marginTop: 6 }}>
      {players.map((p, i) => {
        const c = PLAYER_COLORS[i % PLAYER_COLORS.length];
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span style={{
              display: 'inline-block', width: 28, height: 3,
              background: c.line, borderRadius: 99,
            }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: '#444' }}>
              {p.player_name}
            </span>
            {p.team && (
              <span style={{ fontSize: 11, color: '#999' }}>({p.team})</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Stat summary row beneath chart ──────────────────────────────────────────
function StatSummaryRow({ players, statDefs }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: `repeat(${statDefs.length}, 1fr)`,
      gap: 0,
      borderTop: '1.5px solid #eae8e3',
      marginTop: 4,
    }}>
      {statDefs.map(stat => {
        // Find the player with the best raw value for this stat
        const vals    = players.map(p => ({ name: p.player_name, v: p.stats?.[stat.key] ?? null }));
        const numeric = vals.filter(x => x.v != null);
        const best    = numeric.length
          ? numeric.reduce((a, b) => (stat.key === 'gaa' ? (a.v < b.v ? a : b) : (a.v > b.v ? a : b)))
          : null;

        return (
          <div key={stat.key} style={{
            padding: '10px 6px 8px',
            textAlign: 'center',
            borderRight: '1px solid #eae8e3',
          }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#aaa', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6 }}>
              {stat.label}
            </div>
            {players.map((p, i) => {
              const c   = PLAYER_COLORS[i % PLAYER_COLORS.length];
              const raw = p.stats?.[stat.key];
              const isBest = best?.name === p.player_name && numeric.length > 1;
              let display = raw ?? '—';
              if (typeof raw === 'number') {
                if (stat.key === 'sv_pct') display = raw.toFixed(1) + '%';
                else if (stat.key === 'gaa' || stat.key === 'ppg') display = raw.toFixed(2);
                else if (stat.key === 'plus_minus' && raw > 0) display = `+${raw}`;
                else display = raw % 1 === 0 ? raw : raw.toFixed(1);
              }
              return (
                <div key={i} style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 4,
                  marginBottom: 2,
                }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: c.line, flexShrink: 0 }} />
                  <span style={{
                    fontSize: 13,
                    fontWeight: isBest ? 800 : 500,
                    color: isBest ? c.line : '#555',
                    fontVariantNumeric: 'tabular-nums',
                  }}>
                    {display}
                  </span>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
/**
 * PlayerStatsChart
 *
 * Props:
 *   players  – array of player objects: { player_name, team?, position, stats: { gp, g, a, pts, ... } }
 *   title    – optional string override for the panel title
 *   mode     – 'skater' | 'goalie' | 'auto' (default: 'auto', detects from position field)
 */
export default function PlayerStatsChart({ players = [], title, mode = 'auto' }) {
  const [hoverStat, setHoverStat] = useState(null);

  const isGoalie = mode === 'goalie' || (mode === 'auto' && players.every(p => p.position === 'G'));
  const statDefs = isGoalie ? GOALIE_STATS : SKATER_STATS;
  const statKeys = statDefs.map(s => s.key);

  // Normalised data for the chart (0-100 axis)
  const normPlayers = useMemo(() => normalise(players, statKeys), [players, statKeys]); // eslint-disable-line

  // Build one data point per stat, with each player as a key
  const chartData = useMemo(() =>
    statDefs.map(stat => {
      const point = { stat: stat.label };
      normPlayers.forEach(p => {
        point[p.player_name] = parseFloat((p._norm[stat.key] ?? 0).toFixed(2));
      });
      return point;
    }),
  [normPlayers, statDefs]); // eslint-disable-line

  const panelTitle = title || (isGoalie ? 'Goalie Stats' : 'Skater Stats');

  if (!players.length) {
    return (
      <div style={containerStyle}>
        <div style={headerStyle}><span style={titleStyle}>{panelTitle}</span></div>
        <div style={{ padding: '40px', textAlign: 'center', color: '#bbb', fontStyle: 'italic' }}>
          No players selected for comparison.
        </div>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      {/* ── Panel header ── */}
      <div style={headerStyle}>
        <span style={titleStyle}>{panelTitle}</span>
        <span style={subtitleStyle}>Normalised comparison (0 – 100)</span>
      </div>

      {/* ── Line chart ── */}
      <div style={{ padding: '8px 16px 0' }}>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart
            data={chartData}
            margin={{ top: 12, right: 20, left: -18, bottom: 0 }}
            onMouseLeave={() => setHoverStat(null)}
          >
            <CartesianGrid
              stroke="#e8e6e0"
              strokeDasharray="4 3"
              vertical={false}
            />
            <XAxis
              dataKey="stat"
              tick={{ fontSize: 11, fontWeight: 700, fill: '#999', letterSpacing: '0.05em' }}
              axisLine={false}
              tickLine={false}
              dy={6}
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fontSize: 10, fill: '#ccc' }}
              axisLine={false}
              tickLine={false}
              tickCount={5}
              tickFormatter={v => v === 0 ? '' : `${v}`}
            />
            <Tooltip
              content={
                <CustomTooltip
                  statDefs={statDefs}
                  rawPlayers={players}
                />
              }
              cursor={{ stroke: '#ddd', strokeWidth: 1, strokeDasharray: '4 3' }}
            />
            <ReferenceLine y={50} stroke="#e0ddd7" strokeDasharray="3 3" />

            {normPlayers.map((p, i) => {
              const c = PLAYER_COLORS[i % PLAYER_COLORS.length];
              return (
                <Line
                  key={p.player_name}
                  type="monotone"
                  dataKey={p.player_name}
                  stroke={c.line}
                  strokeWidth={2.5}
                  dot={<Dot r={4} fill={c.line} stroke="#fff" strokeWidth={2} />}
                  activeDot={<ActiveDot fill={c.line} r={6} />}
                  animationDuration={500}
                />
              );
            })}
          </LineChart>
        </ResponsiveContainer>

        {/* ── Legend ── */}
        <ChartLegend players={players} />
      </div>

      {/* ── Raw stat summary grid ── */}
      <div style={{ marginTop: 14 }}>
        <StatSummaryRow players={players} statDefs={statDefs} />
      </div>
    </div>
  );
}

// ─── Inline styles for the shell (avoids CSS module dependency) ──────────────
const containerStyle = {
  fontFamily: "'Inter', 'Helvetica Neue', sans-serif",
  background: '#f5f4f0',
  borderRadius: 12,
  overflow: 'hidden',
  boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
};
const headerStyle = {
  display: 'flex',
  alignItems: 'baseline',
  gap: 12,
  padding: '12px 18px 8px',
  borderBottom: '1.5px solid #eae8e3',
};
const titleStyle = {
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: '0.10em',
  textTransform: 'uppercase',
  color: '#888',
};
const subtitleStyle = {
  fontSize: 10.5,
  color: '#bbb',
  letterSpacing: '0.03em',
};
