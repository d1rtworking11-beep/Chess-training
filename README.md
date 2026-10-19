# OpenChess pilot

Free chess training with 750 real Fischer, Kasparov and Carlsen games, move replay, guess-the-move practice, a hidden-pieces visualization drill, and Stockfish 19 analysis. Play either side against an adjustable bot (500–3000 approximate strength), see three candidate lines, and request hints.

Every move gets a review in the style of Chess.com: a symbol on the moved piece, a label from Brilliant to Blunder, and one sentence on what changed. This covers your moves, the bot's replies and the masters' moves. A full-game review adds accuracy for both players, a tally of labels and an evaluation graph.

## Run

Requires Node.js 24 (Node 22.12+ also supports the build).

```sh
npm ci --cache /workspace/.npm-cache
npm run build
npm start
```

The server binds to `0.0.0.0` on port `3000`; set `PORT` to override it. `npm run dev` serves source files directly; refresh the page after edits. No accounts, external APIs, paid services, database or credentials are needed. Analysis runs locally in a browser Web Worker; the first engine load downloads about 2 MB from this server. If the page's security policy blocks WebAssembly, the app loads Stockfish's pure-JavaScript build instead (about 3 MB, slower, labelled "compatibility mode"). The server must also serve `/engine` and `/vendor/chess.js`, including in production.

```sh
npm test
npm run test:e2e
```

Browser tests use the environment's `/usr/bin/chromium`. Set `CHROMIUM_PATH` for another local Chromium installation. They exercise desktop/mobile, the game library, replay, legal moves, analysis, a real bot response, move-review badges and a full-game review. `npm test` checks all 750 game sequences, core rules and the move-review classifier.

## Pilot limits

Bot Elo labels are approximate and have not been calibrated. Stockfish's own minimum strength is 1320; lower settings add random legal moves. Higher settings have a short thinking budget and are not a guarantee of tournament strength. Analysis uses a short search and can change with more time. No clocks, accounts, multiplayer or progress sync yet. Progress and move reviews live only in the current page. Move-review labels come from the same short searches, so a longer search can rate a move differently.

For static hosting without the Node server, run `npm run build:artifact` after `npm ci`. It writes a self-contained copy to `artifact/` with relative paths, the engine and chess.js copied in, their license files, and a credits footer. That copy shows a game's PGN in a dialog with a copy button, because sandboxed viewers block file downloads. It is the copy used for the Claude artifact preview.

## Move review

Each move is rated from Stockfish's evaluation of the positions before and after it. An evaluation in centipawns becomes a win chance for the player who moved, using the curve Lichess publishes: `1 / (1 + e^(-0.00368208 × centipawns))`. The label depends on how much win chance the move gave up compared with the engine's best move.

| Label | Symbol | Rule |
| --- | --- | --- |
| Best | ★ | The engine's top move, or another engine line within 0.5% of it |
| Excellent | ✓ | Gives up less than 2% |
| Good | ✓ | Gives up 2–5% |
| Inaccuracy | ?! | Gives up 5–10% |
| Mistake | ? | Gives up 10–20% |
| Blunder | ?? | Gives up 20% or more |
| Great | ! | The best move when the engine's second choice is at least 15% worse and not itself winning (90%+); recaptures don't count |
| Brilliant | !! | A best or excellent move that lets a knight, bishop, rook or queen be taken on its new square, is still at least 2 points of material down after two more moves by each side, keeps a 45%+ win chance, and was not played from a won (97%+) position |
| Miss | ✕ | An inaccuracy, mistake or blunder right after the opponent's mistake or blunder, while the player had a 60%+ win chance and still keeps 40%+ |
| Book | ≡ | One of the first 12 moves of a sequence that also appears in the bundled games and gives up less than 10%. When reviewing a master game, the sequence must also appear in another game |
| Forced | → | The only legal move |

The sentence names what changed: a mate allowed or missed, material lost along the engine's line, a missed punishment, or the evaluation before and after with the engine's preferred move. A badge marks the moved piece, and a green arrow shows the stronger move for Excellent, Good and the four error labels. Per-move accuracy uses Lichess's formula, `103.1668 × e^(-4.354 × loss) − 3.1669`; a player's game accuracy is the average over their moves.

"Review full game" rates every move in order, spending 0.35 s per position. Live reviews use the panel's 0.5 s analysis. In master games, click the evaluation graph to jump to a move. The labels follow the expected-points idea Chess.com describes, but these thresholds and rules are this project's own approximation, not Chess.com's method.

## Game records and engine

750 distinct legal match records are bundled in `public/data/games.json`: 250 each from Fischer, Kasparov and Carlsen collections, sampled across their careers. Each record contains the original PGN and source link. These are real historical games, not generated positions; inclusion does not imply that every match is famous. The underlying PGN collections are mirrored from PGN Mentor in [rozim/ChessData](https://github.com/rozim/ChessData), snapshot `ed88abd2716da58ee55d42b662455c1c8ebe0776`, directory `PgnMentor`. No annotated commentary from the collections is used. Chess moves are factual records; source collection rights should be reviewed before a broad public distribution.

To rebuild the data, obtain the three source PGNs and run `node scripts/import-games.js /path/Fischer.pgn /path/Kasparov.pgn /path/Carlsen.pgn`. The bundled file makes network downloads unnecessary during normal setup.

Chess piece SVGs are by Colin M. L. Burnett (cburnett), sourced from lichess-org/lila/public/piece/cburnett and used under GPLv2-or-later (selected compatible GPLv3 terms); see public/pieces/ATTRIBUTION.txt. Stockfish is GPLv3. This project is distributed under GPLv3-or-later; see LICENSE. [Stockfish.js source and license](https://github.com/nmrugg/stockfish.js) and [Stockfish upstream](https://github.com/official-stockfish/Stockfish). The exact engine dependency is pinned by package-lock.json. Keep its GPL notices and corresponding source available when redistributing the engine. Chess.js uses the BSD-2-Clause license; Express uses MIT. Dependency notices are preserved in node_modules.

Use the existing checkout in cloud tasks; each task is already isolated. Do not create a worktree unless explicitly requested.

## Public deployment

`render.yaml` is a Render Blueprint for a free web service. Push this project to your GitHub repository, create a Blueprint in your own Render account using that repository, and deploy. The build installs dependencies and produces the app; the runtime serves the app, piece assets, and local Stockfish engine on Render's assigned `PORT`. Free hosting may sleep between visits. This configuration has been prepared but no public deployment has been performed or verified.
