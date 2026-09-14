import { TOGGLE_SHORTCUT_STORAGE_KEY } from '../shared/shortcut'

const TOGGLE_CURRENT_PAGE_COMMAND = 'toggle-current-page-block'

// Content scripts cannot read `chrome.commands`, so the resolved binding is
// mirrored into storage for the in-page keydown fallback to match against.
// Runs on every background start, which covers install, browser startup and
// service-worker wake-ups without needing a listener for each.
const syncToggleShortcut = () => {
  chrome.commands.getAll(commands => {
    const command = commands.find(
      entry => entry.name === TOGGLE_CURRENT_PAGE_COMMAND,
    )

    chrome.storage.local.set({
      [TOGGLE_SHORTCUT_STORAGE_KEY]: command?.shortcut ?? '',
    })
  })
}

syncToggleShortcut()
