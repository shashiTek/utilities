import React from 'react';

export default function RosterPanel({ team, onClose }) {
  if (!team) return null;

  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px', padding: '20px', height: 'fit-content', position: 'sticky', top: '80px', boxShadow: 'var(--shadow-sm)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h3 style={{ margin: 0, fontSize: '18px', fontFamily: 'var(--font-display)' }}>{team.team_name}</h3>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '16px' }}>
          ✕
        </button>
      </div>

      <div style={{ marginBottom: '16px' }}>
        <span style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block' }}>League</span>
        <div style={{ fontWeight: '600', marginTop: '2px' }}>{team.league}</div>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <span style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block' }}>Coaching Staff</span>
        <div style={{ marginTop: '2px' }}>{team.coach}</div>
      </div>

      <h4 style={{ fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-muted)', borderBottom: '1px solid var(--border)', paddingBottom: '6px', marginBottom: '10px' }}>
        Active Roster ({team.roster_count})
      </h4>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '6px', maxHeight: '400px', overflowY: 'auto', paddingRight: '6px' }}>
        {(team.athletes || []).map((playerObj, idx) => (
          <div key={idx} style={{ padding: '8px 12px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '11px', width: '16px' }}>{idx + 1}</span>
                <span style={{ fontWeight: '500' }}>{playerObj.name}</span>
              </div>
              <span style={{ fontSize: '10px', fontWeight: 'bold', color: playerObj.position === 'G' ? '#0D7C6B' : '#1B5FA8' }}>
                [{playerObj.position || '—'}]
              </span>
            </div>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', paddingLeft: '24px' }}>
              {playerObj.summary}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
