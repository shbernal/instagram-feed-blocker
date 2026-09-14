import type { ExtensionSettings, PageSection } from '../shared/settings'

export const OVERLAY_ID = 'igfb-overlay'
export const OVERLAY_STYLE_ID = 'igfb-overlay-style'
export const OVERLAY_TOGGLE_ID = 'igfb-overlay-toggle'
export const OVERLAY_TOGGLE_LABEL_ID = 'igfb-overlay-toggle-label'
export const OVERLAY_BLOCK_BUTTON_ID = 'igfb-overlay-block-button'

// Callbacks are injected rather than imported so this module never depends on
// the lifecycle module that owns the settings.
export type OverlayHandlers = {
  onToggle: (enabled: boolean) => void
  onBlock: () => void
}

const SECTION_LABELS: Record<PageSection, string> = {
  homeFeed: 'Home feed',
  homeStories: 'stories',
  homeSuggestions: 'suggestions',
  explore: 'Explore',
  reels: 'Reels',
}

let overlayHandlers: OverlayHandlers | null = null

// Placement follows what Instagram keeps on screen. The card sits in the middle
// of the emptied page. The button for an unblocked page sits at the bottom
// centre, because the top right holds the narrow layout's search box and the
// bottom right holds Instagram's floating Messages button; below 768px it
// clears the bottom navigation bar as well.
const OVERLAY_CSS = `
#${OVERLAY_ID} {
  position: fixed;
  z-index: 2147483647;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  color: #0f172a;
}

#${OVERLAY_ID}.igfb-overlay-blocked {
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  min-width: 300px;
  padding: 20px 24px;
  background: #fff;
  border: 1px solid rgba(15, 23, 42, 0.1);
  border-radius: 16px;
  box-shadow: 0 20px 60px rgba(15, 23, 42, 0.18);
  text-align: center;
}

#${OVERLAY_ID}.igfb-overlay-available {
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  padding: 6px;
  background: rgba(255, 255, 255, 0.96);
  border: 1px solid rgba(15, 23, 42, 0.12);
  border-radius: 999px;
  box-shadow: 0 10px 32px rgba(15, 23, 42, 0.16);
}

.igfb-title {
  margin: 0 0 14px;
  font-size: 16px;
  font-weight: 700;
}

.igfb-toggle-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
}

.igfb-toggle-label {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: #334155;
}

.igfb-switch {
  position: relative;
  width: 52px;
  height: 28px;
  cursor: pointer;
}

.igfb-switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.igfb-slider {
  position: absolute;
  inset: 0;
  background: #cbd5e1;
  border-radius: 28px;
  transition: background 0.2s ease;
}

.igfb-slider::before {
  position: absolute;
  content: '';
  width: 22px;
  height: 22px;
  left: 3px;
  bottom: 3px;
  background: #fff;
  border-radius: 50%;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.25);
  transition: transform 0.2s ease;
}

.igfb-switch input:checked + .igfb-slider {
  background: #334155;
}

.igfb-switch input:checked + .igfb-slider::before {
  transform: translateX(24px);
}

.igfb-switch input:focus-visible + .igfb-slider {
  outline: 2px solid #64748b;
  outline-offset: 2px;
}

.igfb-block-button {
  appearance: none;
  min-height: 34px;
  padding: 0 16px;
  background: #0f172a;
  border: 0;
  border-radius: 999px;
  color: #fff;
  cursor: pointer;
  font-size: 13px;
  font-weight: 700;
}

.igfb-block-button:hover {
  background: #334155;
}

.igfb-block-button:focus-visible {
  outline: 2px solid #64748b;
  outline-offset: 2px;
}

@media (max-width: 767px) {
  #${OVERLAY_ID}.igfb-overlay-available {
    bottom: 72px;
  }
}

@media (max-width: 480px) {
  #${OVERLAY_ID}.igfb-overlay-blocked {
    min-width: 0;
    width: calc(100vw - 40px);
  }
}

@media (prefers-color-scheme: dark) {
  #${OVERLAY_ID} {
    color: #f1f5f9;
  }

  #${OVERLAY_ID}.igfb-overlay-blocked {
    background: #1e293b;
    border-color: rgba(241, 245, 249, 0.12);
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.55);
  }

  #${OVERLAY_ID}.igfb-overlay-available {
    background: rgba(30, 41, 59, 0.96);
    border-color: rgba(241, 245, 249, 0.14);
  }

  .igfb-toggle-label {
    color: #cbd5e1;
  }

  .igfb-slider {
    background: #475569;
  }

  .igfb-switch input:checked + .igfb-slider {
    background: #94a3b8;
  }

  .igfb-block-button {
    background: #f1f5f9;
    color: #0f172a;
  }

  .igfb-block-button:hover {
    background: #cbd5e1;
  }
}
`

const ensureOverlayStyles = () => {
  if (document.getElementById(OVERLAY_STYLE_ID)) {
    return
  }

  const style = document.createElement('style')
  style.id = OVERLAY_STYLE_ID
  style.textContent = OVERLAY_CSS
  document.documentElement.appendChild(style)
}

export const removeOverlay = () => {
  document.getElementById(OVERLAY_ID)?.remove()
}

export const removeOverlayStyles = () => {
  document.getElementById(OVERLAY_STYLE_ID)?.remove()
}

// Stable listener identities, attached only when the markup is rebuilt, which
// read the current handlers at event time.
const handleToggle = (event: Event) => {
  const input = event.currentTarget as HTMLInputElement
  overlayHandlers?.onToggle(input.checked)
}

const handleBlock = () => {
  overlayHandlers?.onBlock()
}

// Every write below is skipped when the value already matches. The content
// script re-renders on Instagram's DOM churn, and a text write that replaces a
// node with an identical one is itself churn its observer would react to.
const setText = (element: Element | null, text: string) => {
  if (element && element.textContent !== text) {
    element.textContent = text
  }
}

const setAttribute = (element: Element | null, name: string, value: string) => {
  if (element && element.getAttribute(name) !== value) {
    element.setAttribute(name, value)
  }
}

const buildBlockedMarkup = (overlay: HTMLElement) => {
  overlay.innerHTML = `
    <p class="igfb-title">Instagram Feed Blocker</p>
    <div class="igfb-toggle-row">
      <p id="${OVERLAY_TOGGLE_LABEL_ID}" class="igfb-toggle-label"></p>
      <label class="igfb-switch">
        <input
          id="${OVERLAY_TOGGLE_ID}"
          type="checkbox"
          aria-labelledby="${OVERLAY_TOGGLE_LABEL_ID}"
        />
        <span class="igfb-slider"></span>
      </label>
    </div>
  `
  overlay
    .querySelector(`#${OVERLAY_TOGGLE_ID}`)
    ?.addEventListener('change', handleToggle)
}

const buildAvailableMarkup = (overlay: HTMLElement) => {
  overlay.innerHTML = `
    <button id="${OVERLAY_BLOCK_BUTTON_ID}" class="igfb-block-button" type="button"></button>
  `
  overlay
    .querySelector(`#${OVERLAY_BLOCK_BUTTON_ID}`)
    ?.addEventListener('click', handleBlock)
}

/**
 * A card with the section's switch while it is blocked, or a button to block
 * it again while it is not. Needs `<body>`, which does not exist yet at
 * `document_start`; the content script renders again once it does.
 */
export const renderOverlay = (
  settings: ExtensionSettings,
  handlers: OverlayHandlers,
  section: PageSection,
) => {
  overlayHandlers = handlers

  if (!document.body) {
    return
  }

  ensureOverlayStyles()

  const blocked = settings[section]
  const state = blocked ? 'blocked' : 'available'
  const label = `Block ${SECTION_LABELS[section]}`

  let overlay = document.getElementById(OVERLAY_ID)
  if (!overlay) {
    overlay = document.createElement('div')
    overlay.id = OVERLAY_ID
    document.body.appendChild(overlay)
  }

  if (overlay.dataset.igfbState !== state) {
    overlay.dataset.igfbState = state
    overlay.className = `igfb-overlay-${state}`

    if (blocked) {
      buildBlockedMarkup(overlay)
    } else {
      buildAvailableMarkup(overlay)
    }
  }

  setText(overlay.querySelector(`#${OVERLAY_TOGGLE_LABEL_ID}`), label)
  const button = overlay.querySelector(`#${OVERLAY_BLOCK_BUTTON_ID}`)
  setText(button, label)
  setAttribute(button, 'aria-label', label)

  const toggle = overlay.querySelector<HTMLInputElement>(
    `#${OVERLAY_TOGGLE_ID}`,
  )
  if (toggle) {
    toggle.checked = blocked
  }
}
