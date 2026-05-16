import React, { useState, useEffect } from 'react';
import styles from './PlayerCompare.module.css';
import { fetchPlayers } from '../api';

// ── Stat formatting helpers ──────────────────────────────────────────────────
const fmt   = (v, dec = 1) => (v == null ? '—' : typeof v === 'number' ? v.toFixed(dec) : v);
const fmtPct = (v) => (v == null ? '—' : `${v.toFixed(1)}%`);
const fmtNum = (v) => (v == null ? '—' : typeof v === 'number' ? v.toFixed(0) : v);

// ── Inline search/select dropdown ────────────────────────────────────────────
function PlayerSearch({ slot, onSelect, disabled }) {
  const [query, setQuery]     = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen]       = useState(false);

  useEffect(() => {
    if (query.length < 2) { setResults([]); return; }
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetchPlayers({ search: query, pageSize: 12, page: 0 });
        setResults(res.data || []);
      } catch { setResults([]); }
      finally { setLoading(false); }
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  const pick = (player) => {
    onSelect(player);
    setQuery('');
    setResults([]);
    setOpen(false);
  };

  return (
    <div className={styles.searchWrap}>
      <input
        className={styles.searchInput}
        placeholder={`Search player ${slot}…`}
        value={query}
        disabled={disabled}
        onChange={e => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {open && (loading || results.length > 0) && (
        <div className={styles.dropdown}>
          {loading && <div className={styles.dropLoading}>Searching…</div>}
          {results.map((p, i) => (
            <div key={p._id || i} className={styles.dropItem} onMouseDown={() => pick(p)}>
              <span className={styles.dropName}>{p.player_name}</span>
              <span className={styles.dropMeta}>
                {p.position} · {p.team} · {p.season}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Stat row with bar visualisation ──────────────────────────────────────────
function StatRow({ label, left, right, leftRaw, rightRaw, higherIsBetter = true }) {
  const lv = parseFloat(leftRaw)  || 0;
  const rv = parseFloat(rightRaw) || 0;
  const max = Math.max(lv, rv, 0.001);

  const lPct = (lv / max) * 100;
  const rPct = (rv / max) * 100;

  const lWins = higherIsBetter ? lv > rv : lv < rv;
  const rWins = higherIsBetter ? rv > lv : rv < lv;

  return (
    <div className={styles.statRow}>
      <span className={`${styles.statVal} ${lWins ? styles.winner : ''}`}>{left}</span>
      <div className={styles.barWrap}>
        <div className={styles.barLeft}  style={{ width: `${lPct}%`, opacity: lWins ? 1 : 0.45 }} />
        <span className={styles.statLabel}>{label}</span>
        <div className={styles.barRight} style={{ width: `${rPct}%`, opacity: rWins ? 1 : 0.45 }} />
      </div>
      <span className={`${styles.statVal} ${styles.right} ${rWins ? styles.winner : ''}`}>{right}</span>
    </div>
  );
}

// ── Player card header ────────────────────────────────────────────────────────
function PlayerCard({ player, slot, onClear, onSelect }) {
  if (!player) {
    return (
      <div className={styles.emptySlot}>
        <div className={styles.emptyIcon}>{slot === 1 ? '①' : '②'}</div>
        <div className={styles.emptyLabel}>Select a player to compare</div>
        <PlayerSearch slot={slot} onSelect={onSelect} />
      </div>
    );
  }

  const s = player.stats || {};
  const isGoalie = (player.position || '').toUpperCase() === 'G';

  return (
    <div className={styles.playerCard}>
      <div className={styles.cardTop}>
        <div>
          <div className={styles.playerName}>{player.player_name}</div>
          <div className={styles.playerMeta}>
            <span className={`${styles.posBadge} ${isGoalie ? styles.posG : styles.posSk}`}>
              {player.position || '—'}
            </span>
            <span>{player.team}</span>
            <span className={styles.dot}>·</span>
            <span>{player.league?.toUpperCase()}</span>
            <span className={styles.dot}>·</span>
            <span>{player.season}</span>
          </div>
          {player.birthYear && player.birthYear !== 'N/A' && (
            <div className={styles.birthYear}>Born {player.birthYear}</div>
          )}
        </div>
        <button className={styles.clearBtn} onClick={onClear} title="Remove player">✕</button>
      </div>
      <PlayerSearch slot={slot} onSelect={onSelect} />
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function PlayerCompare() {
  const [left,  setLeft]  = useState(null);
  const [right, setRight] = useState(null);

  const ls = left?.stats  || {};
  const rs = right?.stats || {};

  const lIsGoalie = (left?.position  || '').toUpperCase() === 'G';
  const rIsGoalie = (right?.position || '').toUpperCase() === 'G';
  const bothGoalies  = lIsGoalie && rIsGoalie;
  const bothSkaters  = !lIsGoalie && !rIsGoalie;
  const mixed        = !bothGoalies && !bothSkaters;

  return (
    <div className={styles.wrap}>

      {/* ── Header ── */}
      <div className={styles.header}>
        <div className={styles.headerText}>
          <h2 className={styles.title}>Player Comparison</h2>
          <p className={styles.subtitle}>
            Search and select two players to compare stats side-by-side
          </p>
        </div>
        {(left || right) && (
          <button className={styles.resetBtn} onClick={() => { setLeft(null); setRight(null); }}>
            Clear all ✕
          </button>
        )}
      </div>

      {/* ── Selector row ── */}
      <div className={styles.selectorRow}>
        <PlayerCard player={left}  slot={1} onClear={() => setLeft(null)}  onSelect={setLeft} />
        <div className={styles.vsChip}>VS</div>
        <PlayerCard player={right} slot={2} onClear={() => setRight(null)} onSelect={setRight} />
      </div>

      {/* ── Comparison panels ── */}
      {left && right && (
        <div className={styles.compareWrap}>

          {/* Mixed-position notice */}
          {mixed && (
            <div className={styles.mixedNotice}>
              ⚠ Comparing a goalie and a skater — only shared stats are shown.
            </div>
          )}

          {/* Shared / skater stats */}
          {(bothSkaters || mixed) && (
            <section className={styles.section}>
              <div className={styles.sectionTitle}>Skater Stats</div>
              <StatRow label="GP"  left={fmtNum(ls.gp)}  right={fmtNum(rs.gp)}  leftRaw={ls.gp}  rightRaw={rs.gp} />
              <StatRow label="G"   left={fmtNum(ls.g)}   right={fmtNum(rs.g)}   leftRaw={ls.g}   rightRaw={rs.g} />
              <StatRow label="A"   left={fmtNum(ls.a)}   right={fmtNum(rs.a)}   leftRaw={ls.a}   rightRaw={rs.a} />
              <StatRow label="PTS" left={fmtNum(ls.pts)} right={fmtNum(rs.pts)} leftRaw={ls.pts} rightRaw={rs.pts} />
              <StatRow label="+/-" left={fmtNum(ls.plus_minus)} right={fmtNum(rs.plus_minus)} leftRaw={ls.plus_minus} rightRaw={rs.plus_minus} />
              <StatRow label="PIM" left={fmtNum(ls.pim)} right={fmtNum(rs.pim)} leftRaw={ls.pim} rightRaw={rs.pim} higherIsBetter={false} />
              <StatRow label="PPG" left={fmtNum(ls.ppg)} right={fmtNum(rs.ppg)} leftRaw={ls.ppg} rightRaw={rs.ppg} />
            </section>
          )}

          {/* Goalie stats */}
          {(bothGoalies || mixed) && (
            <section className={styles.section}>
              <div className={styles.sectionTitle}>Goalie Stats</div>
              <StatRow label="GP"   left={fmtNum(ls.gp)}     right={fmtNum(rs.gp)}     leftRaw={ls.gp}     rightRaw={rs.gp} />
              <StatRow label="W"    left={fmtNum(ls.w)}      right={fmtNum(rs.w)}      leftRaw={ls.w}      rightRaw={rs.w} />
              <StatRow label="L"    left={fmtNum(ls.l)}      right={fmtNum(rs.l)}      leftRaw={ls.l}      rightRaw={rs.l}  higherIsBetter={false} />
              <StatRow label="GAA"  left={fmt(ls.gaa, 2)}    right={fmt(rs.gaa, 2)}    leftRaw={ls.gaa}    rightRaw={rs.gaa} higherIsBetter={false} />
              <StatRow label="SV%"  left={fmtPct(ls.sv_pct)} right={fmtPct(rs.sv_pct)} leftRaw={ls.sv_pct} rightRaw={rs.sv_pct} />
              <StatRow label="SO"   left={fmtNum(ls.so)}     right={fmtNum(rs.so)}     leftRaw={ls.so}     rightRaw={rs.so} />
            </section>
          )}

        </div>
      )}

      {/* ── Empty state ── */}
      {!left && !right && (
        <div className={styles.emptyState}>
          <div className={styles.emptyStateIcon}>⬡</div>
          <div className={styles.emptyStateText}>
            Use the search boxes above to load two players and compare their stats head-to-head.
          </div>
        </div>
      )}
    </div>
  );
}
