import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  SETTINGS_STORAGE_KEY,
  type ExtensionSettings,
} from '../shared/settings'
import { getChromeMock } from '../test/chrome'
import App from './App'

const NOTHING_BLOCKED: ExtensionSettings = {
  active: false,
  overlay: true,
  homeFeed: false,
  homeStories: false,
  homeSuggestions: false,
  explore: false,
  reels: false,
}

const EVERYTHING_BLOCKED: ExtensionSettings = {
  active: true,
  overlay: true,
  homeFeed: true,
  homeStories: true,
  homeSuggestions: true,
  explore: true,
  reels: true,
}

const SECTION_LABELS = [
  'Block feed',
  'Block stories',
  'Block suggestions',
  'Block Explore',
  'Block Reels',
]

const toggle = (label: string) => {
  return screen.getByLabelText(label)
}

const storedSettings = () => {
  return getChromeMock().storage.local.snapshot()[SETTINGS_STORAGE_KEY]
}

const withActiveTab = (tab: Partial<chrome.tabs.Tab> | undefined) => {
  getChromeMock().tabs.query.mockImplementation((_queryInfo, callback) => {
    callback(tab ? [tab as chrome.tabs.Tab] : [])
  })
}

let user: ReturnType<typeof userEvent.setup>

beforeEach(() => {
  user = userEvent.setup()
})

describe('loading', () => {
  it('reflects stored settings', () => {
    getChromeMock().storage.local.seed({
      [SETTINGS_STORAGE_KEY]: { ...EVERYTHING_BLOCKED, homeStories: false },
    })

    render(<App />)

    expect(toggle('Block feed')).toBeChecked()
    expect(toggle('Block stories')).not.toBeChecked()
    expect(toggle('Block all sections')).not.toBeChecked()
  })

  it('checks the master toggle only when every section is on', () => {
    getChromeMock().storage.local.seed({
      [SETTINGS_STORAGE_KEY]: EVERYTHING_BLOCKED,
    })

    render(<App />)

    SECTION_LABELS.forEach(label => {
      expect(toggle(label)).toBeChecked()
    })
    expect(toggle('Block all sections')).toBeChecked()
  })

  it('defaults to blocking everything with nothing stored', () => {
    render(<App />)

    expect(toggle('Block all sections')).toBeChecked()
    expect(toggle('Show overlay')).toBeChecked()
    expect(storedSettings()).toEqual(EVERYTHING_BLOCKED)
  })

  it('writes back a normalized copy of whatever was stored', () => {
    getChromeMock().storage.local.seed({
      [SETTINGS_STORAGE_KEY]: { reels: false, stray: 1 },
    })

    render(<App />)

    expect(storedSettings()).toEqual({ ...EVERYTHING_BLOCKED, reels: false })
  })
})

describe('toggling', () => {
  it('persists a single section and notifies the active tab', async () => {
    getChromeMock().storage.local.seed({
      [SETTINGS_STORAGE_KEY]: EVERYTHING_BLOCKED,
    })
    withActiveTab({ id: 5, url: 'https://www.instagram.com/' })
    render(<App />)

    await user.click(toggle('Block Reels'))

    expect(toggle('Block Reels')).not.toBeChecked()
    expect(toggle('Block all sections')).not.toBeChecked()
    expect(storedSettings()).toEqual({ ...EVERYTHING_BLOCKED, reels: false })
    expect(getChromeMock().tabs.sendMessage).toHaveBeenCalledWith(
      5,
      {
        action: 'updateSettings',
        settings: { ...EVERYTHING_BLOCKED, reels: false },
      },
      expect.any(Function),
    )
  })

  it('turns every section off and back on from the master toggle', async () => {
    getChromeMock().storage.local.seed({
      [SETTINGS_STORAGE_KEY]: EVERYTHING_BLOCKED,
    })
    render(<App />)

    await user.click(toggle('Block all sections'))

    SECTION_LABELS.forEach(label => {
      expect(toggle(label)).not.toBeChecked()
    })
    expect(storedSettings()).toEqual(NOTHING_BLOCKED)

    await user.click(toggle('Block all sections'))

    SECTION_LABELS.forEach(label => {
      expect(toggle(label)).toBeChecked()
    })
    expect(storedSettings()).toEqual(EVERYTHING_BLOCKED)
  })

  // A partially blocked state means the master toggle turns the rest on
  // rather than turning the remaining ones off.
  it('completes a partial selection from the master toggle', async () => {
    getChromeMock().storage.local.seed({
      [SETTINGS_STORAGE_KEY]: { ...NOTHING_BLOCKED, homeFeed: true },
    })
    render(<App />)

    await user.click(toggle('Block all sections'))

    expect(storedSettings()).toEqual(EVERYTHING_BLOCKED)
  })

  // Every switch is wired to its own section, so a copy/paste slip that points
  // two rows at the same key only shows up if each one is exercised.
  it('wires every switch to its own section', async () => {
    getChromeMock().storage.local.seed({
      [SETTINGS_STORAGE_KEY]: EVERYTHING_BLOCKED,
    })
    render(<App />)

    for (const label of SECTION_LABELS) {
      await user.click(toggle(label))
    }

    expect(storedSettings()).toEqual(NOTHING_BLOCKED)
    SECTION_LABELS.forEach(label => {
      expect(toggle(label)).not.toBeChecked()
    })
  })

  it('switches the overlay without touching any section', async () => {
    getChromeMock().storage.local.seed({
      [SETTINGS_STORAGE_KEY]: EVERYTHING_BLOCKED,
    })
    render(<App />)

    await user.click(toggle('Show overlay'))

    expect(toggle('Show overlay')).not.toBeChecked()
    expect(toggle('Block all sections')).toBeChecked()
    expect(storedSettings()).toEqual({ ...EVERYTHING_BLOCKED, overlay: false })
  })

  it('leaves the overlay alone from the master toggle', async () => {
    getChromeMock().storage.local.seed({
      [SETTINGS_STORAGE_KEY]: { ...NOTHING_BLOCKED, overlay: false },
    })
    render(<App />)

    await user.click(toggle('Block all sections'))

    expect(storedSettings()).toEqual({ ...EVERYTHING_BLOCKED, overlay: false })
  })

  it('survives having no tab to notify', async () => {
    withActiveTab(undefined)
    render(<App />)

    await user.click(toggle('Block feed'))

    expect(getChromeMock().tabs.sendMessage).not.toHaveBeenCalled()
    expect(storedSettings()).toMatchObject({ homeFeed: false })
  })

  it('swallows the delivery error when the tab has no content script', async () => {
    withActiveTab({ id: 5, url: 'https://example.com/' })
    render(<App />)

    await user.click(toggle('Block feed'))

    const [, , respond] = getChromeMock().tabs.sendMessage.mock.calls[0]
    expect(() => respond?.()).not.toThrow()
  })
})

describe('external changes', () => {
  it('follows a settings write from another surface', async () => {
    render(<App />)
    expect(toggle('Block feed')).toBeChecked()

    getChromeMock().storage.local.set({
      [SETTINGS_STORAGE_KEY]: NOTHING_BLOCKED,
    })

    expect(await screen.findByLabelText('Block feed')).not.toBeChecked()
  })

  it('ignores writes to other keys and other areas', () => {
    render(<App />)

    getChromeMock().storage.local.set({ somethingElse: 1 })
    getChromeMock().storage.onChanged.emit(
      { [SETTINGS_STORAGE_KEY]: { newValue: NOTHING_BLOCKED } },
      'sync',
    )

    expect(toggle('Block feed')).toBeChecked()
  })
})
