# Intake: ShlinkedIn (github.com/cbh123/shlinked)

ShlinkedIn is the code behind a satirical professional network. It is an Elixir/Phoenix
LiveView app with Postgres, licensed **AGPL-3.0** (the LICENSE file is the AGPL-3.0
text; GitHub's licence detection reports none). Last push 2024-04-22. Read on
2026-11-13.

## Decision: port the data model, do not fork the app

| question | ShlinkedIn | what Wesyn needs |
|---|---|---|
| Hosting | a Phoenix server + Postgres | a static demo on GitHub Pages, plus the existing Aitherium backend |
| Accounts | its own email/password accounts (`accounts/`) | "Sign in with Aitherium" only, no second auth system |
| Content | satire is built into the schema (points currency, "life score", interns, jabs, ads) | serious, earned standing |
| Communities | groups inside the app | Discord servers as planets, mirrored to Relay |

Forking would have meant standing up a new runtime, a second account system and a
Postgres schema, then removing the joke mechanics from it. Porting the model let the
signed-in demo work on the backend that already exists. Credit is in `NOTICE` and
`README.md`.

## Per module

| ShlinkedIn module | verdict | what Wesyn took |
|---|---|---|
| `profiles/profile.ex` | ADAPT | username, display name, headline, summary, verified flag -> `Profile`; dropped points, life score, interns |
| `profiles/endorsement.ex` | ADAPT | from, to, body -> `Endorsement` with a named skill; dropped gif/emoji |
| `profiles/testimonial.ex` | REFERENCE | relation + body; star ratings left out (reputation is earned, not rated) |
| `profiles/friend.ex` | ADAPT | request with status and message -> `ConnectionRequest` |
| `profiles/follow.ex` | REFERENCE | follows are a later issue |
| `profiles/work.ex` | ADAPT | title, org, dates -> `WorkEntry` |
| `profiles/jab.ex`, `interns`, `ads`, `points`, `awards` | REJECT | satire mechanics |
| `profiles/notification.ex` | REFERENCE | notifications are a later issue |
| `timeline/post.ex` | ADAPT | body, author, time -> `Post`; posts live in Relay rooms mirrored with Discord |
| `groups` | ADAPT | -> `Planet` (a workspace bound to a Discord server) |
| `chat` | REFERENCE | DMs live in AitherRelay, mirrored to Discord |
| `accounts` | REJECT | replaced by Aitherium OIDC |
| `moderation` | REFERENCE | moderation is server-side in Aitherium |
| `news`, `levels`, `badges` | REFERENCE | badges and levels come from community standing |
| LiveView templates and copy | REJECT | satire copy; Wesyn's UI is its own |
