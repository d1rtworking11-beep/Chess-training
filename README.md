# OpenChess pilot

Free chess training with 750 real Fischer, Kasparov and Carlsen games, move replay, guess-the-move practice, a hidden-pieces visualization drill, and Stockfish 19 analysis. Play either side against an adjustable bot (500–3000 approximate strength), see three candidate lines, and request hints.

Every move gets a review in the style of Chess.com: a symbol on the moved piece, a label from Brilliant to Blunder, and a short comment on what the move did and how the position changed. This covers your moves, the bot's replies and the masters' moves. A full-game review adds accuracy for both players, a tally of labels and an evaluation graph.

**Checkmate drills** drop you into a random position from a real game, where you have three to five moves to deliver mate. There are 10,000 positions to train your board vision.

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

Browser tests use the environment's `/usr/bin/chromium`. Set `CHROMIUM_PATH` for another local Chromium installation. They exercise desktop/mobile, the game library, replay, legal moves, analysis, a real bot response, move-review badges, a full-game review, the Russian interface and the checkmate drill. `npm test` checks all 750 game sequences, all 10,000 drill positions, core rules, the move-review classifier and the translations.

## Look

The interface uses warm dark-grey panels, blue for the main actions and a brown wooden board in every mode. The board shows coordinates inside the edge squares, a yellow-green highlight for the last move and a red glow on a king in check. Move lists show small piece images in place of K, Q, R, B and N. All colours come from the tokens at the top of `public/style.css`.

## Hints and playing the bot

During a bot game, and in master games while "Guess the master's next move" is on, the engine's candidate lines and move tips stay hidden so you find the move yourself. The switch at the top of the analysis panel turns them on. During a checkmate drill the switch stays locked, and the evaluation bar stays level, until the puzzle ends. The **Show hint** button sits under the move review: the first click highlights the piece to move, the second shows the best move with an arrow, and the third hides the hint. In a bot game, hints work on your turn only.

The bot replies 3–5 seconds after your move, so you have time to read your move's comment. Pieces slide to their squares and captured pieces fade out; with the system's reduced-motion setting, moves appear instantly.

## Checkmate drills

Each drill position comes from the [Lichess puzzle database](https://database.lichess.org/#puzzles), which is released under CC0-1.0 (public domain). The bundled snapshot is from 2026-10-02. `public/data/puzzles.json` holds 10,000 puzzles, each with its rating, play count and source game: 4,000 mate-in-3, 3,500 mate-in-4 and 2,500 mate-in-5. Only well-tested puzzles are used: a rating deviation of 80 or less, popularity of 85 or more, and at least 300 plays. They are spread evenly across six rating bands from beginner to master. Mate-in-5 puzzles lean towards 1500–2400, because few easy ones exist. Every puzzle is replayed during import, and again by `npm test`, to confirm it ends in checkmate in exactly that many moves. The file is about 1.4 MB (610 KB gzipped) and loads only when you open the drill.

The opponent's last move plays first, then you have three, four or five moves. If you follow the puzzle's solution, the opponent answers with the solution's replies. If you find a different move, the engine searches for 1.5 seconds; the move counts if the engine confirms it still forces mate in the moves you have left, and the engine then defends as long as it can. The page follows the familiar puzzle layout:

- **Left column:** the puzzle's rating, play count and links to its Lichess page and source game, the mate length (Any, 3, 4 or 5), your progress, and two switches: "Jump to next puzzle immediately" and hiding the pieces.
- **Center:** the board, with a row of chips for this session's results. Green means solved, gold means solved with a hint, red means missed, and blue is the current position. Click a chip to try that position again.
- **Right column:** the engine switch, the move table with ✓ and ✗ marks, the feedback panel (Your turn, Good move!, Success!, Puzzle failed) and **Continue training**.

**View the solution** replays the answer and counts as a miss. Solved positions, your streak and your best streak are saved in your browser. A hint still counts as solved, but your streak doesn't grow. A link ending in `#drill-<puzzle id>` opens that exact position.

To rebuild the positions, download `lichess_db_puzzle.csv.zst` from the Lichess database and run `node scripts/import-puzzles.js lichess_db_puzzle.csv.zst <snapshot date>`. Node 24 reads the compressed file directly. The same snapshot always gives the same selection.

## Languages

The interface is available in English and Russian. That covers menus, messages, move-review labels and explanations, the game summary, and the static build's PGN dialog and credits. Switch with **EN / RU** in the header, and the choice is saved in the browser. A first visit follows the browser's language, and a link ending in `#ru` or `#en` opens in that language.

Move notation (Nf3, O-O) and evaluations (+0.4) stay international. Names from the sources also stay as they are, as on Lichess: players, events, PGN text and opening names.

Interface text lives in `public/i18n.js`, and move-review labels and sentences live in `public/review.js`. `npm test` checks that both languages define the same keys and placeholders, and that every key the page uses exists.

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
| Book | ≡ | Opening theory: every position since the first move is on a named opening line, and the move gives up less than 10%. Book ends at the first move that fails either test and never returns |
| Forced | → | The only legal move |

Each comment says what the move does on the board: it castles, develops a piece, takes the center, captures, gives check, forks two pieces, saves an attacked piece, protects one, or attacks one. It then adds the verdict: a mate allowed or missed, material lost along the engine's line, a missed punishment, or the evaluation change next to the engine's preferred move. For good moves it says who stands better, and whether your position got stronger since your last move. A Book move's comment names the opening, and the full-game review shows the game's opening. The review card keeps the previous move's comment underneath, so your move's comment stays visible after the bot replies. A badge marks the moved piece, and a green arrow shows the stronger move for Excellent, Good and the four error labels. Per-move accuracy uses Lichess's formula, `103.1668 × e^(-4.354 × loss) − 3.1669`; a player's game accuracy is the average over their moves.

"Review full game" rates every move in order, spending 0.35 s per position. Live reviews use the panel's 0.5 s analysis. In master games, click the evaluation graph to jump to a move. The labels follow the expected-points idea Chess.com describes, but these thresholds and rules are this project's own approximation, not Chess.com's method.

## Game records and engine

750 distinct legal match records are bundled in `public/data/games.json`: 250 each from Fischer, Kasparov and Carlsen collections, sampled across their careers. Each record contains the original PGN and source link. These are real historical games, not generated positions; inclusion does not imply that every match is famous. The underlying PGN collections are mirrored from PGN Mentor in [rozim/ChessData](https://github.com/rozim/ChessData), snapshot `ed88abd2716da58ee55d42b662455c1c8ebe0776`, directory `PgnMentor`. No annotated commentary from the collections is used. Chess moves are factual records; source collection rights should be reviewed before a broad public distribution.

To rebuild the data, obtain the three source PGNs and run `node scripts/import-games.js /path/Fischer.pgn /path/Kasparov.pgn /path/Carlsen.pgn`. The bundled file makes network downloads unnecessary during normal setup.

Checkmate drill positions come from the Lichess puzzle database (CC0-1.0); see [Checkmate drills](#checkmate-drills).

Opening names and Book moves come from the Lichess opening list, [lichess-org/chess-openings](https://github.com/lichess-org/chess-openings), commit `a6189a30dc27`, released under CC0-1.0 (public domain). Its 3,865 named lines with ECO codes are stored in `public/data/openings.json` as the 7,982 positions they pass through: about 750 KB, or 90 KB gzipped. Matching positions rather than move sequences means a transposed move order still counts as theory. To rebuild the file, clone that repository and run `node scripts/import-openings.js /path/to/chess-openings <commit>`.

Chess piece SVGs are by Colin M. L. Burnett (cburnett), sourced from lichess-org/lila/public/piece/cburnett and used under GPLv2-or-later (selected compatible GPLv3 terms); see public/pieces/ATTRIBUTION.txt. Stockfish is GPLv3. This project is distributed under GPLv3-or-later; see LICENSE. [Stockfish.js source and license](https://github.com/nmrugg/stockfish.js) and [Stockfish upstream](https://github.com/official-stockfish/Stockfish). The exact engine dependency is pinned by package-lock.json. Keep its GPL notices and corresponding source available when redistributing the engine. Chess.js uses the BSD-2-Clause license; Express uses MIT. Dependency notices are preserved in node_modules.

Use the existing checkout in cloud tasks; each task is already isolated. Do not create a worktree unless explicitly requested.

## Public deployment

`render.yaml` is a Render Blueprint for a free web service. Push this project to your GitHub repository, create a Blueprint in your own Render account using that repository, and deploy. The build installs dependencies and produces the app; the runtime serves the app, piece assets, and local Stockfish engine on Render's assigned `PORT`. Free hosting may sleep between visits. This configuration has been prepared but no public deployment has been performed or verified.
