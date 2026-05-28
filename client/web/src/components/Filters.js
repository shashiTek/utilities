import React, { useMemo } from 'react';
import styles from './Filters.module.css';

const POSITIONS = [
  { value: 'G', label: 'G', title: 'Goalie' },
  { value: 'D', label: 'D', title: 'Defense' },
  { value: 'F', label: 'F', title: 'Forward' },
];

export default function Filters({ filters, values, onChange }) {
  // FIX 1: Explicitly cast elements to numbers right away to ensure stable sort comparisons
  const birthYears = useMemo(() => {
    const rawYears = filters.birthYears || [];
    const validNumbers = rawYears.map(y => parseInt(y, 10)).filter(y => !isNaN(y));
    return [...new Set(validNumbers)].sort((a, b) => a - b);
  }, [filters.birthYears]);

  // FIX 2: Parse current state selection variables into strict integers/nulls
  const currentFrom = values.birthYearFrom ? parseInt(values.birthYearFrom, 10) : null;
  const currentTo = values.birthYearTo ? parseInt(values.birthYearTo, 10) : null;

  // Handles state updates while safely preserving numbers or fallback strings
  const set = (k) => (e) => {
    const rawVal = e.target.value;
    // Keep numbers as strings/ints matching backend expectation, but prioritize structural clearing
    onChange({ ...values, [k]: rawVal, page: 0 });
  };

  // FIX 3: Extracted chip clear handler execution strategies out to protect against memory leak ref triggers
  const activeChips = useMemo(() => {
    const chips = [];
    
    if (values.birthYearFrom || values.birthYearTo) {
      const displayFrom = values.birthYearFrom || '—';
      const displayTo = values.birthYearTo || '—';
      chips.push({
        key: 'byRange',
        label: `Born ${displayFrom} – ${displayTo}`,
        type: 'birthRange'
      });
    }
    if (values.season) chips.push({ key: 'season', label: values.season, type: 'season' });
    if (values.league) chips.push({ key: 'league', label: values.league.toUpperCase(), type: 'league' });
    if (values.position) chips.push({ key: 'position', label: values.position, type: 'position' });
    if (values.search) chips.push({ key: 'search', label: `"${values.search}"`, type: 'search' });
    
    return chips;
  }, [values.birthYearFrom, values.birthYearTo, values.season, values.league, values.position, values.search]);

  // Unified dynamic clear callback handler method
  const handleClearChip = (type) => {
    const updated = { ...values, page: 0 };
    if (type === 'birthRange') {
      updated.birthYearFrom = '';
      updated.birthYearTo = '';
    } else {
      updated[type] = '';
    }
    onChange(updated);
  };

  const hasFilters = activeChips.length > 0;

  return (
    <div className={styles.wrap}>
      <div className={styles.bar}>
        
        {/* Birth year range from */}
        <div className={styles.rangeGroup}>
          <label className={styles.label}>Born — from</label>
          <select className={styles.select} value={values.birthYearFrom || ''} onChange={set('birthYearFrom')}>
            <option value="">Any</option>
            {birthYears.map(y => (
              <option 
                key={y} 
                value={y} 
                //FIX 4: Explicitly utilizes verified currentTo integer parsing for disabling logic
                disabled={currentTo !== null && y > currentTo}
              >
                {y}
              </option>
            ))}
          </select>
        </div>

        {/* Birth year range to */}
        <div className={styles.rangeGroup}>
          <label className={styles.label}>to</label>
          <select className={styles.select} value={values.birthYearTo || ''} onChange={set('birthYearTo')}>
            <option value="">Any</option>
            {birthYears.map(y => (
              <option 
                key={y} 
                value={y} 
                //FIX 5: Explicitly utilizes verified currentFrom integer parsing for disabling logic
                disabled={currentFrom !== null && y < currentFrom}
              >
                {y}
              </option>
            ))}
          </select>
        </div>

        {/* Season */}
        <div className={styles.group}>
          <label className={styles.label}>Season</label>
          <select className={styles.select} value={values.season || ''} onChange={set('season')}>
            <option value="">All seasons</option>
            {(filters.seasons || []).map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        {/* League */}
        <div className={styles.group}>
          <label className={styles.label}>League</label>
          <select className={styles.select} value={values.league || ''} onChange={set('league')}>
            <option value="">All leagues</option>
            {(filters.leagues || []).map(l => <option key={l} value={l}>{l.toUpperCase()}</option>)}
          </select>
        </div>

        {/* Position toggle buttons */}
        <div className={styles.group}>
          <label className={styles.label}>Position</label>
          <div className={styles.posGroup}>
            {POSITIONS.map(p => (
              <button 
                key={p.value} 
                type="button" 
                title={p.title} 
                className={`${styles.posBtn} ${values.position === p.value ? styles.posBtnActive : ''}`} 
                onClick={() => onChange({ ...values, position: values.position === p.value ? '' : p.value, page: 0 })}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Search */}
        <div className={`${styles.group} ${styles.searchGroup}`}>
          <label className={styles.label}>Search player or team</label>
          <div className={styles.searchWrap}>
            <span className={styles.searchIcon}>⌕</span>
            <input className={styles.input} type="text" placeholder="Name or team…" value={values.search || ''} onChange={set('search')} />
            {values.search && (
              <button type="button" className={styles.inputClear} onClick={() => onChange({ ...values, search: '', page: 0 })}>✕</button>
            )}
          </div>
        </div>

        {/* Clear all */}
        <button 
          type="button"
          className={`${styles.reset} ${hasFilters ? styles.resetActive : ''}`} 
          onClick={() => onChange({
            birthYearFrom: '',
            birthYearTo: '',
            season: '',
            league: '',
            position: '',
            search: '',
            page: 0,
            sortBy: values.sortBy,
            sortDir: values.sortDir,
          })} 
          disabled={!hasFilters}
        >
          Clear all
        </button>
      </div>

      {/* Active filter chips */}
      {hasFilters && (
        <div className={styles.chips}>
          <span className={styles.chipsLabel}>Active:</span>
          {activeChips.map(chip => (
            <span key={chip.key} className={styles.chip}>
              {chip.label}
              <button type="button" className={styles.chipX} onClick={() => handleClearChip(chip.type)}>✕</button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
