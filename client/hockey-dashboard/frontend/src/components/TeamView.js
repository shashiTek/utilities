import React, { useState } from 'react';
import TeamFilters from './TeamFilters';
import TeamTable from './TeamTable';
import RosterPanel from './RosterPanel';
import TeamCompare from './TeamCompare'; // Fixed: Imported missing comparison panel
import QueryDisplay from './QueryDisplay';

export default function TeamView({
  filterOptions,
  filters,
  setFilters,
  teams,
  loading,
  handleSort
}) {
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [compareTeams, setCompareTeams] = useState([]); // Fixed: Added missing state array to hold teams being compared

  // Fixed: Implemented the comparison handler callback engine
  const handleToggleCompare = (team) => {
    setCompareTeams((prev) => {
      const exists = prev.find((t) => t.id === team.id);
      if (exists) {
        return prev.filter((t) => t.id !== team.id);
      }
      if (prev.length >= 2) {
        alert("You can only compare a maximum of 2 teams simultaneously.");
        return prev;
      }
      return [...prev, team];
    });
  };

  return (
    <>
      <TeamFilters 
        filterOptions={filterOptions} 
        values={filters} 
        onChange={setFilters} 
      />
      
      <QueryDisplay query={teams.query || ''} />
      
      {/* Fixed: Rendered the TeamCompare layout row module on top of the grids */}
      <TeamCompare 
        selectedTeams={compareTeams}
        onRemove={(id) => setCompareTeams(prev => prev.filter(t => t.id !== id))}
        onClose={() => setCompareTeams([])}
      />

      {/* Dynamic side-by-side split grid engine */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: selectedTeam ? '1fr 340px' : '1fr', 
        gap: '20px',
        transition: 'grid-template-columns 0.2s ease' 
      }}>
        <div>
          <TeamTable
            data={teams.data || []}
            total={teams.total || 0}
            page={filters.page}
            pageSize={50}
            loading={loading}
            sortBy={filters.sortBy}
            sortDir={filters.sortDir}
            onSort={handleSort}
            onPage={(p) => setFilters(f => ({ ...f, page: p }))}
            onSelectTeam={setSelectedTeam}
            selectedTeamId={selectedTeam?.id}
            // Fixed: Wired up properties matching TeamTable's updated signature rules
            onToggleCompare={handleToggleCompare}
            isComparing={(id) => !!compareTeams.find(t => t.id === id)}
          />
        </div>

        {selectedTeam && (
          <div>
            <RosterPanel team={selectedTeam} onClose={() => setSelectedTeam(null)} />
          </div>
        )}
      </div>
    </>
  );
}
