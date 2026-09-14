import { expect, type Locator } from '@playwright/test'

/**
 * Playwright's `toBeVisible()` answers a narrower question than "a person can
 * see this". It checks that the element has a non-empty box and is not
 * `display: none` or `visibility: hidden`. An element squarely inside the
 * viewport with something painted over it passes.
 *
 * That gap matters for the claims this extension makes about what stays
 * usable: the Messages thread list, the Explore search box, the navigation. A
 * rule that hid a neighbour, or an in-page card sitting on top of them, would
 * leave them visible by Playwright's definition and useless to the user.
 */
export const expectUncovered = async (locator: Locator, what: string) => {
  await expect(locator, `${what} is not visible at all`).toBeVisible()

  const covering = await locator.evaluate(element => {
    const rect = element.getBoundingClientRect()
    const hit = element.ownerDocument.elementFromPoint(
      rect.x + rect.width / 2,
      rect.y + rect.height / 2,
    )

    if (hit === null) {
      return 'nothing at all, so the point is outside the viewport'
    }

    if (hit === element || element.contains(hit) || hit.contains(element)) {
      return null
    }

    const id = hit.id ? `#${hit.id}` : ''
    return `${hit.tagName.toLowerCase()}${id}`
  })

  expect(covering, `${what} is covered by ${covering}`).toBe(null)
}
