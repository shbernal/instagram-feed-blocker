import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { DEFAULT_SETTINGS } from '../shared/settings'
import {
  OVERLAY_ID,
  OVERLAY_STYLE_ID,
  removeOverlay,
  removeOverlayStyles,
  renderOverlay,
} from './overlay'

const handlers = () => ({ onToggle: vi.fn(), onBlock: vi.fn() })

const overlays = () => document.querySelectorAll(`#${OVERLAY_ID}`)

describe('the blocked card', () => {
  it('shows the section switch checked', () => {
    renderOverlay(DEFAULT_SETTINGS, handlers(), 'homeFeed')

    expect(screen.getByText('Instagram Feed Blocker')).toBeInTheDocument()
    expect(
      screen.getByRole('checkbox', { name: 'Block Home feed' }),
    ).toBeChecked()
  })

  it('reports the switch turning off', async () => {
    const callbacks = handlers()
    renderOverlay(DEFAULT_SETTINGS, callbacks, 'explore')

    await userEvent.click(
      screen.getByRole('checkbox', { name: 'Block Explore' }),
    )

    expect(callbacks.onToggle).toHaveBeenCalledWith(false)
  })
})

describe('the block button', () => {
  it('offers to block an unblocked section', async () => {
    const callbacks = handlers()
    renderOverlay({ ...DEFAULT_SETTINGS, reels: false }, callbacks, 'reels')

    await userEvent.click(screen.getByRole('button', { name: 'Block Reels' }))

    expect(callbacks.onBlock).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('checkbox')).toBeNull()
  })
})

describe('rendering', () => {
  it('switches state in place with a single overlay', () => {
    renderOverlay(DEFAULT_SETTINGS, handlers(), 'homeFeed')
    renderOverlay(
      { ...DEFAULT_SETTINGS, homeFeed: false },
      handlers(),
      'homeFeed',
    )

    expect(overlays()).toHaveLength(1)
    expect(
      screen.getByRole('button', { name: 'Block Home feed' }),
    ).toBeInTheDocument()
  })

  // The content script re-renders on Instagram's DOM churn. Rebuilding the
  // markup, or rewriting identical text, would be churn of its own.
  it('changes nothing in the DOM when re-rendered in the same state', () => {
    renderOverlay(DEFAULT_SETTINGS, handlers(), 'homeFeed')
    const toggle = screen.getByRole('checkbox')

    const observer = new MutationObserver(() => undefined)
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      characterData: true,
    })
    renderOverlay(DEFAULT_SETTINGS, handlers(), 'homeFeed')
    const records = observer.takeRecords()
    observer.disconnect()

    expect(records).toEqual([])
    expect(screen.getByRole('checkbox')).toBe(toggle)
  })

  it('relabels the same markup for another section', () => {
    renderOverlay(DEFAULT_SETTINGS, handlers(), 'homeFeed')
    renderOverlay(DEFAULT_SETTINGS, handlers(), 'explore')

    expect(
      screen.getByRole('checkbox', { name: 'Block Explore' }),
    ).toBeChecked()
  })

  it('calls the handlers of the latest render', async () => {
    const first = handlers()
    const latest = handlers()
    renderOverlay({ ...DEFAULT_SETTINGS, explore: false }, first, 'explore')
    renderOverlay({ ...DEFAULT_SETTINGS, explore: false }, latest, 'explore')

    await userEvent.click(screen.getByRole('button', { name: 'Block Explore' }))

    expect(first.onBlock).not.toHaveBeenCalled()
    expect(latest.onBlock).toHaveBeenCalledTimes(1)
  })

  it('adds its stylesheet once and removes everything on request', () => {
    renderOverlay(DEFAULT_SETTINGS, handlers(), 'homeFeed')
    renderOverlay(DEFAULT_SETTINGS, handlers(), 'reels')

    expect(document.querySelectorAll(`#${OVERLAY_STYLE_ID}`)).toHaveLength(1)

    removeOverlay()
    removeOverlayStyles()

    expect(overlays()).toHaveLength(0)
    expect(document.getElementById(OVERLAY_STYLE_ID)).toBeNull()
  })

  // At document_start there is no body yet.
  it('waits for a body', () => {
    const body = document.body
    body.remove()

    try {
      renderOverlay(DEFAULT_SETTINGS, handlers(), 'homeFeed')

      expect(document.getElementById(OVERLAY_ID)).toBeNull()
    } finally {
      document.documentElement.appendChild(body)
    }
  })
})
