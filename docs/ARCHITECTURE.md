# Wesyn architecture

## Layers

| layer | what | where it lives |
|---|---|---|
| Network | profiles, earned standing, connections, planets | this app + Aitherium Spaces (`/myspace/*`) |
| Conversation | posts, threads, forums, DMs | Discord forums and channels, mirrored to AitherRelay rooms |
| Pages | docs, wikis, boards | Wesyn Pages (planned) |
| Copilot | Aither, in Discord and in the app | Aitherium agents |
| Apps | the Occupy SaaS suite underneath | self-hostable |

## Discord is the primary backend; Relay and IRC are the mirror

A planet is a Discord server bound to an Aitherium workspace. Roles in that server are
membership; channels and forums are the discussions.

```
Discord server (planet)                         Aitherium
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
mandatory, and its only callback is `https://aitherium.github.io/wesyn/`. The access
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
profile, work entry, endorsement, connection request, post, group (planet), with
provenance on every fact (`proved`, `earned`, `claimed`). Only proved and earned facts
count toward standing.
