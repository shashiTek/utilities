import React, { useMemo } from 'react';
import styles from './Filters.module.css';

const POSITIONS = [
  { value: 'G', label: 'G', title: 'Goalie' },
  { value: 'D', label: 'D', title: 'Defense' },
  { value: 'F', label: 'F', title: 'Forward' },
];

export default function Filters({ filters, values, onChange }) {
  const set = (k) => (e) => onChange({ ...values, [k]: e.target.value, page: 0 });

  // Sorted unique birth years for From/To selects
  const birthYears = useMemo(() =>
    [...new Set(filters.birthYears || [])].sort((a, b) => a - b),
    [filters.birthYears]
  );

  // Active filter chips — show what is currently applied
  const activeChips = useMemo(() => {
    const chips = [];
    if (values.birthYearFrom || values.birthYearTo) {
      const from = values.birthYearFrom || '—';
      const to   = values.birthYearTo   || '—';
      chips.push({ key: 'byRange', label: `Born ${from} – ${to}`, clear: () => onChange({ ...values, birthYearFrom: '', birthYearTo: '', page: 0 }) });
    }
    if (values.season)   chips.push({ key: 'season',   label: values.season,               clear: () => onChange({ ...values, season: '',   page: 0 }) });
    if (values.league)   chips.push({ key: 'league',   label: values.league.toUpperCase(), clear: () => onChange({ ...values, league: '',   page: 0 }) });
    if (values.position) chips.push({ key: 'position', label: values.position,             clear: () => onChange({ ...values, position: '', page: 0 }) });
    if (values.search)   chips.push({ key: 'search',   label: `"${values.search}"`,        clear: () => onChange({ ...values, search: '',   page: 0 }) });
    return chips;
  }, [values, onChange]);

  const hasFilters = activeChips.length > 0;

  return (
    <div className={styles.wrap}>
      <div className={styles.bar}>

        {/* Birth year range */}
        <div className={styles.rangeGroup}>
          <label className={styles.label}>Born — from</label>
          <select className={styles.select} value={values.birthYearFrom || ''} onChange={set('birthYearFrom')}>
            <option value="">Any</option>
            {birthYears.map(y => (
              <option key={y} value={y} disabled={values.birthYearTo && y > values.birthYearTo}>{y}</option>
            ))}
          </select>
        </div>

        <div className={styles.rangeGroup}>
          <label className={styles.label}>to</label>
          <select className={styles.select} value={values.birthYearTo || ''} onChange={set('birthYearTo')}>
            <option value="">Any</option>
            {birthYears.map(y => (
              <option key={y} value={y} disabled={values.birthYearFrom && y < values.birthYearFrom}>{y}</option>
            ))}
          </select>
        </div>

        {/* Season */}
        <div className={styles.group}>
          <label className={styles.label}>Season</label>
          <select className={styles.select} value={values.season} onChange={set('season')}>
            <option value="">All seasons</option>
            {(filters.seasons || []).map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        {/* League */}
        <div className={styles.group}>
          <label className={styles.label}>League</label>
          <select className={styles.select} value={values.league} onChange={set('league')}>
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
            <input
              className={styles.input}
              type="text"
              placeholder="Name or team…"
              value={values.search}
              onChange={set('search')}
            />
            {values.search && (
              <button className={styles.inputClear} onClick={() => onChange({ ...values, search: '', page: 0 })}>✕</button>
            )}
          </div>
        </div>

        {/* Clear all */}
        <button
          className={`${styles.reset} ${hasFilters ? styles.resetActive : ''}`}
          onClick={() => onChange({
            birthYearFrom: '', birthYearTo: '', season: '', league: '',
            position: '', search: '', page: 0,
            sortBy: values.sortBy, sortDir: values.sortDir,
          })}
          disabled={!hasFilters}
        >
          Clear all
        </button>
      </div>

      {/* Active filter chips */}
      {activeChips.length > 0 && (
        <div className={styles.chips}>
          <span className={styles.chipsLabel}>Active:</span>
          {activeChips.map(chip => (
            <span key={chip.key} className={styles.chip}>
              {chip.label}
              <button className={styles.chipX} onClick={chip.clear}>✕</button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
