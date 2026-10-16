/* UI & wiring. Phụ thuộc: XoiSig, XbtCodec, XoiCodec, UIForm (tuỳ chọn). */
(function () {
  'use strict';

  if (!window.XoiCodec) {
    document.addEventListener('DOMContentLoaded', () => {
      document.body.insertAdjacentHTML('afterbegin',
        '<div style="background:#c02323;color:#fff;padding:14px;font:14px/1.5 system-ui">' +
        '❌ Không load được <code>src/codec.js</code>. Kiểm tra đủ 5 file: ' +
        '<code>src/sig.js</code>, <code>src/xbt.js</code>, <code>src/codec.js</code>, ' +
        '<code>src/dict.js</code>, <code>src/ui-form.js</code>, <code>src/app.js</code>.' +
        '</div>');
    });
    return;
  }

  const $ = id => document.getElementById(id);
  const C = window.XoiCodec;

  /* ---- Constants ---- */
  const FULL_DISHES = [
    'doxanh','lac','gac','ladua','xeo','lacam','dauden','nepcam','mit','ga',
    'san','bap','vo','com','khuc','thit','chuoi','xoai','saurieng','patecha',
    'trungcut','lapxuong','thapcam','ngusac'
  ];
  const UPG_KEYS = ['noi','la','ghe','loa','ti','tra'];
  const UPG_MAX = 5;

  // Mức "trần" ước lượng cho 1 ngày bán — dùng để quyết định cần mấy ngày sổ sách.
  // Nếu game vẫn bắt bất thường, giảm số này xuống (VD 50_000_000) rồi thử lại.
  const CAP_PER_DAY = 100_000_000;
  const AVG_TICKET = 25_000;   // giá trung bình 1 suất, dùng để ước lượng served

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

  /* =========================================================
     CÂN BẰNG SỔ SÁCH — chạy ngầm
     Đảm bảo: money == sum(ledger[i].net)
     - Nếu money vẫn nằm trong ngưỡng ngày hiện tại → chỉ chỉnh entry cuối
     - Nếu vượt ngưỡng → tự tăng day + sinh thêm entry
     ========================================================= */
  function autoBalanceLedger(state, targetMoney) {
    if (!Number.isFinite(targetMoney) || targetMoney <= 0) return;
    if (!Array.isArray(state.ledger)) state.ledger = [];

    const currentDay = Math.max(1, state.day || 1);
    const neededDays = Math.max(1, Math.ceil(targetMoney / CAP_PER_DAY));
    const finalDay = Math.max(currentDay, neededDays);

    // --- Trường hợp 1: đủ ngày → chỉ cần chỉnh entry cuối ---
    if (finalDay === currentDay && state.ledger.length > 0) {
      const sumNet = state.ledger.reduce((a, e) => a + (e.net || 0), 0);
      const diff = targetMoney - sumNet;
      if (Math.abs(diff) < 1) { state.money = targetMoney; return; }

      const last = state.ledger[state.ledger.length - 1];
      const newNet = (last.net || 0) + diff;

      if (newNet >= 0 && newNet < CAP_PER_DAY) {
        const revenue = newNet
          + (last.cost  || 0) + (last.fee || 0) + (last.fines || 0)
          + (last.rent  || 0) + (last.tax || 0) + (last.farmIn || 0)
          - (last.tips  || 0) - (last.farmOut || 0);
        if (revenue > 0) {
          last.net     = newNet;
          last.revenue = Math.round(revenue);
          last.cash    = last.revenue + (last.tips || 0);
          state.money  = targetMoney;
          return;
        }
      }
    }

    // --- Trường hợp 2: cần sinh sổ sách mới ---
    regenerateLedger(state, finalDay, targetMoney);
  }

  function regenerateLedger(state, days, targetMoney) {
    const existing = state.ledger.slice();
    const entries = [];
    const avgNet = Math.floor(targetMoney / days);
    let runningSum = 0;
    let totalServed = 0;

    for (let d = 1; d <= days; d++) {
      let net;
      if (d === days) {
        net = targetMoney - runningSum;
      } else {
        const jitter = 1 + (Math.random() - 0.5) * 0.2;
        net = Math.round(avgNet * jitter);
      }
      runningSum += net;

      const revenue = Math.max(100_000, Math.round((net + 10_000) / 0.47));
      const tips    = Math.round(revenue * 0.02);
      const cost    = Math.round(revenue * 0.55);
      const fee     = 10_000;
      const served  = Math.max(1, Math.round(revenue / AVG_TICKET));
      totalServed  += served;

      const old = existing[d - 1];
      entries.push({
        day: d,
        revenue,
        tips,
        cost,
        fee,
        fines: 0,
        fineTax: 0, fineQltt: 0, fineTtp: 0, fineVs: 0,
        cash: revenue + tips,
        net,
        served,
        lost: old ? (old.lost || 0) : 0,
        rent: 0, tax: 0, farmIn: 0, farmOut: 0
      });
    }

    state.ledger     = entries;
    state.day        = days;
    state.money      = targetMoney;
    state.totalServed = totalServed;

    if (state.stats) {
      state.stats.served  = totalServed;
      state.stats.bestNet = Math.max.apply(null, entries.map(e => e.net));
      const dishKeys = Object.keys(state.stats.dish || {});
      if (dishKeys.length) {
        const base = Math.floor(totalServed / dishKeys.length);
        const rem  = totalServed - base * dishKeys.length;
        dishKeys.forEach((k, i) => { state.stats.dish[k] = base + (i < rem ? 1 : 0); });
      }
    }
    if (state.today) {
      state.today.day  = days;
      state.today.cost = 0;
      state.today.fee  = 0;
    }
  }

  /* ========================================================= */

  function saveState(s) {
    $('state').value = JSON.stringify(s, null, 2);
    renderPreview(s);
    refreshQuickEdit(s);
    buildDishList(s);
    if (window.UIForm) window.UIForm.refresh(s);
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

    const oldMoney = s.money;

    for (const [id,[k,t]] of Object.entries(QE)) {
      const el = $(id); if (!el) continue;
      if (t === 'b') s[k] = !!el.checked;
      else {
        const n = parseFloat(el.value);
        if (el.value === '') delete s[k];
        else if (isFinite(n)) s[k] = n;
      }
    }

    // ⚡ TỰ ĐỘNG cân bằng nếu tiền vừa đổi
    if (s.money !== oldMoney && Number.isFinite(s.money) && s.money > 0) {
      const beforeDay = s.day;
      autoBalanceLedger(s, s.money);
      if (s.day !== beforeDay) {
        toast('🔧 Tự động sinh ' + s.day + ' ngày sổ sách cho ' + fmtMoney(s.money) + '.', '');
      }
    }

    saveState(s);
  }

  /* ---- Unlock helpers ---- */
  function unlockDishes(s)      { s.unlocked = FULL_DISHES.slice(); return s; }
  function maxUpgrades(s)       { s.upg = s.upg || {}; for (const k of UPG_KEYS) s.upg[k] = UPG_MAX; return s; }
  function maxAchievements(s)   { s.ach = s.ach || {}; for (const k of Object.keys(s.ach)) s.ach[k] = 999; return s; }
  function unlockEverything(s)  {
    unlockDishes(s); maxUpgrades(s); maxAchievements(s);
    s.rep = 5; s.app = 5; s.debt = 0;
    return s;
  }

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
      if (window.UIForm) window.UIForm.refresh(r.state);

      // Thông báo cho extras.js
      window.dispatchEvent(new CustomEvent('xoi:decoded', { detail: { state: r.state } }));

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
      if (typeof s.day !== 'number' || s.day < 1) throw new Error('day phải >= 1.');

      // ⚡ Lưới an toàn: nếu vẫn lệch (do user sửa JSON tay) → tự cân bằng
      const sumNet = (s.ledger || []).reduce((a, e) => a + (e.net || 0), 0);
      if (Number.isFinite(s.money) && Math.abs(sumNet - s.money) > 0.5) {
        autoBalanceLedger(s, s.money);
        $('state').value = JSON.stringify(s, null, 2);
        renderPreview(s); refreshQuickEdit(s); buildDishList(s);
        if (window.UIForm) window.UIForm.refresh(s);
        toast('🔧 Đã tự động cân bằng sổ sách trước khi ký.', '');
      }

      $('output').value = C.encodeSave(s);
      window.dispatchEvent(new CustomEvent('xoi:signed'));
      toast('✅ Đã ký lại save JSON.', 'good');
    } catch (e) { toast('❌ ' + e.message, 'bad'); }
  }

  function onMakeXbt() {
    try {
      const s = currentState();
      if (typeof s.v !== 'number') s.v = 1;
      if (typeof s.day !== 'number' || s.day < 1)
        throw new Error('day phải là số >= 1.');
      $('output').value = C.encodeXbt(s);
      window.dispatchEvent(new CustomEvent('xoi:signed'));
      toast('📱 Đã tạo mã XBT cho app — copy rồi dán vào game.', 'good');
    } catch (e) { toast('❌ ' + e.message, 'bad'); }
  }

  function onVerify() {
    const raw = ($('output').value || $('input').value || '').trim();
    if (!raw) return toast('Chưa có gì để kiểm tra.', 'bad');
    try {
      if (raw.indexOf('XBT3') >= 0 && window.XbtCodec) {
        const r = window.XbtCodec.decode(raw);
        toast('✅ Mã XBT hợp lệ. day=' + r.state.day, 'good');
        return;
      }
      const r = C.decodeSave(raw);
      toast('✅ Chữ ký hợp lệ. day=' + r.state.day, 'good');
    } catch (e) { toast('❌ ' + e.message, 'bad'); }
  }

  async function onCopySave() {
    const txt = $('output').value;
    if (!txt) return toast('Chưa có save — bấm Ký lại trước.', 'bad');
    try { await navigator.clipboard.writeText(txt); toast('📋 Đã sao chép.', 'good'); }
    catch (e) { $('output').select(); toast('Không tự sao chép được — Ctrl+C.', 'bad'); }
  }

  function onDownloadSave() {
    const txt = $('output').value;
    if (!txt) return toast('Chưa có save — bấm Ký lại trước.', 'bad');
    let day = 1;
    try {
      const o = JSON.parse(txt);
      if (o.d) { const st = JSON.parse(C.b64d(o.d)); day = st.day || 1; }
      else if (o.state) day = o.state.day || 1;
    } catch(e){}
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
    if (window.UIForm) window.UIForm.refresh(null);

    // Thông báo cho extras.js
    window.dispatchEvent(new CustomEvent('xoi:cleared'));

    toast('🧹 Đã xoá hết.', '');
  }

  /* ============ Drop zone / file picker ============ */
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

  /* ============ Bootstrap ============ */
  document.addEventListener('DOMContentLoaded', () => {
    $('btnDecode').addEventListener('click', onDecode);
    $('btnSign').addEventListener('click', onSign);
    $('btnMakeXbt').addEventListener('click', onMakeXbt);
    $('btnVerify').addEventListener('click', onVerify);
    $('btnCopySave').addEventListener('click', onCopySave);
    $('btnDownloadSave').addEventListener('click', onDownloadSave);
    $('btnWriteStorage').addEventListener('click', onWriteStorage);
    $('btnMakeLink').addEventListener('click', onMakeLink);
    $('btnCopyLink').addEventListener('click', onCopyLink);
    $('btnLoadStorage').addEventListener('click', onLoadStorage);
    $('btnClear').addEventListener('click', onClear);

    // Unlock buttons (chỉ bind nếu tồn tại trong DOM)
    const bindIfExists = (id, fn) => { const el = $(id); if (el) el.addEventListener('click', fn); };

    bindIfExists('btnUnlockDishes', () => {
      const s = loadStateOrWarn(); if (!s) return;
      unlockDishes(s); saveState(s);
      toast('🍚 Đã mở tất cả ' + FULL_DISHES.length + ' món xôi.', 'good');
    });
    bindIfExists('btnMaxUpg', () => {
      const s = loadStateOrWarn(); if (!s) return;
      maxUpgrades(s); saveState(s);
      toast('⬆️ Đã max nâng cấp.', 'good');
    });
    bindIfExists('btnMaxAch', () => {
      const s = loadStateOrWarn(); if (!s) return;
      maxAchievements(s); saveState(s);
      toast('🏆 Đã full thành tựu.', 'good');
    });
    bindIfExists('btnUnlockAll', () => {
      const s = loadStateOrWarn(); if (!s) return;
      unlockEverything(s); saveState(s);
      toast('🔓 Đã mở khoá tất cả — bấm Ký lại để lưu.', 'good');
    });

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
        if (window.UIForm) window.UIForm.refresh(s);
      } catch (e) { toast('JSON chưa hợp lệ.', 'bad'); }
    });

    bindIfExists('btnMaxMoney', () => { $('qe_money').value = 999999999; applyQuickEdit(); });
    bindIfExists('btnClearDebt', () => { $('qe_debt').value = 0; applyQuickEdit(); });
    bindIfExists('btnMaxRep', () => { $('qe_rep').value = 5; applyQuickEdit(); });

    setupDropZone();
    renderPreview(null);
    refreshQuickEdit(null);
    if (window.UIForm) window.UIForm.refresh(null);
  });
})();