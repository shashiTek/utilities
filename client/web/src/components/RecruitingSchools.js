import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { fetchRecruitingSchools, fetchFilters } from '../api';
import AgingOutPlayersModal from './AgingOutPlayersModal';
import styles from './RecruitingSchools.module.css';

// ─── Helpers ────────────────────────────────────────────────────────────────
const getPriorityColor = (priority) => {
  switch (priority) {
    case 'HIGH': return '#d32f2f';
    case 'MEDIUM': return '#f57c00';
    case 'LOW': return '#388e3c';
    default: return '#999';
  }
};

const PriorityBadge = ({ priority }) => (
  <span
    className={styles.priorityBadge}
    style={{ backgroundColor: getPriorityColor(priority) }}
  >
    {priority}
  </span>
);

// ─── Component ──────────────────────────────────────────────────────────────
export default function RecruitingSchools() {
  const [filters, setFilters] = useState({});
  const [filterOptions, setFilterOptions] = useState({});
  const [schools, setSchools] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Target birth year - 2011 is the main focus
  const [birthYear, setBirthYear] = useState('2011');
  const [season, setSeason] = useState('');
  const [league, setLeague] = useState('');
  const [agingOutYears, setAgingOutYears] = useState(''); // Empty = use server default
  const [selectedSchool, setSelectedSchool] = useState(null); // For aging out players modal

  // Load filter options on mount
  useEffect(() => {
    fetchFilters()
      .then(setFilterOptions)
      .catch(console.error);
  }, []);

  // Fetch recruiting schools
  const loadData = useCallback(async () => {
    if (!birthYear) return;

    setLoading(true);
    setError(null);
    try {
      const data = await fetchRecruitingSchools(
        birthYear,
        season || undefined,
        league || undefined,
        agingOutYears ? parseInt(agingOutYears) : undefined
      );
      setSchools(data.schools || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [birthYear, season, league, agingOutYears]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Calculate the cutoff birth year for aging out players
  // Aging out must be 18+ years old (minimum)
  const MIN_AGE_FOR_AGING_OUT = 18;
  
  const getAgingOutYearsValue = () => {
    return agingOutYears ? parseInt(agingOutYears) : 3; // default to 3
  };

  const getCutoffBirthYear = () => {
    const currentYear = 2026;
    const agingOutYears = getAgingOutYearsValue();
    // Ensure cutoff is at least 18 years old
    return currentYear - Math.max(agingOutYears, MIN_AGE_FOR_AGING_OUT);
  };

  return (
    <div className={styles.container}>
      {/* ── Header ── */}
      <div className={styles.header}>
        <h1>Schools Recruiting {birthYear}-Born Players</h1>
        <p className={styles.subtitle}>
          Find prep schools losing aging players (18+) and seeking {birthYear}-born talent
        </p>
      </div>

      {/* ── Filters ── */}
      <div className={styles.filtersPanel}>
        <div className={styles.filterGroup}>
          <label>Target Birth Year *</label>
          <input
            type="number"
            value={birthYear}
            onChange={(e) => setBirthYear(e.target.value)}
            min="1990"
            max="2020"
            className={styles.input}
          />
        </div>

        <div className={styles.filterGroup}>
          <label>Season</label>
          <select
            value={season}
            onChange={(e) => setSeason(e.target.value)}
            className={styles.select}
          >
            <option value="">All Seasons</option>
            {(filterOptions.seasons || []).map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.filterGroup}>
          <label>League</label>
          <select
            value={league}
            onChange={(e) => setLeague(e.target.value)}
            className={styles.select}
          >
            <option value="">All Leagues</option>
            {(filterOptions.leagues || []).map((l) => (
              <option key={l} value={l}>
                {l.toUpperCase()}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.filterGroup}>
          <label>Aging Out Years</label>
          <input
            type="number"
            value={agingOutYears}
            onChange={(e) => setAgingOutYears(e.target.value)}
            placeholder="Default from config"
            min="1"
            max="10"
            className={styles.input}
          />
        </div>

        <button onClick={loadData} className={styles.refreshBtn} disabled={loading}>
          {loading ? 'Loading...' : '🔄 Refresh'}
        </button>
      </div>

      {/* ── Error ── */}
      {error && <div className={styles.error}>Error: {error}</div>}

      {/* ── Results ── */}
      <div className={styles.resultsPanel}>
        {loading && <p className={styles.loading}>Loading schools...</p>}

        {!loading && schools.length === 0 && (
          <p className={styles.noResults}>No schools found matching criteria</p>
        )}

        {!loading && schools.length > 0 && (
          <>
            <div className={styles.resultCount}>
              Found <strong>{schools.length}</strong> schools recruiting {birthYear}-born players
            </div>

            <div className={styles.schoolsList}>
              {schools.map((school, idx) => (
                <div key={idx} className={styles.schoolCard}>
                  {/* Header */}
                  <div className={styles.cardHeader}>
                    <div className={styles.schoolInfo}>
                      <h3 className={styles.schoolName}>{school.team}</h3>
                      <div className={styles.badges}>
                        <span className={styles.league}>{(school.league || '').toUpperCase()}</span>
                        <span className={styles.season}>{school.season}</span>
                      </div>
                    </div>
                    <div className={styles.priority}>
                      <PriorityBadge priority={school.recruitment_priority} />
                      <span className={styles.priorityText}>
                        {school.aging_out_percentage}% losing
                      </span>
                    </div>
                  </div>

                  {/* Stats Grid */}
                  <div className={styles.statsGrid}>
                    {/* Target Cohort */}
                    <div className={styles.statBox}>
                      <div className={styles.statLabel}>2011-Born (Target)</div>
                      <div className={styles.statValue} style={{ color: '#1976d2' }}>
                        {school.players_target_cohort}
                      </div>
                    </div>

                    {/* Aging Out */}
                    <div className={styles.statBox}>
                      <div className={styles.statLabel}>Aging Out ({getCutoffBirthYear()} & older)</div>
                      <div className={styles.statValue} style={{ color: '#d32f2f' }}>
                        {school.players_aging_out}
                      </div>
                    </div>

                    {/* Future Talent */}
                    <div className={styles.statBox}>
                      <div className={styles.statLabel}>Future (2012 & younger)</div>
                      <div className={styles.statValue} style={{ color: '#388e3c' }}>
                        {school.players_future_talent}
                      </div>
                    </div>

                    {/* Total */}
                    <div className={styles.statBox}>
                      <div className={styles.statLabel}>Total Players</div>
                      <div className={styles.statValue} style={{ color: '#666' }}>
                        {school.total_players}
                      </div>
                    </div>
                  </div>

                  {/* Position Mix */}
                  <div className={styles.positionMix}>
                    <div className={styles.positionItem}>
                      <span className={styles.positionLabel}>F:</span>
                      <span className={styles.positionCount}>{school.forwards}</span>
                    </div>
                    <div className={styles.positionItem}>
                      <span className={styles.positionLabel}>D:</span>
                      <span className={styles.positionCount}>{school.defensemen}</span>
                    </div>
                    <div className={styles.positionItem}>
                      <span className={styles.positionLabel}>G:</span>
                      <span className={styles.positionCount}>{school.goalies}</span>
                    </div>
                  </div>

                  {/* Action */}
                  <div className={styles.cardFooter}>
                    <small className={styles.insight}>
                      {school.aging_out > 0 && school.players_target_cohort > 0
                        ? `Strong fit: Losing ${school.aging_out} players, has ${school.players_target_cohort} 2011-borns`
                        : 'Growing program with young talent'}
                    </small>
                    {school.players_aging_out > 0 && (
                      <button
                        className={styles.viewPlayersBtn}
                        onClick={() => setSelectedSchool(school.team)}
                      >
                        👥 View {school.players_aging_out} Aging Out
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Modal for aging out players */}
      {selectedSchool && (
        <AgingOutPlayersModal
          school={selectedSchool}
          season={season}
          league={league}
          agingOutYears={agingOutYears ? parseInt(agingOutYears) : undefined}
          onClose={() => setSelectedSchool(null)}
        />
      )}
    </div>
  );
}
