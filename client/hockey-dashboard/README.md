# Hockey Player Stats Dashboard

A full-stack dashboard that reads from your EliteProspects MongoDB pipeline
and lets you query players by birth year, league, season, and position.

```
hockey-dashboard/
├── api-services/
│   ├── api.py              Flask REST API → MongoDB
│   ├── requirements.txt
│   └── .env.example
└── frontend/
    ├── public/index.html
    ├── package.json
    └── src/
        ├── App.js                  Root component + layout
        ├── api.js                  Fetch helpers
        ├── index.js / index.css    Entry point + global styles
        ├── hooks/useDebounce.js
        └── components/
            ├── Filters.js          Birth year + season + league + position dropdowns
            ├── MetricCards.js      Summary stats (count, avg GAA, avg GP, top scorer)
            ├── PlayerTable.js      Sortable paginated table (auto goalie/skater columns)
            ├── Charts.js           Birth year bar chart + position breakdown
            └── QueryDisplay.js     Live MongoDB aggregation query preview
```

## MongoDB collections required

| Collection     | Populated by      |
|----------------|-------------------|
| league_members | organization.py   |
| teams          | teams.py          |
| players        | players.py        |
| stats          | player_stats.py   |

## Setup

### 1. Backend (Flask API)

```bash
cd backend

# Copy env config
cp .env.example .env
# Edit .env with your MongoDB URI if different from default

pip install -r requirements.txt
python api.py
# Runs on http://localhost:5000
```

### 2. Frontend (React)

```bash
cd frontend

npm install
npm start
# Runs on http://localhost:3000
# Proxies /api/* to http://localhost:5000 automatically
```

Open http://localhost:3000 in your browser.

## API endpoints

| Method | Path                    | Description                              |
|--------|-------------------------|------------------------------------------|
| GET    | /api/players            | Paginated player+stats list (see params) |
| GET    | /api/filters            | Distinct values for dropdown options     |
| GET    | /api/metrics            | Summary aggregation for metric cards     |
| GET    | /api/charts/birthyear   | Player count per birth year              |
| GET    | /api/player/{id}        | Single player detail + full stat history |

### /api/players query params

| Param      | Example        | Description                    |
|------------|----------------|--------------------------------|
| birthYear  | 2010           | Filter by birth year           |
| season     | 2025-2026      | Filter by season slug          |
| league     | ushs-prep      | Filter by league slug          |
| position   | G              | G or F/D                       |
| search     | Benjamin       | Name or team (case-insensitive)|
| page       | 0              | Zero-based page index          |
| pageSize   | 50             | Results per page               |
| sortBy     | player_name    | Field to sort by               |
| sortDir    | asc / desc     | Sort direction                 |

## MongoDB aggregation (the core query)

```js
db.stats.aggregate([
  { $lookup: {
      from: "players",
      localField: "player_url",
      foreignField: "url",
      as: "bio"
  }},
  { $unwind: "$bio" },
  { $addFields: {
      birthYear: { $toInt: { $substr: ["$bio.birthDate", 0, 4] } }
  }},
  { $match: { birthYear: 2010 } },   // <-- birth year filter applied here
  { $sort: { player_name: 1 } }
])
```

## Production build

```bash
cd frontend && npm run build
# Outputs to frontend/build/ — serve with any static host or nginx
```
