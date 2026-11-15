import { describe, expect, it } from 'vitest'
import { createRoot } from 'react-dom/client'
import { act } from 'react'
import App from './App'

describe('App routing', () => {
  it('shows "No such page" for an unknown hash', () => {
    window.location.hash = '#/no-such-page'
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    act(() => { root.render(<App />) })
    expect(container.textContent).toContain('No such page')
    expect(container.querySelector('a[href="#/"]')).not.toBeNull()
    act(() => { root.unmount() })
    document.body.removeChild(container)
  })

  it('signed out, shows the welcome and the first connected world, never sample people', () => {
    window.location.hash = '#/'
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    act(() => { root.render(<App />) })
    expect(container.textContent).toContain('Occupy SaaS')
    expect(container.textContent).not.toContain('(sample)')
    expect(container.textContent).not.toMatch(/planet/i)
    act(() => { root.unmount() })
    document.body.removeChild(container)
  })
})
