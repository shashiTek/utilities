import React from 'react';
import styles from './Filters.module.css';

export default function TeamFilters({ filterOptions, values, onChange }) {
  const handleChange = (field, val) => {
    onChange(prev => ({ ...prev, [field]: val, page: 0 }));
  };

  // Convert team list data to a safe unique set array to avoid double options
  const uniqueTeams = [...new Set(filterOptions.teams || [])].sort();

  return (
    <div className={styles.filtersPanel}>
      {/* 1. Fixed: Converted text input into a standardized unique team dropdown */}
      <div className={styles.filterGroup}>
        <label className={styles.label}>Team Name</label>
        <select 
          className={styles.select}
          value={values.search || ''} 
          onChange={(e) => handleChange('search', e.target.value)}
        >
          <option value="">All Teams</option>
          {uniqueTeams.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>

      {/* 2. Specific Athlete Search Input */}
      <div className={styles.filterGroup}>
        <label className={styles.label}>Roster Athlete</label>
        <input 
          type="text" 
          className={styles.input} 
          placeholder="Search by athlete name..." 
          value={values.athlete || ''} 
          onChange={(e) => handleChange('athlete', e.target.value)} 
        />
      </div>

      {/* 3. Coach Filter Input */}
      <div className={styles.filterGroup}>
        <label className={styles.label}>Head Coach</label>
        <input 
          type="text" 
          className={styles.input} 
          placeholder="Filter by coach..." 
          value={values.coach || ''} 
          onChange={(e) => handleChange('coach', e.target.value)} 
        />
      </div>

      {/* 4. League Dropdown Selection */}
      <div className={styles.filterGroup}>
        <label className={styles.label}>League</label>
        <select 
          className={styles.select} 
          value={values.league || ''} 
          onChange={(e) => handleChange('league', e.target.value)} 
        >
          <option value="">All Leagues</option>
          {(filterOptions.leagues || []).map((l) => (
            <option key={l} value={l}>{l}</option>
          ))}
        </select>
      </div>
    </div>
  );
}
