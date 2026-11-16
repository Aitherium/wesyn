import { describe, expect, it } from 'vitest'
import css from './styles.css?raw'

describe('keyboard focus styles', () => {
  it('gives every focusable element a visible accent ring', () => {
    expect(css).toMatch(/:focus-visible\s*\{[^}]*outline:\s*2px solid var\(--accent\)/)
  })

  it('does not take the outline away from keyboard focus on inputs', () => {
    expect(css).not.toMatch(/input:focus\s*\{[^}]*outline:\s*none/)
    expect(css).toMatch(/input:focus:not\(:focus-visible\)\s*\{[^}]*outline:\s*none/)
  })
})
