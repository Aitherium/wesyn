// Fictional jobs for TESTS only; never imported by the app. AGPL-3.0-only.
import type { Job } from './Jobs'

/** Fictional sample jobs (every org name ends in "(sample)"; links point at nothing real). */
export const SAMPLE_JOBS: Job[] = [
  { id: 'j1', title: 'Platform engineer', org: 'Lantern Works (sample)', world: 'Driftwood Collective (sample)',
    description: 'Own CI and the build farm. Reproducible builds, flaky-test quarantine, on-call rotation of five.',
    datePosted: '2026-11-10', validThrough: '2026-12-31', employmentType: 'FULL_TIME', remote: true,
    country: 'US', applyUrl: 'https://example.invalid/jobs/j1' },
  { id: 'j2', title: 'Open-source maintainer (charting)', org: 'Tidewater Analytics (sample)', world: 'Driftwood Collective (sample)',
    description: 'Review PRs, run releases, mentor first-time contributors. Paid part time.',
    datePosted: '2026-11-08', employmentType: 'PART_TIME', remote: true, applyUrl: 'https://example.invalid/jobs/j2' },
]

