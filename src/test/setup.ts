import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, beforeEach, vi } from 'vitest'
import { clearAllBlocking } from '../content/blocking'
import { READY_ATTR } from '../content/blockingStyles'
import { OVERLAY_STYLE_ID } from '../content/overlay'
import { installChromeMock } from './chrome'
import { installMediaStub } from './media'

beforeEach(() => {
  installChromeMock()
  installMediaStub()
})

afterEach(() => {
  cleanup()
  document.body.innerHTML = ''
  // Section attributes, the ready gate and the overlay stylesheet live on
  // `<html>`, which resetting the body does not touch, so without this state
  // leaks into the next test.
  clearAllBlocking()
  document.documentElement.removeAttribute(READY_ATTR)
  document.getElementById(OVERLAY_STYLE_ID)?.remove()
  document.head.querySelectorAll('style').forEach(style => style.remove())
  window.history.replaceState({}, '', '/')
  vi.useRealTimers()
  vi.restoreAllMocks()
})
