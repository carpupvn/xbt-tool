/* Form chỉnh sửa trực quan với tên tiếng Việt + bulk actions.
   Phụ thuộc: XoiDict */
(function (global) {
  'use strict';
  const D = global.XoiDict;

  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"']/g, c =>
    ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  const fmtMoney = v => Math.round(v || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');

  /* Giá gợi ý gốc của game (từ source: suggest field) */
  const BASE_PRICES = {
    doxanh: 15000, lac: 15000, gac: 20000, ladua: 15000, xeo: 20000,
    lacam: 15000, dauden: 15000, nepcam: 20000, mit: 20000, ga: 30000,
    san: 12000, bap: 15000, vo: 18000, com: 22000, khuc: 28000,
    thit: 28000, chuoi: 18000, xoai: 25000, saurieng: 30000,
    patecha: 30000, trungcut: 17000, lapxuong: 32000, thapcam: 50000, ngusac: 36000
  };

  /* Giá trị bulk input — giữ giữa các lần render */
  let lastBulkPrice = 20000;
  let lastBulkStock = 99;

  function toast(msg, kind) {
    const t = $('toast');
    if (!t) return;
    t.textContent = msg; t.className = 'toast ' + (kind || '');
    setTimeout(() => { t.className = 'toast hidden'; }, 2400);
  }

  /* Ghi thay đổi vào textarea state rồi notify app.js */
  function mutate(updater) {
    const ta = $('state');
    if (!ta || !ta.value.trim()) {
      toast('Chưa có state — bấm Giải mã trước.', 'bad');
      return;
    }
    try {
      const s = JSON.parse(ta.value);
      updater(s);
      ta.value = JSON.stringify(s, null, 2);
      ta.dispatchEvent(new Event('input'));
    } catch (e) {
      toast('❌ ' + e.message, 'bad');
    }
  }

  /* ============== Render ============== */
  let expanded = { dish: true, ing: false, upg: true, ach: false };

  function refresh(s) {
    const box = $('uiForm');
    if (!box) return;
    if (!s) {
      try { s = JSON.parse($('state').value); } catch (e) { s = null; }
    }
    if (!s) { box.innerHTML = '<p class="muted">Chưa có state — bấm Giải mã trước.</p>'; return; }

    box.innerHTML =
      sectionDishes(s) +
      sectionIngredients(s) +
      sectionUpgrades(s) +
      sectionAchievements(s);
    bindEvents();
  }

  /* ---------- Bulk action bars ---------- */
  function bulkBarDishes() {
    return `
      <div class="bulk-bar">
        <span class="bulk-lbl">💰 Set giá:</span>
        <input type="number" id="bulkDishPrice" min="0" step="1000"
               value="${lastBulkPrice}" placeholder="20000">
        <button data-bulk="dish-price-unlocked" class="mini" type="button">Món đã mở</button>
        <button data-bulk="dish-price-all" class="mini" type="button">Tất cả</button>
        <button data-bulk="dish-price-reset" class="mini" type="button">Về giá gốc</button>
      </div>`;
  }
  function bulkBarIngredients() {
    return `
      <div class="bulk-bar">
        <span class="bulk-lbl">📦 Set kho:</span>
        <input type="number" id="bulkStock" min="0" step="1"
               value="${lastBulkStock}" placeholder="99">
        <button data-bulk="stock-apply" class="mini" type="button">Áp dụng tất cả</button>
        <button data-bulk="stock-max" class="mini" type="button">Max (99)</button>
        <button data-bulk="stock-zero" class="mini" type="button">Về 0</button>
      </div>`;
  }
  function bulkBarUpgrades() {
    return `
      <div class="bulk-bar">
        <span class="bulk-lbl">⬆️ Nâng cấp:</span>
        <button data-bulk="upg-max" class="mini" type="button">Max tất cả (5)</button>
        <button data-bulk="upg-zero" class="mini" type="button">Về 0</button>
      </div>`;
  }
  function bulkBarAchievements() {
    return `
      <div class="bulk-bar">
        <span class="bulk-lbl">🏆 Thành tựu:</span>
        <button data-bulk="ach-unlock" class="mini" type="button">Mở khoá (=1)</button>
        <button data-bulk="ach-full" class="mini" type="button">Full (999)</button>
        <button data-bulk="ach-zero" class="mini" type="button">Xoá hết</button>
      </div>`;
  }

  /* ---------- Sections ---------- */
  function sectionDishes(s) {
    const unlocked = new Set(s.unlocked || []);
    const cooked = s.cooked || {};
    const prices = s.prices || {};
    const rows = Object.keys(D.DISH).map(k => {
      const on = unlocked.has(k);
      const price = prices[k] || 0;
      const made = cooked[k] || 0;
      return `
        <div class="dish-row${on ? ' on' : ''}">
          <label class="dish-chk">
            <input type="checkbox" data-dish="${k}"${on ? ' checked' : ''}>
            <b>${esc(D.DISH[k])}</b>
          </label>
          <label class="dish-input">
            <span>Giá bán</span>
            <input type="number" min="0" step="1000" data-price="${k}" value="${price}">
          </label>
          <label class="dish-input">
            <span>Đã nấu</span>
            <input type="number" min="0" step="1" data-cooked="${k}" value="${made}">
          </label>
        </div>`;
    }).join('');
    return detailsWrap('dish', '🍚 Món xôi',
      'Bật/tắt món đã mở khoá · chỉnh giá · số phần đã nấu',
      bulkBarDishes() + rows);
  }

  function sectionIngredients(s) {
    const stock = s.stock || {};
    const rows = Object.keys(D.ING).map(k => `
      <label class="ing-cell">
        <span>${esc(D.ING[k])}</span>
        <input type="number" min="0" step="1" data-stock="${k}" value="${stock[k] || 0}">
      </label>`).join('');
    return detailsWrap('ing', '📦 Kho nguyên liệu',
      'Số lượng trong kho (0 = hết)',
      bulkBarIngredients() + `<div class="ing-grid">${rows}</div>`);
  }

  function sectionUpgrades(s) {
    const upg = s.upg || {};
    const rows = Object.keys(D.UPG).map(k => {
      const lv = upg[k] || 0;
      return `
        <div class="upg-row">
          <b>${esc(D.UPG[k])}</b>
          <div class="upg-stepper">
            <button data-upg-dec="${k}" type="button">−</button>
            <input type="number" min="0" max="5" step="1" data-upg="${k}" value="${lv}">
            <button data-upg-inc="${k}" type="button">+</button>
          </div>
        </div>`;
    }).join('');

    const stats = s.stats || {};
    const statsBox = `
      <div class="stat-pills">
        ${Object.keys(D.STAT).map(k => {
          const v = stats[k];
          if (v == null) return '';
          const isMoney = /Net$/.test(k);
          const display = isMoney ? fmtMoney(v) + 'đ' : v;
          return `<span class="stat-pill">${esc(D.STAT[k])}: <b>${display}</b></span>`;
        }).join('')}
      </div>`;
    return detailsWrap('upg', '⬆️ Nâng cấp & Thống kê',
      'Cấp đồ nghề (0-5) và số liệu tổng',
      bulkBarUpgrades() + rows + statsBox);
  }

  function sectionAchievements(s) {
    const ach = s.ach || {};
    const rows = Object.keys(D.ACH).map(k => {
      const v = ach[k] || 0;
      const on = v > 0;
      return `
        <div class="ach-row${on ? ' on' : ''}">
          <label>
            <input type="checkbox" data-ach-on="${k}"${on ? ' checked' : ''}>
            <b>${esc(D.ACH[k])}</b>
          </label>
          <input type="number" min="0" step="1" data-ach="${k}" value="${v}">
        </div>`;
    }).join('');
    return detailsWrap('ach', '🏆 Thành tựu',
      'Mở khoá thành tựu (giá trị đặt >0)',
      bulkBarAchievements() + `<div class="ach-grid">${rows}</div>`);
  }

  function detailsWrap(id, title, hint, content) {
    return `
      <details class="ui-sec" ${expanded[id] ? 'open' : ''} data-sec="${id}">
        <summary><span class="ui-sec-title">${title}</span>
          <span class="ui-sec-hint">${esc(hint)}</span>
        </summary>
        <div class="ui-sec-body">${content}</div>
      </details>`;
  }

  /* ============== Bulk handlers ============== */
  function runBulk(action) {
    // Lưu giá trị bulk trước khi re-render
    const priceEl = $('bulkDishPrice');
    if (priceEl) lastBulkPrice = parseInt(priceEl.value, 10) || 0;
    const stockEl = $('bulkStock');
    if (stockEl) lastBulkStock = parseInt(stockEl.value, 10) || 0;

    let msg = '';
    mutate(s => {
      switch (action) {
        /* ----- Món xôi ----- */
        case 'dish-price-unlocked': {
          s.prices = s.prices || {};
          const list = s.unlocked || [];
          list.forEach(k => { s.prices[k] = lastBulkPrice; });
          msg = '💰 Đã set giá ' + fmtMoney(lastBulkPrice) + ' cho ' + list.length + ' món đã mở.';
          break;
        }
        case 'dish-price-all': {
          s.prices = s.prices || {};
          Object.keys(D.DISH).forEach(k => { s.prices[k] = lastBulkPrice; });
          msg = '💰 Đã set giá ' + fmtMoney(lastBulkPrice) + ' cho tất cả ' + Object.keys(D.DISH).length + ' món.';
          break;
        }
        case 'dish-price-reset': {
          s.prices = s.prices || {};
          let n = 0;
          Object.keys(BASE_PRICES).forEach(k => {
            if (s.prices[k] !== BASE_PRICES[k]) { s.prices[k] = BASE_PRICES[k]; n++; }
          });
          msg = '↺ Đã reset ' + n + ' món về giá gốc của game.';
          break;
        }

        /* ----- Kho ----- */
        case 'stock-apply': {
          s.stock = s.stock || {};
          Object.keys(D.ING).forEach(k => { s.stock[k] = lastBulkStock; });
          msg = '📦 Đã set kho = ' + lastBulkStock + ' cho tất cả ' + Object.keys(D.ING).length + ' loại.';
          break;
        }
        case 'stock-max': {
          s.stock = s.stock || {};
          Object.keys(D.ING).forEach(k => { s.stock[k] = 99; });
          msg = '📦 Đã set kho = 99 cho tất cả.';
          break;
        }
        case 'stock-zero': {
          s.stock = s.stock || {};
          Object.keys(D.ING).forEach(k => { s.stock[k] = 0; });
          msg = '📦 Đã xoá sạch kho.';
          break;
        }

        /* ----- Nâng cấp ----- */
        case 'upg-max': {
          s.upg = s.upg || {};
          Object.keys(D.UPG).forEach(k => { s.upg[k] = 5; });
          msg = '⬆️ Đã max tất cả nâng cấp.';
          break;
        }
        case 'upg-zero': {
          s.upg = s.upg || {};
          Object.keys(D.UPG).forEach(k => { s.upg[k] = 0; });
          msg = '↺ Đã reset nâng cấp về 0.';
          break;
        }

        /* ----- Thành tựu ----- */
        case 'ach-unlock': {
          s.ach = s.ach || {};
          Object.keys(D.ACH).forEach(k => { s.ach[k] = 1; });
          msg = '🏆 Đã mở khoá tất cả thành tựu (=1).';
          break;
        }
        case 'ach-full': {
          s.ach = s.ach || {};
          Object.keys(D.ACH).forEach(k => { s.ach[k] = 999; });
          msg = '🏆 Đã set tất cả thành tựu = 999.';
          break;
        }
        case 'ach-zero': {
          s.ach = s.ach || {};
          Object.keys(D.ACH).forEach(k => { delete s.ach[k]; });
          msg = '↺ Đã xoá hết thành tựu.';
          break;
        }
      }
    });
    if (msg) toast(msg, 'good');
    refresh();
  }

  /* ============== Events ============== */
  function bindEvents() {
    const box = $('uiForm');
    if (!box) return;

    /* Giữ expanded state */
    box.querySelectorAll('details.ui-sec').forEach(el => {
      el.addEventListener('toggle', () => { expanded[el.dataset.sec] = el.open; });
    });

    /* Lưu giá trị bulk input */
    const bulkPrice = box.querySelector('#bulkDishPrice');
    if (bulkPrice) bulkPrice.addEventListener('input', () => {
      lastBulkPrice = parseInt(bulkPrice.value, 10) || 0;
    });
    const bulkStock = box.querySelector('#bulkStock');
    if (bulkStock) bulkStock.addEventListener('input', () => {
      lastBulkStock = parseInt(bulkStock.value, 10) || 0;
    });

    /* Bulk action buttons */
    box.querySelectorAll('[data-bulk]').forEach(el => {
      el.addEventListener('click', () => runBulk(el.dataset.bulk));
    });

    /* Unlocked checkbox */
    box.querySelectorAll('[data-dish]').forEach(el => {
      el.addEventListener('change', () => {
        const k = el.dataset.dish, on = el.checked;
        mutate(s => {
          if (!Array.isArray(s.unlocked)) s.unlocked = [];
          if (on && !s.unlocked.includes(k)) s.unlocked.push(k);
          if (!on) s.unlocked = s.unlocked.filter(x => x !== k);
        });
        refresh();
      });
    });

    /* Giá bán */
    box.querySelectorAll('[data-price]').forEach(el => {
      el.addEventListener('change', () => {
        const k = el.dataset.price, v = parseInt(el.value, 10) || 0;
        mutate(s => { s.prices = s.prices || {}; s.prices[k] = v; });
      });
    });

    /* Đã nấu */
    box.querySelectorAll('[data-cooked]').forEach(el => {
      el.addEventListener('change', () => {
        const k = el.dataset.cooked, v = parseInt(el.value, 10) || 0;
        mutate(s => {
          s.cooked = s.cooked || {};
          if (v > 0) s.cooked[k] = v; else delete s.cooked[k];
        });
      });
    });

    /* Kho nguyên liệu */
    box.querySelectorAll('[data-stock]').forEach(el => {
      el.addEventListener('change', () => {
        const k = el.dataset.stock, v = parseInt(el.value, 10) || 0;
        mutate(s => { s.stock = s.stock || {}; s.stock[k] = v; });
      });
    });

    /* Nâng cấp */
    box.querySelectorAll('[data-upg]').forEach(el => {
      el.addEventListener('change', () => {
        const k = el.dataset.upg, v = Math.max(0, Math.min(5, parseInt(el.value, 10) || 0));
        mutate(s => { s.upg = s.upg || {}; s.upg[k] = v; });
        refresh();
      });
    });
    box.querySelectorAll('[data-upg-inc]').forEach(el => {
      el.addEventListener('click', () => {
        const k = el.dataset.upgInc;
        mutate(s => {
          s.upg = s.upg || {};
          s.upg[k] = Math.min(5, (s.upg[k] || 0) + 1);
        });
        refresh();
      });
    });
    box.querySelectorAll('[data-upg-dec]').forEach(el => {
      el.addEventListener('click', () => {
        const k = el.dataset.upgDec;
        mutate(s => {
          s.upg = s.upg || {};
          s.upg[k] = Math.max(0, (s.upg[k] || 0) - 1);
        });
        refresh();
      });
    });

    /* Thành tựu */
    box.querySelectorAll('[data-ach]').forEach(el => {
      el.addEventListener('change', () => {
        const k = el.dataset.ach, v = Math.max(0, parseInt(el.value, 10) || 0);
        mutate(s => {
          s.ach = s.ach || {};
          if (v > 0) s.ach[k] = v; else delete s.ach[k];
        });
      });
    });
    box.querySelectorAll('[data-ach-on]').forEach(el => {
      el.addEventListener('change', () => {
        const k = el.dataset.achOn, on = el.checked;
        mutate(s => {
          s.ach = s.ach || {};
          if (on && !(s.ach[k] > 0)) s.ach[k] = 1;
          if (!on) delete s.ach[k];
        });
        refresh();
      });
    });
  }

  global.UIForm = { refresh };
})(window);