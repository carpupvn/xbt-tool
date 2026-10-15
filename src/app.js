/* UI & wiring. Phụ thuộc: XoiSig, XoiCodec. */
(function () {
  'use strict';

  if (!window.XoiCodec) {
    document.addEventListener('DOMContentLoaded', () => {
      document.body.insertAdjacentHTML('afterbegin',
        '<div style="background:#c02323;color:#fff;padding:14px;font:14px/1.5 system-ui">' +
        '❌ Không load được <code>src/codec.js</code>. Kiểm tra đủ 3 file: ' +
        '<code>src/sig.js</code>, <code>src/codec.js</code>, <code>src/app.js</code>.' +
        '</div>');
    });
    return;
  }

  const $ = id => document.getElementById(id);
  const C = window.XoiCodec;

  /* ---- Danh sách cố định ---- */
  const FULL_DISHES = [
    'doxanh','lac','gac','ladua','xeo','lacam','dauden','nepcam','mit','ga',
    'san','bap','vo','com','khuc','thit','chuoi','xoai','saurieng','patecha',
    'trungcut','lapxuong','thapcam','ngusac'
  ];
  const UPG_KEYS = ['noi','la','ghe','loa','ti','tra'];
  const UPG_MAX = 5;

  let toastTimer = 0;
  function toast(msg, kind) {
    const t = $('toast');
    if (!t) return;
    t.textContent = msg; t.className = 'toast ' + (kind || '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.className = 'toast hidden'; }, 3400);
  }

  const fmtMoney = v => Math.round(v || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.') + 'đ';
  const chapLabel = s =>
    (s.ch5 >= 1) ? 'Chương 5' :
    (s.ch4 >= 1) ? 'Chương 4' :
    (s.ch3 >= 1) ? 'Chương 3' :
    (s.ch2 >= 1 || s.chapter >= 2) ? 'Chương 2' : 'Chương 1';

  function currentState() {
    const txt = $('state').value.trim();
    if (!txt) throw new Error('Chưa có state — bấm Giải mã trước.');
    let s;
    try { s = JSON.parse(txt); }
    catch (e) { throw new Error('State JSON không hợp lệ: ' + e.message); }
    if (!s || typeof s !== 'object') throw new Error('State phải là object.');
    return s;
  }
  function loadStateOrWarn() {
    try { return currentState(); }
    catch (e) { toast('❌ ' + e.message, 'bad'); return null; }
  }
  function saveState(s) {
    $('state').value = JSON.stringify(s, null, 2);
    renderPreview(s);
    refreshQuickEdit(s);
    buildDishList(s);
  }

  function renderPreview(s) {
    const box = $('preview');
    if (!s || typeof s.day !== 'number') {
      box.innerHTML = '<span class="muted">Chưa có state.</span>'; return;
    }
    box.innerHTML = `
      <div class="pill">📅 Ngày <b>${s.day}</b></div>
      <div class="pill">💰 <b>${fmtMoney(s.money)}</b></div>
      <div class="pill">💳 Nợ <b>${fmtMoney(s.debt)}</b></div>
      <div class="pill">⭐ Uy tín <b>${s.rep ?? 0}</b></div>
      <div class="pill">📖 <b>${chapLabel(s)}</b></div>
      <div class="pill">📱 App <b>${s.app ?? 0}</b></div>`;
  }

  const QE = {
    qe_day:['day','n'], qe_money:['money','n'], qe_debt:['debt','n'], qe_rep:['rep','n'],
    qe_chapter:['chapter','n'], qe_ch2:['ch2','n'], qe_ch3:['ch3','n'],
    qe_ch4:['ch4','n'], qe_ch5:['ch5','n'],
    qe_app:['app','n'], qe_totalServed:['totalServed','n'],
    qe_freeMode:['freeMode','b'], qe_dayDone:['dayDone','b'],
  };

  function refreshQuickEdit(s) {
    for (const [id,[k,t]] of Object.entries(QE)) {
      const el = $(id); if (!el) continue;
      const v = s ? s[k] : undefined;
      if (t === 'b') el.checked = !!v;
      else el.value = (typeof v === 'number') ? v : '';
    }
  }
  function applyQuickEdit() {
    let s;
    try { s = currentState(); }
    catch (e) { return toast('❌ ' + e.message, 'bad'); }
    for (const [id,[k,t]] of Object.entries(QE)) {
      const el = $(id); if (!el) continue;
      if (t === 'b') s[k] = !!el.checked;
      else {
        const n = parseFloat(el.value);
        if (el.value === '') delete s[k];
        else if (isFinite(n)) s[k] = n;
      }
    }
    saveState(s);
  }

  /* ---- Unlock helpers ---- */
  function unlockDishes(s) {
    s.unlocked = FULL_DISHES.slice();
    return s;
  }
  function maxUpgrades(s) {
    s.upg = s.upg || {};
    for (const k of UPG_KEYS) s.upg[k] = UPG_MAX;
    return s;
  }
  function maxAchievements(s) {
    s.ach = s.ach || {};
    for (const k of Object.keys(s.ach)) s.ach[k] = 999;
    return s;
  }
  function unlockEverything(s) {
    unlockDishes(s);
    maxUpgrades(s);
    maxAchievements(s);
    s.rep = 5;
    s.app = 5;
    s.debt = 0;
    return s;
  }

  /* ---- Checkbox list món xôi ---- */
  function buildDishList(s) {
    const box = $('dishList');
    if (!box) return;
    const has = new Set((s && Array.isArray(s.unlocked)) ? s.unlocked : []);
    box.innerHTML = FULL_DISHES.map(id =>
      `<label class="dish-item${has.has(id) ? ' on' : ''}">` +
        `<input type="checkbox" data-dish="${id}"${has.has(id) ? ' checked' : ''}>` +
        `<span>${id}</span>` +
      `</label>`
    ).join('');
    box.querySelectorAll('input[type=checkbox]').forEach(cb => {
      cb.addEventListener('change', () => {
        const st = loadStateOrWarn();
        if (!st) return;
        const set = new Set(st.unlocked || []);
        if (cb.checked) set.add(cb.dataset.dish);
        else set.delete(cb.dataset.dish);
        st.unlocked = FULL_DISHES.filter(d => set.has(d));
        saveState(st);
      });
    });
  }

  async function onDecode() {
    try {
      const r = await C.decodeAny($('input').value);
      $('state').value = JSON.stringify(r.state, null, 2);
      renderPreview(r.state); refreshQuickEdit(r.state); buildDishList(r.state);
      const when = r.t ? new Date(r.t).toLocaleString('vi-VN') : '(không có t)';
      toast('✅ Giải mã OK (' + r.kind + '). Lưu lúc: ' + when, 'good');
      return true;
    } catch (e) {
      toast('❌ ' + e.message, 'bad');
      return false;
    }
  }
  function onSign() {
    try {
      const s = currentState();
      if (typeof s.v !== 'number') s.v = 1;
      if (typeof s.day !== 'number' || s.day < 1)
        throw new Error('day phải là số >= 1.');
      $('output').value = C.encodeSave(s);
      toast('✅ Đã ký lại save.', 'good');
    } catch (e) { toast('❌ ' + e.message, 'bad'); }
  }
  function onVerify() {
    const raw = ($('output').value || $('input').value || '').trim();
    if (!raw) return toast('Chưa có gì để kiểm tra.', 'bad');
    try { const r = C.decodeSave(raw); toast('✅ Chữ ký hợp lệ. day=' + r.state.day, 'good'); }
    catch (e) { toast('❌ ' + e.message, 'bad'); }
  }
  async function onCopySave() {
    const txt = $('output').value;
    if (!txt) return toast('Chưa có save — bấm Ký lại trước.', 'bad');
    try { await navigator.clipboard.writeText(txt); toast('📋 Đã sao chép save.', 'good'); }
    catch (e) { $('output').select(); toast('Không tự sao chép được — Ctrl+C.', 'bad'); }
  }
  function onDownloadSave() {
    const txt = $('output').value;
    if (!txt) return toast('Chưa có save — bấm Ký lại trước.', 'bad');
    let day = 1;
    try { const o = JSON.parse(txt); const st = JSON.parse(C.b64d(o.d)); day = st.day || 1; } catch(e){}
    const d = new Date(), p2 = n => String(n).padStart(2,'0');
    const name = 'xoi-ba-tam-ngay-' + day + '-' + d.getFullYear() + p2(d.getMonth()+1) + p2(d.getDate()) + '.json';
    const blob = new Blob([txt], { type:'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    toast('💾 Đã tải ' + name, 'good');
  }
  function onWriteStorage() {
    const txt = $('output').value;
    if (!txt) return toast('Chưa có save — bấm Ký lại trước.', 'bad');
    try {
      localStorage.setItem('xoi_bt_save', txt);
      localStorage.setItem('xoi_bt_save_bak', txt);
      localStorage.setItem('xoi_fmt', '2');
      toast('💽 Đã ghi localStorage. Reload game để áp dụng.', 'good');
    } catch (e) { toast('❌ Không ghi được localStorage: ' + e.message, 'bad'); }
  }
  async function onMakeLink() {
    try {
      const s = currentState();
      const base = ($('baseUrl').value || '').trim();
      const token = await C.encodeTransfer(s);
      $('linkOut').value = (base ? base.split('#')[0] : '') + '#xoi-transfer=' + token;
      toast('🔗 Đã tạo link chuyển dữ liệu.', 'good');
    } catch (e) { toast('❌ ' + e.message, 'bad'); }
  }
  async function onCopyLink() {
    const v = $('linkOut').value;
    if (!v) return toast('Chưa có link.', 'bad');
    try { await navigator.clipboard.writeText(v); toast('📋 Đã sao chép link.', 'good'); }
    catch (e) { $('linkOut').select(); toast('Không tự chép — Ctrl+C.', 'bad'); }
  }
  function onLoadStorage() {
    try {
      const v = localStorage.getItem('xoi_bt_save') || localStorage.getItem('xoi_bt_save_bak');
      if (!v) return toast('Không thấy save trong localStorage trang này.', 'bad');
      $('input').value = v;
      toast('📥 Đã nạp save. Bấm Giải mã.', 'good');
    } catch (e) { toast('❌ ' + e.message, 'bad'); }
  }
  function onClear() {
    $('input').value = ''; $('state').value = ''; $('output').value = ''; $('linkOut').value = '';
    renderPreview(null); refreshQuickEdit(null); buildDishList(null);
    toast('🧹 Đã xoá hết.', '');
  }

  /* ---- Drop zone / file picker ---- */
  function setupDropZone() {
    const zone = $('dropZone');
    const picker = $('filePicker');
    if (!zone || !picker) return;

    zone.addEventListener('click', (e) => {
      const t = e.target;
      if (t.tagName === 'LABEL' || t.tagName === 'INPUT') return;
      picker.click();
    });
    zone.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); picker.click(); }
    });
    picker.addEventListener('change', async () => {
      const f = picker.files && picker.files[0];
      if (f) await loadFile(f);
      picker.value = '';
    });

    let dragDepth = 0;
    const setDrag = (on) => zone.classList.toggle('dragover', on);

    zone.addEventListener('dragenter', (e) => {
      e.preventDefault(); e.stopPropagation();
      dragDepth++; setDrag(true);
    });
    zone.addEventListener('dragover', (e) => {
      e.preventDefault(); e.stopPropagation();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
    });
    zone.addEventListener('dragleave', (e) => {
      e.preventDefault(); e.stopPropagation();
      dragDepth--;
      if (dragDepth <= 0) { dragDepth = 0; setDrag(false); }
    });
    zone.addEventListener('drop', async (e) => {
      e.preventDefault(); e.stopPropagation();
      dragDepth = 0; setDrag(false);

      const dt = e.dataTransfer;
      if (!dt) return;

      if (dt.files && dt.files.length) {
        if (dt.files.length > 1)
          toast('Có ' + dt.files.length + ' file — dùng file đầu tiên.', '');
        await loadFile(dt.files[0]);
        return;
      }
      const text = (dt.getData('text/plain') || dt.getData('text') || '').trim();
      if (text) {
        $('input').value = text;
        await onDecode();
      } else {
        toast('Không đọc được nội dung được thả.', 'bad');
      }
    });

    ['dragover', 'drop'].forEach(evt => {
      window.addEventListener(evt, (e) => {
        if (!zone.contains(e.target)) e.preventDefault();
      });
    });
  }

  function readFileAsText(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result || ''));
      r.onerror = () => reject(r.error || new Error('FileReader thất bại.'));
      r.onabort = () => reject(new Error('Đọc file bị huỷ.'));
      r.readAsText(file, 'utf-8');
    });
  }

  async function loadFile(file) {
    const zone = $('dropZone');
    if (zone) zone.classList.add('busy');
    try {
      if (!file) throw new Error('Không có file.');
      if (file.size === 0) throw new Error('File rỗng.');
      if (file.size > 5 * 1024 * 1024) throw new Error('File quá lớn (>5 MB).');

      const text = await readFileAsText(file);
      if (!text || !text.trim()) throw new Error('File không có nội dung đọc được.');

      $('input').value = text.trim();
      const kb = Math.max(1, Math.round(file.size / 1024));
      toast('📂 Đã nạp "' + (file.name || 'file') + '" (' + kb + ' KB)', 'good');
      await onDecode();
    } catch (e) {
      const name = e && e.name ? ' [' + e.name + ']' : '';
      toast('❌ Không đọc được file' + name + ': ' + (e.message || e), 'bad');
    } finally {
      if (zone) zone.classList.remove('busy');
    }
  }

  /* ---- Bootstrap ---- */
  document.addEventListener('DOMContentLoaded', () => {
    $('btnDecode').addEventListener('click', onDecode);
    $('btnSign').addEventListener('click', onSign);
    $('btnVerify').addEventListener('click', onVerify);
    $('btnCopySave').addEventListener('click', onCopySave);
    $('btnDownloadSave').addEventListener('click', onDownloadSave);
    $('btnWriteStorage').addEventListener('click', onWriteStorage);
    $('btnMakeLink').addEventListener('click', onMakeLink);
    $('btnCopyLink').addEventListener('click', onCopyLink);
    $('btnLoadStorage').addEventListener('click', onLoadStorage);
    $('btnClear').addEventListener('click', onClear);

    // Unlock buttons
    $('btnUnlockDishes').addEventListener('click', () => {
      const s = loadStateOrWarn(); if (!s) return;
      unlockDishes(s); saveState(s);
      toast('🍚 Đã mở tất cả ' + FULL_DISHES.length + ' món xôi.', 'good');
    });
    $('btnMaxUpg').addEventListener('click', () => {
      const s = loadStateOrWarn(); if (!s) return;
      maxUpgrades(s); saveState(s);
      toast('⬆️ Đã max nâng cấp (cấp ' + UPG_MAX + ').', 'good');
    });
    $('btnMaxAch').addEventListener('click', () => {
      const s = loadStateOrWarn(); if (!s) return;
      maxAchievements(s); saveState(s);
      toast('🏆 Đã full thành tựu.', 'good');
    });
    $('btnUnlockAll').addEventListener('click', () => {
      const s = loadStateOrWarn(); if (!s) return;
      unlockEverything(s); saveState(s);
      toast('🔓 Đã mở khoá tất cả — bấm Ký lại để lưu.', 'good');
    });

    // Quick edit fields
    for (const id of Object.keys(QE)) {
      const el = $(id);
      if (el) el.addEventListener('change', applyQuickEdit);
    }
    $('state').addEventListener('input', () => {
      try { renderPreview(JSON.parse($('state').value)); } catch (e) {}
    });
    $('state').addEventListener('change', () => {
      try {
        const s = JSON.parse($('state').value);
        refreshQuickEdit(s); renderPreview(s); buildDishList(s);
      } catch (e) { toast('JSON chưa hợp lệ.', 'bad'); }
    });

    $('btnMaxMoney').addEventListener('click', () => { $('qe_money').value = 999999999; applyQuickEdit(); });
    $('btnClearDebt').addEventListener('click', () => { $('qe_debt').value = 0; applyQuickEdit(); });
    $('btnMaxRep').addEventListener('click', () => { $('qe_rep').value = 5; applyQuickEdit(); });

    setupDropZone();
    renderPreview(null);
    refreshQuickEdit(null);
    buildDishList(null);
  });
})();