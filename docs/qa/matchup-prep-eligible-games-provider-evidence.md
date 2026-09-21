# Matchup Prep Eligible-Games Incident — Provider Evidence

Collected 2026-09-21 UTC for the reported Chess.com account `humblelowkey`.

| Source | Observation |
|---|---|
| [Chess.com public profile](https://api.chess.com/pub/player/humblelowkey) | The account resolves successfully as `humblelowkey` (Arnold Lopez) and reports recent online activity. |
| [Chess.com archive index](https://api.chess.com/pub/player/humblelowkey/games/archives) | Archives exist from August 2023 through September 2026, including current-month data. |
| [September 2026 public games](https://api.chess.com/pub/player/humblelowkey/games/2026/09) | The returned games include rated, standard-chess, Blitz games where the exact username appears as either White or Black, with completed results and full PGN movetext. Examples observed: live games `174062031816`, `174062247592`, `174105081244`, and `174148239408`. |

This evidence establishes that a “not enough eligible recent games” result for the account cannot be explained by a missing account, absent archives, absent rated Blitz games, an absent player identity, or missing PGN movetext. The repair must therefore focus on the application’s collection/parsing/caching path while retaining its rated, standard-chess, completed-game, and legal-replay safeguards.
