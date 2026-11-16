// Worlds while signed out. AGPL-3.0-only.
//
// Owner rule 2026-11-14: Wesyn shows REAL data only. A world's forum, rooms and panels
// are a member's, so signed out there is nothing to show: every read says "sign in"
// and every write changes nothing. No sample forum, no sample OSINT rows.
import type { Outcome, OsintResult, WorldClient, WorldDetail } from './types'

const SIGN_IN = 'Sign in with Aitherium to open a world.'
const NOTHING: Outcome = { ok: false, message: SIGN_IN }

export class SignedOutWorlds implements WorldClient {
  async create() { return NOTHING }
  async open(): Promise<WorldDetail> { throw new Error(SIGN_IN) }
  async boards() { return [] }
  async threads() { return [] }
  async thread(): Promise<never> { throw new Error(SIGN_IN) }
  async search() { return [] }
  async startThread() { return NOTHING }
  async reply() { return NOTHING }
  async chat() { return [] }
  async say() { return NOTHING }
  async saveSettings() { return NOTHING }
  async osint(_kind: 'news' | 'telemetry', query: string): Promise<OsintResult> {
    return { query, items: [], notice: '', board: '', software: 'https://github.com/wizzense/Shadowbroker',
      license: 'AGPL-3.0', error: SIGN_IN }
  }
  async message() { return NOTHING }
}
