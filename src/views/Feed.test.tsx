import { describe, expect, it } from 'vitest'
import { createRoot } from 'react-dom/client'
import { act } from 'react'
import { SampleClient } from '../api/sample'
import { FeedView } from './Lists'

describe('FeedView timestamp', () => {
  it('shows the full timestamp as a title on the feed header', async () => {
    const client = new SampleClient()
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    await act(async () => {
      root.render(<FeedView client={client} />)
    })
    await act(async () => { await new Promise(r => setTimeout(r, 50)) })

    const span = container.querySelector('span[title]')
    expect(span).toBeTruthy()
    expect(span!.getAttribute('title')).toBeTruthy()

    act(() => { root.unmount() })
    document.body.removeChild(container)
  })
})
