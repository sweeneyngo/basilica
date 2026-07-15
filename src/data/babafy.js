// Core transform: find the FIRST "ba" (case-insensitive) in a word and
// echo it — insert an extra lowercase "ba" immediately after the match.
//   balloon -> ba + ba + lloon -> baballoon
//   banshee -> ba + ba + nshee -> babanshee
//
// Returns null if the word has no "ba" at all.
// Returns a part-based object so the UI can color the original match
// and the echoed insertion differently (the "stutter" effect).
export function babafy(word) {
  const idx = word.toLowerCase().indexOf('ba')
  if (idx === -1) return null

  const before = word.slice(0, idx)
  const matched = word.slice(idx, idx + 2) // preserve original casing
  const inserted = 'ba' // echo is always lowercase
  const after = word.slice(idx + 2)

  return {
    word,
    before,
    matched,
    inserted,
    after,
    result: before + matched + inserted + after,
  }
}
