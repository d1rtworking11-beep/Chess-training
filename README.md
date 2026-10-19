# OpenChess pilot

Free chess training with 750 real Fischer, Kasparov and Carlsen games, move replay, guess-the-move practice, a hidden-pieces visualization drill, and Stockfish 19 analysis. Play either side against an adjustable bot (500–3000 approximate strength), see three candidate lines, and request hints.

## Run

Requires Node.js 24 (Node 22.12+ also supports the build).

```sh
npm ci --cache /workspace/.npm-cache
npm run build
npm start
```

The server binds to `0.0.0.0` on port `3000`; set `PORT` to override it. `npm run dev` serves source files directly; refresh the page after edits. No accounts, external APIs, paid services, database or credentials are needed. Analysis runs locally in a browser Web Worker; the first engine load downloads about 2 MB from this server. The server must also serve `/engine` and `/vendor/chess.js`, including in production.

```sh
npm test
npm run test:e2e
```

Browser tests use the environment's `/usr/bin/chromium`. Set `CHROMIUM_PATH` for another local Chromium installation. They exercise desktop/mobile, the game library, replay, legal moves, analysis and a real bot response.

## Pilot limits

Bot Elo labels are approximate and have not been calibrated. Stockfish's own minimum strength is 1320; lower settings add random legal moves. Higher settings have a short thinking budget and are not a guarantee of tournament strength. Analysis uses a short search and can change with more time. No clocks, accounts, multiplayer, progress sync, or full-game report yet. Progress lives only in the current page. The pilot is intended for one browser session and static hosting needs a separate deployment adapter.

## Game records and engine

750 distinct legal match records are bundled in `public/data/games.json`: 250 each from Fischer, Kasparov and Carlsen collections, sampled across their careers. Each record contains the original PGN and source link. These are real historical games, not generated positions; inclusion does not imply that every match is famous. The underlying PGN collections are mirrored from PGN Mentor in [rozim/ChessData](https://github.com/rozim/ChessData), snapshot `ed88abd2716da58ee55d42b662455c1c8ebe0776`, directory `PgnMentor`. No annotated commentary from the collections is used. Chess moves are factual records; source collection rights should be reviewed before a broad public distribution.

To rebuild the data, obtain the three source PGNs and run `node scripts/import-games.js /path/Fischer.pgn /path/Kasparov.pgn /path/Carlsen.pgn`. The bundled file makes network downloads unnecessary during normal setup.

Chess piece SVGs are by Colin M. L. Burnett (cburnett), sourced from lichess-org/lila/public/piece/cburnett and used under GPLv2-or-later (selected compatible GPLv3 terms); see public/pieces/ATTRIBUTION.txt. Stockfish is GPLv3. This project is distributed under GPLv3-or-later; see LICENSE. [Stockfish.js source and license](https://github.com/nmrugg/stockfish.js) and [Stockfish upstream](https://github.com/official-stockfish/Stockfish). The exact engine dependency is pinned by package-lock.json. Keep its GPL notices and corresponding source available when redistributing the engine. Chess.js uses the BSD-2-Clause license; Express uses MIT. Dependency notices are preserved in node_modules.

Use the existing checkout in cloud tasks; each task is already isolated. Do not create a worktree unless explicitly requested.

## Public deployment

`render.yaml` is a Render Blueprint for a free web service. Push this project to your GitHub repository, create a Blueprint in your own Render account using that repository, and deploy. The build installs dependencies and produces the app; the runtime serves the app, piece assets, and local Stockfish engine on Render's assigned `PORT`. Free hosting may sleep between visits. This configuration has been prepared but no public deployment has been performed or verified.
