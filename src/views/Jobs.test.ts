import { describe, expect, it } from 'vitest'
import { SAMPLE_JOBS, jobPostingLd } from './Jobs'

describe('JobPosting JSON-LD', () => {
  it('is schema.org JobPosting with the required properties', () => {
    const ld = jobPostingLd(SAMPLE_JOBS[0])
    expect(ld['@context']).toBe('https://schema.org')
    expect(ld['@type']).toBe('JobPosting')
    for (const k of ['title', 'description', 'datePosted', 'hiringOrganization']) expect(ld[k]).toBeTruthy()
    expect(ld.jobLocationType).toBe('TELECOMMUTE')
    expect(ld.directApply).toBe(false)
  })
  it('sample jobs are fictional', () => {
    for (const j of SAMPLE_JOBS) {
      expect(j.org).toMatch(/\(sample\)$/)
      expect(new URL(j.applyUrl).hostname).toBe('example.invalid')
    }
  })
})
