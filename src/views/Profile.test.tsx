import { describe, expect, it, vi } from 'vitest'
import { createRoot } from 'react-dom/client'
import { act } from 'react'
import { SampleClient } from '../api/sample'
import { ProfileView } from './Profile'

describe('ProfileView copy link', () => {
  it('writes the profile URL to the clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    })

    const client = new SampleClient()
    const go = () => {}
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    await act(async () => {
      root.render(<ProfileView client={client} username="rowan" go={go} />)
    })
    // wait for profile to load
    await act(async () => { await new Promise(r => setTimeout(r, 50)) })

    const btn = Array.from(container.querySelectorAll('button')).find(b => b.textContent === 'Copy link')
    expect(btn).toBeTruthy()
    await act(async () => { btn!.click() })
    await act(async () => { await new Promise(r => setTimeout(r, 50)) })

    expect(writeText).toHaveBeenCalledWith('https://aitherium.github.io/wesyn/#/u/rowan')
    const copiedBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent === 'Copied!')
    expect(copiedBtn).toBeTruthy()

    act(() => { root.unmount() })
    document.body.removeChild(container)
  })
})
