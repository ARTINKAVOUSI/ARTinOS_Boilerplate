/**
 * Subsequence fuzzy matching with match ranges, for search fields and browsers.
 * No dependencies. Scoring rewards consecutive runs, word boundaries and early hits.
 */

export interface FuzzyMatch {
  /** Higher is better. Only meaningful when comparing matches of the same query. */
  score: number
  /** Inclusive-exclusive `[start, end)` slices of the haystack that matched. */
  ranges: Array<[number, number]>
}

const BOUNDARY = /[\s./_:-]/

/** Returns `null` when `query` is not a subsequence of `text`. An empty query always matches. */
export function fuzzyMatch(text: string, query: string): FuzzyMatch | null {
  if (!query) return { score: 0, ranges: [] }
  const haystack = text.toLowerCase()
  const needle = query.toLowerCase()

  const ranges: Array<[number, number]> = []
  let score = 0
  let cursor = 0
  let previous = -2

  for (let index = 0; index < needle.length; index++) {
    const found = haystack.indexOf(needle[index], cursor)
    if (found < 0) return null

    if (found === previous + 1) {
      score += 8
      ranges[ranges.length - 1][1] = found + 1
    } else {
      score += found === 0 || BOUNDARY.test(haystack[found - 1]) ? 6 : 1
      ranges.push([found, found + 1])
    }

    previous = found
    cursor = found + 1
  }

  // Prefer shorter haystacks and matches that start early.
  score -= ranges[0][0] * 0.1 + haystack.length * 0.01
  return { score, ranges }
}

/** Splits `text` into alternating unmatched/matched segments for highlight rendering. */
export function splitRanges(text: string, ranges: Array<[number, number]>): Array<{ text: string; match: boolean }> {
  if (!ranges.length) return [{ text, match: false }]
  const parts: Array<{ text: string; match: boolean }> = []
  let cursor = 0
  for (const [start, end] of ranges) {
    if (start > cursor) parts.push({ text: text.slice(cursor, start), match: false })
    parts.push({ text: text.slice(start, end), match: true })
    cursor = end
  }
  if (cursor < text.length) parts.push({ text: text.slice(cursor), match: false })
  return parts
}

/** Filters and ranks `items` by a searchable string. Returns every item when `query` is empty. */
export function fuzzyFilter<T>(items: T[], query: string, searchable: (item: T) => string): Array<{ item: T; match: FuzzyMatch }> {
  if (!query) return items.map(item => ({ item, match: { score: 0, ranges: [] } }))
  const results: Array<{ item: T; match: FuzzyMatch }> = []
  for (const item of items) {
    const match = fuzzyMatch(searchable(item), query)
    if (match) results.push({ item, match })
  }
  return results.sort((a, b) => b.match.score - a.match.score)
}
