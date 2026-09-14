import { describe, expect, it } from 'vitest'
import { getRouteSections } from './routes'

describe('getRouteSections', () => {
  it('gives Home its three sections', () => {
    expect(getRouteSections('/')).toEqual([
      'homeFeed',
      'homeStories',
      'homeSuggestions',
    ])
  })

  it('treats Explore as its grid only, with or without the slash', () => {
    expect(getRouteSections('/explore/')).toEqual(['explore'])
    expect(getRouteSections('/explore')).toEqual(['explore'])
  })

  it('covers the Reels tab and every reel it scrolls through', () => {
    expect(getRouteSections('/reels/')).toEqual(['reels'])
    expect(getRouteSections('/reels/Dc0eSCwM5mr/')).toEqual(['reels'])
    expect(getRouteSections('/reels/Dc0eSCwM5mr')).toEqual(['reels'])
  })

  // Shared links and anything reached on purpose stay untouched.
  it('leaves intentional destinations alone', () => {
    for (const pathname of [
      '/reel/Dc0eSCwM5mr/',
      '/p/DdLvHP8xU91/',
      '/direct/inbox/',
      '/direct/t/123/',
      '/some.user/',
      '/some.user/reels/',
      '/explore/people/',
      '/explore/search/keyword/',
      '/explore/tags/guitar/',
      '/accounts/edit/',
      '/notifications/',
    ]) {
      expect(getRouteSections(pathname), pathname).toEqual([])
    }
  })

  it('marks the story viewer as transparent', () => {
    expect(getRouteSections('/stories/some.user/')).toBeNull()
    expect(getRouteSections('/stories/some.user/3456/')).toBeNull()
  })
})
