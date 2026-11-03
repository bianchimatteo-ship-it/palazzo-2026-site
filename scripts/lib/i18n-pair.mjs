// A pair of the phrase book with BOTH free parts (`{}`) and numbers (`#`): the engine hands the parts of a match in the order of the Italian text, numbers included, and a `{n}` of the English side
// names a part by that position; a bare `#` takes "the next unnamed part". Mixing the two shifts the parts (the number lands where a name should be), so a pair like that is written with positions only:
//   «Colpo per {} in {} (−#)» → «Blow to {1} in {2} (−{3})».
// `normalizePair` takes the English as an author writes it (`{k}` = the k-th FREE part, `#` = the next number) and gives the form the engine reads.
export function normalizePair(it, en) {
  const tokens = [...it.matchAll(/\{\}|#/g)].map(match => match[0]);
  if (!tokens.includes('{}') || !tokens.includes('#')) return en; // only free parts or only numbers: the plain forms are safe
  const freeAt = [], hashAt = [];
  tokens.forEach((token, index) => (token === '{}' ? freeAt : hashAt).push(index + 1));
  let nextHash = 0, nextFree = 0;
  // a bare `{}` in the English is the next free part in order, `{k}` the k-th free part, `#` the next number
  return en.replace(/\{(\d?)\}|#/g, (token, digit) => {
    if (token === '#') return `{${hashAt[nextHash++] ?? '#'}}`;
    const k = digit ? Number(digit) : ++nextFree;
    return `{${freeAt[k - 1] ?? token}}`;
  });
}
// The number of parts of an Italian side (free parts and numbers).
export const partsOf = it => (it.match(/\{\}|#/g) ?? []).length;
