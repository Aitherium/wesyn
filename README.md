# Wesyn (beta)

**The open network where reputation is earned.** Profiles, earned standing, connections,
communities ("planets"), a feed and messages, with Aither built in, running on the
open-source Occupy SaaS apps. Licensed AGPL-3.0.

- **Demo:** https://aitherium.github.io/wesyn/ (sample data: every person, server and
  post in it is fictional and labelled `(sample)`).
- **Sign in with Aitherium** on the demo to switch to your real network.
- **Join from Discord:** `/wesyn join` in the Aitherium Discord makes your profile and
  answers with its link.

Wesyn is in beta. Expect rough edges and missing pieces; the issues list says which.

## What makes it different

| | Wesyn |
|---|---|
| Reputation | Earned in communities (shipped work, reviews, badges). Nobody types their own. |
| GitHub | Shown only when PROVED by signing in with GitHub, never a typed handle. |
| Communities | Each Discord server is a planet. Discord is the primary backend; AitherRelay and IRC mirror it so the network keeps working when Discord is down. |
| Privacy | The server decides. A private profile shows the word "private" and nothing else. |
| Code | AGPL-3.0. Run it, fork it, self-host it. |

## How it works

```
 browser (this app, static on GitHub Pages)
   |  1. "Sign in with Aitherium": OIDC code + PKCE (S256), public client `wesyn-pages`
   |     -> idp.aitherium.com/identity/oidc/authorize -> back to /wesyn/?code&state
   |     -> POST /oidc/token with the verifier -> access token (sessionStorage, this tab)
   |  2. every read: Authorization: Bearer <token>, credentials: 'omit'
   v
 api.aitherium.com/api/*  (non-credentialed CORS for github.io origins)
   |-- /myspace/{user}            the member's Space; 403 when this viewer may not see it
   |-- /myspace/{user}/standing   earned community standing, OAuth-proved GitHub, connections
   |-- /myspace/network/planets   the viewer's own workspaces and their Discord servers
   |-- /social/friends[...]       connections and requests
   `-- /relay/v1/channels/...     the rooms this viewer may read (Discord forums mirror here)
```

The page holds no secret. The IdP accepts exactly one callback for this client,
`https://aitherium.github.io/wesyn/`; a fork on another Pages origin cannot obtain a
token for it, and should register its own client.

Without a token the app uses `SampleClient` (`src/api/sample.ts`). With one it uses
`LiveClient` (`src/api/live.ts`). Both implement `NetworkClient` (`src/api/types.ts`),
so every screen is the same code in both modes.

More: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). LinkedIn interop (sign-in, import from your own data export, opt-in sharing, JobPosting JSON-LD, and why no LinkedIn SDK is used): [docs/linkedin-interop.md](docs/linkedin-interop.md).

## Run it

```bash
npm ci
npm run dev        # http://localhost:5173/wesyn/ (sample mode)
npm test
npm run build
```

Live sign-in works only from the registered callback (the Pages URL). Local
development runs in sample mode.

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md). Start with an issue labelled
`good first issue`. AI agents are welcome on issues labelled `agent-ok`; a human
maintainer approves their pull requests.

## Credits

The social data model follows **ShlinkedIn** (https://github.com/cbh123/shlinked,
AGPL-3.0). We ported the shape of its profiles, endorsements, work history, connection
requests, posts and groups, and left out its satire content and joke mechanics. See
[NOTICE](NOTICE) and [docs/shlinked-intake.md](docs/shlinked-intake.md).

## Licence

AGPL-3.0-only. See [LICENSE](LICENSE). The Wesyn name is not covered by the licence:
forks are welcome under a different name.
