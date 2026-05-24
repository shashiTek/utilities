import React, { useMemo, useRef, useCallback } from 'react';
import { fetchPlayersExport } from '../api';
import styles from './PlayerTable.module.css';

// ─── CSV export ────────────────────────────────────────────────────────────────
function exportCSV(data, cols) {
  const headers = cols.map(c => c.label);
  const rows = data.map(row => cols.map(c => {
    const s = row.stats || {};
    let v;
    switch (c.key) {
      case 'player_name': v = row.player_name; break;
      case 'position':    v = row.position;    break;
      case 'league':      v = (row.league || '').toUpperCase(); break;
      case 'team':        v = row.team;        break;
      case 'season':      v = row.season;      break;
      case 'birthYear':   v = row.birthYear;   break;
      case 'birthState':  v = row.birthState;  break;
      case 'gp':  v = s.gp;         break;
      case 'g':   v = s.g;          break;
      case 'a':   v = s.a;          break;
      case 'pts': v = s.pts;        break;
      case 'pm':  v = s.plus_minus; break;
      case 'pim': v = s.pim;        break;
      case 'ppg': v = s.ppg;        break;
      case 'w':   v = s.w;          break;
      case 'l':   v = s.l;          break;
      case 'ot':  v = s.ot;         break;
      case 'gaa': v = s.gaa;        break;
      case 'svp': v = s.sv_pct;     break;
      case 'so':  v = s.so;         break;
      default:    v = row[c.key];
    }
    const str = v == null ? '' : String(v);
    return str.includes(',') ? `"${str}"` : str;
  }));
  const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = 'players.csv'; a.click();
  URL.revokeObjectURL(url);
}

// ─── Formatters ────────────────────────────────────────────────────────────────
const fmt    = (v, dec = 1) => (v == null ? '—' : typeof v === 'number' ? v.toFixed(dec) : v);
const fmtPct = (v)          => (v == null ? '—' : v.toFixed(1) + '%');

// ─── Position badge ────────────────────────────────────────────────────────────
function PosBadge({ pos }) {
  return <span className={pos === 'G' ? styles.badgeG : styles.badgeSk}>{pos}</span>;
}

// ─── Inline stat bar cell ──────────────────────────────────────────────────────
// Renders the value as text AND draws a proportional bar behind it.
// `pct`  : 0–1 fill fraction (clamped)
// `highlight` : true for the "leader" value (bolder colour)
function StatBar({ value, pct, highlight, isNeg }) {
  const fill = Math.min(1, Math.max(0, pct ?? 0));
  return (
    <div className={styles.statBarWrap}>
      {/* Track */}
      <div className={styles.statBarTrack}>
        <div
          className={`${styles.statBarFill} ${highlight ? styles.statBarHighlight : ''} ${isNeg ? styles.statBarNeg : ''}`}
          style={{ width: `${fill * 100}%` }}
        />
      </div>
      {/* Value floated above the bar */}
      <span className={`${styles.statBarValue} ${highlight ? styles.statBarValueHighlight : ''}`}>
        {value}
      </span>
    </div>
  );
}

// ─── Column definitions ────────────────────────────────────────────────────────
const BASE_COLS = [
  { key: 'player_name', label: 'Player',  w: '150px' },
  { key: 'birthYear',   label: 'Born',    w: '54px'  },
  { key: 'birthState',  label: 'State',   w: '54px'  },
  { key: 'season',      label: 'Season',  w: '94px'  },
  { key: 'league',      label: 'League',  w: '80px'  },
  { key: 'team',        label: 'Team',    w: '130px' },
];

const GOALIE_STAT_COLS = [
  { key: 'gp',  label: 'GP',  w: '80px',  num: true, sortPath: 'stats.gp'     },
  { key: 'w',   label: 'W',   w: '80px',  num: true, sortPath: 'stats.w'      },
  { key: 'l',   label: 'L',   w: '80px',  num: true, sortPath: 'stats.l'      },
  { key: 'ot',  label: 'OT',  w: '80px',  num: true, sortPath: 'stats.ot'     },
  { key: 'gaa', label: 'GAA', w: '90px',  num: true, sortPath: 'stats.gaa',  dec: 2, lowerBetter: true },
  { key: 'svp', label: 'SV%', w: '90px',  num: true, sortPath: 'stats.sv_pct', pct: true },
  { key: 'so',  label: 'SO',  w: '80px',  num: true, sortPath: 'stats.so'     },
];

const SKATER_STAT_COLS = [
  { key: 'gp',  label: 'GP',  w: '80px',  num: true, sortPath: 'stats.gp'          },
  { key: 'g',   label: 'G',   w: '80px',  num: true, sortPath: 'stats.g'           },
  { key: 'a',   label: 'A',   w: '80px',  num: true, sortPath: 'stats.a'           },
  { key: 'pts', label: 'PTS', w: '90px',  num: true, sortPath: 'stats.pts'         },
  { key: 'pm',  label: '+/-', w: '90px',  num: true, sortPath: 'stats.plus_minus'  },
  { key: 'pim', label: 'PIM', w: '80px',  num: true, sortPath: 'stats.pim'         },
  { key: 'ppg', label: 'PPG', w: '80px',  num: true, sortPath: 'stats.ppg', dec: 2 },
];

const MIXED_STAT_COLS = [
  { key: 'gp',  label: 'GP',  w: '80px',  num: true, sortPath: 'stats.gp'         },
  { key: 'pts', label: 'PTS', w: '90px',  num: true, sortPath: 'stats.pts'        },
  { key: 'gaa', label: 'GAA', w: '90px',  num: true, sortPath: 'stats.gaa', dec: 2, lowerBetter: true },
  { key: 'svp', label: 'SV%', w: '90px',  num: true, sortPath: 'stats.sv_pct', pct: true },
];

const GOALIE_COLS = [...BASE_COLS, ...GOALIE_STAT_COLS];
const SKATER_COLS = [...BASE_COLS, ...SKATER_STAT_COLS];
const MIXED_COLS  = [
  { key: 'player_name', label: 'Player',  w: '140px' },
  { key: 'position',    label: 'Pos',     w: '52px'  },
  { key: 'birthYear',   label: 'Born',    w: '54px'  },
  { key: 'birthState',  label: 'State',   w: '54px'  },
  { key: 'season',      label: 'Season',  w: '94px'  },
  { key: 'league',      label: 'League',  w: '80px'  },
  { key: 'team',        label: 'Team',    w: '120px' },
  ...MIXED_STAT_COLS,
];

// ─── Helpers ───────────────────────────────────────────────────────────────────

/** Extract the raw numeric value for a given column key from a row object */
function getRawValue(ck, row) {
  const s = row.stats || {};
  switch (ck) {
    case 'gp':  return s.gp;
    case 'w':   return s.w;
    case 'l':   return s.l;
    case 'ot':  return s.ot;
    case 'gaa': return s.gaa;
    case 'svp': return s.sv_pct;
    case 'so':  return s.so;
    case 'g':   return s.g;
    case 'a':   return s.a;
    case 'pts': return s.pts;
    case 'pm':  return s.plus_minus;
    case 'pim': return s.pim;
    case 'ppg': return s.ppg;
    default:    return row[ck];
  }
}

/** Compute per-column max values from the current page of data (for bar scaling) */
function computeMaxes(data, statCols) {
  const maxes = {};
  for (const col of statCols) {
    if (!col.num) continue;
    let mx = 0;
    for (const row of data) {
      const v = getRawValue(col.key, row);
      if (typeof v === 'number') mx = Math.max(mx, Math.abs(v));
    }
    maxes[col.key] = mx || 1; // avoid divide-by-zero
  }
  return maxes;
}

// ─── Component ─────────────────────────────────────────────────────────────────
export default function PlayerTable({
  data, loading, total, page, pageSize, onSort, sortBy, sortDir, onPage,
  currentPositionFilter = 'ALL', onPlayerClick,
  birthYearFrom, birthYearTo, season, league, position, search,
}) {
  const wrapRef = useRef(null);

  // Scroll table back to top on page change and expose a stable handler
  const handlePage = useCallback((p) => {
    onPage(p);
    wrapRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [onPage]);

  const cols = useMemo(() => {
    const f = String(currentPositionFilter).trim().toUpperCase();
    if (['G', 'GK', 'GOALIE'].includes(f))                          return GOALIE_COLS;
    if (['F', 'D', 'FORWARD', 'DEFENSE', 'SKATER', 'F/D', 'F-D'].includes(f)) return SKATER_COLS;
    return MIXED_COLS;
  }, [currentPositionFilter]);

  // Handle async export of all records
  const handleExportAll = useCallback(async () => {
    try {
      const res = await fetchPlayersExport({
        birthYearFrom: birthYearFrom || undefined,
        birthYearTo: birthYearTo || undefined,
        season: season || undefined,
        league: league || undefined,
        position: position || undefined,
        search: search || undefined,
        sortBy: sortBy,
        sortDir: sortDir,
      });
      if (res && res.data) {
        exportCSV(res.data, cols);
      }
    } catch (err) {
      console.error('Export failed:', err);
      alert('Failed to export data');
    }
  }, [birthYearFrom, birthYearTo, season, league, position, search, sortBy, sortDir, cols]);

  // Stat columns are those with num:true (for bar rendering)
  const statCols = cols.filter(c => c.num);

  // Per-column maxes computed from visible page data
  const maxes = useMemo(() => computeMaxes(data, statCols), [data, statCols]); // eslint-disable-line

  const totalPages = Math.ceil(total / pageSize);
  const thClick    = (col) => onSort(col.sortPath || col.key);

  return (
    <div className={styles.wrap} ref={wrapRef}>
      {/* ── Header bar ── */}
      <div className={styles.header}>
        <span className={styles.count}>
          {loading ? 'Loading…' : `${total.toLocaleString()} player${total !== 1 ? 's' : ''}`}
        </span>
        <span className={styles.pageInfo}>
          {total > 0 &&
            `${page * pageSize + 1}–${Math.min((page + 1) * pageSize, total)} of ${total}`}
        </span>
        {data.length > 0 && (
          <button
            className={styles.exportBtn}
            onClick={handleExportAll}
            title="Export all records to CSV"
          >
            ↓ Export CSV
          </button>
        )}
      </div>

      {/* ── Scrollable table ── */}
      <div className={styles.tableWrap}>
        <table className={`${styles.table} ${loading ? styles.loading : ''}`}>
          <thead>
            <tr>
              {cols.map(c => {
                const isActive = sortBy === c.key || sortBy === c.sortPath;
                return (
                  <th
                    key={c.key}
                    style={{ width: c.w, minWidth: c.w }}
                    className={`${c.num ? styles.thNum : ''} ${isActive ? styles.sorted : ''}`}
                    onClick={() => thClick(c)}
                  >
                    {c.label}
                    <span className={styles.arrow}>
                      {isActive ? (sortDir === 'asc' ? '▲' : '▼') : '↕'}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody>
            {data.length === 0 && !loading && (
              <tr>
                <td colSpan={cols.length} className={styles.empty}>
                  No players match your filters.
                </td>
              </tr>
            )}

            {data.map((row, i) => {
              const rowId   = row._id || i;
              const statsObj = row.stats || {};
              const pmVal   = statsObj.plus_minus;

              return (
                <tr key={rowId}>
                  {cols.map(c => {
                    const ck = c.key;

                    // ── Non-numeric identity cells ──────────────────────────
                    if (ck === 'player_name')
                      return (
                        <td key={ck} className={styles.name}>
                          {onPlayerClick ? (
                            <button
                              className={styles.nameBtn}
                              onClick={() => onPlayerClick(row.player_name)}
                              title={`View ${row.player_name}'s profile`}
                            >
                              {row.player_name}
                            </button>
                          ) : row.player_name}
                        </td>
                      );
                    if (ck === 'position')
                      return <td key={ck}><PosBadge pos={row.position} /></td>;
                    if (ck === 'league')
                      return <td key={ck} className={styles.leagueCell}>{(row.league || '').toUpperCase()}</td>;
                    if (ck === 'team')
                      return (
                        <td key={ck} className={styles.teamCell}>
                          <span className={styles.teamText}>{row.team ?? '—'}</span>
                        </td>
                      );
                    if (ck === 'season')
                      return <td key={ck}><span className={styles.seasonTag}>{row.season}</span></td>;
                    if (ck === 'birthYear')
                      return <td key={ck} className={styles.num}>{row.birthYear ?? '—'}</td>;
                    if (ck === 'birthState')
                      return <td key={ck} className={styles.num}>{row.birthState ?? '—'}</td>;

                    // ── Numeric / stat cells with inline bar ────────────────
                    const raw = getRawValue(ck, row);

                    if (raw == null)
                      return <td key={ck} className={styles.numCell}><span className={styles.nullVal}>—</span></td>;

                    // Format display value
                    let display;
                    if (c.pct)         display = fmtPct(raw);
                    else if (c.dec != null) display = fmt(raw, c.dec);
                    else               display = typeof raw === 'number' ? raw.toFixed(0) : raw;

                    // +/- prefix
                    if (ck === 'pm' && typeof raw === 'number' && raw > 0) display = `+${display}`;

                    // Bar fill fraction (0–1)
                    const mx  = maxes[ck] || 1;
                    const pct = Math.abs(raw) / mx;

                    // Colour logic
                    const isHighlight = sortBy === c.key || sortBy === c.sortPath;
                    const isNegative  = ck === 'pm' && raw < 0;

                    return (
                      <td
                        key={ck}
                        className={`${styles.numCell} ${ck === 'pm' ? (raw > 0 ? styles.pos : raw < 0 ? styles.neg : '') : ''}`}
                      >
                        <StatBar
                          value={display}
                          pct={pct}
                          highlight={isHighlight}
                          isNeg={isNegative}
                        />
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <div className={styles.pager}>
          <button onClick={() => handlePage(0)}              disabled={page === 0}>«</button>
          <button onClick={() => handlePage(page - 1)}       disabled={page === 0}>‹ Prev</button>
          <span className={styles.pageCounter}>{page + 1} / {totalPages}</span>
          <button onClick={() => handlePage(page + 1)}       disabled={page >= totalPages - 1}>Next ›</button>
          <button onClick={() => handlePage(totalPages - 1)} disabled={page >= totalPages - 1}>»</button>
        </div>
      )}
    </div>
  );
}
