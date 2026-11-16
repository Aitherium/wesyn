// Jobs, published as schema.org JobPosting JSON-LD so any search engine or job board can
// read them. No "apply with" partner flows: applying happens on the poster's own link.
// AGPL-3.0-only.
import { useEffect, useMemo } from 'react'
import type { NetworkClient } from '../api/types'

export interface Job {
  id: string
  title: string
  org: string
  world: string
  description: string
  datePosted: string          // YYYY-MM-DD
  validThrough?: string
  employmentType: 'FULL_TIME' | 'PART_TIME' | 'CONTRACTOR' | 'VOLUNTEER'
  remote: boolean
  locality?: string
  country?: string
  applyUrl: string
}

/** schema.org JobPosting for one job (https://schema.org/JobPosting). */
export function jobPostingLd(j: Job): Record<string, unknown> {
  const ld: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'JobPosting',
    title: j.title,
    description: j.description,
    datePosted: j.datePosted,
    employmentType: j.employmentType,
    hiringOrganization: { '@type': 'Organization', name: j.org },
    identifier: { '@type': 'PropertyValue', name: 'wesyn', value: j.id },
    url: j.applyUrl,
    directApply: false,
  }
  if (j.validThrough) ld.validThrough = j.validThrough
  if (j.remote) {
    ld.jobLocationType = 'TELECOMMUTE'
    if (j.country) ld.applicantLocationRequirements = { '@type': 'Country', name: j.country }
  } else {
    ld.jobLocation = { '@type': 'Place', address: { '@type': 'PostalAddress',
      addressLocality: j.locality || '', addressCountry: j.country || '' } }
  }
  return ld
}

export function jobsLdGraph(jobs: Job[]): string {
  return JSON.stringify(jobs.map(jobPostingLd), null, 2)
}

export function JobsView({ client }: { client: NetworkClient }) {
  // Live jobs have no backend yet. Wesyn never shows fictional jobs (owner, 2026-11-14).
  void client
  const jobs = useMemo<Job[]>(() => [], [])
  useEffect(() => {
    const el = document.createElement('script')
    el.type = 'application/ld+json'
    el.id = 'wesyn-jobs-ld'
    el.textContent = jobsLdGraph(jobs)
    document.head.appendChild(el)
    return () => { el.remove() }
  }, [jobs])
  const download = () => {
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([jobsLdGraph(jobs)], { type: 'application/ld+json' }))
    a.download = 'wesyn-jobs.jsonld'
    a.click()
    URL.revokeObjectURL(a.href)
  }
  return (
    <section className="stack" aria-label="Jobs">
      <p className="dim">Jobs posted in your worlds. Each one is published as schema.org JobPosting data, so search engines and other boards can list it. You apply on the poster's own link.</p>
      {jobs.length === 0 && <p className="dim">No jobs posted in your worlds yet. Paid work in Occupy SaaS is on its bounty board in Discord.</p>}
      {jobs.map(j => (
        <article key={j.id} className="card">
          <h2>{j.world}</h2>
          <p><b>{j.title}</b> · {j.org}</p>
          <p className="mono dim">{j.employmentType.replace('_', ' ').toLowerCase()} · {j.remote ? 'remote' : j.locality} · posted {j.datePosted}</p>
          <p>{j.description}</p>
          <a className="link" href={j.applyUrl} rel="noopener noreferrer">Apply on the poster's site</a>
        </article>
      ))}
      {jobs.length > 0 && <button onClick={download}>Download JSON-LD</button>}
    </section>
  )
}
