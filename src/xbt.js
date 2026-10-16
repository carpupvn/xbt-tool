/* ============================================================================
   XBT3 codec — format sao lưu của app "Tiệm Xôi Bà Tám"
   Copy logic trực tiếp từ game (đã dịch ra JS sạch).
   ============================================================================ */
(function (global) {
  'use strict';

  const ALPHA = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  const DECODE = {};
  for (let i = 0; i < 32; i++) DECODE[ALPHA[i]] = i;
  DECODE['I'] = 1; DECODE['L'] = 1;
  DECODE['O'] = 0; DECODE['U'] = DECODE['V'];

  /* ---------- base32 ↔ number ---------- */
  function b32ToNum(str, from, len) {
    let r = 0;
    for (let i = 0; i < len; i++) r = r * 32 + (DECODE[str[from + i]] || 0);
    return r;
  }
  function numToB32(num, digits) {
    let s = '';
    for (let i = 0; i < digits; i++) { s = ALPHA[num % 32] + s; num = Math.floor(num / 32); }
    return s;
  }

  /* ---------- checksum rolling ---------- */
  function rollHash(s) {
    let h = 7;
    for (let i = 0; i < s.length; i++) h = (h * 31 + (DECODE[s[i]] || 0) + 1) % 1021;
    return h;
  }

  /* ---------- LZ decompress ---------- */
  function decompress(input) {
    const len = input.length;
    let pos = 0;
    let cur = len ? (DECODE[input[0]] || 0) : 0;
    let mask = 0x10;

    function readBits(n) {
      let r = 0;
      for (let i = 0; i < n; i++) {
        if (pos >= len) throw new Error('XBT payload cụt');
        const bit = (cur & mask) ? 1 : 0;
        mask >>= 1;
        if (!mask) { mask = 0x10; pos++; cur = pos < len ? (DECODE[input[pos]] || 0) : 0; }
        r |= bit << i;
      }
      return r;
    }

    const dict = ['', '', ''];
    let countdown = 4, nextIdx = 4, bitWidth = 3, prev, current;

    const first = readBits(2);
    if (first === 2) return '';
    if (first > 2) throw new Error('XBT header sai');

    prev = String.fromCharCode(readBits(first === 0 ? 8 : 16));
    dict[3] = prev;
    const out = [prev];

    for (;;) {
      let code = readBits(bitWidth);
      if (code === 2) return out.join('');
      if (code === 0 || code === 1) {
        dict[nextIdx++] = String.fromCharCode(readBits(code === 0 ? 8 : 16));
        code = nextIdx - 1;
        if (--countdown === 0) { countdown = 1 << bitWidth; bitWidth++; }
      }
      if (dict[code] !== undefined) current = dict[code];
      else if (code === nextIdx) current = prev + prev[0];
      else throw new Error('XBT dict lỗi');
      out.push(current);
      dict[nextIdx++] = prev + current[0];
      if (--countdown === 0) { countdown = 1 << bitWidth; bitWidth++; }
      prev = current;
    }
  }

  /* ---------- LZ compress ---------- */
  function compress(input) {
    const out = [];
    const dict = new Map();
    const singles = new Set();
    let current = '', countdown = 2, nextCode = 3, bitsPerCode = 2;
    let buf = 0, bufBits = 0;

    function emit(value, numBits) {
      for (let i = 0; i < numBits; i++) {
        buf = (buf << 1) | ((value >> i) & 1);
        if (bufBits === 4) { out.push(ALPHA[buf]); buf = 0; bufBits = 0; }
        else bufBits++;
      }
    }
    function tick() {
      if (--countdown === 0) { countdown = 1 << bitsPerCode; bitsPerCode++; }
    }
    function flushCurrent() {
      if (singles.has(current)) {
        const c = current.charCodeAt(0);
        if (c < 0x100) { emit(0, bitsPerCode); emit(c, 8); }
        else { emit(1, bitsPerCode); emit(c, 16); }
        tick(); singles.delete(current);
      } else {
        emit(dict.get(current), bitsPerCode);
      }
      tick();
    }

    for (let i = 0; i < input.length; i++) {
      const ch = input[i];
      if (!dict.has(ch)) { dict.set(ch, nextCode++); singles.add(ch); }
      const combo = current + ch;
      if (dict.has(combo)) { current = combo; continue; }
      flushCurrent();
      dict.set(combo, nextCode++);
      current = ch;
    }
    if (current !== '') flushCurrent();
    emit(2, bitsPerCode);

    for (;;) {
      buf = buf << 1;
      if (bufBits === 4) { out.push(ALPHA[buf]); break; }
      bufBits++;
    }
    return out.join('');
  }

  /* ---------- decode "XBT3..." → { state, t, h, version } ---------- */
  function decode(raw) {
    raw = String(raw || '').trim();
    const idx = raw.indexOf('XBT3');
    if (idx < 0) throw new Error('Không tìm thấy tiền tố XBT3.');
    const cleaned = raw.slice(idx + 4).replace(/[^0-9A-Za-z]/g, '');
    if (cleaned.length < 7) throw new Error('Mã XBT quá ngắn.');

    const totalLen = b32ToNum(cleaned, 0, 4);
    const checksum = b32ToNum(cleaned, 4, 2);
    const payload = cleaned.slice(6, 6 + totalLen);
    if (payload.length < totalLen) throw new Error('Mã XBT bị cụt.');

    if (rollHash(payload) !== checksum) throw new Error('Mã XBT sai checksum.');

    const json = decompress(payload);
    const obj = JSON.parse(json);
    if (!obj || obj.g !== 'xbt' || typeof obj.s !== 'string')
      throw new Error('Payload XBT không hợp lệ.');

    return { state: JSON.parse(obj.s), t: obj.t, h: obj.h, version: obj.v };
  }

  /* ---------- encode state → "XBT3..." ---------- */
  function encode(state, sigFn, gameVer) {
    const stateJson = JSON.stringify(state);
    const inner = JSON.stringify({
      g: 'xbt',
      v: String(gameVer || ''),
      day: state.day,
      t: Date.now(),
      s: stateJson,
      h: sigFn(stateJson),
    });
    const compressed = compress(inner);
    return 'XBT3' + numToB32(compressed.length, 4) + numToB32(rollHash(compressed), 2) + compressed;
  }

  global.XbtCodec = { decode, encode, compress, decompress, rollHash };
})(window);