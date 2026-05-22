import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';

const defaultFiltersResponse = {
  positions: ['Forward', 'Defense'],
  leagues: ['NHL'],
  seasons: ['2024'],
};
const defaultTeamsResponse = { leagues: [] };
const defaultPlayersResponse = {
  data: [],
  total: 0,
  query: '',
  metrics: { totalPlayers: 0, forwards: 0, defensemen: 0, goalies: 0, leagueCount: 0 },
};

beforeEach(() => {
  global.fetch = jest.fn().mockImplementation((url) => {
    const parsedUrl = new URL(url, 'http://localhost');
    if (parsedUrl.pathname === '/api/filters') {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(defaultFiltersResponse) });
    }
    if (parsedUrl.pathname === '/api/filters/teams') {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(defaultTeamsResponse) });
    }
    if (parsedUrl.pathname === '/api/players') {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(defaultPlayersResponse) });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
  });
});

afterEach(() => {
  jest.resetAllMocks();
});

test('renders the app and loads navigation', async () => {
  await act(async () => {
    render(<App />);
  });

  expect(screen.getByText('TopPlay')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Players/i })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Teams/i })).toBeInTheDocument();

  await waitFor(() => {
    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/api/filters'));
    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/api/filters/teams'));
    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/api/players'));
  });

  await act(async () => {
    await Promise.resolve();
  });

  const totalPlayersLabels = screen.getAllByText('Total Players');
  expect(totalPlayersLabels.length).toBeGreaterThanOrEqual(1);
});

test('navigates to Teams view and updates page title', async () => {
  await act(async () => {
    render(<App />);
  });

  const teamsButton = screen.getByRole('button', { name: /Teams/i });
  await act(async () => {
    await userEvent.click(teamsButton);
  });

  expect(await screen.findByRole('heading', { name: /Teams/i })).toBeInTheDocument();
});
