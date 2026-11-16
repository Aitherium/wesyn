# Wesyn architecture

## Layers

| layer | what | where it lives |
|---|---|---|
| Network | profiles, earned standing, connections, worlds | this app + Aitherium Spaces (`/myspace/*`) |
| Conversation | posts, threads, forums, DMs | Discord forums and channels, mirrored to AitherRelay rooms |
| Pages | docs, wikis, boards | Wesyn Pages (planned) |
| Copilot | Aither, in Discord and in the app | Aitherium agents |
| Apps | the Occupy SaaS suite underneath | self-hostable |

## Discord is the primary backend; Relay and IRC are the mirror

A world (called a "planet" until 2026-11-15) is a Discord server bound to an Aitherium workspace, and that workspace's AitherRelay rooms and forum board. Roles in that server are
membership; channels and forums are the discussions.

```
Discord server (world)                          Aitherium
  forum post / thread / message  --gateway-->  awdiscord bot --hook--> DiscordRelayBridge
                                                                          |
                                         AitherRelay room  <--------------'
                                           |        ^
                    IRC clients <-- AitherRelayIRCD (RFC 1459 over TLS, a Relay client)
                                           |
                                Wesyn feed reads /relay/v1/channels/<room>/messages
```

- **One conversation, two transports.** The bridge mirrors messages, threads, forum
  posts, edits, deletes and reactions both ways, so a Wesyn post and its Discord forum
  thread are the same conversation.
- **Survives Discord going dark.** Relay holds its own copy; IRC and the Wesyn app keep
  reading and writing Relay, and the bridge backfills Discord when it returns.
- **The IRC gateway holds no privileged credential.** It authenticates to Relay with the
  connecting user's own bearer token and inherits every gate Relay enforces.

## Identity

"Sign in with Aitherium" is OIDC authorization code with PKCE (S256) against
`idp.aitherium.com/identity`. The client `wesyn-pages` is public (no secret), PKCE is
mandatory, and its only callback is `https://wesyn.aitherium.com/`. The access
token is kept in `sessionStorage` for the tab and sent only as a bearer header.

A Discord member links their Discord account to their Aitherium account once
(`/space` or `/wesyn join` tells them how). After that, `/wesyn join` makes their profile
from Discord and answers with its link.

## Privacy rules the client keeps

1. The profile PAGE read is the gate. Anything but 2xx renders one line and nothing else.
2. If the standing read is stricter than the page read, the stricter answer wins.
3. Requests never carry cookies (`credentials: 'omit'`).
4. The feed reads only rooms the server lists for this viewer; a room that answers 403
   contributes nothing.

## Data model

`src/api/types.ts`. It follows ShlinkedIn's model (see `docs/shlinked-intake.md`):
profile, work entry, endorsement, connection request, post, group (world), with
provenance on every fact (`proved`, `earned`, `claimed`). Only proved and earned facts
count toward standing.

## Worlds

A world (called a "planet" until 2026-11-15; `#/planets` redirects to `#/worlds`) is
one AitherRelay workspace. That workspace has rooms (`#<slug>-general`, ...) and a forum
board (`/relay/v1/workspaces/<slug>/forum/*`), and the Discord server bound to it
mirrors into those same rooms through the Discord-to-workspace mapping. Wesyn keeps no
forum engine and no message table of its own. `#/w/<slug>` is the world page:

| part | what it reads and writes |
|---|---|
| Pinned (`data-slot="world-pinned"`) | `world.pinned` on the Relay workspace (sites and agents the Studio pins) |
| Forum | boards, threads, search, reply and new thread, all Relay's workspace forum |
| Live chat | the world's Relay rooms, polled every 5 s; send posts as the member |
| OSINT | `GET /api/osint/news` and `/api/osint/telemetry` for `world.osint.query` or a typed region |
| Copilot | the in-tab Bonsai agent (below) |

World settings (`world.osint`, `world.pinned`) are written by a world admin through
`PUT /relay/v1/workspaces/<slug>`, and Relay validates them. Pins must be https links.

**OSINT.** The panel is read-only. It calls the platform's public read door, which signs
each request to the ShadowBroker board (github.com/wizzense/Shadowbroker, AGPL-3.0) on
the server. The board's secret never reaches the browser. Every row keeps its own
source link and is labelled a lead to verify, and the panel credits the board and its
software.

## The copilot

Profiles and world pages carry a copilot that runs **Bonsai on the member's own GPU,
inside the tab**. It uses Aitherium's in-tab runtime, the same worker
(`https://aitherium.com/workers/webgpu-brain-bonsai-worker.js`) and tool parser
(`https://aitherium.com/gobbonet/bonsai-tools.js`) that aitherium.com/edge-agent runs.
That runtime is **not part of this repository**. It is Aitherium's own, separately
licensed software. It is fetched from aitherium.com only when the member clicks
"Load on my GPU", and this app talks to it only through the worker's message protocol.
No prompt leaves the tab.

The tool loop runs in the page (`src/copilot/loop.ts`) and the tools are in
`src/copilot/tools.ts`. They act as the signed-in member with the member's own token:

- `wesyn_read_feed`, `wesyn_search_threads`, `wesyn_read_thread` and `osint_news` /
  `osint_telemetry` read at once.
- `wesyn_post_reply` and `wesyn_message_member` only make a **draft**. The draft is sent
  when the member clicks Post or Send on it. The model is told this, so it cannot claim
  it posted.

The same tools are registered with WebMCP (`navigator.modelContext`) when the browser
has it, under the same draft rule.
