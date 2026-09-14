import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getChromeMock } from '../test/chrome'
import { TOGGLE_SHORTCUT_STORAGE_KEY } from '../shared/shortcut'

const TOGGLE_COMMAND = 'toggle-current-page-block'

// The service worker wires everything up at import time, so each test needs a
// fresh module instance against the freshly installed Chrome mock.
const loadServiceWorker = async () => {
  vi.resetModules()
  await import('./service-worker')
}

beforeEach(() => {
  vi.resetModules()
})

describe('shortcut mirroring', () => {
  // Content scripts cannot read `chrome.commands`, so the in-page keydown
  // fallback depends on this storage key being written on every start.
  it('mirrors the resolved command binding into storage', async () => {
    await loadServiceWorker()

    expect(getChromeMock().storage.local.snapshot()).toEqual({
      [TOGGLE_SHORTCUT_STORAGE_KEY]: 'Ctrl+Shift+9',
    })
  })

  it('mirrors an empty binding when the command is unbound', async () => {
    getChromeMock().commands.getAll.mockImplementation(callback => {
      callback([{ name: TOGGLE_COMMAND, description: 'Toggle' }])
    })

    await loadServiceWorker()

    expect(
      getChromeMock().storage.local.snapshot()[TOGGLE_SHORTCUT_STORAGE_KEY],
    ).toBe('')
  })

  it('mirrors an empty binding when the command is missing entirely', async () => {
    getChromeMock().commands.getAll.mockImplementation(callback => {
      callback([])
    })

    await loadServiceWorker()

    expect(
      getChromeMock().storage.local.snapshot()[TOGGLE_SHORTCUT_STORAGE_KEY],
    ).toBe('')
  })
})
