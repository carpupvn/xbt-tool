/* ============================================================================
   UX ENHANCEMENTS — tất cả tính năng UX bổ sung.
   Chỉ hook vào app.js qua custom events + DOM, KHÔNG sửa code cũ.
   ============================================================================ */
(function () {
  'use strict';

  const $ = id => document.getElementById(id);

  let snapshot = null;   // state JSON lúc decode (dạng string pretty)
  let hasState = false;  // đã decode thành công chưa
  let dirty    = false;  // đã sửa mà chưa ký

  /* ---------- Inject sticky action bar ---------- */
  const bar = document.createElement('div');
  bar.id = 'stickyActions';
  bar.className = 'sticky-actions';
  bar.innerHTML = `
    <button id="saSign" class="primary">✍️ Ký lại</button>
    <button id="saXbt">📱 Tạo XBT</button>
    <button id="saCopy">📋 Copy</button>
    <span class="sa-hint">Ctrl+S</span>
  `;
  document.body.appendChild(bar);

  /* ---------- Inject dirty banner ---------- */
  const banner = document.createElement('div');
  banner.id = 'dirtyBanner';
  banner.className = 'dirty-banner';
  banner.innerHTML = '⚠️ <b>Có thay đổi chưa ký</b> — bấm Ký lại trước khi đóng trang';
  document.body.appendChild(banner);

  /* ---------- Helpers ---------- */
  function setDirty(v) {
    if (dirty === v) return;
    dirty = v;
    const b = $('dirtyBanner');
    if (b) b.classList.toggle('show', v);
    setStatus();
  }

  function setStatus() {
    const el = $('saveStatus');
    if (!el) return;
    if (!hasState) {
      el.className = 'save-status';
      el.textContent = 'Chưa có state';
      return;
    }
    if (dirty) {
      el.className = 'save-status dirty';
      el.textContent = 'Có thay đổi chưa ký';
    } else {
      el.className = 'save-status signed';
      el.textContent = 'Đã ký — sẵn sàng copy';
    }
  }

  function charCount(textarea) {
    const el = document.createElement('div');
    el.className = 'char-count';
    textarea.parentNode.insertBefore(el, textarea.nextSibling);
    const update = () => {
      const n = textarea.value.length;
      el.textContent = n.toLocaleString('vi-VN') + ' ký tự';
    };
    textarea.addEventListener('input', update);
    update();
    return update;
  }

  /* ---------- Bootstrap ---------- */
  document.addEventListener('DOMContentLoaded', () => {
    const inputTa  = $('input');
    const outputTa = $('output');
    const stateTa  = $('state');

    /* ---------- Character counters ---------- */
    const refreshInputCount  = inputTa  ? charCount(inputTa)  : null;
    const refreshOutputCount = outputTa ? charCount(outputTa) : null;

    /* ---------- Sticky bar wiring ---------- */
    $('saSign').addEventListener('click', () => $('btnSign').click());
    $('saXbt').addEventListener('click',  () => $('btnMakeXbt').click());
    $('saCopy').addEventListener('click', () => $('btnCopySave').click());

    /* ---------- Snapshot reset button ---------- */
    if (stateTa) {
      const wrap = stateTa.closest('.quick-edit') || stateTa.parentNode;
      const row = document.createElement('div');
      row.className = 'snapshot-row';
      row.innerHTML = '<button class="btn-reset" id="btnResetState" ' +
        'title="Khôi phục state về bản vừa giải mã (huỷ mọi thay đổi)">' +
        '↺ Khôi phục bản gốc</button>';
      wrap.appendChild(row);

      $('btnResetState').addEventListener('click', () => {
        if (!snapshot) return;
        stateTa.value = snapshot;
        stateTa.dispatchEvent(new Event('change'));
        setDirty(false);
        showToast('↺ Đã khôi phục state về bản vừa giải mã');
      });
    }

    /* ---------- Dirty tracking ---------- */
    if (stateTa) {
      stateTa.addEventListener('input', () => {
        if (!hasState) return;
        // Nếu text khớp snapshot → coi như sạch
        if (stateTa.value.trim() === snapshot) setDirty(false);
        else setDirty(true);
      });
    }

    /* ---------- Lắng nghe event từ app.js ---------- */
    window.addEventListener('xoi:decoded', (e) => {
      hasState = true;
      snapshot = JSON.stringify(e.detail.state, null, 2);
      setDirty(false);
      setStatus();
    });
    window.addEventListener('xoi:signed', () => {
      setDirty(false);
      setStatus();
      if (refreshOutputCount) refreshOutputCount();
    });
    window.addEventListener('xoi:cleared', () => {
      hasState = false;
      snapshot = null;
      setDirty(false);
      setStatus();
    });

    /* ---------- Keyboard shortcuts ---------- */
    document.addEventListener('keydown', (e) => {
      const ctrl = e.ctrlKey || e.metaKey;
      if (!ctrl) return;

      // Ctrl+Enter → Giải mã
      if (e.key === 'Enter') {
        e.preventDefault();
        $('btnDecode').click();
        return;
      }
      // Ctrl+S / Ctrl+Shift+S
      if (e.key === 's' || e.key === 'S') {
        e.preventDefault();
        if (e.shiftKey) $('btnMakeXbt').click();
        else $('btnSign').click();
        return;
      }
      // Ctrl+K → Copy save
      if (e.key === 'k' || e.key === 'K') {
        e.preventDefault();
        $('btnCopySave').click();
        return;
      }
      // Ctrl+D → Tải file
      if (e.key === 'd' || e.key === 'D') {
        e.preventDefault();
        $('btnDownloadSave').click();
        return;
      }
    });

    /* ---------- Cảnh báo trước khi rời trang ---------- */
    window.addEventListener('beforeunload', (e) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = '';
        return '';
      }
    });

    /* ---------- Sticky bar hiện/ẩn theo scroll ---------- */
    const cards = document.querySelectorAll('.card');
    const step3 = cards[2]; // card thứ 3 = "Ký lại & lấy save"
    if (step3 && 'IntersectionObserver' in window) {
      const io = new IntersectionObserver((entries) => {
        entries.forEach(en => {
          if (!hasState) return;
          if (en.isIntersecting) bar.classList.add('show');
          else {
            // Vẫn hiện nếu user còn đang ở card 4/5 (muốn copy)
            const bottom = document.documentElement.scrollHeight - window.scrollY - window.innerHeight;
            if (bottom > 200) bar.classList.remove('show');
          }
        });
      }, { rootMargin: '-80px 0px 0px 0px' });
      io.observe(step3);
    }

    /* ---------- Toast helper (tái dùng DOM có sẵn của app.js) ---------- */
    function showToast(msg) {
      const t = $('toast');
      if (!t) return;
      t.textContent = msg;
      t.className = 'toast';
      clearTimeout(showToast._t);
      showToast._t = setTimeout(() => { t.className = 'toast hidden'; }, 2600);
    }

    setStatus();
  });
})();