import { describe, expect, it } from 'vitest'
import { createRoot } from 'react-dom/client'
import { act } from 'react'
import { SampleClient } from '../api/sample'
import type { ProfileResult } from '../api/types'
import { ProfileView } from './Profile'

class PendingClient extends SampleClient {
  override profile(): Promise<ProfileResult> { return new Promise(() => {}) }
}

describe('ProfileView loading state', () => {
  it('shows a skeleton while the profile is loading', async () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    await act(async () => {
      root.render(<ProfileView client={new PendingClient()} username="rowan" go={() => {}} />)
    })

    expect(container.querySelector('.skeleton')).not.toBeNull()
    expect(container.querySelector('.sk-name')).not.toBeNull()
    expect(container.querySelector('.sk-btn')).not.toBeNull()
    expect(container.querySelector('p.dim')).toBeNull()
    expect(container.textContent).toContain('Loading profile')

    act(() => { root.unmount() })
    document.body.removeChild(container)
  })
})
