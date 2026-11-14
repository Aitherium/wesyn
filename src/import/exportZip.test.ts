// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { importExport, parseCsv, readZipTexts } from './exportZip'
import { SAMPLE_EXPORT, makeZip } from './zipTestUtil'

describe('data-export import (client-side)', () => {
  it('reads deflated and stored entries and maps the four files', async () => {
    for (const deflate of [true, false]) {
      const zip = await makeZip(SAMPLE_EXPORT, deflate)
      const p = await importExport(new Blob([zip]))
      expect(p.files).toEqual(['connections.csv', 'education.csv', 'positions.csv', 'skills.csv'])
      expect(p.positions[0]).toEqual({ title: 'Platform engineer', company: 'Lantern Works (sample)', from: 'Jan 2023', to: '' })
      expect(p.skills).toEqual(['Kubernetes', 'CI/CD'])
      expect(p.education[0].degree).toBe('BSc Computer Science')
      expect(p.contacts).toEqual([{ name: 'Mira Okafor (sample)', company: 'Tidewater Analytics (sample)', position: 'Founder', email: '' }])
    }
  })

  it('never reads files it was not asked for (messages stay closed)', async () => {
    const texts = await readZipTexts((await makeZip(SAMPLE_EXPORT)).buffer as ArrayBuffer)
    expect(Object.keys(texts)).not.toContain('messages.csv')
  })

  it('refuses a file that is not a ZIP', async () => {
    await expect(importExport(new Blob(['hello']))).rejects.toThrow('not a ZIP')
  })

  it('parses quoted CSV fields with commas and doubled quotes', () => {
    expect(parseCsv('a,"b, c","d ""e"""\r\n1,2,3')).toEqual([['a', 'b, c', 'd "e"'], ['1', '2', '3']])
  })
})
