import React from 'react';
import styles from './PlayerTable.module.css';

export default function TeamTable({
  data,
  total,
  page,
  pageSize,
  loading,
  sortBy,
  sortDir,
  onSort,
  onPage,
  onSelectTeam,
  selectedTeamId,
  onToggleCompare, // Fixed: Added missing comparison handler prop
  isComparing      // Fixed: Added missing comparison active check function prop
}) {
  const totalPages = Math.ceil(total / pageSize) || 1;

  const renderSortIcon = (key) => {
    if (sortBy !== key) return <span className={styles.sortNone}>↕</span>;
    return sortDir === 'asc' ? '↑' : '↓';
  };

  return (
    <div className={styles.tableWrapper}>
      <table className={styles.table} style={{ tableLayout: 'fixed', width: '100%' }}>
        {/* Fixed: Updated colgroup column tracking nodes to distribute space for 5 columns */}
        <colgroup>
          <col style={{ width: '30%' }} />
          <col style={{ width: '20%' }} />
          <col style={{ width: '20%' }} />
          <col style={{ width: '15%' }} />
          <col style={{ width: '15%' }} />
        </colgroup>
        <thead>
          <tr>
            <th onClick={() => onSort('team_name')} className={styles.sortable}>
              Team Name {renderSortIcon('team_name')}
            </th>
            <th onClick={() => onSort('league')} className={styles.sortable}>
              League {renderSortIcon('league')}
            </th>
            <th onClick={() => onSort('coach')} className={styles.sortable}>
              Head Coach {renderSortIcon('coach')}
            </th>
            <th onClick={() => onSort('roster_count')} className={styles.sortable}>
              Roster {renderSortIcon('roster_count')}
            </th>
            {/* Fixed: Added missing Actions column header */}
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr><td colSpan={5} className={styles.center}>Loading roster details...</td></tr>
          ) : data.length === 0 ? (
            <tr><td colSpan={5} className={styles.center}>No teams found.</td></tr>
          ) : (
            data.map((team) => {
              const isSelected = selectedTeamId === team.id;
              const teamIsComparing = isComparing(team.id); // Fixed: Execute the status function check safely

              return (
                <tr 
                  key={team.id} 
                  style={{ 
                    cursor: 'pointer',
                    background: isSelected ? 'rgba(232, 67, 26, 0.05)' : 'transparent',
                    borderLeft: isSelected ? '4px solid #E8431A' : 'none'
                  }}
                >
                  {/* Row click event isolated to data columns so clicking the button doesn't trigger row selection */}
                  <td className={styles.bold} onClick={() => onSelectTeam(team)}>{team.team_name}</td>
                  <td onClick={() => onSelectTeam(team)}><span className={styles.badge}>{team.league}</span></td>
                  <td onClick={() => onSelectTeam(team)}>{team.coach || '—'}</td>
                  <td onClick={() => onSelectTeam(team)} className={styles.bold} style={{ color: '#E8431A' }}>
                    {team.roster_count} Players →
                  </td>
                  
                  {/* Fixed: Added Comparison interactive action cell row */}
                  <td>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation(); // Stops row selection side drawer from opening
                        onToggleCompare(team);
                      }}
                      style={{
                        padding: '4px 10px',
                        fontSize: '11px',
                        fontWeight: '600',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        background: teamIsComparing ? '#E8431A' : 'transparent',
                        border: '1.5px solid #E8431A',
                        color: teamIsComparing ? '#FFFFFF' : '#E8431A',
                        width: '100%',
                        textAlign: 'center',
                        transition: 'all 0.15s'
                      }}
                    >
                      {teamIsComparing ? 'Selected' : 'Compare'}
                    </button>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>

      {/* Pagination */}
      <div className={styles.pagination}>
        <span className={styles.pageInfo}>
          Showing {page * pageSize + 1} - {Math.min((page + 1) * pageSize, total)} of {total}
        </span>
        <div className={styles.pageButtons}>
          <button disabled={page === 0 || loading} onClick={() => onPage(page - 1)} className={styles.pageBtn}>Prev</button>
          <span className={styles.activePage}>{page + 1} / {totalPages}</span>
          <button disabled={page >= totalPages - 1 || loading} onClick={() => onPage(page + 1)} className={styles.pageBtn}>Next</button>
        </div>
      </div>
    </div>
  );
}
