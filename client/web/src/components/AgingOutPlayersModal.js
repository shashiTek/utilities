import React, { useEffect, useState } from 'react';
import { fetchAgingOutPlayers } from '../api';
import styles from './AgingOutPlayersModal.module.css';

export default function AgingOutPlayersModal({ school, season, league, agingOutYears, onClose }) {
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!school) {
      onClose();
      return;
    }

    setLoading(true);
    setError(null);
    
    fetchAgingOutPlayers(school, season, league, agingOutYears)
      .then(data => {
        setPlayers(data.players || []);
      })
      .catch(err => {
        setError(err.message);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [school, season, league, agingOutYears, onClose]);

  if (!school) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.header}>
          <h2 className={styles.title}>
            Aging Out Players - {school}
          </h2>
          <button className={styles.closeBtn} onClick={onClose}>
            ✕
          </button>
        </div>

        {/* Content */}
        <div className={styles.content}>
          {loading && <div className={styles.loading}>Loading players...</div>}

          {error && <div className={styles.error}>Error: {error}</div>}

          {!loading && players.length === 0 && (
            <div className={styles.noResults}>No aging out players found</div>
          )}

          {!loading && players.length > 0 && (
            <>
              <div className={styles.summary}>
                <strong>{players.length}</strong> players aging out (18+ years old)
              </div>

              <div className={styles.tableWrapper}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th className={styles.colName}>Name</th>
                      <th className={styles.colPos}>Pos</th>
                      <th className={styles.colYear}>Birth</th>
                      <th className={styles.colAge}>Age</th>
                      <th className={styles.colStats}>Stats (GP/G/A/PTS)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {players.map((player, idx) => (
                      <tr key={idx} className={styles.row}>
                        <td className={styles.colName}>
                          {player.url ? (
                            <a
                              href={`https://www.eliteprospects.com${player.url}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={styles.playerLink}
                            >
                              {player.name}
                            </a>
                          ) : (
                            <span>{player.name}</span>
                          )}
                        </td>
                        <td className={styles.colPos}>{player.position}</td>
                        <td className={styles.colYear}>{player.birth_year}</td>
                        <td className={styles.colAge}>
                          <span className={styles.ageBadge}>{player.age}</span>
                        </td>
                        <td className={styles.colStats}>
                          <span className={styles.stats}>
                            {player.stats.GP}/{player.stats.G}/{player.stats.A}/{player.stats.PTS}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className={styles.footer}>
          <button className={styles.closeFooterBtn} onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
