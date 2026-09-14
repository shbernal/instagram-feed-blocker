import { defineManifest } from '@crxjs/vite-plugin'
import pkg from './package.json' with { type: 'json' }

// Gecko needs an explicit add-on id and an up-front data-collection answer.
// Chrome has no use for either key, so they are only emitted for the Firefox
// build and the default build stays exactly what ships to the Chrome Web Store.
const isFirefox = process.env.EXT_TARGET === 'firefox'

// crxjs names each output chunk after its entry file's basename, so no two
// entries may share one: the generated `service-worker-loader.js` then picks
// whichever `<basename>.ts-<hash>.js` it resolves first and can end up importing
// the content script instead of the background script.
export default defineManifest({
  manifest_version: 3,
  name: 'Instagram Feed Blocker',
  version: pkg.version,
  description: pkg.description,
  permissions: ['activeTab', 'storage'],
  host_permissions: ['*://*.instagram.com/*'],
  // Gecko has no extension service workers, and crxjs reads the background
  // entry straight off this manifest rather than rewriting it per target, so
  // the conditional has to live here. crxjs adds `"type": "module"` to the
  // Firefox entry itself.
  background: isFirefox
    ? { scripts: ['src/background/service-worker.ts'] }
    : { service_worker: 'src/background/service-worker.ts', type: 'module' },
  commands: {
    'toggle-current-page-block': {
      suggested_key: {
        default: 'Ctrl+Shift+9',
        mac: 'Command+Shift+9',
      },
      description: 'Toggle blocking for the current Instagram page',
    },
  },
  // One entry for every Instagram page, at document_start. The stylesheet has to
  // be in place before anything renders, and it cannot be scoped to routes here:
  // Instagram navigates client-side and the browser never re-evaluates
  // `matches` for that. Route scoping is the content script's job, through the
  // attributes the stylesheet keys on.
  content_scripts: [
    {
      matches: ['*://*.instagram.com/*'],
      js: ['src/content/content-script.ts'],
      css: ['src/content/blocking.css'],
      run_at: 'document_start',
    },
  ],
  action: {
    default_popup: 'src/popup/index.html',
    default_title: 'Instagram Feed Blocker',
  },
  icons: {
    16: 'icons/icon16.png',
    48: 'icons/icon48.png',
    128: 'icons/icon128.png',
  },
  ...(isFirefox
    ? {
        browser_specific_settings: {
          gecko: {
            // Permanent once listed. AMO binds the listing, the review history
            // and every installed user's update path to this id; changing it
            // creates a different add-on.
            id: 'instagram-feed-blocker@shbernal.github.io',
            // 140 is the floor for `data_collection_permissions`; below it the
            // key is ignored and the disclosure never reaches the user.
            strict_min_version: '140.0',
            // The extension reads and writes nothing but its own settings.
            data_collection_permissions: { required: ['none'] },
          },
        },
      }
    : {}),
})
