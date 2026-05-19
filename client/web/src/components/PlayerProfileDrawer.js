import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts';
import { fetchPlayers } from '../api';
import styles from './PlayerProfileDrawer.module.css';

// ── Helpers ────────────────────────────────────────────────────────────────────
const currentYear = new Date().getFullYear();
const toAge = (by) => by ? currentYear - parseInt(by, 10) : null;
const fmt   = (v, dec = 0) => v == null ? '—' : typeof v === 'number' ? v.toFixed(dec) : v;

function posLabel(pos) {
  const p = (pos || '').toUpperCase();
  if (p === 'G')  return 'Goalie';
  if (p === 'D')  return 'Defence';
  if (p === 'F')  return 'Forward';
  return pos || '—';
}

function isGoalie(seasons) {
  const g = seasons.filter(s => (s.position || '').toUpperCase() === 'G').length;
  return g > seasons.length / 2;
}

/** Sort seasons chronologically — handles "2022-23" and plain "2023" */
function seasonSort(a, b) {
  const yr = s => parseInt((s.season || '0').split('-')[0], 10);
  return yr(a) - yr(b);
}

/** Aggregate duplicate (same team + same season) rows — API can return multiples */
function dedupeSeasons(rows) {
  const map = {};
  for (const r of rows) {
    const key = `${r.season}||${r.team}||${r.league}`;
    if (!map[key]) { map[key] = { ...r }; continue; }
    // merge stats: take max GP, sum goals/assists/etc.
    const s  = r.stats || {};
    const ms = map[key].stats || {};
    map[key].stats = {
      gp:         Math.max(ms.gp  || 0, s.gp  || 0),
      g:          (ms.g   || 0) + (s.g   || 0),
      a:          (ms.a   || 0) + (s.a   || 0),
      pts:        (ms.pts || 0) + (s.pts || 0),
      plus_minus: ms.plus_minus ?? s.plus_minus,
      pim:        (ms.pim || 0) + (s.pim || 0),
      w:          (ms.w   || 0) + (s.w   || 0),
      l:          (ms.l   || 0) + (s.l   || 0),
      ot:         (ms.ot  || 0) + (s.ot  || 0),
      gaa:        ms.gaa ?? s.gaa,
      sv_pct:     ms.sv_pct ?? s.sv_pct,
      so:         (ms.so  || 0) + (s.so  || 0),
      ppg:        ms.ppg ?? s.ppg,
    };
  }
  return Object.values(map).sort(seasonSort);
}

// ── Trend chart ────────────────────────────────────────────────────────────────
function TrendChart({ seasons, goalie }) {
  if (seasons.length < 2) return null;

  const data = seasons.map(s => ({
    label: `${s.season}${s.league ? ` · ${s.league.toUpperCase()}` : ''}`,
    ...(goalie
      ? { GAA: s.stats?.gaa, 'SV%': s.stats?.sv_pct ? +(s.stats.sv_pct.toFixed(3)) : null }
      : { G: s.stats?.g, A: s.stats?.a, PTS: s.stats?.pts }
    ),
  }));

  const lines = goalie
    ? [{ key: 'GAA', color: '#E8472A' }, { key: 'SV%', color: '#2563EB' }]
    : [{ key: 'PTS', color: '#2563EB' }, { key: 'G', color: '#E8472A' }, { key: 'A', color: '#1A6B4A' }];

  return (
    <div className={styles.chartWrap}>
      <div className={styles.sectionLabel}>Stat trend</div>
      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={data} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
          <CartesianGrid stroke="rgba(0,0,0,0.06)" strokeDasharray="4 3" />
          <XAxis dataKey="label" tick={{ fontSize: 9, fill: '#999' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 9, fill: '#999' }} axisLine={false} tickLine={false} width={28} />
          <Tooltip
            contentStyle={{ background: '#fff', border: '1.5px solid #e5e5e5', borderRadius: 8, fontSize: 11 }}
            cursor={{ stroke: 'rgba(0,0,0,0.08)', strokeWidth: 1 }}
          />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
          {lines.map(l => (
            <Line key={l.key} type="monotone" dataKey={l.key}
              stroke={l.color} strokeWidth={2} dot={{ r: 3, fill: l.color }}
              connectNulls activeDot={{ r: 4 }} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Career timeline table ──────────────────────────────────────────────────────
function CareerTable({ seasons, goalie }) {
  if (!seasons.length) return null;
  return (
    <div className={styles.tableWrap}>
      <div className={styles.sectionLabel}>Career timeline</div>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Season</th>
            <th>League</th>
            <th>Team</th>
            <th className={styles.num}>GP</th>
            {goalie ? (
              <>
                <th className={styles.num}>W</th>
                <th className={styles.num}>L</th>
                <th className={styles.num}>OT</th>
                <th className={styles.num}>GAA</th>
                <th className={styles.num}>SV%</th>
                <th className={styles.num}>SO</th>
              </>
            ) : (
              <>
                <th className={styles.num}>G</th>
                <th className={styles.num}>A</th>
                <th className={styles.num}>PTS</th>
                <th className={styles.num}>+/−</th>
                <th className={styles.num}>PIM</th>
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {seasons.map((s, i) => {
            const st = s.stats || {};
            const pm = st.plus_minus;
            const pmStr = pm == null ? '—' : pm > 0 ? `+${pm}` : String(pm);
            return (
              <tr key={i} className={i === seasons.length - 1 ? styles.latestRow : ''}>
                <td className={styles.seasonCell}>
                  <span className={styles.seasonTag}>{s.season || '—'}</span>
                </td>
                <td className={styles.leagueCell}>{(s.league || '—').toUpperCase()}</td>
                <td className={styles.teamCell}>{s.team || '—'}</td>
                <td className={styles.num}>{fmt(st.gp)}</td>
                {goalie ? (
                  <>
                    <td className={styles.num}>{fmt(st.w)}</td>
                    <td className={styles.num}>{fmt(st.l)}</td>
                    <td className={styles.num}>{fmt(st.ot)}</td>
                    <td className={styles.num}>{fmt(st.gaa, 2)}</td>
                    <td className={styles.num}>{st.sv_pct != null ? st.sv_pct.toFixed(3) : '—'}</td>
                    <td className={styles.num}>{fmt(st.so)}</td>
                  </>
                ) : (
                  <>
                    <td className={styles.num}>{fmt(st.g)}</td>
                    <td className={styles.num}>{fmt(st.a)}</td>
                    <td className={`${styles.num} ${styles.pts}`}>{fmt(st.pts)}</td>
                    <td className={`${styles.num} ${pm > 0 ? styles.pos : pm < 0 ? styles.neg : ''}`}>{pmStr}</td>
                    <td className={styles.num}>{fmt(st.pim)}</td>
                  </>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Stat summary pills ─────────────────────────────────────────────────────────
function StatPills({ seasons, goalie }) {
  const totals = useMemo(() => {
    let gp = 0, g = 0, a = 0, pts = 0, w = 0, seasons_count = seasons.length;
    for (const s of seasons) {
      const st = s.stats || {};
      gp  += st.gp  || 0;
      g   += st.g   || 0;
      a   += st.a   || 0;
      pts += st.pts || 0;
      w   += st.w   || 0;
    }
    const best = [...seasons].sort((a, b) => {
      if (goalie) return (b.stats?.w || 0) - (a.stats?.w || 0);
      return (b.stats?.pts || 0) - (a.stats?.pts || 0);
    })[0];
    return { gp, g, a, pts, w, seasons_count, best };
  }, [seasons, goalie]);

  const pills = goalie
    ? [
        { label: 'Seasons', value: totals.seasons_count },
        { label: 'Career GP', value: totals.gp },
        { label: 'Career W', value: totals.w },
        { label: 'Best season', value: totals.best?.season || '—' },
      ]
    : [
        { label: 'Seasons', value: totals.seasons_count },
        { label: 'Career GP', value: totals.gp },
        { label: 'Career PTS', value: totals.pts, accent: true },
        { label: 'Career G', value: totals.g },
        { label: 'Career A', value: totals.a },
        { label: 'Best season', value: totals.best?.season || '—' },
      ];

  return (
    <div className={styles.pills}>
      {pills.map(p => (
        <div key={p.label} className={`${styles.pill} ${p.accent ? styles.pillAccent : ''}`}>
          <span className={styles.pillValue}>{p.value}</span>
          <span className={styles.pillLabel}>{p.label}</span>
        </div>
      ))}
    </div>
  );
}

// ── Main drawer ────────────────────────────────────────────────────────────────
export default function PlayerProfileDrawer({ playerName, onClose }) {
  const [seasons,  setSeasons]  = useState([]);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState(null);

  const fetchHistory = useCallback(async () => {
    if (!playerName) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetchPlayers({ search: playerName, pageSize: 200, page: 0 });
      const rows = (res?.data || []).filter(
        r => r.player_name?.toLowerCase() === playerName.toLowerCase()
      );
      setSeasons(dedupeSeasons(rows));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [playerName]);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  // Close on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const goalie    = isGoalie(seasons);
  const latest    = seasons[seasons.length - 1];
  const birthYear = latest?.birthYear;
  const age       = toAge(birthYear);
  const position  = latest?.position;
  const currentTeam   = latest?.team;
  const currentLeague = latest?.league;

  const initials = (playerName || '?')
    .split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();

  return (
    <>
      {/* Backdrop */}
      <div className={styles.backdrop} onClick={onClose} aria-hidden="true" />

      {/* Drawer */}
      <aside className={styles.drawer} role="dialog" aria-label={`Profile: ${playerName}`}>

        {/* Header */}
        <div className={styles.header}>
          <div className={styles.avatar}>{initials}</div>
          <div className={styles.headerInfo}>
            <div className={styles.playerName}>{playerName}</div>
            <div className={styles.playerMeta}>
              {[posLabel(position), age ? `Age ${age}` : null, birthYear ? `b. ${birthYear}` : null]
                .filter(Boolean).join(' · ')}
            </div>
            {(currentTeam || currentLeague) && (
              <div className={styles.currentTeam}>
                {currentLeague?.toUpperCase()} · {currentTeam}
                <span className={styles.currentBadge}>Current</span>
              </div>
            )}
          </div>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">✕</button>
        </div>

        {/* Body */}
        <div className={styles.body}>
          {loading && (
            <div className={styles.stateWrap}>
              <div className={styles.spinner} />
              <span className={styles.stateText}>Loading career history…</span>
            </div>
          )}

          {!loading && error && (
            <div className={styles.errorBox}>⚠ {error}</div>
          )}

          {!loading && !error && seasons.length === 0 && (
            <div className={styles.stateWrap}>
              <div className={styles.stateText}>No career data found for this player.</div>
            </div>
          )}

          {!loading && seasons.length > 0 && (
            <>
              <StatPills seasons={seasons} goalie={goalie} />
              <TrendChart seasons={seasons} goalie={goalie} />
              <CareerTable seasons={seasons} goalie={goalie} />
            </>
          )}
        </div>

      </aside>
    </>
  );
}
