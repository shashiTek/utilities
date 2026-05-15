import React, { useState, useEffect, useCallback } from 'react';
import MetricCards from './components/MetricCards';
import Filters from './components/Filters';
import PlayerTable from './components/PlayerTable';
import Charts from './components/Charts';
import QueryDisplay from './components/QueryDisplay';
import TeamView from './components/TeamView'; // Fixed: Added missing import
import useDebounce from './hooks/useDebounce';
// Fixed: Added fetchTeamFilters and fetchTeams missing API hooks
import { fetchFilters, fetchMetrics, fetchPlayers, fetchBirthChart, fetchTeamFilters, fetchTeams } from './api';
import styles from './App.module.css';

const DEFAULT_PLAYER_FILTERS = {
  birthYear: '',
  season: '',
  league: '',
  position: '',
  search: '',
  page: 0,
  sortBy: 'player_name',
  sortDir: 'asc',
};

const DEFAULT_TEAM_FILTERS = {
  search: '', 
  athlete: '', 
  coach: '', 
  league: '', 
  page: 0,
  sortBy: 'team_name',
  sortDir: 'asc',
};

export default function App() {
  const [activeView, setActiveView] = useState('players');
  const [filterOptions, setFilterOptions] = useState({});
  const [teamFilterOptions, setTeamFilterOptions] = useState({}); // Fixed: Added separate team filter data state
  
  // ── Fixed: Separated individual filter state values and their setters ──
  const [playerFilters, setPlayerFilters] = useState(DEFAULT_PLAYER_FILTERS);
  const [teamFilters, setTeamFilters] = useState(DEFAULT_TEAM_FILTERS);
  
  const [players, setPlayers] = useState({ data: [], total: 0, query: '' });
  const [teams, setTeams] = useState({ data: [], total: 0, query: '' }); // Fixed: Added missing team data state hook
  const [metrics, setMetrics] = useState({});
  const [birthData, setBirthData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // ── Fixed: Configured distinct search field debouncers for each tab ──
  const debouncedPlayerSearch = useDebounce(playerFilters.search, 400);
  const debouncedTeamSearch = useDebounce(teamFilters.search, 400);

  useEffect(() => {
    fetchFilters().then(setFilterOptions).catch(console.error);
    fetchBirthChart().then(setBirthData).catch(console.error);
    fetchTeamFilters().then(setTeamFilterOptions).catch(console.error); // Fixed: Preload team choices
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (activeView === 'players') {
        const playerParams = {
          birthYear: playerFilters.birthYear,
          season: playerFilters.season,
          league: playerFilters.league,
          position: playerFilters.position,
          search: debouncedPlayerSearch,
          page: playerFilters.page,
          pageSize: 50,
          sortBy: playerFilters.sortBy,
          sortDir: playerFilters.sortDir,
        };

        const [p, m] = await Promise.all([
          fetchPlayers(playerParams),
          fetchMetrics(playerParams)
        ]);
        setPlayers(p);
        setMetrics(m);
      } else if (activeView === 'teams') {
        const teamParams = {
          search: debouncedTeamSearch,
          athlete: teamFilters.athlete,
          coach: teamFilters.coach,
          league: teamFilters.league,
          page: teamFilters.page,
          pageSize: 50,
          sortBy: teamFilters.sortBy,
          sortDir: teamFilters.sortDir,
        };

        const t = await fetchTeams(teamParams);
        setTeams(t);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
    // Fixed: Fully mapped complete variable tree in hook dependency check block
  }, [
    activeView,
    playerFilters,
    debouncedPlayerSearch,
    teamFilters,
    debouncedTeamSearch
  ]);

  // Fixed: Updated to track 'loadData' handler hook reference name correctly
  useEffect(() => {
    loadData();
  }, [loadData]);

  // ── Fixed: Separated sorting mechanics between table views ──
  const handlePlayerSort = (key) => setPlayerFilters(f => ({
    ...f,
    sortBy: key,
    sortDir: f.sortBy === key && f.sortDir === 'asc' ? 'desc' : 'asc',
    page: 0,
  }));

  const handleTeamSort = (key) => setTeamFilters(f => ({
    ...f,
    sortBy: key,
    sortDir: f.sortBy === key && f.sortDir === 'asc' ? 'desc' : 'asc',
    page: 0,
  }));

  const handleBirthYearSelect = (year) => {
    setPlayerFilters(f => ({ ...f, birthYear: year, page: 0 }));
  };

  const renderContentView = () => {
    switch (activeView) {
      case 'teams':
        // Fixed: Swapped static fallback wrapper out for complete dynamic component integration layout
        return (
          <TeamView
            filterOptions={teamFilterOptions}
            filters={teamFilters}
            setFilters={setTeamFilters}
            teams={teams}
            loading={loading}
            handleSort={handleTeamSort}
          />
        );
      case 'leagues':
        return (
          <div className={styles.emptyView}>
            <h2>League Overviews</h2>
            <p>League standing filters and distribution matrices go here.</p>
          </div>
        );
      case 'players':
      default:
        return (
          <>
            <Filters filters={filterOptions} values={playerFilters} onChange={setPlayerFilters} />
            <MetricCards metrics={metrics} loading={loading} />
            <Charts birthYearData={birthData} metrics={metrics} onBirthYearSelect={handleBirthYearSelect} />
            <QueryDisplay query={players.query || ''} />
            <PlayerTable
              data={players.data || []}
              total={players.total || 0}
              page={playerFilters.page}
              pageSize={50}
              loading={loading}
              sortBy={playerFilters.sortBy}
              sortDir={playerFilters.sortDir}
              onSort={handlePlayerSort}
              onPage={(p) => setPlayerFilters(f => ({ ...f, page: p }))}
            />
          </>
        );
    }
  };

  const getViewTitle = () => activeView.charAt(0).toUpperCase() + activeView.slice(1);

  return (
    <div className={styles.layout}>
      {/* ── Sidebar ─────────────────────────── */}
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <div className={styles.brandTop}>
            <div className={styles.brandIcon}>TopPlay</div>
            <div className={styles.brandName}>Scout DB</div>
          </div>
          <div className={styles.brandSub}>Player Analytics</div>
        </div>
        <nav className={styles.nav}>
          <div className={styles.navLabel}>Views</div>
          <button
            type="button"
            className={`${styles.navItem} ${activeView === 'players' ? styles.navActive : ''}`}
            onClick={() => setActiveView('players')}
          >
            <span className={styles.navIcon}>◈</span> Players
          </button>
          <button
            type="button"
            className={`${styles.navItem} ${activeView === 'teams' ? styles.navActive : ''}`}
            onClick={() => setActiveView('teams')}
          >
            <span className={styles.navIcon}>◇</span> Teams
          </button>
          <button
            type="button"
            className={`${styles.navItem} ${activeView === 'leagues' ? styles.navActive : ''}`}
            onClick={() => setActiveView('leagues')}
          >
            <span className={styles.navIcon}>◉</span> Leagues
          </button>
        </nav>
        <div className={styles.sideStats}>
          <div className={styles.sideStatsTitle}>Summary</div>
          {[
            ['Total players', metrics.totalPlayers?.toLocaleString() ?? '—'],
            ['Goalies', metrics.goalies ?? '—'],
            ['Skaters', metrics.skaters ?? '—'],
            ['Leagues', metrics.leagueCount ?? '—'],
          ].map(([label, val]) => (
            <div key={label} className={styles.sideStatRow}>
              <span className={styles.sideStatLabel}>{label}</span>
              <span className={styles.sideStatVal}>{val}</span>
            </div>
          ))}
        </div>
      </aside>

      {/* ── Main ───────────────────────────── */}
      <main className={styles.main}>
        <div className={styles.topbar}>
          <div className={styles.titleGroup}>
            <h1 className={styles.pageTitle}>{getViewTitle()} Stats</h1>
            <span className={styles.pageSubtitle}>
              {activeView === 'players'
                ? 'Query by birth year, league, season & position'
                : `Overview breakdown for active database ${activeView}`}
            </span>
          </div>
          {error && <div className={styles.error}>⚠ {error}</div>}
        </div>
        <div className={styles.content}>
          {renderContentView()}
        </div>
      </main>
    </div>
  );
}
