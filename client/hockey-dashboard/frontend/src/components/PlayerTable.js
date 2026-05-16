import React, { useMemo } from 'react';
import styles from './PlayerTable.module.css';

// Static utility formatting parameters (Isolated from execution loops)
const fmt = (v, dec = 1) => (v == null ? '—' : typeof v === 'number' ? v.toFixed(dec) : v);
const fmtPct = (v) => (v == null ? '—' : v.toFixed(1) + '%');

function PosBadge({ pos }) {
  return <span className={pos === 'G' ? styles.badgeG : styles.badgeSk}>{pos}</span>;
}

const GOALIE_COLS = [
  { key: 'player_name', label: 'Player', w: '150px' },
  { key: 'birthYear', label: 'Born', w: '54px' },
  { key: 'season', label: 'Season', w: '94px' },
  { key: 'league', label: 'League', w: '80px' },
  { key: 'team', label: 'Team', w: '130px' },
  { key: 'gp', label: 'GP', w: '44px', num: true, sortPath: 'stats.gp' },
  { key: 'w', label: 'W', w: '40px', num: true, sortPath: 'stats.w' },
  { key: 'l', label: 'L', w: '40px', num: true, sortPath: 'stats.l' },
  { key: 'ot', label: 'OT', w: '40px', num: true, sortPath: 'stats.ot' },
  { key: 'gaa', label: 'GAA', w: '56px', num: true, sortPath: 'stats.gaa', dec: 2 },
  { key: 'svp', label: 'SV%', w: '56px', num: true, sortPath: 'stats.sv_pct', pct: true },
  { key: 'so', label: 'SO', w: '40px', num: true, sortPath: 'stats.so' },
];

const SKATER_COLS = [
  { key: 'player_name', label: 'Player', w: '150px' },
  { key: 'birthYear', label: 'Born', w: '54px' },
  { key: 'season', label: 'Season', w: '94px' },
  { key: 'league', label: 'League', w: '80px' },
  { key: 'team', label: 'Team', w: '130px' },
  { key: 'gp', label: 'GP', w: '44px', num: true, sortPath: 'stats.gp' },
  { key: 'g', label: 'G', w: '40px', num: true, sortPath: 'stats.g' },
  { key: 'a', label: 'A', w: '40px', num: true, sortPath: 'stats.a' },
  { key: 'pts', label: 'PTS', w: '48px', num: true, sortPath: 'stats.pts' },
  { key: 'pm', label: '+/-', w: '48px', num: true, sortPath: 'stats.plus_minus' },
  { key: 'pim', label: 'PIM', w: '48px', num: true, sortPath: 'stats.pim' },
  { key: 'ppg', label: 'PPG', w: '48px', num: true, sortPath: 'stats.ppg' },
];

const MIXED_COLS = [
  { key: 'player_name', label: 'Player', w: '140px' },
  { key: 'position', label: 'Pos', w: '52px' },
  { key: 'birthYear', label: 'Born', w: '54px' },
  { key: 'season', label: 'Season', w: '94px' },
  { key: 'league', label: 'League', w: '80px' },
  { key: 'team', label: 'Team', w: '120px' },
  { key: 'gp', label: 'GP', w: '44px', num: true, sortPath: 'stats.gp' },
  { key: 'pts', label: 'PTS', w: '48px', num: true, sortPath: 'stats.pts' },
  { key: 'gaa', label: 'GAA', w: '54px', num: true, sortPath: 'stats.gaa', dec: 2 },
  { key: 'svp', label: 'SV%', w: '54px', num: true, sortPath: 'stats.sv_pct', pct: true },
];

export default function PlayerTable({ 
  data, loading, total, page, pageSize, onSort, sortBy, sortDir, onPage, 
  currentPositionFilter = 'ALL' 
}) {
  
  // FIX: Monitored ONLY by the position dropdown selection. 
  // Sorting array mutations will never cross-contaminate layout boundaries now.
  const cols = useMemo(() => {
    const cleanFilter = String(currentPositionFilter).trim().toUpperCase();
    
    if (['G', 'GK', 'GOALIE'].includes(cleanFilter)) {
      return GOALIE_COLS;
    }
    if (['F', 'D', 'FORWARD', 'DEFENSE', 'SKATER', 'F/D', 'F-D'].includes(cleanFilter)) {
      return SKATER_COLS;
    }
    
    return MIXED_COLS;
  }, [currentPositionFilter]); // Dropped dependency on 'data' completely to preserve structural alignment

  const totalPages = Math.ceil(total / pageSize);

  const thClick = (col) => {
    const backendSortTarget = col.sortPath || col.key;
    onSort(backendSortTarget);
  };

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <span className={styles.count}>
          {loading ? 'Loading…' : `${total.toLocaleString()} player${total !== 1 ? 's' : ''}`}
        </span>
        <span className={styles.pageInfo}>
          {total > 0 && `${page * pageSize + 1}–${Math.min((page + 1) * pageSize, total)} of ${total}`}
        </span>
      </div>
      <div className={styles.tableWrap}>
        <table className={`${styles.table} ${loading ? styles.loading : ''}`}>
          <thead>
            <tr>
              {cols.map(c => {
                const isActiveSort = sortBy === c.key || sortBy === c.sortPath;
                return (
                  <th 
                    key={c.key} 
                    style={{ width: c.w, minWidth: c.w }} 
                    className={isActiveSort ? styles.sorted : ''} 
                    onClick={() => thClick(c)}
                  >
                    {c.label}
                    <span className={styles.arrow}>
                      {isActiveSort ? (sortDir === 'asc' ? '▲' : '▼') : '↕'}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {data.length === 0 && !loading && (
              <tr><td colSpan={cols.length} className={styles.empty}>No players match your filters.</td></tr>
            )}
            {data.map((row, i) => {
              const rowId = row._id || i;
              const statsObj = row.stats || {};
              const pmVal = statsObj.plus_minus;

              return (
                <tr key={rowId}>
                  {cols.map(c => {
                    const ck = c.key;
                    
                    if (ck === 'player_name') return <td key={ck} className={styles.name}>{row.player_name}</td>;
                    if (ck === 'position')   return <td key={ck}><PosBadge pos={row.position} /></td>;
                    if (ck === 'league')     return <td key={ck} className={styles.leagueCell}>{(row.league || '').toUpperCase()}</td>;
                    if (ck === 'team')       return <td key={ck} className={styles.teamCell} style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.team ?? '—'}</td>;
                    if (ck === 'season')     return <td key={ck}><span className={styles.seasonTag}>{row.season}</span></td>;

                    let v;
                    if (ck === 'gp')   v = statsObj.gp;
                    else if (ck === 'w')   v = statsObj.w;
                    else if (ck === 'l')   v = statsObj.l;
                    else if (ck === 'ot')  v = statsObj.ot;
                    else if (ck === 'gaa') v = statsObj.gaa;
                    else if (ck === 'svp') v = statsObj.sv_pct;
                    else if (ck === 'so')  v = statsObj.so;
                    else if (ck === 'g')   v = statsObj.g;
                    else if (ck === 'a')   v = statsObj.a;
                    else if (ck === 'pts') v = statsObj.pts;
                    else if (ck === 'pm')  v = pmVal;
                    else if (ck === 'pim') v = statsObj.pim;
                    else if (ck === 'ppg') v = statsObj.ppg;
                    else v = row[ck];

                    if (v == null) return <td key={ck} className={c.num ? styles.num : ''}>—</td>;

                    let renderedVal = v;
                    if (c.pct) renderedVal = fmtPct(v);
                    else if (c.dec != null) renderedVal = fmt(v, c.dec);
                    else if (c.num) renderedVal = typeof v === 'number' ? v.toFixed(0) : v;

                    if (ck === 'pm' && pmVal != null) {
                      return (
                        <td key={ck} className={`${styles.num} ${pmVal > 0 ? styles.pos : pmVal < 0 ? styles.neg : ''}`}>
                          {pmVal > 0 ? '+' : ''}{renderedVal}
                        </td>
                      );
                    }

                    return (
                      <td key={ck} className={c.num ? styles.num : ''}>
                        {renderedVal}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className={styles.pager}>
          <button onClick={() => onPage(0)} disabled={page === 0}>«</button>
          <button onClick={() => onPage(page - 1)} disabled={page === 0}>‹ Prev</button>
          <span>{page + 1} / {totalPages}</span>
          <button onClick={() => onPage(page + 1)} disabled={page >= totalPages - 1}>Next ›</button>
          <button onClick={() => onPage(totalPages - 1)} disabled={page >= totalPages - 1}>»</button>
        </div>
      )}
    </div>
  );
}
