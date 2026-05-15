import React, { useState, useEffect, useCallback } from 'react';
import MetricCards  from './components/MetricCards';
import Filters      from './components/Filters';
import PlayerTable  from './components/PlayerTable';
import Charts       from './components/Charts';
import QueryDisplay from './components/QueryDisplay';
import useDebounce  from './hooks/useDebounce';
import { fetchFilters, fetchMetrics, fetchPlayers, fetchBirthChart } from './api';
import styles from './App.module.css';

const DEFAULT_FILTERS = {
  birthYear: '', season: '', league: '', position: '', search: '',
  page: 0, sortBy: 'player_name', sortDir: 'asc',
};

export default function App() {
  const [filterOptions, setFilterOptions] = useState({});
  const [filters, setFilters]             = useState(DEFAULT_FILTERS);
  const [players, setPlayers]             = useState({ data: [], total: 0, query: '' });
  const [metrics, setMetrics]             = useState({});
  const [birthData, setBirthData]         = useState([]);
  const [loading, setLoading]             = useState(false);
  const [error, setError]                 = useState(null);

  const debouncedSearch = useDebounce(filters.search, 400);

  useEffect(() => {
    fetchFilters().then(setFilterOptions).catch(console.error);
    fetchBirthChart().then(setBirthData).catch(console.error);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = {
      birthYear: filters.birthYear, season: filters.season,
      league: filters.league, position: filters.position,
      search: debouncedSearch, page: filters.page, pageSize: 50,
      sortBy: filters.sortBy, sortDir: filters.sortDir,
    };
    try {
      const [p, m] = await Promise.all([fetchPlayers(params), fetchMetrics(params)]);
      setPlayers(p);
      setMetrics(m);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [filters.birthYear, filters.season, filters.league, filters.position,
      filters.page, filters.sortBy, filters.sortDir, debouncedSearch]);

  useEffect(() => { load(); }, [load]);

  const handleSort = (key) => setFilters(f => ({
    ...f, sortBy: key, sortDir: f.sortBy === key && f.sortDir === 'desc' ? 'asc' : 'desc', page: 0,
  }));

  return (
    <div className={styles.layout}>
      {/* ── Sidebar ─────────────────────────── */}
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <div className={styles.brandTop}>
            <div className={styles.brandIcon}>EP</div>
            <div className={styles.brandName}>Scout DB</div>
          </div>
          <div className={styles.brandSub}>EliteProspects Analytics</div>
        </div>

        <nav className={styles.nav}>
          <div className={styles.navLabel}>Views</div>
          <div className={styles.navItem + ' ' + styles.navActive}>
            <span className={styles.navIcon}>◈</span> Players
          </div>
          <div className={styles.navItem}>
            <span className={styles.navIcon}>◇</span> Teams
          </div>
          <div className={styles.navItem}>
            <span className={styles.navIcon}>◉</span> Leagues
          </div>
        </nav>

        <div className={styles.sideStats}>
          <div className={styles.sideStatsTitle}>Current view</div>
          {[
            ['Total players', metrics.totalPlayers?.toLocaleString() ?? '—'],
            ['Goalies',       metrics.goalies ?? '—'],
            ['Skaters',       metrics.skaters ?? '—'],
            ['Leagues',       metrics.leagueCount ?? '—'],
          ].map(([label, val]) => (
            <div key={label} className={styles.sideStatRow}>
              <span className={styles.sideStatLabel}>{label}</span>
              <span className={styles.sideStatVal}>{val}</span>
            </div>
          ))}
        </div>

        <div className={styles.pipeline}>
          <div className={styles.pipelineTitle}>Data pipeline</div>
          {['organization.py', 'teams.py', 'players.py', 'player_stats.py'].map((s, i) => (
            <div key={s} className={styles.pipelineStep}>
              <span className={styles.pipelineNum}>{i + 1}</span>
              <span className={styles.pipelineName}>{s}</span>
            </div>
          ))}
        </div>
      </aside>

      {/* ── Main ───────────────────────────── */}
      <main className={styles.main}>
        <div className={styles.topbar}>
          <div className={styles.titleGroup}>
            <h1 className={styles.pageTitle}>Player Stats</h1>
            <span className={styles.pageSubtitle}>Query by birth year, league, season &amp; position</span>
          </div>
          {error && <div className={styles.error}>⚠ {error}</div>}
        </div>

        <div className={styles.content}>
          <Filters filters={filterOptions} values={filters} onChange={setFilters} />
          <MetricCards metrics={metrics} loading={loading} />
          <Charts birthYearData={birthData} metrics={metrics} />
          <QueryDisplay query={players.query || ''} />
          <PlayerTable
            data={players.data || []}
            total={players.total || 0}
            page={filters.page}
            pageSize={50}
            loading={loading}
            sortBy={filters.sortBy}
            sortDir={filters.sortDir}
            onSort={handleSort}
            onPage={(p) => setFilters(f => ({ ...f, page: p }))}
          />
        </div>
      </main>
    </div>
  );
}
