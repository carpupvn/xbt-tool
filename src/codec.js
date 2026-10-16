/* ============================================================================
   Codec: giải mã / ký lại save, đóng gói token chuyển dữ liệu.
   Phụ thuộc: XoiSig (bắt buộc), XbtCodec (tuỳ chọn - để hỗ trợ mã XBT3)
   ============================================================================ */
(function (global) {
  'use strict';
  if (!global.XoiSig) return;
  const { sig, b64e, b64d } = global.XoiSig;

  /* ---------- base64url ↔ bytes ---------- */
  function bytesToToken(bytes) {
    let out = ''; const step = 32768;
    for (let i = 0; i < bytes.length; i += step)
      out += String.fromCharCode.apply(null, bytes.subarray(i, i + step));
    return btoa(out).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function tokenToBytes(token) {
    let s = token.replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    const raw = atob(s), bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
    return bytes;
  }
  function rawTextToToken(t) {
    return btoa(unescape(encodeURIComponent(t))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  }
  function tokenToRawText(t) {
    let s = t.replace(/-/g,'+').replace(/_/g,'/');
    while (s.length % 4) s += '=';
    return decodeURIComponent(escape(atob(s)));
  }

  /* ---------- gzip ---------- */
  async function gzipText(text) {
    if (typeof CompressionStream === 'undefined') throw new Error('no-compression');
    const stream = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'));
    const buf = await new Response(stream).arrayBuffer();
    return bytesToToken(new Uint8Array(buf));
  }
  async function gunzipText(token) {
    if (typeof DecompressionStream === 'undefined') throw new Error('no-decompression');
    const stream = new Blob([tokenToBytes(token)]).stream().pipeThrough(new DecompressionStream('gzip'));
    return await new Response(stream).text();
  }

  /* ---------- save <-> object ---------- */
  function buildSave(state, t) {
    const json = JSON.stringify(state);
    return { json, d: b64e(json), h: sig(json), t: t || Date.now() };
  }
  function encodeSave(state, t) {
    const o = buildSave(state, t);
    return JSON.stringify({
      game: 'ai-mua-xoi-di',
      f: 2,
      v: 'web-final',
      day: state.day,
      t: o.t,
      d: o.d,
      h: o.h
    });
  }
  function decodeSave(raw) {
    let o;
    try { o = typeof raw === 'string' ? JSON.parse(raw) : raw; }
    catch (e) { throw new Error('Save không phải JSON hợp lệ.'); }
    if (!o || o.f !== 2 || typeof o.d !== 'string' || typeof o.h !== 'string')
      throw new Error('Save thiếu f / d / h.');
    const json = b64d(o.d);
    if (sig(json) !== o.h) throw new Error('Chữ ký không khớp — save hỏng hoặc bị sửa tay.');
    let state;
    try { state = JSON.parse(json); }
    catch (e) { throw new Error('State bên trong không phải JSON.'); }
    if (!state || typeof state !== 'object' || typeof state.day !== 'number')
      throw new Error('State không hợp lệ (thiếu day).');
    return { state, t: typeof o.t === 'number' ? o.t : 0 };
  }

  /* ---------- XBT3 ---------- */
  function encodeXbt(state) {
    if (!global.XbtCodec) throw new Error('Chưa load xbt.js');
    return global.XbtCodec.encode(state, sig, 'web-final');
  }

  /* ---------- transfer token ---------- */
  async function encodeTransfer(state, t) {
    const o = buildSave(state, t);
    const payload = JSON.stringify({ game:'ai-mua-xoi-di', f:2, v:'web-final', day: state.day, t: o.t, d: o.d, h: o.h });
    try { return 'g.' + await gzipText(payload); }
    catch (e) { return 'r.' + rawTextToToken(payload); }
  }
  async function decodeTransfer(token) {
    let text;
    if (token.startsWith('g.')) text = await gunzipText(token.slice(2));
    else if (token.startsWith('r.')) text = tokenToRawText(token.slice(2));
    else throw new Error('Token không có tiền tố g. / r.');
    const o = JSON.parse(text);
    if (!o || o.game !== 'ai-mua-xoi-di' || o.f !== 2) throw new Error('Payload transfer sai.');
    return decodeSave(JSON.stringify({ f:2, d:o.d, h:o.h, t:o.t }));
  }

  /* ---------- auto-detect ---------- */
  async function decodeAny(raw) {
    raw = String(raw || '').trim();
    if (!raw) throw new Error('Chưa có dữ liệu để giải mã.');

    // ⚡ Mã XBT3 của app native (Android/iOS)
    if (raw.indexOf('XBT3') >= 0 && global.XbtCodec) {
      const r = global.XbtCodec.decode(raw);
      const json = JSON.stringify(r.state);
      if (sig(json) !== r.h) throw new Error('Chữ ký XBT không khớp — mã đã bị sửa.');
      return { state: r.state, t: r.t, kind: 'xbt-app' };
    }

    const m = raw.match(/#?xoi-transfer=([A-Za-z0-9_\-\.]+)/);
    const tok = m ? m[1] : (/^(g\.|r\.)[A-Za-z0-9_\-]+$/.test(raw) ? raw : null);
    if (tok) { const r = await decodeTransfer(tok); r.kind = 'transfer'; return r; }

    try {
      const o = JSON.parse(raw);
      if (o && o.f === 2 && typeof o.d === 'string' && typeof o.h === 'string') {
        const r = decodeSave(o); r.kind = 'save'; return r;
      }
      if (o && o.v === 1 && typeof o.day === 'number')
        return { state: o, t: 0, kind: 'raw-state' };
      if (o && o.game === 'ai-mua-xoi-di' && o.f === 2) {
        const r = decodeSave(JSON.stringify({ f:2, d:o.d, h:o.h, t:o.t }));
        r.kind = 'transfer-json'; return r;
      }
    } catch (e) { /* không phải JSON */ }

    try {
      const json = b64d(raw);
      const st = JSON.parse(json);
      if (st && st.v === 1 && typeof st.day === 'number')
        return { state: st, t: 0, kind: 'base64-raw' };
    } catch (e) { /* không phải base64 state */ }

    throw new Error('Không nhận dạng được định dạng. Kiểm tra lại dữ liệu đã dán.');
  }

  global.XoiCodec = {
    sig, b64e, b64d,
    encodeSave, decodeSave,
    encodeTransfer, decodeTransfer,
    encodeXbt,
    decodeAny,
  };
})(window);