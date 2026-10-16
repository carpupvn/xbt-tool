/* Form chỉnh sửa trực quan với tên tiếng Việt.
   Phụ thuộc: XoiDict */
(function (global) {
  'use strict';
  const D = global.XoiDict;

  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"']/g, c =>
    ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  const fmtMoney = v => Math.round(v || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');

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
    return detailsWrap('dish', '🍚 Món xôi', 'Bật/tắt món đã mở khoá · chỉnh giá · số phần đã nấu', rows);
  }

  function sectionIngredients(s) {
    const stock = s.stock || {};
    const rows = Object.keys(D.ING).map(k => `
      <label class="ing-cell">
        <span>${esc(D.ING[k])}</span>
        <input type="number" min="0" step="1" data-stock="${k}" value="${stock[k] || 0}">
      </label>`).join('');
    return detailsWrap('ing', '📦 Kho nguyên liệu', 'Số lượng trong kho (0 = hết)', `<div class="ing-grid">${rows}</div>`);
  }

  function sectionUpgrades(s) {
    const upg = s.upg || {};
    const rows = Object.keys(D.UPG).map(k => {
      const lv = upg[k] || 0;
      return `
        <div class="upg-row">
          <b>${esc(D.UPG[k])}</b>
          <div class="upg-stepper">
            <button data-upg-dec="${k}">−</button>
            <input type="number" min="0" max="5" step="1" data-upg="${k}" value="${lv}">
            <button data-upg-inc="${k}">+</button>
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
    return detailsWrap('upg', '⬆️ Nâng cấp & Thống kê', 'Cấp đồ nghề (0-5) và số liệu tổng', rows + statsBox);
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
    return detailsWrap('ach', '🏆 Thành tựu', 'Mở khoá thành tựu (giá trị đặt >0)', `<div class="ach-grid">${rows}</div>`);
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

  /* ============== Events ============== */
  function bindEvents() {
    const box = $('uiForm');
    if (!box) return;

    box.querySelectorAll('details.ui-sec').forEach(el => {
      el.addEventListener('toggle', () => { expanded[el.dataset.sec] = el.open; });
    });

    // Unlocked checkbox
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

    // Giá bán
    box.querySelectorAll('[data-price]').forEach(el => {
      el.addEventListener('change', () => {
        const k = el.dataset.price, v = parseInt(el.value, 10) || 0;
        mutate(s => { s.prices = s.prices || {}; s.prices[k] = v; });
      });
    });

    // Đã nấu
    box.querySelectorAll('[data-cooked]').forEach(el => {
      el.addEventListener('change', () => {
        const k = el.dataset.cooked, v = parseInt(el.value, 10) || 0;
        mutate(s => {
          s.cooked = s.cooked || {};
          if (v > 0) s.cooked[k] = v; else delete s.cooked[k];
        });
      });
    });

    // Kho nguyên liệu
    box.querySelectorAll('[data-stock]').forEach(el => {
      el.addEventListener('change', () => {
        const k = el.dataset.stock, v = parseInt(el.value, 10) || 0;
        mutate(s => { s.stock = s.stock || {}; s.stock[k] = v; });
      });
    });

    // Nâng cấp
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

    // Thành tựu
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