import react from '@vitejs/plugin-react'
import { configDefaults, defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    // `e2e/**` is Playwright's; `.e2e/**` is the gitignored local scratch area
    // for real-site profiles and throwaway probe specs. Vitest must own
    // neither, or a stray spec there fails the unit run.
    exclude: [...configDefaults.exclude, 'e2e/**', '.e2e/**'],
    environmentOptions: {
      jsdom: {
        url: 'https://www.instagram.com/',
      },
    },
    setupFiles: ['./src/test/setup.ts'],
    // jsdom runs its own event plumbing on `setImmediate`. Faking it would put
    // jsdom's tasks in the fake clock beside the extension's timers.
    fakeTimers: {
      toFake: [
        'setTimeout',
        'clearTimeout',
        'setInterval',
        'clearInterval',
        'Date',
      ],
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      reportsDirectory: 'coverage',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/test/**', 'src/popup/main.tsx'],
      // A floor that only moves up. Set a couple of points below the measured
      // numbers so an unrelated change cannot quietly erode coverage, while
      // leaving room for small refactors. Raise these when coverage rises.
      // The text reporter omits fully covered files; that is `skipFull`
      // behaviour, not a gap in the report.
      thresholds: {
        statements: 97,
        branches: 96,
        functions: 98,
        lines: 97,
      },
    },
  },
})
