import { useState, useEffect, useCallback } from "react";

const API_URL = "/api/recruitment/vacancies";
const AVAILABLE_YEARS = [2007, 2008, 2009, 2010,2011];
const DEFAULT_YEARS = [2007, 2008];

function getInitials(name) {
  return name.split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase();
}

function calcAge(birthDate) {
  if (!birthDate) return null;
  const [year, month, day] = birthDate.split("-").map(Number);
  if (!year) return null;
  const now = new Date();
  let age = now.getFullYear() - year;
  if (month && day) {
    const bday = new Date(year, month - 1, day);
    if (now < new Date(now.getFullYear(), bday.getMonth(), bday.getDate())) age--;
  }
  return age;
}

function buildApiUrl(selectedYears) {
  if (!selectedYears.length) return API_URL;
  return `${API_URL}?birthYears=${selectedYears.sort().join(",")}`;
}

// ── Birth Year Toggle Pills ───────────────────────────────────────────────────
function BirthYearFilter({ selected, onChange }) {
  const toggle = (year) => {
    if (selected.includes(year)) {
      if (selected.length === 1) return; // keep at least one
      onChange(selected.filter((y) => y !== year));
    } else {
      onChange([...selected, year]);
    }
  };

  return (
    <div className="year-filter">
      <span className="year-filter-label">Birth Year</span>
      <div className="year-pills">
        {AVAILABLE_YEARS.map((year) => (
          <button
            key={year}
            className={`year-pill ${selected.includes(year) ? "active" : ""}`}
            onClick={() => toggle(year)}
            type="button"
          >
            {year}
          </button>
        ))}
      </div>
      <span className="year-filter-hint">
        Querying: born in {selected.sort().join(", ")}
      </span>
    </div>
  );
}

// ── Player Drawer ─────────────────────────────────────────────────────────────
function PlayerDrawer({ player, onClose }) {
  const age = calcAge(player.birthDate);
  return (
    <div className="drawer-overlay" onClick={onClose}>
      <div className="drawer" onClick={(e) => e.stopPropagation()}>
        <button className="drawer-close" onClick={onClose}>✕</button>
        <div className="drawer-avatar">{getInitials(player.name)}</div>
        <h2 className="drawer-name">{player.name}</h2>
        <div className="drawer-meta">
          {player.birthDate && (
            <span className="meta-pill">
              🎂 {player.birthDate.replace(/-00/g, "")}
              {age ? ` · ${age} yrs` : ""}
            </span>
          )}
        </div>
        <a href={player.url} target="_blank" rel="noopener noreferrer" className="ep-button">
          View on EliteProspects →
        </a>
      </div>
    </div>
  );
}

// ── School Card ───────────────────────────────────────────────────────────────
function SchoolCard({ school, onViewPlayers }) {
  return (
    <div className="school-card">
      <div className="card-header">
        {school.schoolLogo ? (
          <img
            src={school.schoolLogo}
            alt={school.schoolName}
            className="school-logo"
            onError={(e) => { e.target.style.display = "none"; e.target.nextSibling.style.display = "flex"; }}
          />
        ) : null}
        <div className="school-logo-fallback" style={{ display: school.schoolLogo ? "none" : "flex" }}>
          {getInitials(school.schoolName)}
        </div>
        <div className="card-title-block">
          <h3 className="school-name">{school.schoolName}</h3>
          <span className="spots-badge">
            {school.departingPlayersCount} spot{school.departingPlayersCount !== 1 ? "s" : ""} available
          </span>
        </div>
      </div>

      <div className="players-preview">
        {school.leavingPlayersList.slice(0, 5).map((p) => (
          <span key={p.url} className="player-chip" title={p.name}>{getInitials(p.name)}</span>
        ))}
        {school.leavingPlayersList.length > 5 && (
          <span className="player-chip more">+{school.leavingPlayersList.length - 5}</span>
        )}
      </div>

      {school.coachingStaff?.length > 0 && (
        <div className="coaching-section">
          <span className="coaching-label">Coaching Staff</span>
          <div className="coaching-list">
            {school.coachingStaff.map((c) => (
              <a key={c.url} href={c.url} target="_blank" rel="noopener noreferrer" className="coach-chip">
                <span className="coach-avatar">{getInitials(c.name)}</span>
                <span className="coach-name">{c.name}</span>
              </a>
            ))}
          </div>
        </div>
      )}

      <div className="card-actions">
        {school.eliteProspectsTeamUrl && (
          <a href={school.eliteProspectsTeamUrl} target="_blank" rel="noopener noreferrer" className="btn-secondary">
            Team Page
          </a>
        )}
        <button className="btn-primary" onClick={() => onViewPlayers(school)}>View Players</button>
      </div>
    </div>
  );
}

// ── Players Modal ─────────────────────────────────────────────────────────────
function PlayersModal({ school, onClose }) {
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [search, setSearch] = useState("");

  const filtered = school.leavingPlayersList.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          {school.schoolLogo && <img src={school.schoolLogo} alt="" className="modal-logo" />}
          <div>
            <h2 className="modal-title">{school.schoolName}</h2>
            <p className="modal-subtitle">{school.departingPlayersCount} departing players</p>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {school.coachingStaff?.length > 0 && (
          <div className="modal-coaches">
            <span className="coaching-label">Coaching Staff</span>
            <div className="coaching-list">
              {school.coachingStaff.map((c) => (
                <a key={c.url} href={c.url} target="_blank" rel="noopener noreferrer" className="coach-chip">
                  <span className="coach-avatar">{getInitials(c.name)}</span>
                  <span className="coach-name">{c.name}</span>
                </a>
              ))}
            </div>
          </div>
        )}

        <div className="modal-search">
          <input
            type="text"
            placeholder="Search players..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="search-input"
          />
        </div>

        <div className="players-grid">
          {filtered.map((player) => {
            const age = calcAge(player.birthDate);
            return (
              <div key={player.url} className="player-row" onClick={() => setSelectedPlayer(player)}>
                <div className="player-avatar">{getInitials(player.name)}</div>
                <div className="player-info">
                  <span className="player-name">{player.name}</span>
                  <span className="player-meta">
                    {player.birthDate?.replace(/-00/g, "") || "—"}
                    {age ? ` · ${age} yrs` : ""}
                  </span>
                </div>
                <a
                  href={player.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ep-link"
                  onClick={(e) => e.stopPropagation()}
                >
                  EP →
                </a>
              </div>
            );
          })}
          {filtered.length === 0 && <p className="empty-state">No players match your search.</p>}
        </div>
      </div>
      {selectedPlayer && (
        <PlayerDrawer player={selectedPlayer} onClose={() => setSelectedPlayer(null)} />
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function VacanciesPage() {
  const [schools, setSchools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("spots");
  const [selectedSchool, setSelectedSchool] = useState(null);
  const [selectedYears, setSelectedYears] = useState(DEFAULT_YEARS);
  const [pendingYears, setPendingYears] = useState(DEFAULT_YEARS); // staged, not yet fetched

  const fetchSchools = useCallback(() => {
    setLoading(true);
    setError(null);
    fetch(buildApiUrl(pendingYears))
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch vacancies");
        return res.json();
      })
      .then((json) => {
        setSchools(json.data || []);
        setSelectedYears(pendingYears);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [pendingYears]);

  // Initial load
  useEffect(() => { fetchSchools(); }, []); // eslint-disable-line

  const isDirty = pendingYears.slice().sort().join(",") !== selectedYears.slice().sort().join(",");

  const filtered = schools
    .filter((s) => s.schoolName.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === "spots") return b.departingPlayersCount - a.departingPlayersCount;
      if (sortBy === "name") return a.schoolName.localeCompare(b.schoolName);
      return 0;
    });

  const totalSpots = schools.reduce((s, c) => s + c.departingPlayersCount, 0);

  return (
    <>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Inter', sans-serif; background: #f4f6fa; color: #1a1d23; min-height: 100vh; }

        .page { max-width: 1200px; margin: 0 auto; padding: 2.5rem 1.5rem; }

        .page-header { margin-bottom: 1.5rem; }
        .page-header h1 { font-size: 2rem; font-weight: 700; color: #0f1117; letter-spacing: -0.5px; }
        .page-header p { color: #6b7280; margin-top: 0.35rem; font-size: 0.95rem; }

        /* ── Birth Year Filter ── */
        .year-filter {
          background: #fff;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          padding: 1rem 1.25rem;
          margin-bottom: 1.5rem;
          display: flex;
          flex-direction: column;
          gap: 0.6rem;
        }
        .year-filter-label {
          font-size: 0.72rem;
          font-weight: 700;
          color: #9ca3af;
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }
        .year-pills { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
        .year-pill {
          padding: 5px 14px;
          border-radius: 20px;
          border: 1.5px solid #e5e7eb;
          background: #f9fafb;
          color: #6b7280;
          font-size: 0.85rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s;
        }
        .year-pill:hover { border-color: #a5b4fc; color: #4f46e5; background: #eef2ff; }
        .year-pill.active { background: #4f46e5; border-color: #4f46e5; color: #fff; }
        .year-filter-hint { font-size: 0.75rem; color: #9ca3af; }

        .apply-btn {
          margin-left: auto;
          padding: 5px 16px;
          border-radius: 8px;
          border: none;
          background: #4f46e5;
          color: #fff;
          font-size: 0.82rem;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.15s;
          align-self: flex-end;
        }
        .apply-btn:hover { background: #4338ca; }
        .apply-btn:disabled { background: #c7d2fe; cursor: default; }

        .year-filter-row { display: flex; align-items: center; gap: 1rem; flex-wrap: wrap; }

        /* ── Stats ── */
        .stats-row { display: flex; gap: 1rem; margin-bottom: 1.5rem; flex-wrap: wrap; }
        .stat-card { background: #fff; border-radius: 12px; padding: 1rem 1.5rem; border: 1px solid #e5e7eb; min-width: 140px; }
        .stat-label { font-size: 0.75rem; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600; }
        .stat-value { font-size: 1.75rem; font-weight: 700; color: #111827; margin-top: 0.2rem; }

        /* ── Controls ── */
        .controls { display: flex; gap: 0.75rem; margin-bottom: 1.25rem; flex-wrap: wrap; align-items: center; }
        .search-bar { flex: 1; min-width: 200px; padding: 0.55rem 1rem; border: 1px solid #d1d5db; border-radius: 8px; font-size: 0.9rem; outline: none; background: #fff; transition: border-color 0.15s; }
        .search-bar:focus { border-color: #4f46e5; }
        .sort-select { padding: 0.55rem 1rem; border: 1px solid #d1d5db; border-radius: 8px; font-size: 0.9rem; background: #fff; cursor: pointer; outline: none; }

        .results-count { font-size: 0.85rem; color: #9ca3af; margin-bottom: 1rem; }

        /* ── Grid ── */
        .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 1.25rem; }

        .school-card { background: #fff; border-radius: 14px; border: 1px solid #e5e7eb; padding: 1.25rem; display: flex; flex-direction: column; gap: 1rem; transition: box-shadow 0.2s, transform 0.2s; }
        .school-card:hover { box-shadow: 0 8px 24px rgba(0,0,0,0.08); transform: translateY(-2px); }

        .card-header { display: flex; align-items: center; gap: 0.85rem; }
        .school-logo { width: 48px; height: 48px; object-fit: contain; border-radius: 8px; border: 1px solid #f3f4f6; flex-shrink: 0; }
        .school-logo-fallback { width: 48px; height: 48px; border-radius: 8px; background: #ede9fe; color: #4f46e5; font-weight: 700; font-size: 0.85rem; align-items: center; justify-content: center; flex-shrink: 0; }
        .card-title-block { flex: 1; min-width: 0; }
        .school-name { font-size: 1rem; font-weight: 600; color: #111827; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .spots-badge { display: inline-block; margin-top: 0.25rem; font-size: 0.75rem; font-weight: 600; color: #065f46; background: #d1fae5; border-radius: 20px; padding: 2px 10px; }

        .players-preview { display: flex; gap: 6px; flex-wrap: wrap; }
        .player-chip { width: 34px; height: 34px; border-radius: 50%; background: #ede9fe; color: #4f46e5; font-size: 0.7rem; font-weight: 700; display: flex; align-items: center; justify-content: center; border: 2px solid #fff; cursor: default; }
        .player-chip.more { background: #f3f4f6; color: #6b7280; font-size: 0.65rem; }

        .card-actions { display: flex; gap: 0.6rem; margin-top: auto; }
        .btn-primary { flex: 1; padding: 0.5rem 1rem; background: #4f46e5; color: #fff; border: none; border-radius: 8px; font-size: 0.875rem; font-weight: 600; cursor: pointer; transition: background 0.15s; }
        .btn-primary:hover { background: #4338ca; }
        .btn-secondary { padding: 0.5rem 1rem; background: #f9fafb; color: #374151; border: 1px solid #d1d5db; border-radius: 8px; font-size: 0.875rem; font-weight: 500; cursor: pointer; text-decoration: none; display: inline-flex; align-items: center; transition: background 0.15s; }
        .btn-secondary:hover { background: #f3f4f6; }

        /* ── Coaching ── */
        .coaching-section { display: flex; flex-direction: column; gap: 6px; }
        .coaching-label { font-size: 0.7rem; font-weight: 700; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.06em; }
        .coaching-list { display: flex; flex-wrap: wrap; gap: 6px; }
        .coach-chip { display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px 4px 4px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 20px; text-decoration: none; transition: background 0.15s; }
        .coach-chip:hover { background: #dcfce7; }
        .coach-avatar { width: 22px; height: 22px; border-radius: 50%; background: #16a34a; color: #fff; font-size: 0.6rem; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .coach-name { font-size: 0.78rem; font-weight: 600; color: #15803d; }

        /* ── Modal ── */
        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.45); z-index: 100; display: flex; align-items: center; justify-content: center; padding: 1rem; }
        .modal { background: #fff; border-radius: 16px; width: 100%; max-width: 560px; max-height: 85vh; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 20px 60px rgba(0,0,0,0.2); }
        .modal-header { display: flex; align-items: center; gap: 0.85rem; padding: 1.25rem 1.5rem; border-bottom: 1px solid #f3f4f6; }
        .modal-logo { width: 44px; height: 44px; object-fit: contain; border-radius: 8px; border: 1px solid #f3f4f6; }
        .modal-title { font-size: 1.1rem; font-weight: 700; color: #111827; }
        .modal-subtitle { font-size: 0.8rem; color: #9ca3af; margin-top: 2px; }
        .modal-close { margin-left: auto; background: none; border: none; font-size: 1.1rem; color: #9ca3af; cursor: pointer; padding: 0.25rem; border-radius: 6px; }
        .modal-close:hover { color: #374151; background: #f3f4f6; }
        .modal-coaches { padding: 0.75rem 1.5rem; border-bottom: 1px solid #f3f4f6; display: flex; flex-direction: column; gap: 6px; }
        .modal-search { padding: 0.85rem 1.5rem; border-bottom: 1px solid #f3f4f6; }
        .search-input { width: 100%; padding: 0.5rem 0.875rem; border: 1px solid #d1d5db; border-radius: 8px; font-size: 0.875rem; outline: none; }
        .search-input:focus { border-color: #4f46e5; }
        .players-grid { overflow-y: auto; padding: 0.5rem 1.5rem 1.5rem; display: flex; flex-direction: column; gap: 2px; }
        .player-row { display: flex; align-items: center; gap: 0.75rem; padding: 0.6rem 0.5rem; border-radius: 8px; cursor: pointer; transition: background 0.1s; }
        .player-row:hover { background: #f9fafb; }
        .player-avatar { width: 36px; height: 36px; border-radius: 50%; background: #ede9fe; color: #4f46e5; font-size: 0.7rem; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .player-info { flex: 1; min-width: 0; }
        .player-name { display: block; font-size: 0.9rem; font-weight: 600; color: #111827; }
        .player-meta { display: block; font-size: 0.75rem; color: #9ca3af; margin-top: 1px; }
        .ep-link { font-size: 0.78rem; color: #4f46e5; font-weight: 600; text-decoration: none; padding: 0.25rem 0.5rem; border-radius: 6px; border: 1px solid #e0e0fd; }
        .ep-link:hover { background: #ede9fe; }

        /* ── Drawer ── */
        .drawer-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.3); z-index: 200; display: flex; justify-content: flex-end; }
        .drawer { background: #fff; width: 320px; height: 100%; padding: 2rem 1.5rem; display: flex; flex-direction: column; align-items: center; gap: 1rem; box-shadow: -4px 0 24px rgba(0,0,0,0.12); position: relative; }
        .drawer-close { position: absolute; top: 1rem; right: 1rem; background: none; border: none; font-size: 1rem; color: #9ca3af; cursor: pointer; padding: 0.3rem; border-radius: 6px; }
        .drawer-close:hover { background: #f3f4f6; color: #374151; }
        .drawer-avatar { width: 72px; height: 72px; border-radius: 50%; background: #ede9fe; color: #4f46e5; font-size: 1.25rem; font-weight: 700; display: flex; align-items: center; justify-content: center; margin-top: 1.5rem; }
        .drawer-name { font-size: 1.2rem; font-weight: 700; color: #111827; text-align: center; }
        .drawer-meta { display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; }
        .meta-pill { font-size: 0.8rem; background: #f3f4f6; color: #374151; border-radius: 20px; padding: 4px 12px; font-weight: 500; }
        .ep-button { display: inline-block; margin-top: 0.5rem; padding: 0.6rem 1.25rem; background: #4f46e5; color: #fff; border-radius: 8px; font-size: 0.875rem; font-weight: 600; text-decoration: none; transition: background 0.15s; }
        .ep-button:hover { background: #4338ca; }

        .loading, .error-state, .empty-state { text-align: center; color: #9ca3af; padding: 3rem; font-size: 1rem; }
        .error-state { color: #ef4444; }
      `}</style>

      <div className="page">
        <div className="page-header">
          <h1>Open Vacancies</h1>
          <p>Schools currently recruiting new students</p>
        </div>

        {/* Birth Year Filter */}
        <div className="year-filter">
          <span className="year-filter-label">Birth Year</span>
          <div className="year-filter-row">
            <div className="year-pills">
              {AVAILABLE_YEARS.map((year) => (
                <button
                  key={year}
                  type="button"
                  className={`year-pill ${pendingYears.includes(year) ? "active" : ""}`}
                  onClick={() => {
                    if (pendingYears.includes(year)) {
                      if (pendingYears.length === 1) return;
                      setPendingYears(pendingYears.filter((y) => y !== year));
                    } else {
                      setPendingYears([...pendingYears, year]);
                    }
                  }}
                >
                  {year}
                </button>
              ))}
            </div>
            <button
              className="apply-btn"
              disabled={!isDirty || loading}
              onClick={fetchSchools}
            >
              {loading ? "Loading…" : "Apply"}
            </button>
          </div>
          <span className="year-filter-hint">
            {isDirty
              ? `Pending: ${pendingYears.sort().join(", ")} — click Apply to fetch`
              : `Showing players born in ${selectedYears.sort().join(", ")}`}
          </span>
        </div>

        {loading && <p className="loading">Loading vacancies…</p>}
        {error && <p className="error-state">Error: {error}</p>}

        {!loading && !error && (
          <>
            <div className="stats-row">
              <div className="stat-card">
                <div className="stat-label">Schools</div>
                <div className="stat-value">{schools.length}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Total Spots</div>
                <div className="stat-value">{totalSpots}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Avg / School</div>
                <div className="stat-value">
                  {schools.length ? Math.round(totalSpots / schools.length) : 0}
                </div>
              </div>
            </div>

            <div className="controls">
              <input
                className="search-bar"
                type="text"
                placeholder="Search schools…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <select className="sort-select" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                <option value="spots">Sort: Most Spots</option>
                <option value="name">Sort: Name A–Z</option>
              </select>
            </div>

            <p className="results-count">Showing {filtered.length} of {schools.length} schools</p>

            <div className="grid">
              {filtered.map((school) => (
                <SchoolCard key={school._id} school={school} onViewPlayers={setSelectedSchool} />
              ))}
              {filtered.length === 0 && <p className="empty-state">No schools match your search.</p>}
            </div>
          </>
        )}
      </div>

      {selectedSchool && (
        <PlayersModal school={selectedSchool} onClose={() => setSelectedSchool(null)} />
      )}
    </>
  );
}
