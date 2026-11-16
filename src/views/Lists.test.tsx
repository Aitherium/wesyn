import { describe, expect, it } from 'vitest'
import { createRoot } from 'react-dom/client'
import { act } from 'react'
import { SampleClient } from '../api/sample'
import { PeopleView } from './Lists'

describe('PeopleView filter', () => {
  it('narrows connections by display name or handle', async () => {
    const client = new SampleClient()
    const go = () => {}
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    await act(async () => {
      root.render(<PeopleView client={client} go={go} />)
    })
    await act(async () => { await new Promise(r => setTimeout(r, 50)) })

    const input = container.querySelector('input[aria-label="Filter connections"]') as HTMLInputElement
    expect(input).toBeTruthy()

    const before = container.querySelectorAll('ul.rows li').length
    expect(before).toBeGreaterThan(0)

    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
      setter?.call(input, 'zzznomatch')
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await act(async () => { await new Promise(r => setTimeout(r, 50)) })

    const after = container.querySelectorAll('ul.rows li').length
    expect(after).toBeLessThan(before)

    act(() => { root.unmount() })
    document.body.removeChild(container)
  })
})
