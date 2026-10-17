// A small lossless compressor (LZW over the alphabet of the text, packed 15 bits to a character so that no lone surrogate is ever produced), synchronous, used only as the last resort of the
// saves: when localStorage has no room for a save and no other storage can take it, the save is written compressed (a JSON career shrinks to a fraction) instead of failing. A compressed value
// starts with LZ_MARK; any other string is returned as it is.
export const LZ_MARK = '\u0001lz1:';
const bitsFor = count => Math.max(1, Math.ceil(Math.log2(Math.max(2, count))));

function packer() {
  let out = '', buffer = 0, held = 0;
  return {
    write(value, width) {
      while (width > 0) {
        const take = Math.min(width, 15 - held);
        buffer = (buffer << take) | ((value >>> (width - take)) & ((1 << take) - 1));
        held += take; width -= take;
        if (held === 15) { out += String.fromCharCode(buffer + 32); buffer = 0; held = 0; }
      }
    },
    finish() { const padding = held ? 15 - held : 0; if (held) out += String.fromCharCode((buffer << padding) + 32); return { padding, out }; }
  };
}

export function compress(text) {
  const source = String(text);
  const alphabet = [...new Set(source)].map(char => char.charCodeAt(0));
  // (code units, not code points: the text is read one UTF-16 unit at a time)
  const units = new Set(); for (let at = 0; at < source.length; at++) units.add(source.charCodeAt(at));
  const symbols = [...units];
  const index = new Map(symbols.map((unit, at) => [unit, at]));
  const A = symbols.length;
  const bits = packer();
  bits.write(A, 16);
  for (const unit of symbols) bits.write(unit, 16);
  bits.write(source.length >>> 16, 16); bits.write(source.length & 0xffff, 16);
  const table = new Map(); // prefixCode * A + symbol -> code
  let size = A, emitted = 0;
  let prefix = -1;
  for (let at = 0; at < source.length; at++) {
    const symbol = index.get(source.charCodeAt(at));
    if (prefix === -1) { prefix = symbol; continue; }
    const key = prefix * A + symbol;
    const hit = table.get(key);
    if (hit !== undefined) { prefix = hit; continue; }
    bits.write(prefix, bitsFor(A + emitted)); emitted++;
    table.set(key, size++);
    prefix = symbol;
  }
  if (prefix !== -1) { bits.write(prefix, bitsFor(A + emitted)); emitted++; }
  const { padding, out } = bits.finish();
  void alphabet;
  return LZ_MARK + String.fromCharCode(padding + 32) + out;
}

export function decompress(packed) {
  const text = String(packed);
  if (!text.startsWith(LZ_MARK)) return text;
  const padding = text.charCodeAt(LZ_MARK.length) - 32;
  const body = text.slice(LZ_MARK.length + 1);
  const totalBits = body.length * 15 - padding;
  let position = 0;
  const read = width => {
    let value = 0;
    for (let need = width; need > 0;) {
      if (position >= totalBits) throw new Error('Dato compresso troncato.');
      const chunk = body.charCodeAt(Math.floor(position / 15)) - 32;
      const used = position % 15;
      const take = Math.min(need, 15 - used);
      value = (value * (1 << take)) + ((chunk >>> (15 - used - take)) & ((1 << take) - 1));
      position += take; need -= take;
    }
    return value;
  };
  const A = read(16);
  const symbols = Array.from({ length: A }, () => read(16));
  const length = read(16) * 65536 + read(16);
  const prefixes = new Array(A).fill(-1);
  const chars = symbols.slice();
  const stringOf = code => { const parts = []; while (code >= 0) { parts.push(chars[code]); code = prefixes[code]; } let out = ''; for (let at = parts.length - 1; at >= 0; at--) out += String.fromCharCode(parts[at]); return out; };
  const firstOf = code => { while (prefixes[code] >= 0) code = prefixes[code]; return chars[code]; };
  if (length === 0) return '';
  const pieces = [];
  let previous = read(bitsFor(A));
  pieces.push(stringOf(previous));
  let produced = pieces[0].length;
  for (let step = 1; produced < length; step++) {
    const code = read(bitsFor(A + step));
    let first;
    if (code < chars.length) { first = firstOf(code); }
    else if (code === chars.length) { first = firstOf(previous); }
    else throw new Error('Dato compresso non valido.');
    prefixes.push(previous); chars.push(first);
    const piece = stringOf(code);
    pieces.push(piece); produced += piece.length;
    previous = code;
  }
  return pieces.join('');
}
