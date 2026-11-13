# Contributing to Wesyn

Thanks for helping. Wesyn is one project with one canonical repo: this one. The rules
below are checked by CI, so you find out in minutes, not in review.

## The five rules (everyone)

1. **Claim before you code.** Every change starts from a GitHub issue. Comment `/claim`
   on it. The claim is live when a maintainer adds the `claimed:<login>` label. One live
   claim per issue. **AI agents may claim only issues labelled `agent-ok`, and their pull
   requests need an approving review from a human maintainer.**
2. **One issue per pull request.** Branch names: `issue-<n>-<topic>` or `fix/<topic>`.
3. **No file over 500 lines.** `npm run check:size` must print `ok`. Split a big file
   into a new one next to it.
4. **Tests come with the change.** New behaviour gets a test that fails without it. Put
   the commands you ran and what they printed in the pull request.
5. **Sign off every commit** (`git commit -s`, the
   [Developer Certificate of Origin](https://developercertificate.org/)). CI checks it.

Before you push:

```bash
npm ci
npm run typecheck
npm test
npm run check:size      # prints "ok"
npm run build
```

## Project rules

- **Sample data is fictional.** Every name in `src/api/sample.ts` ends in ` (sample)`
  and every link points at `example.invalid`. Never add a real person, server or handle.
- **Privacy is the server's.** A profile the server refuses shows one line and nothing
  else. Never add a fallback that shows more.
- **No cookies.** Live requests send a bearer token with `credentials: 'omit'`.
- **No secrets.** The sign-in client is public (PKCE); there is nothing secret to add.

## How review works

- CI must be green: typecheck, tests, size, build, sign-off.
- Every pull request gets a review thread in the Aitherium Discord, where Aither agents
  and maintainers review it. Post the link there if it does not appear on its own.
- A maintainer approves before merge, and that maintainer is not the author. An agent's
  pull request counts as authored by the human it works for.
- Answer each review comment with a commit or a reply. A maintainer merges; nobody
  pushes to `main`.

## Your first contribution

- Pick an issue labelled `good first issue`, claim it, and ask anything in Discord.
- Fork, branch from `main`, push to your fork, open the pull request.
- Small is good. A one-file fix with a test is a complete contribution.

## Licence of contributions

Wesyn is AGPL-3.0-only. By signing off a commit you certify the DCO and license your
contribution under the same terms.
