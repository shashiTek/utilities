import React from 'react';
import styles from './Filters.module.css';

export default function Filters({ filters, values, onChange }) {
  const set = (k) => (e) => onChange({ ...values, [k]: e.target.value, page: 0 });

  return (
    <div className={styles.bar}>
      <div className={styles.group}>
        <label className={styles.label}>Birth year</label>
        <select className={styles.select} value={values.birthYear} onChange={set('birthYear')}>
          <option value="">All years</option>
          {(filters.birthYears || []).map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      <div className={styles.group}>
        <label className={styles.label}>Season</label>
        <select className={styles.select} value={values.season} onChange={set('season')}>
          <option value="">All seasons</option>
          {(filters.seasons || []).map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div className={styles.group}>
        <label className={styles.label}>League</label>
        <select className={styles.select} value={values.league} onChange={set('league')}>
          <option value="">All leagues</option>
          {(filters.leagues || []).map(l => <option key={l} value={l}>{l.toUpperCase()}</option>)}
        </select>
      </div>

      <div className={styles.group}>
        <label className={styles.label}>Position</label>
        <select className={styles.select} value={values.position} onChange={set('position')}>
          <option value="">All positions</option>
          <option value="G">Goalie</option>
          <option value="F/D">Skater</option>
        </select>
      </div>

      <div className={styles.group}>
        <label className={styles.label}>Search</label>
        <input
          className={styles.input}
          type="text"
          placeholder="Name or team…"
          value={values.search}
          onChange={set('search')}
        />
      </div>

      <button
        className={styles.reset}
        onClick={() => onChange({ birthYear: '', season: '', league: '', position: '', search: '', page: 0 })}
      >
        Clear all
      </button>
    </div>
  );
}
