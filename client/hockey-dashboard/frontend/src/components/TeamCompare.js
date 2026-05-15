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
          <span className={styles.subtitleText}>Comparing {selectedTeams.length} of 2 teams Max</span>
        </div>
        <button onClick={onClose} className={styles.clearBtn}>Clear Comparison ✕</button>
      </div>

      <div className={styles.compareGrid} style={{ gridTemplateColumns: isTwoColumns ? '1fr 1fr' : '1fr', gap: '24px' }}>
        {selectedTeams.map((team) => {
          const teamStats = team.stats || {};
          return (
            <div key={team.id} className={styles.cardBody}>
              <button onClick={() => onRemove(team.id)} className={styles.removeCardBtn}>✕</button>
              <h4 className={styles.cardTitle}>{team.team_name}</h4>
              <span className={styles.leagueBadge}>{team.league} ({teamStats.cohort_season || '—'})</span>

              {/* Roster Layout Split Grid */}
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

              {/* ── NEW: TOP LEADERS HIGHLIGHT BOX ── */}
              <div style={{
                marginTop: '16px',
                padding: '14px',
                background: 'linear-gradient(135deg, rgba(232,67,26,0.02) 0%, rgba(0,0,0,0.02) 100%)',
                border: '1px solid var(--border)',
                borderRadius: '8px'
              }}>
                <span className={styles.rosterSectionTitle} style={{ color: '#E8431A', marginBottom: '10px', fontSize: '11px', letterSpacing: '0.05em' }}>
                  ★ Team Performance Leaders
                </span>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', background: 'var(--bg-card)', padding: '6px 10px', borderRadius: '4px', border: '1px solid rgba(0,0,0,0.02)' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Top Scorer:</span>
                    <strong style={{ color: '#E8431A' }}>{teamStats.top_scorer || '—'}</strong>
                  </div>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', background: 'var(--bg-card)', padding: '6px 10px', borderRadius: '4px', border: '1px solid rgba(0,0,0,0.02)' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Top Assists:</span>
                    <strong style={{ color: '#1B5FA8' }}>{teamStats.top_assister || '—'}</strong>
                  </div>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', background: 'var(--bg-card)', padding: '6px 10px', borderRadius: '4px', border: '1px solid rgba(0,0,0,0.02)' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Top Goalie:</span>
                    <strong style={{ color: '#0D7C6B' }}>{teamStats.top_goalie || '—'}</strong>
                  </div>
                </div>
              </div>

              {/* Roster Listing Area */}
              <div style={{ marginTop: '16px' }}>
                <span className={styles.rosterSectionTitle}>Full Roster Athletes</span>
                <div className={styles.rosterContainer}>
                  {(team.athletes || []).map((playerObj, idx) => (
                    <div key={idx} className={styles.athleteRow} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                      <span>{idx + 1}. {playerObj.name} [{playerObj.position}]</span>
                      <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{playerObj.summary.split('|')[1] || playerObj.summary}</span>
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
