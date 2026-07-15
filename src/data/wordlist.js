// The crate is distilled from the dwyl english-words dictionary
// (https://github.com/dwyl/english-words, words_dictionary.json): every
// entry that is purely alphabetic, 3–14 letters, and contains "ba" — so
// babafy() always finds a match — then filtered to the common ones by
// frequency (Norvig's count_1w.txt, keeping words ranked in the top 30k).
// ~400 words, sorted A→Z. Raise the 30k threshold for a bigger crate.
//
// To regenerate ba-words.json:
//   ba   = {w for w in words_dictionary
//           if re.fullmatch(r'[a-z]+', w) and 'ba' in w and 3 <= len(w) <= 14}
//   rank = {line order in count_1w.txt}   # 0 = most common
//   WORDS = sorted(w for w in ba if rank.get(w, inf) < 30000)
import WORDS from './ba-words.json'

export { WORDS }
