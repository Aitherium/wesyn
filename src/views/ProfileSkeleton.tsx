// The profile hero while the profile is still loading. AGPL-3.0-only.
export function ProfileSkeleton() {
  return (
    <article className="stack" aria-busy="true">
      <header className="card hero skeleton">
        <div className="avatar sk sk-avatar" aria-hidden />
        <div className="grow">
          <div className="sk sk-line sk-name" aria-hidden />
          <div className="sk sk-line sk-handle" aria-hidden />
          <div className="sk sk-line sk-headline" aria-hidden />
        </div>
        <div className="sk sk-btn" aria-hidden />
        <div className="sk sk-btn sk-btn-small" aria-hidden />
      </header>
      <p className="sr-only" role="status">Loading profile…</p>
    </article>
  )
}
