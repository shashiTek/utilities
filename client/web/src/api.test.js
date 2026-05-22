import { fetchFilters, fetchPlayers, fetchTeamFilters, fetchTeams } from './api';

let consoleErrorSpy;

beforeEach(() => {
  global.fetch = jest.fn();
  consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  jest.resetAllMocks();
  consoleErrorSpy.mockRestore();
});

test('builds the correct query string for players endpoint', async () => {
  global.fetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ data: [1] }) });

  const response = await fetchPlayers({ search: 'test', page: 2, sortBy: 'player_name' });

  expect(response).toEqual({ data: [1] });
  expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/api/players?'));
  expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('search=test'));
  expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('page=2'));
});

test('returns safe fallback for fetchTeamFilters on error', async () => {
  global.fetch.mockRejectedValueOnce(new Error('network failure'));

  const response = await fetchTeamFilters();

  expect(response).toEqual({ leagues: [] });
  expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/api/filters/teams'));
});

test('returns safe error placeholder for fetchTeams on failure', async () => {
  global.fetch.mockRejectedValueOnce(new Error('network failure'));

  const response = await fetchTeams({ search: 'fail' });

  expect(response).toMatchObject({ data: [], total: 0 });
  expect(response.query).toContain('Error Fallback');
});
