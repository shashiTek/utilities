import React, { useState, useEffect, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, ReferenceLine, LabelList,
} from 'recharts';
import { fetchPlayers, fetchFilters, fetchTeamRosterOrigins } from '../api';
import styles from './LeaguesView.module.css';

// ── Helpers ────────────────────────────────────────────────────────────────────
const currentYear = new Date().getFullYear();
const toAge  = (birthYear) => birthYear ? currentYear - birthYear : null;
const round1 = (n) => Math.round(n * 10) / 10;

/**
 * Extract country — always the LAST comma-segment.
 * "Troy, NY, USA" → "USA"   "Stockholm, SWE" → "SWE"
 */
function extractCountry(player) {
  const str =
    player.birthPlace?.name ||
    (typeof player.birthPlace === 'string' ? player.birthPlace : null) ||
    player.birthCity || player.hometown || player.city || '';
  if (!str) return null;
  const parts = str.split(',').map(s => s.trim()).filter(Boolean);
  return parts.length > 0 ? parts[parts.length - 1] : null;
}

/**
 * Extract state/province — second-to-last for 3-part strings.
 * "Troy, NY, USA" → "NY"   "Toronto, ON, CAN" → "ON"   "Troy, NY" → "NY"
 */
function extractState(player) {
  const parse = (str) => {
    if (!str || typeof str !== 'string') return null;
    const parts = str.split(',').map(s => s.trim()).filter(Boolean);
    if (parts.length >= 3) return parts[parts.length - 2] || null;
    if (parts.length === 2) return parts[1] || null;
    return null;
  };
  return (
    parse(player.birthPlace?.name) ||
    parse(typeof player.birthPlace === 'string' ? player.birthPlace : null) ||
    parse(player.birthCity) ||
    parse(player.hometown) ||
    (player.province ? String(player.province).trim() : null) ||
    (player.state    ? String(player.state).trim()    : null) ||
    parse(player.city) ||
    null
  );
}

/** Count players per country, sorted by count desc */
function buildRegionStats(players) {
  const map = {};
  for (const p of players) {
    const r = extractCountry(p);
    if (!r) continue;
    map[r] = (map[r] || 0) + 1;
  }
  return Object.entries(map)
    .map(([region, count]) => ({ region, count }))
    .sort((a, b) => b.count - a.count);
}

/** Count players per state/province, optionally filtered to one country */
function buildStateStats(players, filterRegion) {
  const map = {};
  for (const p of players) {
    if (filterRegion && extractCountry(p) !== filterRegion) continue;
    const s = extractState(p);
    if (!s) continue;
    map[s] = (map[s] || 0) + 1;
  }
  return Object.entries(map)
    .map(([state, count]) => ({ state, count }))
    .sort((a, b) => b.count - a.count);
}

/** Group by team and compute age stats */
function buildTeamStats(players) {
  const map = {};
  for (const p of players) {
    const team = p.team || 'Unknown';
    const by   = parseInt(p.birthYear, 10);
    if (!map[team]) map[team] = { team, birthYears: [], positions: { G: 0, D: 0, F: 0 } };
    if (!isNaN(by)) map[team].birthYears.push(by);
    const pos = (p.position || '').toUpperCase();
    if (pos === 'G') map[team].positions.G++;
    else if (pos === 'D') map[team].positions.D++;
    else map[team].positions.F++;
  }
  return Object.values(map)
    .filter(t => t.birthYears.length > 0)
    .map(t => {
      const avg = t.birthYears.reduce((a, b) => a + b, 0) / t.birthYears.length;
      return {
        team:        t.team,
        avgBY:       round1(avg),
        avgAge:      round1(toAge(avg)),
        oldestBY:    Math.min(...t.birthYears),
        youngestBY:  Math.max(...t.birthYears),
        oldestAge:   toAge(Math.min(...t.birthYears)),
        youngestAge: toAge(Math.max(...t.birthYears)),
        count:       t.birthYears.length,
        positions:   t.positions,
      };
    })
    .sort((a, b) => a.avgBY - b.avgBY);
}

// ── Roster-origins helpers ─────────────────────────────────────────────────────

/**
 * Extract state from a player's birth_place field returned by the
 * /api/league/team-roster-origins endpoint.
 * birth_place may be { name: "City, ST, COUNTRY" } or a plain string.
 */
function extractStateFromBio(player) {
  const raw = player.birth_place;
  const str =
    (raw && typeof raw === 'object' ? raw.name : null) ||
    (typeof raw === 'string' ? raw : '') ||
    '';
  if (!str) return null;
  const parts = str.split(',').map(s => s.trim()).filter(Boolean);
  if (parts.length >= 3) return parts[parts.length - 2] || null;
  if (parts.length === 2) return parts[1] || null;
  return null;
}

/** Count players per state for a single team's roster */
function buildRosterStateStats(players) {
  const map = {};
  for (const p of players) {
    const st = extractStateFromBio(p);
    if (!st) continue;
    map[st] = (map[st] || 0) + 1;
  }
  return Object.entries(map)
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);
}

/** Extract birth year (4-digit int) from a bio birth_date string like "2007-03-15" */
function parseBirthYear(birthDate) {
  if (!birthDate || typeof birthDate !== 'string') return null;
  const yr = parseInt(birthDate.slice(0, 4), 10);
  return isNaN(yr) || yr < 1980 ? null : yr;
}

/** Players from a specific state, sorted by birth year asc (oldest first) */
function getPlayersByState(players, state) {
  return players
    .filter(p => extractStateFromBio(p) === state)
    .map(p => ({ ...p, birthYear: parseBirthYear(p.birth_date) }))
    .sort((a, b) => (a.birthYear || 9999) - (b.birthYear || 9999));
}

/** Count players by their prior (youth) team */
function buildYouthTeamStats(players) {
  const homegrown = { label: 'Homegrown', count: 0, isHomegrown: true };
  const map = {};
  for (const p of players) {
    if (!p.youth_team) { homegrown.count++; continue; }
    const key = p.youth_team;
    if (!map[key]) map[key] = { label: p.youth_team, league: p.youth_league, count: 0 };
    map[key].count++;
  }
  const list = Object.values(map).sort((a, b) => b.count - a.count);
  if (homegrown.count > 0) list.push(homegrown);
  return list;
}

// ── Sub-components ─────────────────────────────────────────────────────────────

// Age chart tooltip
function AgeTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className={styles.tooltip}>
      <div className={styles.tooltipTeam}>{d.team}</div>
      <div className={styles.tooltipRow}><span>Avg birth year</span><strong>{d.avgBY}</strong></div>
      <div className={styles.tooltipRow}><span>Avg age</span><strong>{d.avgAge}</strong></div>
      <div className={styles.tooltipRow}><span>Age range</span><strong>{d.youngestAge}–{d.oldestAge}</strong></div>
      <div className={styles.tooltipRow}><span>Roster size</span><strong>{d.count}</strong></div>
      <div className={styles.tooltipRow}><span>G / D / F</span><strong>{d.positions.G} / {d.positions.D} / {d.positions.F}</strong></div>
    </div>
  );
}

// Region list row (pure HTML — reliable click)
function RegionRow({ region, count, pct, maxCount, selected, onClick }) {
  const fillPct = maxCount > 0 ? (count / maxCount) * 100 : 0;
  const isTop   = !selected && pct >= 50;
  return (
    <button
      type="button"
      className={`${styles.regionRow} ${selected ? styles.regionRowActive : ''}`}
      onClick={onClick}
    >
      <div className={styles.regionRowTop}>
        <span className={styles.regionName}>{region}</span>
        <span className={`${styles.regionCount} ${selected ? styles.regionCountActive : ''}`}>{count}</span>
      </div>
      <div className={styles.regionBarTrack}>
        <div
          className={styles.regionBarFill}
          style={{
            width: `${fillPct}%`,
            background: selected ? '#2563EB' : isTop ? '#E8472A' : '#6B8CAE',
          }}
        />
      </div>
      <div className={styles.regionPct}>{pct}% of league</div>
    </button>
  );
}

// Team list row for roster-origins panel
function TeamRow({ team, count, selected, onClick }) {
  return (
    <button
      type="button"
      className={`${styles.teamListRow} ${selected ? styles.teamListRowActive : ''}`}
      onClick={onClick}
    >
      <span className={styles.teamListName}>{team}</span>
      <span className={`${styles.teamListCount} ${selected ? styles.teamListCountActive : ''}`}>
        {count}
      </span>
    </button>
  );
}

// Horizontal mini-bar list (state or youth-team breakdown)
// onItemClick(item) — optional; when provided, rows become clickable buttons
function BarList({ items, maxCount, title, colorFn, emptyText, onItemClick, selectedLabel }) {
  if (!items.length) {
    return (
      <div className={styles.barListSection}>
        <div className={styles.barListTitle}>{title}</div>
        <div className={styles.barListEmpty}>{emptyText || 'No data'}</div>
      </div>
    );
  }
  return (
    <div className={styles.barListSection}>
      <div className={styles.barListTitle}>{title}</div>
      {items.map((item, i) => {
        const pct       = maxCount > 0 ? (item.count / maxCount) * 100 : 0;
        const isActive  = selectedLabel === item.label;
        const clickable = !!onItemClick && !item.isHomegrown;
        const RowTag    = clickable ? 'button' : 'div';
        return (
          <RowTag
            key={item.label}
            type={clickable ? 'button' : undefined}
            className={`${styles.barListRow} ${clickable ? styles.barListRowClickable : ''} ${isActive ? styles.barListRowActive : ''}`}
            onClick={clickable ? () => onItemClick(item) : undefined}
          >
            <div className={styles.barListMeta}>
              <span className={styles.barListLabel}>{item.label}</span>
              {item.league && (
                <span className={styles.barListSub}>{item.league.toUpperCase()}</span>
              )}
              {item.isHomegrown && (
                <span className={styles.barListHomegrown}>no prior record</span>
              )}
            </div>
            <div className={styles.barListTrack}>
              <div
                className={styles.barListFill}
                style={{ width: `${pct}%`, background: isActive ? '#2563EB' : colorFn(i, item) }}
              />
            </div>
            <span className={styles.barListCount}>{item.count}</span>
          </RowTag>
        );
      })}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function LeaguesView() {
  const [filterOptions, setFilterOptions] = useState({ leagues: [], seasons: [] });
  const [league,   setLeague]   = useState('');
  const [season,   setSeason]   = useState('');
  const [players,  setPlayers]  = useState([]);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState(null);

  const [selectedRegion, setSelectedRegion] = useState(null);
  const [regionSearch,   setRegionSearch]   = useState('');

  // Roster-origins state
  const [rosterData,         setRosterData]         = useState([]);   // [{team, player_count, players[]}]
  const [rosterLoading,      setRosterLoading]      = useState(false);
  const [selectedTeam,       setSelectedTeam]       = useState(null); // team name string
  const [selectedRosterState, setSelectedRosterState] = useState(null); // state label string

  useEffect(() => {
    fetchFilters().then(setFilterOptions).catch(() => {});
  }, []);

  // Fetch player list (for region/state/age charts)
  useEffect(() => {
    if (!league) { setPlayers([]); return; }
    let cancelled = false;
    setLoading(true); setError(null);
    fetchPlayers({ league, season, pageSize: 1000, page: 0 })
      .then(res => { if (!cancelled) setPlayers(res?.data || []); })
      .catch(err => { if (!cancelled) setError(err.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [league, season]);

  // Fetch roster-origins data (for the new team-breakdown section)
  useEffect(() => {
    if (!league) { setRosterData([]); return; }
    let cancelled = false;
    setRosterLoading(true);
    fetchTeamRosterOrigins(league, season)
      .then(data => { if (!cancelled) setRosterData(Array.isArray(data) ? data : []); })
      .catch(() => { if (!cancelled) setRosterData([]); })
      .finally(() => { if (!cancelled) setRosterLoading(false); });
    return () => { cancelled = true; };
  }, [league, season]);

  // Reset drilldowns when league/season changes
  useEffect(() => {
    setSelectedRegion(null);
    setRegionSearch('');
    setSelectedTeam(null);
    setSelectedRosterState(null);
  }, [players]);

  const teamStats   = useMemo(() => buildTeamStats(players),   [players]);
  const regionStats = useMemo(() => buildRegionStats(players), [players]);

  const filteredRegions = useMemo(() => {
    if (!regionSearch.trim()) return regionStats;
    const q = regionSearch.trim().toLowerCase();
    return regionStats.filter(r => r.region.toLowerCase().includes(q));
  }, [regionStats, regionSearch]);

  const stateStats = useMemo(
    () => (selectedRegion ? buildStateStats(players, selectedRegion) : []),
    [players, selectedRegion]
  );

  // Selected team's player list (from rosterData)
  const selectedTeamPlayers = useMemo(() => {
    if (!selectedTeam) return [];
    return rosterData.find(r => r.team === selectedTeam)?.players || [];
  }, [rosterData, selectedTeam]);

  // Clear state selection whenever the team changes
  useEffect(() => { setSelectedRosterState(null); }, [selectedTeam]);

  const rosterStateStats = useMemo(
    () => buildRosterStateStats(selectedTeamPlayers),
    [selectedTeamPlayers]
  );

  const youthTeamStats = useMemo(
    () => buildYouthTeamStats(selectedTeamPlayers),
    [selectedTeamPlayers]
  );

  const statePlayerList = useMemo(
    () => selectedRosterState ? getPlayersByState(selectedTeamPlayers, selectedRosterState) : [],
    [selectedTeamPlayers, selectedRosterState]
  );

  const oldestTeam   = teamStats[0]  || null;
  const youngestTeam = teamStats[teamStats.length - 1] || null;
  const avgLeagueAge = teamStats.length
    ? round1(teamStats.reduce((s, t) => s + t.avgAge, 0) / teamStats.length) : null;
  const leagueAvgBY  = teamStats.length
    ? round1(teamStats.reduce((s, t) => s + t.avgBY, 0) / teamStats.length) : null;

  const getAgeColor = (team) => {
    if (team === oldestTeam?.team)   return '#C0392B';
    if (team === youngestTeam?.team) return '#1A6B4A';
    return '#6B8CAE';
  };

  const teamChartHeight  = Math.min(520, Math.max(300, teamStats.length * 44));
  const stateChartHeight = Math.max(260, Math.min(stateStats.length, 20) * 34);
  const maxRegionCount   = filteredRegions[0]?.count || 1;
  const totalPlayers     = players.length;

  const maxRosterState  = rosterStateStats[0]?.count  || 1;
  const maxYouthTeam    = youthTeamStats[0]?.count    || 1;

  const stateColor   = (i) => i === 0 ? '#2563EB' : i < 3 ? '#3B82F6' : '#93C5FD';
  const youthColor   = (i, item) => item.isHomegrown ? '#CBD5E1' : i === 0 ? '#1A6B4A' : i < 3 ? '#16A34A' : '#86EFAC';

  return (
    <div className={styles.wrap}>

      {/* ── Controls ── */}
      <div className={styles.controls}>
        <div className={styles.controlGroup}>
          <label className={styles.label}>League</label>
          <select className={styles.select} value={league}
            onChange={e => { setLeague(e.target.value); setSeason(''); }}>
            <option value="">Select a league…</option>
            {(filterOptions.leagues || []).map(l => (
              <option key={l} value={l}>{l.toUpperCase()}</option>
            ))}
          </select>
        </div>

        <div className={styles.controlGroup}>
          <label className={styles.label}>Season</label>
          <select className={styles.select} value={season}
            onChange={e => setSeason(e.target.value)} disabled={!league}>
            <option value="">All seasons</option>
            {(filterOptions.seasons || []).map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        {regionStats.length > 0 && (
          <div className={styles.controlGroup}>
            <label className={styles.label}>Filter region</label>
            <input className={styles.searchInput} type="text"
              placeholder="e.g. USA, CAN…"
              value={regionSearch}
              onChange={e => setRegionSearch(e.target.value)} />
          </div>
        )}

        {players.length > 0 && (
          <div className={styles.meta}>
            {players.length} players · {teamStats.length} teams
            {selectedRegion && <span className={styles.metaRegion}> · {selectedRegion}</span>}
          </div>
        )}
      </div>

      {/* ── Empty / loading ── */}
      {!league && (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>◎</div>
          <div className={styles.emptyText}>Select a league to explore team age &amp; player origins</div>
        </div>
      )}
      {league && loading && (
        <div className={styles.empty}><div className={styles.emptyText}>Loading…</div></div>
      )}
      {league && !loading && error && (
        <div className={styles.errorBox}>⚠ {error}</div>
      )}

      {/* ── Data ── */}
      {!loading && teamStats.length > 0 && (
        <>
          {/* Summary cards */}
          <div className={styles.cards}>
            <div className={`${styles.card} ${styles.cardOldest}`}>
              <div className={styles.cardBadge}>Oldest team</div>
              <div className={styles.cardTeam}>{oldestTeam.team}</div>
              <div className={styles.cardStat}>{oldestTeam.avgAge} avg age</div>
              <div className={styles.cardSub}>Born avg {oldestTeam.avgBY} · {oldestTeam.count} players</div>
            </div>
            <div className={`${styles.card} ${styles.cardLeague}`}>
              <div className={styles.cardBadge}>League average</div>
              <div className={styles.cardTeam}>{league.toUpperCase()}{season ? ` · ${season}` : ''}</div>
              <div className={styles.cardStat}>{avgLeagueAge} avg age</div>
              <div className={styles.cardSub}>Across {teamStats.length} teams · {players.length} players</div>
            </div>
            <div className={`${styles.card} ${styles.cardYoungest}`}>
              <div className={styles.cardBadge}>Youngest team</div>
              <div className={styles.cardTeam}>{youngestTeam.team}</div>
              <div className={styles.cardStat}>{youngestTeam.avgAge} avg age</div>
              <div className={styles.cardSub}>Born avg {youngestTeam.avgBY} · {youngestTeam.count} players</div>
            </div>
          </div>

          {/* ── Charts 1 + 2: Region list + State breakdown ── */}
          {regionStats.length > 0 ? (
            <div className={styles.originsRow}>

              {/* Region selector list */}
              <div className={styles.chartWrap}>
                <div className={styles.chartHeader}>
                  <span className={styles.chartTitle}>Player origins — by region</span>
                  <span className={styles.chartSub}>{filteredRegions.length} region{filteredRegions.length !== 1 ? 's' : ''}</span>
                </div>

                <div className={styles.regionList}>
                  {filteredRegions.map(r => (
                    <RegionRow
                      key={r.region}
                      region={r.region}
                      count={r.count}
                      pct={round1((r.count / totalPlayers) * 100)}
                      maxCount={maxRegionCount}
                      selected={selectedRegion === r.region}
                      onClick={() => setSelectedRegion(
                        selectedRegion === r.region ? null : r.region
                      )}
                    />
                  ))}
                  {filteredRegions.length === 0 && (
                    <div className={styles.emptyText} style={{ padding: '20px 0', textAlign: 'center' }}>
                      No regions match "{regionSearch}"
                    </div>
                  )}
                </div>
              </div>

              {/* State breakdown */}
              <div className={styles.chartWrap}>
                {!selectedRegion ? (
                  <div className={styles.stateEmptyState}>
                    <div className={styles.stateEmptyIcon}>←</div>
                    <div className={styles.stateEmptyTitle}>Select a region</div>
                    <div className={styles.stateEmptyText}>
                      Click any region on the left to see its state &amp; province breakdown
                    </div>
                  </div>
                ) : (
                  <>
                    <div className={styles.chartHeader}>
                      <div className={styles.drilldownHeader}>
                        <span className={styles.chartTitle}>States &amp; provinces</span>
                        <span className={styles.regionTag}>{selectedRegion}</span>
                      </div>
                      <button className={styles.clearBtn}
                        onClick={() => setSelectedRegion(null)}>
                        ✕ clear
                      </button>
                    </div>

                    {stateStats.length > 0 ? (
                      <>
                        <div className={styles.stateHighlight}>
                          <div className={styles.stateHighlightLeft}>
                            <span className={styles.stateHighlightLabel}>Top state / province</span>
                            <span className={styles.stateHighlightName}>{stateStats[0].state}</span>
                          </div>
                          <div className={`${styles.stateHighlightStat} ${styles.stateHighlightStatBlue}`}>
                            {stateStats[0].count}
                            <span className={styles.stateHighlightUnit}> players</span>
                          </div>
                          <div className={styles.stateHighlightPct}>
                            {round1((stateStats[0].count / totalPlayers) * 100)}% of league
                          </div>
                        </div>

                        <ResponsiveContainer width="100%" height={stateChartHeight}>
                          <BarChart data={stateStats.slice(0, 20)} layout="vertical"
                            margin={{ top: 4, right: 60, left: 8, bottom: 4 }} barCategoryGap="28%">
                            <CartesianGrid horizontal={false} stroke="rgba(0,0,0,0.06)" strokeDasharray="4 3" />
                            <XAxis type="number" tick={{ fontSize: 10, fill: '#999' }} axisLine={false} tickLine={false} />
                            <YAxis type="category" dataKey="state" width={44}
                              tick={{ fontSize: 11, fill: '#555', fontWeight: 600 }} axisLine={false} tickLine={false} />
                            <Tooltip
                              formatter={(val, _n, p) => [
                                `${val} players (${round1((val / totalPlayers) * 100)}%)`,
                                p.payload.state,
                              ]}
                              contentStyle={{ background: '#fff', border: '1.5px solid #e5e5e5', borderRadius: 8, fontSize: 12, boxShadow: '0 4px 16px rgba(0,0,0,0.09)' }}
                              cursor={{ fill: 'rgba(0,0,0,0.04)' }}
                            />
                            <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={26}>
                              {stateStats.slice(0, 20).map((entry, i) => (
                                <Cell key={entry.state}
                                  fill={i === 0 ? '#2563EB' : i < 3 ? '#3B82F6' : '#93C5FD'}
                                  fillOpacity={0.9} />
                              ))}
                              <LabelList dataKey="count" position="right"
                                style={{ fontSize: 11, fontWeight: 600, fill: '#555' }} />
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>

                        {stateStats.length > 20 && (
                          <div className={styles.stateOverflow}>
                            + {stateStats.length - 20} more states / provinces not shown
                          </div>
                        )}
                      </>
                    ) : (
                      <div className={styles.stateEmptyState}>
                        <div className={styles.stateEmptyText}>
                          No state-level data available for {selectedRegion}.
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>

            </div>
          ) : (
            <div className={styles.chartWrap}>
              <div className={styles.empty} style={{ border: 'none', padding: '40px 20px' }}>
                <div className={styles.emptyIcon}>📍</div>
                <div className={styles.emptyText}>No birth location data available for this league.</div>
              </div>
            </div>
          )}

          {/* ── Team Roster Origins ── */}
          <div className={styles.chartWrap}>
            <div className={styles.chartHeader}>
              <span className={styles.chartTitle}>Team roster origins — states &amp; prior teams</span>
              <span className={styles.chartSub}>
                {rosterLoading
                  ? 'Loading…'
                  : `${rosterData.length} team${rosterData.length !== 1 ? 's' : ''}`}
              </span>
            </div>

            {rosterLoading ? (
              <div className={styles.stateEmptyState}>
                <div className={styles.emptyText}>Fetching roster data…</div>
              </div>
            ) : rosterData.length === 0 ? (
              <div className={styles.stateEmptyState}>
                <div className={styles.stateEmptyText}>No roster-origin data available.</div>
              </div>
            ) : (
              <div className={styles.rosterOriginsRow}>

                {/* Left: team list */}
                <div className={styles.teamList}>
                  {rosterData.map(r => (
                    <TeamRow
                      key={r.team}
                      team={r.team}
                      count={r.player_count}
                      selected={selectedTeam === r.team}
                      onClick={() => setSelectedTeam(
                        selectedTeam === r.team ? null : r.team
                      )}
                    />
                  ))}
                </div>

                {/* Right: detail panel */}
                <div className={styles.rosterDetail}>
                  {!selectedTeam ? (
                    <div className={styles.stateEmptyState}>
                      <div className={styles.stateEmptyIcon}>←</div>
                      <div className={styles.stateEmptyTitle}>Select a team</div>
                      <div className={styles.stateEmptyText}>
                        Click any team on the left to see where its players come from and their prior teams.
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className={styles.rosterDetailHeader}>
                        <span className={styles.rosterDetailTeam}>{selectedTeam}</span>
                        <span className={styles.rosterDetailCount}>
                          {selectedTeamPlayers.length} player{selectedTeamPlayers.length !== 1 ? 's' : ''}
                        </span>
                        <button className={styles.clearBtn}
                          onClick={() => setSelectedTeam(null)}>
                          ✕ clear
                        </button>
                      </div>

                      <div className={styles.rosterDetailCols}>
                        {/* State breakdown — clickable */}
                        <BarList
                          items={rosterStateStats.slice(0, 12)}
                          maxCount={maxRosterState}
                          title="Player origins by state — click to see players"
                          colorFn={stateColor}
                          emptyText="No birth-state data for this team"
                          onItemClick={item => setSelectedRosterState(
                            selectedRosterState === item.label ? null : item.label
                          )}
                          selectedLabel={selectedRosterState}
                        />

                        {/* Youth / prior team breakdown */}
                        <BarList
                          items={youthTeamStats.slice(0, 12)}
                          maxCount={maxYouthTeam}
                          title="Prior teams (youth / transfer)"
                          colorFn={youthColor}
                          emptyText="No prior-team data for this roster"
                        />
                      </div>

                      {/* State player drill-down */}
                      {selectedRosterState && statePlayerList.length > 0 && (
                        <div className={styles.stateDrilldown}>
                          <div className={styles.stateDrilldownHeader}>
                            <span className={styles.stateDrilldownTitle}>
                              Players from <strong>{selectedRosterState}</strong>
                            </span>
                            <span className={styles.stateDrilldownCount}>
                              {statePlayerList.length} player{statePlayerList.length !== 1 ? 's' : ''}
                            </span>
                            <button
                              className={styles.clearBtn}
                              onClick={() => setSelectedRosterState(null)}
                            >
                              ✕ clear
                            </button>
                          </div>
                          <div className={styles.stateDrilldownGrid}>
                            {statePlayerList.map((p, i) => {
                              const epUrl = p.player_url
                                ? (p.player_url.startsWith('http')
                                    ? p.player_url
                                    : `https://www.eliteprospects.com${p.player_url}`)
                                : null;
                              const CardEl = epUrl ? 'a' : 'div';
                              return (
                                <CardEl
                                  key={`${p.name}-${i}`}
                                  className={`${styles.stateDrilldownCard} ${epUrl ? styles.stateDrilldownCardLink : ''}`}
                                  {...(epUrl ? { href: epUrl, target: '_blank', rel: 'noopener noreferrer' } : {})}
                                >
                                  <div className={styles.stateDrilldownCardTop}>
                                    <span className={styles.stateDrilldownName}>{p.name}</span>
                                    <span className={`${styles.stateDrilldownPos} ${p.position === 'G' ? styles.posG : p.position === 'D' ? styles.posD : styles.posF}`}>
                                      {p.position || '—'}
                                    </span>
                                  </div>
                                  <div className={styles.stateDrilldownCardBot}>
                                    <span className={styles.stateDrilldownBY}>
                                      {p.birthYear ? `Born ${p.birthYear}` : 'Birth year unknown'}
                                    </span>
                                    {p.youth_team && (
                                      <span className={styles.stateDrilldownPrev}>
                                        ← {p.youth_team}
                                      </span>
                                    )}
                                  </div>
                                  {epUrl && (
                                    <div className={styles.stateDrilldownEPHint}>
                                      View on Elite Prospects ↗
                                    </div>
                                  )}
                                </CardEl>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>

              </div>
            )}
          </div>

          {/* ── Team age distribution ── */}
          <div className={styles.chartWrap}>
            <div className={styles.chartHeader}>
              <span className={styles.chartTitle}>Team age distribution — oldest → youngest</span>
              <div className={styles.chartLegend}>
                <span className={styles.legendDot} style={{ background: '#C0392B' }} /> Oldest
                <span className={styles.legendDot} style={{ background: '#6B8CAE', marginLeft: 12 }} /> Mid
                <span className={styles.legendDot} style={{ background: '#1A6B4A', marginLeft: 12 }} /> Youngest
              </div>
            </div>
            <ResponsiveContainer width="100%" height={teamChartHeight}>
              <BarChart data={teamStats} layout="vertical"
                margin={{ top: 4, right: 80, left: 8, bottom: 4 }} barCategoryGap="28%">
                <CartesianGrid horizontal={false} stroke="rgba(0,0,0,0.06)" strokeDasharray="4 3" />
                <XAxis type="number" domain={['dataMin - 1', 'dataMax + 1']} dataKey="avgBY"
                  tick={{ fontSize: 10, fill: '#999' }} axisLine={false} tickLine={false}
                  tickFormatter={v => `'${String(v).slice(-2)}`} />
                <YAxis type="category" dataKey="team" width={150}
                  tick={{ fontSize: 11, fill: '#555', fontWeight: 500 }} axisLine={false} tickLine={false} />
                <Tooltip content={<AgeTooltip />} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
                {leagueAvgBY && (
                  <ReferenceLine x={leagueAvgBY} stroke="#E8472A" strokeDasharray="5 3" strokeWidth={1.5}
                    label={{ value: `Avg '${String(Math.round(leagueAvgBY)).slice(-2)}`, position: 'top', fontSize: 10, fill: '#E8472A', fontWeight: 700 }} />
                )}
                <Bar dataKey="avgBY" radius={[0, 4, 4, 0]} maxBarSize={28}>
                  {teamStats.map(entry => (
                    <Cell key={entry.team} fill={getAgeColor(entry.team)} fillOpacity={0.85} />
                  ))}
                  <LabelList dataKey="avgAge" position="right" formatter={v => `${v} yrs`}
                    style={{ fontSize: 11, fontWeight: 600, fill: '#555' }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

        </>
      )}

      {!loading && league && teamStats.length === 0 && !error && (
        <div className={styles.empty}>
          <div className={styles.emptyText}>No player data found for this league / season.</div>
        </div>
      )}
    </div>
  );
}
