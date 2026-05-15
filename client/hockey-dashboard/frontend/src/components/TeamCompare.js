import React from 'react';
import styles from './TeamCompare.module.css';

export default function TeamCompare({ selectedTeams, onRemove, onClose }) {
  if (!selectedTeams || selectedTeams.length === 0) return null;

  const isTwoColumns = selectedTeams.length === 2;

  return (
    <div className={styles.compareContainer}>
      <div className={styles.compareHeader}>
        <div>
          <h3 className={styles.titleText}>Team Comparison Dashboard</h3>
          <span className={styles.subtitleText}>
            Comparing {selectedTeams.length} of 2 teams Max
          </span>
        </div>
        <button onClick={onClose} className={styles.clearBtn}>
          Clear Comparison ✕
        </button>
      </div>

      <div 
        className={styles.compareGrid} 
        style={{ gridTemplateColumns: isTwoColumns ? '1fr 1fr' : '1fr' }}
      >
        {selectedTeams.map((team) => {
          // Provide local defaults if backend properties are unpopulated
          const teamStats = team.stats || { avg_age: '—', goalies: 0, skaters: 0, common_birth_year: '—', cohort_season: '—' };
          
          return (
            <div key={team.id} className={styles.cardBody}>
              <button onClick={() => onRemove(team.id)} className={styles.removeCardBtn}>✕</button>
              <h4 className={styles.cardTitle}>{team.team_name}</h4>
              <span className={styles.leagueBadge}>{team.league} ({teamStats.cohort_season})</span>

              {/* Core Staff Metrics */}
              <div className={styles.metricsSplitGrid}>
                <div>
                  <span className={styles.metricLabel}>Roster Size</span>
                  <strong className={styles.metricValueBig}>{team.roster_count} Players</strong>
                </div>
                <div>
                  <span className={styles.metricLabel}>Head Coach</span>
                  <strong className={styles.metricValueText}>{team.coach}</strong>
                </div>
              </div>

              {/* ── NEW: Player Aggregation Stats Breakdown Section ── */}
              <div style={{
                marginTop: '14px',
                padding: '12px',
                background: 'rgba(232, 67, 26, 0.03)',
                border: '1px solid rgba(232, 67, 26, 0.1)',
                borderRadius: '6px'
              }}>
                <span className={styles.rosterSectionTitle} style={{ color: '#E8431A', marginBottom: '8px' }}>
                  Player Roster Analytics
                </span>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 14px' }}>
                  <div>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Average Age</span>
                    <div style={{ fontSize: '14px', fontWeight: '600' }}>{teamStats.avg_age} yrs</div>
                  </div>
                  <div>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Top Birth Year</span>
                    <div style={{ fontSize: '14px', fontWeight: '600' }}>{teamStats.common_birth_year}</div>
                  </div>
                  <div>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Skaters Count</span>
                    <div style={{ fontSize: '14px', fontWeight: '600', color: '#1B5FA8' }}>{teamStats.skaters} Skaters</div>
                  </div>
                  <div>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Goalies Count</span>
                    <div style={{ fontSize: '14px', fontWeight: '600', color: '#0D7C6B' }}>{teamStats.goalies} Goalies</div>
                  </div>
                </div>
              </div>

              {/* Scrollable Roster Box */}
              <div style={{ marginTop: '12px' }}>
  <span className={styles.rosterSectionTitle}>Roster Athletes & Seasonal Stats</span>
  <div className={styles.rosterContainer}>
    {(team.athletes || []).map((playerObj, idx) => (
      <div 
        key={idx} 
        className={styles.athleteRow}
        style={{ display: 'flex', flexDirection: 'column', gap: '2px', padding: '6px 10px' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span style={{ color: 'var(--text-muted)', marginRight: '6px', fontSize: '11px' }}>{idx + 1}.</span>
            <strong style={{ fontSize: '13px' }}>{playerObj.name}</strong>
          </div>
          {/* Positional indicator badge capsule */}
          <span style={{
            fontSize: '10px',
            fontWeight: '700',
            padding: '1px 5px',
            borderRadius: '4px',
            background: playerObj.position === 'G' ? 'rgba(13, 124, 107, 0.1)' : 'rgba(27, 95, 168, 0.1)',
            color: playerObj.position === 'G' ? '#0D7C6B' : '#1B5FA8'
          }}>
            {playerObj.position}
          </span>
        </div>
        {/* Dynamic game performance stats text row */}
        <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
          {playerObj.summary}
        </span>
      </div>
    ))}
  </div>
</div>
            </div>
          );
        })}

        {selectedTeams.length === 1 && (
          <div className={styles.placeholderBox}>
            Select another team from the list below to compare analytical player records side-by-side...
          </div>
        )}
      </div>
    </div>
  );
}
