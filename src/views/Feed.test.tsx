import { describe, expect, it } from 'vitest'
import { createRoot } from 'react-dom/client'
import { act } from 'react'
import { SampleClient } from '../api/sample'
import { FeedView } from './Lists'

describe('FeedView room filter', () => {
  it('filters posts by room when a chip is clicked', async () => {
    const client = new SampleClient()
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    await act(async () => {
      root.render(<FeedView client={client} />)
    })
    await act(async () => { await new Promise(r => setTimeout(r, 50)) })

    const articlesBefore = container.querySelectorAll('article.card.post').length
    expect(articlesBefore).toBeGreaterThan(0)

    const chips = Array.from(container.querySelectorAll('ul.chips button'))
    expect(chips.length).toBeGreaterThan(1)

    // click the second chip (first room)
    await act(async () => { (chips[1] as HTMLButtonElement).click() })
    await act(async () => { await new Promise(r => setTimeout(r, 50)) })

    const articlesAfter = container.querySelectorAll('article.card.post').length
    expect(articlesAfter).toBeLessThan(articlesBefore)

    act(() => { root.unmount() })
    document.body.removeChild(container)
  })
})
