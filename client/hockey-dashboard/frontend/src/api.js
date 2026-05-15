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

export const fetchFilters  = ()       => get('/api/filters');
export const fetchMetrics  = (params) => get('/api/metrics', params);
export const fetchPlayers  = (params) => get('/api/players', params);
export const fetchBirthChart = ()     => get('/api/charts/birthyear');
export const fetchPlayer   = (id)     => get(`/api/player/${id}`);
