# PrimeStyle — Survey Panel (Client + Server)

> **Important:** This code is **inspired by** the look and feel of modern survey sites (color palette, spacing, UI patterns). It **does not** include any Prime Opinion proprietary code, copy, or trademarks.

## Structure

```
primeopinion-style-survey/
  client/   -> static frontend (HTML/CSS/JS)
  server/   -> Node.js/Express API with SQLite
```

## Quick start

### 1) Run the API (server)

```bash
cd server
cp .env.example .env
npm install
npm run dev
# API default: http://localhost:3001
```

### 2) Open the client (frontend)

Use any static file server, e.g.

```bash
cd ../client
# Option A: Python's simple server
python3 -m http.server 3000

# Option B: Node http-server (if installed)
# npx http-server -p 3000
```

Open http://localhost:3000 in your browser.

> The client expects API at `http://localhost:3001`. You can change it by setting `localStorage.apiBase` in DevTools:
> ```js
> localStorage.setItem('apiBase','http://localhost:3001')
> ```

## Features

- Email/password auth (JWT)
- List of seeded surveys
- Attempt recording (demo credits 50% of reward instantly)
- Balance and activity feed
- Simple payout request flow (demo: empties balance)
- Clean, modern UI inspired by the target site’s color system.
- No third-party/trademarked assets included.

## Notes

- Replace demo logic with your real survey partners and postbacks.
- Secure JWT/cookies, add rate limits, production HTTPS, etc.
- The UI uses Montserrat and a gradient similar to the reference site.
- You can drop your own images into `client/assets/` and adjust CSS variables in `assets/styles.css`.
