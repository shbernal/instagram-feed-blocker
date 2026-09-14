const INSTAGRAM_HOST_SUFFIX = '.instagram.com'

export const isInstagramUrl = (value: string | undefined) => {
  if (!value) {
    return false
  }

  try {
    const url = new URL(value)
    return (
      url.hostname === 'instagram.com' ||
      url.hostname.endsWith(INSTAGRAM_HOST_SUFFIX)
    )
  } catch {
    return false
  }
}
