import React from 'react';
import styles from './MetricCards.module.css';

const fmt = (v, dec = 1) => (v == null || v === '') ? '—' : typeof v === 'number' ? v.toFixed(dec) : v;

// Mini horizontal bar showing a proportion (0–1)
function MiniBar({ pct, color }) {
  return (
    <div className={styles.miniBarTrack}>
      <div className={styles.miniBarFill} style={{ width: `${Math.min(100, pct * 100)}%`, background: color }} />
    </div>
  );
}

// Clickable player name — opens profile drawer if handler provided
function PlayerName({ name, onClick }) {
  if (!name || name === '—') return <span className={styles.value}>—</span>;
  if (!onClick) return <span className={styles.value}>{name}</span>;
  return (
    <button className={`${styles.value} ${styles.nameBtn}`} onClick={() => onClick(name)} title={`View ${name}'s profile`}>
      {name}
    </button>
  );
}

export default function MetricCards({ metrics, loading, onPlayerClick }) {
  const m = metrics || {};

  const total   = m.totalPlayers || 0;
  const fwd     = m.forwards     || 0;
  const def     = m.defensemen   || 0;
  const gls     = m.goalies      || 0;
  const skaters = fwd + def;
  const posTotal = fwd + def + gls || 1;

  return (
    <div className={`${styles.grid} ${loading ? styles.loading : ''}`}>

      {/* ── Roster split ── */}
      <div className={`${styles.card} ${styles.accent}`}>
        <div className={styles.label}>Roster split</div>
        <div className={styles.bigNum}>{total.toLocaleString()}</div>
        <div className={styles.sub}>total players</div>
        <div className={styles.splitBars}>
          <div className={styles.splitRow}>
            <span className={styles.splitLabel}>F</span>
            <MiniBar pct={fwd / posTotal} color="var(--accent, #E8472A)" />
            <span className={styles.splitCount}>{fwd}</span>
          </div>
          <div className={styles.splitRow}>
            <span className={styles.splitLabel}>D</span>
            <MiniBar pct={def / posTotal} color="var(--teal, #0D7C6B)" />
            <span className={styles.splitCount}>{def}</span>
          </div>
          <div className={styles.splitRow}>
            <span className={styles.splitLabel}>G</span>
            <MiniBar pct={gls / posTotal} color="var(--blue, #1B5FA8)" />
            <span className={styles.splitCount}>{gls}</span>
          </div>
        </div>
      </div>

      {/* ── Top forward ── */}
      <div className={`${styles.card} ${styles.teal}`}>
        <div className={styles.label}>Top forward scorer</div>
        <PlayerName name={m.topForwardScorer ?? '—'} onClick={onPlayerClick} />
        <div className={styles.sub}>{m.maxForwardPts ?? 0} PTS this view</div>
        <div className={styles.statRow}>
          <span className={styles.statChip} style={{ background: 'rgba(13,124,107,0.1)', color: 'var(--teal)' }}>
            {fwd} forwards in view
          </span>
        </div>
      </div>

      {/* ── Top defenseman ── */}
      <div className={`${styles.card} ${styles.amber}`}>
        <div className={styles.label}>Top defense scorer</div>
        <PlayerName name={m.topDefenseScorer ?? '—'} onClick={onPlayerClick} />
        <div className={styles.sub}>{m.maxDefensePts ?? 0} PTS · {fmt(m.avgDefenseBlks ?? 0, 1)} BLK avg</div>
        <div className={styles.statRow}>
          <span className={styles.statChip} style={{ background: 'rgba(186,117,23,0.1)', color: 'var(--amber)' }}>
            {def} defensemen in view
          </span>
        </div>
      </div>

      {/* ── Top goalie ── */}
      <div className={`${styles.card} ${styles.blue}`}>
        <div className={styles.label}>Top goalie</div>
        <PlayerName name={m.topGoalie ?? '—'} onClick={onPlayerClick} />
        <div className={styles.sub}>
          {m.maxGoalieSVP ? `${fmt(m.maxGoalieSVP, 1)}% SV%` : '—'} · {fmt(m.topGoalieGAA, 2)} GAA
        </div>
        <div className={styles.statRow}>
          <span className={styles.statChip} style={{ background: 'rgba(27,95,168,0.1)', color: 'var(--blue)' }}>
            League avg {m.avgSVP ? `${fmt(m.avgSVP, 1)}% SV%` : '—'}
          </span>
        </div>
      </div>

      {/* ── Active leagues ── */}
      <div className={`${styles.card} ${styles.neutral}`}>
        <div className={styles.label}>Active leagues</div>
        <div className={styles.bigNum}>{m.leagueCount ?? '—'}</div>
        <div className={styles.sub}>leagues in current view</div>
        <div className={styles.statRow}>
          <span className={styles.statChip}>
            {skaters} skaters · {gls} goalies
          </span>
        </div>
      </div>

    </div>
  );
}
