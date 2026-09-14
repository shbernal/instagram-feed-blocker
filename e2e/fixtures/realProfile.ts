import path from 'node:path'

// Everything here holds a live Instagram session, which is why it all lives
// under `.e2e/`, the one directory git ignores wholesale.
const defaultProfilePath = '.e2e/instagram-real-profile'

export const resolveRealInstagramProfilePath = () => {
  return path.resolve(
    process.cwd(),
    process.env.INSTAGRAM_REAL_PROFILE_DIR ?? defaultProfilePath,
  )
}

/**
 * The session's cookies and storage, exported for probes that do not need the
 * extension and so can use a plain context instead of the persistent profile.
 */
export const resolveRealInstagramStatePath = () => {
  return path.resolve(process.cwd(), '.e2e/instagram-storage-state.json')
}

/**
 * Where a verification code can be dropped while the setup run waits on it,
 * for when nobody is at the window to type it.
 */
export const resolveVerificationCodePath = () => {
  return path.resolve(process.cwd(), '.e2e/instagram-verification-code')
}
