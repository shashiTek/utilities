// src/api.js
// Centralised fetch calls to the Flask backend
const BASE = process.env.REACT_APP_API_URL || '';

async function get(path, params = {}) {
  const qs = new URLSearchParams(
    Object.fromEntries(Object.entries(params).filter(([, v]) => v !== '' && v != null))
  ).toString();
  
  const url = `${BASE}${path}${qs ? '?' + qs : ''}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`API ${res.status}: ${url}`);
  return res.json();
}

// ── Player & Global Endpoints ──
export const fetchFilters = () => get('/api/filters');
export const fetchPlayers = (params) => get('/api/players', params);
export const fetchPlayer = (id) => get(`/api/player/${id}`);

export const fetchTeamRosterOrigins = (league, season) =>
  get('/api/league/team-roster-origins', { league, season });

// ── Team Endpoints (Using the unified get helper) ──
/**
 * Fetches dropdown data options for team view filtering matrix
 */
export const fetchTeamFilters = async () => {
  try {
    return await get('/api/filters/teams');
  } catch (err) {
    console.error('Error fetching team filters:', err);
    // Safe placeholder prevents app crashes if server drop down payload is missing
    return { leagues: [] };
  }
};

/**
 * Fetches filtered team listings using automated string query building engine
 */
export const fetchTeams = async (params) => {
  try {
    return await get('/api/teams', params);
  } catch (err) {
    console.error('Error fetching team listings:', err);
    // Safe placeholder matching table component execution layout mapping
    return { 
      data: [], 
      total: 0, 
      query: 'db.teams.find({}) /* Error Fallback Local Log */' 
    };
  }
};
