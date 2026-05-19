import React, { useState, useEffect } from 'react';
import styles from './PlayerCompare.module.css';
import { fetchPlayers } from '../api';
import PlayerStatsChart from './PlayerStatsChart';


// ── Inline search/select dropdown ────────────────────────────────────────────
function PlayerSearch({ slot, onSelect, disabled }) {
  const [query,   setQuery]   = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open,    setOpen]    = useState(false);

  useEffect(() => {
    if (query.length < 2) { setResults([]); setLoading(false); return; }
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetchPlayers({ search: query, pageSize: 12, page: 0 });
        setResults(res.data || []);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  const pick = (player) => {
    onSelect(player);
    setQuery('');
    setResults([]);
    setOpen(false);
  };

  const showDropdown = open && query.length >= 2;

  return (
    <div className={styles.searchWrap}>
      <input
        className={styles.searchInput}
        placeholder={`Search player ${slot}…`}
        value={query}
        disabled={disabled}
        autoComplete="off"
        onChange={e => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
      />
      {showDropdown && (
        /* onMouseDown + e.preventDefault() on the container stops the input
           from losing focus before the item's onClick fires — fixes the
           blur-before-click race condition that swallowed selections. */
        <div
          className={styles.dropdown}
          onMouseDown={e => e.preventDefault()}
        >
          {loading && <div className={styles.dropLoading}>Searching…</div>}
          {!loading && results.length === 0 && (
            <div className={styles.dropEmpty}>No players found for "{query}"</div>
          )}
          {results.map((p, i) => {
            const meta = [
              p.position || null,
              p.team     || null,
              p.league   ? p.league.toUpperCase() : null,
              p.season   || null,
            ].filter(Boolean).join(' · ');

            return (
              <div
                key={p._id || i}
                className={styles.dropItem}
                onClick={() => pick(p)}
              >
                <span className={styles.dropName}>{p.player_name || '—'}</span>
                {meta && <span className={styles.dropMeta}>{meta}</span>}
              </div>
            );
          })}
        </div>
      )}
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

          {/* Line chart comparison */}
          <PlayerStatsChart
            players={[left, right]}
            mode={bothGoalies ? 'goalie' : bothSkaters ? 'skater' : 'auto'}
          />

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
