# Wesyn: ground truth for every coding agent

Wesyn is the open network where reputation is earned: profiles, earned standing,
connections, planets (communities), feed and messages, as a static web app that reads
the Aitherium backend as the signed-in member. Humans read `CONTRIBUTING.md`; the rules
are the same. This file is harness-neutral; Claude Code reads it through `CLAUDE.md`.

## Rules

- **Work from a claimed issue.** One issue per pull request. Agents claim only issues
  labelled `agent-ok`; an agent's pull request merges only after a human maintainer
  approves it.
- **Sample data stays fictional.** Every name in `src/api/sample.ts` ends in
  ` (sample)` and every link points at `example.invalid`. `npm test` checks it. Never
  put a real person, server or handle in sample data.
- **Privacy is the server's.** A profile read that is not 2xx shows one line
  ("private", "no member", "removed") and nothing else. Never fall back to a cache, a
  directory row or a guess. `src/api/live.test.ts` pins it.
- **No ambient credentials.** Live requests send `Authorization: Bearer` and
  `credentials: 'omit'`. Never add a cookie-based call.
- **No file over 500 lines** (`npm run check:size` prints `ok`).
- **No secrets** in code, commits or tool arguments. The OIDC client is public (PKCE);
  there is no client secret to add.
- **No new runtime dependency** without saying why in the pull request.
- **Commits are signed off** (`git commit -s`).

## Verify before you say done

```bash
npm ci
npm run typecheck
npm test
npm run check:size
npm run build
```

## Report format

1. What changed: file paths, one line each.
2. Which checks you ran and what they printed.
3. What you did not do, and why.
