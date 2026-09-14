import {
  expect,
  test as base,
  type BrowserContext,
  type Page,
} from '@playwright/test'
import {
  SETTINGS_STORAGE_KEY,
  type ExtensionSettings,
} from '../../src/shared/settings'
import {
  closeBrowserContext,
  getExtensionId,
  getStorageValue,
  launchBrowserProfileContext,
  openExtensionPage as openExtensionPageInContext,
  removeStorageValues,
  setStorageValue,
  waitForExtensionWorker,
} from './extensionRuntime'
import { resolveRealInstagramProfilePath } from './realProfile'

type RealExtensionFixtures = {
  extensionContext: BrowserContext
  extensionId: string
  newRealInstagramPage: () => Promise<Page>
  openExtensionPage: (pagePath: string) => Promise<Page>
  clearSettings: () => Promise<void>
  seedSettings: (settings: ExtensionSettings) => Promise<void>
  readSettings: () => Promise<ExtensionSettings | undefined>
}

// The signed-in profile from `pnpm e2e:real:setup`, with `dist/` loaded. One
// persistent context per test, because Chromium only loads an unpacked
// extension into a persistent context.
export const test = base.extend<RealExtensionFixtures>({
  extensionContext: async ({ headless }, use) => {
    const context = await launchBrowserProfileContext({
      userDataDir: resolveRealInstagramProfilePath(),
      headless,
    })

    await waitForExtensionWorker(context)

    await use(context)
    await closeBrowserContext(context)
  },

  extensionId: async ({ extensionContext }, use) => {
    await use(await getExtensionId(extensionContext))
  },

  newRealInstagramPage: async ({ extensionContext }, use) => {
    await use(async () => extensionContext.newPage())
  },

  openExtensionPage: async ({ extensionContext, extensionId }, use) => {
    await use(async pagePath => {
      return openExtensionPageInContext(extensionContext, extensionId, pagePath)
    })
  },

  clearSettings: async ({ extensionContext }, use) => {
    await use(async () => {
      await removeStorageValues(extensionContext, [SETTINGS_STORAGE_KEY])
    })
  },

  seedSettings: async ({ extensionContext }, use) => {
    await use(async settings => {
      await setStorageValue(extensionContext, SETTINGS_STORAGE_KEY, settings)
    })
  },

  readSettings: async ({ extensionContext }, use) => {
    await use(async () =>
      getStorageValue<ExtensionSettings>(
        extensionContext,
        SETTINGS_STORAGE_KEY,
      ),
    )
  },
})

export { expect }
