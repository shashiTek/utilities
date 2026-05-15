import React from 'react';
import styles from './MetricCards.module.css';

function fmt(v, dec = 1) {
  if (v == null || v === '') return '—';
  return typeof v === 'number' ? v.toFixed(dec) : v;
}

export default function MetricCards({ metrics, loading }) {
  const cards = [
    { label: 'Players',    value: metrics.totalPlayers ?? '—', sub: `${metrics.goalies ?? 0} goalies · ${metrics.skaters ?? 0} skaters`, color: 'accent' },
    { label: 'Avg GP',     value: fmt(metrics.avgGP, 1),        sub: 'games played avg',   color: 'teal' },
    { label: 'Avg GAA',    value: fmt(metrics.avgGAA, 2),       sub: 'goals against avg',  color: 'amber' },
    { label: 'Avg SV%',    value: metrics.avgSVP != null ? fmt(metrics.avgSVP, 1) + '%' : '—', sub: 'save percentage', color: 'blue' },
    { label: 'Top scorer', value: metrics.maxPTS ?? '—',        sub: 'pts (filtered view)',color: 'teal' },
    { label: 'Leagues',    value: metrics.leagueCount ?? '—',   sub: 'in current view',    color: 'amber' },
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
