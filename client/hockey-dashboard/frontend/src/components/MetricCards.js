import React from 'react';
import styles from './MetricCards.module.css';

function fmt(v, dec = 1) {
  if (v == null || v === '') return '—';
  return typeof v === 'number' ? v.toFixed(dec) : v;
}

export default function MetricCards({ metrics, loading }) {
  // FIX: Added top goalie fallback properties to protect layout initialization state
  const m = metrics || {
    totalPlayers: '—',
    forwards: 0,
    defensemen: 0,
    goalies: 0,
    topForwardScorer: '—',
    maxForwardPts: 0,
    topDefenseScorer: '—',
    maxDefensePts: 0,
    avgDefenseBlks: 0,
    topGoalie: '—',
    maxGoalieSVP: 0,
    topGoalieGAA: 0,
    avgGAA: null,
    avgSVP: null,
    leagueCount: '—'
  };

  const cards = [
    { 
      label: 'Roster Split', 
      value: m.totalPlayers ?? '—', 
      sub: `${m.forwards ?? 0} F · ${m.defensemen ?? 0} D · ${m.goalies ?? 0} G`, 
      color: 'accent' 
    },
    { 
      label: 'Forward Leaders', 
      value: m.topForwardScorer ?? '—', 
      sub: `Top F: ${m.maxForwardPts ?? 0} PTS avg`, 
      color: 'teal' 
    },
    { 
      label: 'Defense Impact', 
      value: m.topDefenseScorer ?? '—', 
      sub: `Top D: ${m.maxDefensePts ?? 0} PTS · ${m.avgDefenseBlks ?? 0} BLK`, 
      color: 'amber' 
    },
    { 
      label: 'Top Goalie', 
      value: m.topGoalie ?? '—', 
      sub: `Top G: ${m.maxGoalieSVP != null && m.maxGoalieSVP !== 0 ? fmt(m.maxGoalieSVP, 1) + '%' : '—'} SV% · ${fmt(m.topGoalieGAA, 2)} GAA`, 
      color: 'blue' 
    },
    { 
      label: 'Goalie SV% Avg', 
      value: m.avgSVP != null && m.avgSVP !== 0 ? fmt(m.avgSVP, 1) + '%' : '—', 
      sub: 'Save Percentage Average', 
      color: 'blue' 
    },
    { 
      label: 'Active Leagues', 
      value: m.leagueCount ?? '—', 
      sub: 'Total leagues in view', 
      color: 'accent' 
    },
  ];

  return (
    <div className={styles.grid}>
      {cards.map(c => (
        <div key={c.label} className={`${styles.card} ${styles[c.color]} ${loading ? styles.loading : ''}`}>
          <div className={styles.label}>{c.label}</div>
          <div className={styles.value}>{c.value}</div>
          <div className={styles.sub}>{c.sub}</div>
        </div>
      ))}
    </div>
  );
}
