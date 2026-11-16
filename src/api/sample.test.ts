import { describe, expect, it } from 'vitest'
import { SAMPLE_FEED, SAMPLE_PEOPLE, SAMPLE_WORLDS, SAMPLE_PROFILES, SampleClient } from './sample'

describe('sample data', () => {
  it('every person is labelled (sample)', () => {
    const names = [
      ...Object.values(SAMPLE_PROFILES).map(p => p.displayName),
      ...SAMPLE_PEOPLE.connections.map(p => p.displayName),
      ...Object.values(SAMPLE_PROFILES).flatMap(p => p.connections.people.map(c => c.displayName)),
    ]
    for (const n of names) expect(n).toMatch(/\(sample\)$/)
    for (const p of SAMPLE_WORLDS) expect(p.name).toMatch(/\(sample\)/)
  })

  it('signed out, a world shows nothing invented', async () => {
    const w = new SampleClient().world
    await expect(w.open()).rejects.toThrow(/Sign in/)
    expect(await w.boards()).toEqual([])
    expect(await w.chat()).toEqual([])
    expect((await w.osint('news', 'Baltic')).items).toEqual([])
    expect((await w.reply()).ok).toBe(false)
  })

  it('links point at nothing real', () => {
    for (const p of Object.values(SAMPLE_PROFILES)) {
      if (p.github) expect(new URL(p.github.url).hostname).toBe('example.invalid')
    }
  })

  it('a private sample profile shows only the gate', async () => {
    expect(await new SampleClient().profile('sage')).toEqual({ gate: 'private' })
  })

  it('every feed author has a sample profile', () => {
    for (const post of SAMPLE_FEED) expect(SAMPLE_PROFILES[post.author]).toBeTruthy()
  })
})
