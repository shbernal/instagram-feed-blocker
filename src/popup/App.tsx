import { useEffect, useState } from 'react'
import './App.css'
import {
  DEFAULT_SETTINGS,
  isAllPagesActive,
  normalizeSettings,
  setAllPages,
  SETTINGS_STORAGE_KEY,
  syncActiveWithPages,
  type ExtensionSettings,
  type PageSection,
} from '../shared/settings'

type UpdateSettingsMessage = {
  action: 'updateSettings'
  settings: ExtensionSettings
}

type SectionGroup = {
  title: string
  sections: { key: PageSection; label: string }[]
}

const SECTION_GROUPS: SectionGroup[] = [
  {
    title: 'Home',
    sections: [
      { key: 'homeFeed', label: 'Block feed' },
      { key: 'homeStories', label: 'Block stories' },
      { key: 'homeSuggestions', label: 'Block suggestions' },
    ],
  },
  {
    title: 'Explore',
    sections: [{ key: 'explore', label: 'Block Explore' }],
  },
  {
    title: 'Reels',
    sections: [{ key: 'reels', label: 'Block Reels' }],
  },
]

type SwitchProps = {
  label: string
  checked: boolean
  onChange: () => void
  master?: boolean
}

const Switch = ({ label, checked, onChange, master = false }: SwitchProps) => {
  return (
    <label className={master ? 'switch-row' : 'switch-row switch-row-child'}>
      <span
        className={master ? 'switch-label switch-label-master' : 'switch-label'}
      >
        {label}
      </span>
      <span className={master ? 'switch' : 'switch switch-small'}>
        <input type="checkbox" checked={checked} onChange={onChange} />
        <span className="slider"></span>
      </span>
    </label>
  )
}

function App() {
  const [settings, setSettings] = useState<ExtensionSettings>(DEFAULT_SETTINGS)

  useEffect(() => {
    chrome.storage.local.get([SETTINGS_STORAGE_KEY], result => {
      const initialSettings = normalizeSettings(result[SETTINGS_STORAGE_KEY])
      setSettings(initialSettings)
      chrome.storage.local.set({ [SETTINGS_STORAGE_KEY]: initialSettings })
    })

    const handleStorageChange: Parameters<
      typeof chrome.storage.onChanged.addListener
    >[0] = (changes, areaName) => {
      if (areaName !== 'local' || !changes[SETTINGS_STORAGE_KEY]) {
        return
      }

      setSettings(currentSettings =>
        normalizeSettings(
          changes[SETTINGS_STORAGE_KEY].newValue,
          currentSettings,
        ),
      )
    }

    chrome.storage.onChanged.addListener(handleStorageChange)

    return () => {
      chrome.storage.onChanged.removeListener(handleStorageChange)
    }
  }, [])

  const persistAndNotify = (nextSettings: ExtensionSettings) => {
    const syncedSettings = syncActiveWithPages(nextSettings)

    setSettings(syncedSettings)
    chrome.storage.local.set({ [SETTINGS_STORAGE_KEY]: syncedSettings })

    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
      if (tab?.id === undefined) {
        return
      }

      const message: UpdateSettingsMessage = {
        action: 'updateSettings',
        settings: syncedSettings,
      }
      chrome.tabs.sendMessage(tab.id, message, () => {
        // Expected when the active tab has no injected content script.
        void chrome.runtime.lastError
      })
    })
  }

  return (
    <div className="popup-container">
      <div className="popup-header">
        <h2>Instagram Feed Blocker</h2>
      </div>

      <div className="popup-content">
        <div className="switch-list">
          <Switch
            master
            label="Block all sections"
            checked={isAllPagesActive(settings)}
            onChange={() =>
              persistAndNotify(
                setAllPages(settings, !isAllPagesActive(settings)),
              )
            }
          />

          {SECTION_GROUPS.map(group => (
            <div className="section-group" key={group.title}>
              <h3 className="section-title">{group.title}</h3>

              {group.sections.map(section => (
                <Switch
                  key={section.key}
                  label={section.label}
                  checked={settings[section.key]}
                  onChange={() =>
                    persistAndNotify({
                      ...settings,
                      [section.key]: !settings[section.key],
                    })
                  }
                />
              ))}
            </div>
          ))}

          <div className="section-group">
            <h3 className="section-title">Display</h3>

            <Switch
              label="Show overlay"
              checked={settings.overlay}
              onChange={() =>
                persistAndNotify({ ...settings, overlay: !settings.overlay })
              }
            />
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
