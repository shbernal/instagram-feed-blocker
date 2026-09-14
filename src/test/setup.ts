import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, beforeEach, vi } from 'vitest'
import { clearAllBlocking } from '../content/blocking'
import { READY_ATTR } from '../content/blockingStyles'
import { installChromeMock } from './chrome'

beforeEach(() => {
  installChromeMock()
})

afterEach(() => {
  cleanup()
  document.body.innerHTML = ''
  // Section attributes and the ready gate live on `<html>`, which resetting the
  // body does not touch, so without this blocking state leaks into the next
  // test.
  clearAllBlocking()
  document.documentElement.removeAttribute(READY_ATTR)
  document.head.querySelectorAll('style').forEach(style => style.remove())
  window.history.replaceState({}, '', '/')
  vi.useRealTimers()
  vi.restoreAllMocks()
})
