/* Hàm băm chữ ký + base64 — COPY NGUYÊN từ game.
   KHÔNG được đổi bất kỳ ký tự nào trong chuỗi tiền tố. */
(function (global) {
  'use strict';

  function sig(str) {
    var s = 'b\u00e0-t\u00e1m#x\u00f4i$' + str + '|' + str.length + '|ai-mua-x\u00f4i';
    var h1 = 0x811c9dc5, h2 = 0x9e3779b9;
    for (var i = 0; i < s.length; i++) {
      var c = s.charCodeAt(i);
      h1 = Math.imul(h1 ^ c, 16777619);
      h2 = Math.imul(h2 ^ (c + i), 2246822507); h2 ^= h2 >>> 13;
    }
    return (h1 >>> 0).toString(36) + '.' + (h2 >>> 0).toString(36);
  }

  function b64e(s) { return btoa(unescape(encodeURIComponent(s))); }
  function b64d(s) { return decodeURIComponent(escape(atob(s))); }

  global.XoiSig = { sig: sig, b64e: b64e, b64d: b64d };
})(window);