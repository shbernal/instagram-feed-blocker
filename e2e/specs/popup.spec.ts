import type { Page } from '@playwright/test'
import { test, expect } from '../fixtures/extension'
import { EVERYTHING_BLOCKED, NOTHING_BLOCKED } from '../fixtures/settings'

const SECTION_LABELS = [
  'Block feed',
  'Block stories',
  'Block suggestions',
  'Block Explore',
  'Block Reels',
]

// The checkbox itself is visually replaced by the slider, so the click has to
// land on the slider while the assertions read the checkbox.
const clickSwitch = async (page: Page, label: string) => {
  await page
    .locator('.switch-row', { hasText: label })
    .locator('.slider')
    .click()
}

test('reflects and persists section toggles', async ({
  clearSettings,
  seedSettings,
  openExtensionPage,
  readSettings,
}) => {
  await clearSettings()
  await seedSettings({ ...EVERYTHING_BLOCKED, homeStories: false })

  const popup = await openExtensionPage('/src/popup/index.html')

  await expect(popup.getByLabel('Block all sections')).not.toBeChecked()
  await expect(popup.getByLabel('Block feed', { exact: true })).toBeChecked()
  await expect(popup.getByLabel('Block stories')).not.toBeChecked()

  await clickSwitch(popup, 'Block stories')

  await expect(popup.getByLabel('Block all sections')).toBeChecked()
  await expect.poll(readSettings).toEqual(EVERYTHING_BLOCKED)

  await clickSwitch(popup, 'Block Reels')

  await expect(popup.getByLabel('Block Reels')).not.toBeChecked()
  await expect.poll(readSettings).toEqual({
    ...EVERYTHING_BLOCKED,
    reels: false,
  })
})

test('turns every section off and on without touching the overlay', async ({
  clearSettings,
  seedSettings,
  openExtensionPage,
  readSettings,
}) => {
  await clearSettings()
  await seedSettings({ ...EVERYTHING_BLOCKED, overlay: false })

  const popup = await openExtensionPage('/src/popup/index.html')

  await clickSwitch(popup, 'Block all sections')

  for (const label of SECTION_LABELS) {
    await expect(popup.getByLabel(label, { exact: true })).not.toBeChecked()
  }
  await expect(popup.getByLabel('Show overlay')).not.toBeChecked()
  await expect.poll(readSettings).toEqual({
    ...NOTHING_BLOCKED,
    overlay: false,
  })

  await clickSwitch(popup, 'Block all sections')

  for (const label of SECTION_LABELS) {
    await expect(popup.getByLabel(label, { exact: true })).toBeChecked()
  }
  await expect.poll(readSettings).toEqual({
    ...EVERYTHING_BLOCKED,
    overlay: false,
  })
})
