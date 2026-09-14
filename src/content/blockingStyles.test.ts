import { describe, expect, it } from 'vitest'
import { PAGE_SECTIONS } from '../shared/settings'
import {
  buildBlockingCss,
  CURTAIN_EXPIRY_MS,
  getCurtainSelectors,
  isBlockingReady,
  markBlockingReady,
  READY_ATTR,
  READY_FALLBACK_MS,
} from './blockingStyles'
import { BLOCKED_SECTION_ATTRS, SECTION_SELECTORS } from './selectors'

const ruleBody = (css: string, selectorLine: string) => {
  const start = css.indexOf(selectorLine)
  const open = css.indexOf('{', start)
  return css.slice(open + 1, css.indexOf('}', open))
}

describe('the curtain', () => {
  it('covers every selector of every section exactly once', () => {
    const all = PAGE_SECTIONS.flatMap(section => SECTION_SELECTORS[section])

    expect(new Set(getCurtainSelectors())).toEqual(new Set(all))
    expect(getCurtainSelectors()).toHaveLength(new Set(all).size)
  })

  it('applies only while the page is not marked ready', () => {
    const css = buildBlockingCss()

    getCurtainSelectors().forEach(selector => {
      expect(css).toContain(`html:not([${READY_ATTR}]) ${selector}`)
    })
  })

  // `display` cannot be animated back, so a curtain built on it could never
  // lift itself if the content script failed to run.
  it('uses the two properties an animation can restore', () => {
    const css = buildBlockingCss()
    const body = ruleBody(
      css,
      `html:not([${READY_ATTR}]) ${getCurtainSelectors()[0]}`,
    )

    expect(body).toContain('content-visibility: hidden')
    expect(body).toContain('visibility: hidden')
    expect(body).not.toContain('display')
    expect(body).toContain(`${CURTAIN_EXPIRY_MS}ms forwards`)
    expect(css).toMatch(
      /@keyframes igfb-curtain-lift \{\s*to \{\s*content-visibility: visible;\s*visibility: visible;/,
    )
  })

  it('lets the content script recover before the stylesheet has to', () => {
    expect(READY_FALLBACK_MS).toBeLessThan(CURTAIN_EXPIRY_MS)
  })
})

describe('the section rules', () => {
  it('hide each section only while its own attribute is set', () => {
    const css = buildBlockingCss()

    PAGE_SECTIONS.forEach(section => {
      const attribute = BLOCKED_SECTION_ATTRS[section]
      SECTION_SELECTORS[section].forEach(selector => {
        expect(css).toContain(`html[${attribute}] ${selector}`)
      })

      const firstLine = `html[${attribute}] ${SECTION_SELECTORS[section][0]}`
      expect(ruleBody(css, firstLine).trim()).toBe('display: none !important;')
    })
  })

  it('give every section a distinct attribute', () => {
    const attributes = Object.values(BLOCKED_SECTION_ATTRS)

    expect(new Set(attributes).size).toBe(PAGE_SECTIONS.length)
    attributes.forEach(attribute => {
      expect(attribute).toMatch(/^data-igfb-[a-z-]+-blocked$/)
    })
  })
})

describe('the ready gate', () => {
  it('is set by markBlockingReady and stays set', () => {
    expect(isBlockingReady()).toBe(false)

    markBlockingReady()
    markBlockingReady()

    expect(isBlockingReady()).toBe(true)
  })
})
