import React from 'react';
import styles from './PlayerTable.module.css';

const fmt = (v, dec = 1) => (v == null ? '—' : typeof v === 'number' ? v.toFixed(dec) : v);
const fmtPct = (v) => (v == null ? '—' : v.toFixed(1) + '%');

function PosBadge({ pos }) {
  return <span className={pos === 'G' ? styles.badgeG : styles.badgeSk}>{pos}</span>;
}

const GOALIE_COLS = [
  { key: 'player_name', label: 'Player',  w: '150px' },
  { key: 'birthYear',   label: 'Born',    w: '54px'  },
  { key: 'season',      label: 'Season',  w: '94px'  },
  { key: 'league',      label: 'League',  w: '80px'  },
  { key: 'team',        label: 'Team',    w: '130px' },
  { key: 'gp',  label: 'GP',  w: '44px', num: true, path: 'stats.gp'     },
  { key: 'w',   label: 'W',   w: '40px', num: true, path: 'stats.w'      },
  { key: 'l',   label: 'L',   w: '40px', num: true, path: 'stats.l'      },
  { key: 'ot',  label: 'OT',  w: '40px', num: true, path: 'stats.ot'     },
  { key: 'gaa', label: 'GAA', w: '56px', num: true, path: 'stats.gaa', dec: 2 },
  { key: 'svp', label: 'SV%', w: '56px', num: true, path: 'stats.sv_pct', pct: true },
  { key: 'so',  label: 'SO',  w: '40px', num: true, path: 'stats.so'     },
];

const SKATER_COLS = [
  { key: 'player_name', label: 'Player', w: '150px' },
  { key: 'birthYear',   label: 'Born',   w: '54px'  },
  { key: 'season',      label: 'Season', w: '94px'  },
  { key: 'league',      label: 'League', w: '80px'  },
  { key: 'team',        label: 'Team',   w: '130px' },
  { key: 'gp',  label: 'GP',  w: '44px', num: true, path: 'stats.gp'         },
  { key: 'g',   label: 'G',   w: '40px', num: true, path: 'stats.g'          },
  { key: 'a',   label: 'A',   w: '40px', num: true, path: 'stats.a'          },
  { key: 'pts', label: 'PTS', w: '48px', num: true, path: 'stats.pts'        },
  { key: 'pm',  label: '+/-', w: '48px', num: true, path: 'stats.plus_minus' },
  { key: 'pim', label: 'PIM', w: '48px', num: true, path: 'stats.pim'        },
  { key: 'ppg', label: 'PPG', w: '48px', num: true, path: 'stats.ppg'        },
];

const MIXED_COLS = [
  { key: 'player_name', label: 'Player', w: '140px' },
  { key: 'position',    label: 'Pos',    w: '52px'  },
  { key: 'birthYear',   label: 'Born',   w: '54px'  },
  { key: 'season',      label: 'Season', w: '94px'  },
  { key: 'league',      label: 'League', w: '80px'  },
  { key: 'team',        label: 'Team',   w: '120px' },
  { key: 'gp',  label: 'GP',  w: '44px', num: true, path: 'stats.gp'        },
  { key: 'pts', label: 'PTS', w: '48px', num: true, path: 'stats.pts'       },
  { key: 'gaa', label: 'GAA', w: '54px', num: true, path: 'stats.gaa', dec:2},
  { key: 'svp', label: 'SV%', w: '54px', num: true, path: 'stats.sv_pct', pct:true },
];

function getVal(row, col) {
  if (!col.path) return row[col.key] ?? '—';
  let v = row;
  for (const p of col.path.split('.')) v = v?.[p];
  if (v == null) return '—';
  if (col.pct) return fmtPct(v);
  if (col.dec != null) return fmt(v, col.dec);
  if (col.num) return typeof v === 'number' ? v.toFixed(0) : v;
  return v;
}

export default function PlayerTable({ data, loading, total, page, pageSize, onSort, sortBy, sortDir, onPage }) {
  const hasG = data.some(r => r.position === 'G');
  const hasSk = data.some(r => r.position === 'F/D');
  const cols = hasG && hasSk ? MIXED_COLS : hasG ? GOALIE_COLS : SKATER_COLS;
  const totalPages = Math.ceil(total / pageSize);

  const thClick = (key) => onSort(key === 'svp' ? 'sv_pct' : key);

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <span className={styles.count}>
          {loading ? 'Loading…' : `${total.toLocaleString()} player${total !== 1 ? 's' : ''}`}
        </span>
        <span className={styles.pageInfo}>
          {total > 0 && `${page * pageSize + 1}–${Math.min((page+1)*pageSize, total)} of ${total}`}
        </span>
      </div>

      <div className={styles.tableWrap}>
        <table className={`${styles.table} ${loading ? styles.loading : ''}`}>
          <thead>
            <tr>
              {cols.map(c => (
                <th
                  key={c.key}
                  style={{ width: c.w, minWidth: c.w }}
                  className={sortBy === c.key ? styles.sorted : ''}
                  onClick={() => thClick(c.key)}
                >
                  {c.label}
                  <span className={styles.arrow}>
                    {sortBy === c.key ? (sortDir === 'asc' ? '▲' : '▼') : '↕'}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.length === 0 && !loading && (
              <tr><td colSpan={cols.length} className={styles.empty}>No players match your filters.</td></tr>
            )}
            {data.map((row, i) => (
              <tr key={row._id || i}>
                {cols.map(c => {
                  if (c.key === 'position') return <td key={c.key}><PosBadge pos={row.position} /></td>;
                  if (c.key === 'league') return <td key={c.key} className={styles.leagueCell}>{(row.league||'').toUpperCase()}</td>;
                  if (c.key === 'team') return <td key={c.key} className={styles.teamCell} style={{overflow:'hidden',textOverflow:'ellipsis'}}>{row.team ?? '—'}</td>;
                  if (c.key === 'player_name') return <td key={c.key} className={styles.name}>{row.player_name}</td>;
                  if (c.key === 'season') return <td key={c.key}><span className={styles.seasonTag}>{row.season}</span></td>;
                  const val = getVal(row, c);
                  const isPM = c.key === 'pm';
                  const pmVal = isPM ? row.stats?.plus_minus : null;
                  return (
                    <td key={c.key} className={`${c.num ? styles.num : ''} ${pmVal != null && pmVal > 0 ? styles.pos : pmVal != null && pmVal < 0 ? styles.neg : ''}`}>
                      {isPM && pmVal != null && pmVal > 0 ? '+' : ''}{val}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className={styles.pager}>
          <button onClick={() => onPage(0)} disabled={page === 0}>«</button>
          <button onClick={() => onPage(page-1)} disabled={page === 0}>‹ Prev</button>
          <span>{page+1} / {totalPages}</span>
          <button onClick={() => onPage(page+1)} disabled={page >= totalPages-1}>Next ›</button>
          <button onClick={() => onPage(totalPages-1)} disabled={page >= totalPages-1}>»</button>
        </div>
      )}
    </div>
  );
}
