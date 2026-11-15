// The signed-out page: real things only, no sample people. AGPL-3.0-only.
//
// Wesyn shows a member's network only to that member, so a visitor who is not signed in
// sees what is true for everyone: what Wesyn is, how to sign in, and the worlds that are
// connected. Occupy SaaS is the first connected world.

export interface World { name: string; summary: string; discord: string }

export const CONNECTED_WORLDS: World[] = [
  {
    name: 'Occupy SaaS',
    summary: 'The first connected world: an open-source community that builds, owns and gets paid for its own software. Projects, the bug board and the bounty board run in its Discord.',
    discord: 'https://discord.gg/zSvECrMjE',
  },
]

export function WelcomeView({ signIn }: { signIn: () => void }) {
  return (
    <section className="stack" aria-label="Welcome">
      <p>Wesyn is the open network where reputation is earned: your profile, your standing, your connections and the worlds you belong to.</p>
      <p><button className="primary" onClick={signIn}>Sign in with Aitherium</button> to see your network. Nothing here is shown to anyone who is not signed in.</p>
      <h2>Connected worlds</h2>
      <p className="dim">A world is a community: a workspace, and the Discord server bound to it. Join from its Discord, then run <code>/wesyn join</code>.</p>
      <ul className="grid">{CONNECTED_WORLDS.map(w => (
        <li key={w.name} className="card">
          <h2>{w.name}</h2>
          <p>{w.summary}</p>
          <a className="link" href={w.discord} rel="noopener noreferrer">Join on Discord</a>
        </li>
      ))}</ul>
    </section>
  )
}
