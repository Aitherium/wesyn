# Interop with LinkedIn

Wesyn talks to LinkedIn only through LinkedIn's public OAuth 2.0 and REST endpoints,
with plain `fetch` (browser) or `httpx` (Aitherium backend). **No LinkedIn client
library is used, vendored or copied.** LinkedIn's own SDKs are published under the
proprietary "LinkedIn API Development Software License Agreement", which forbids
copying them into a public repository and is incompatible with the AGPL.

No scraping, ever. No LinkedIn logo or colours anywhere in Wesyn.

| feature | where it runs | what moves |
|---|---|---|
| Sign in with LinkedIn | the Aitherium IdP (server-side) | The hosted "Sign in with Aitherium" page offers LinkedIn. The client secret stays in the platform vault; this app never sees it. |
| Import from LinkedIn | this browser tab only | You pick the ZIP from LinkedIn's "Get a copy of your data". `src/import/exportZip.ts` reads `Positions.csv`, `Skills.csv`, `Education.csv` and `Connections.csv` with the browser's own `DecompressionStream`. Nothing is uploaded. You may keep the result on this device; it shows on your profile as **claimed**, not earned. Connections become invite suggestions; Wesyn never messages anyone. |
| Also share to LinkedIn | Aitherium backend | Opt-in per post, off by default. You connect your own LinkedIn once (scopes `openid profile w_member_social`); the token is stored under your account only. The server allows **2 posts a day** per account and checks the cap before calling LinkedIn. |
| Jobs | this app | Every job is published as schema.org `JobPosting` JSON-LD (`src/views/Jobs.tsx`), so search engines and other boards can read it. There is no "apply with LinkedIn" (a partner-only program); you apply on the poster's own link. |

Backend routes (Aitherium, `/api/social/linkedin/member/*`): `GET connect`, `GET status`,
`POST share {text, url}`. They act only for the authenticated caller.
