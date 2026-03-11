(function() {
  'use strict';

  // Tab switching
  document.querySelectorAll('.tab-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      btn.closest('.tab-nav').querySelectorAll('.tab-btn').forEach(function(b) {
        b.classList.remove('active');
        b.setAttribute('aria-selected', 'false');
      });
      btn.classList.add('active');
      btn.setAttribute('aria-selected', 'true');

      document.querySelectorAll('.tab-panel').forEach(function(p) {
        p.classList.remove('active');
      });
      document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
    });
  });

  // Table sorting
  document.querySelectorAll('th[data-sort]').forEach(function(th) {
    th.addEventListener('click', function() {
      const table = th.closest('table');
      const tbody = table.querySelector('tbody');
      const rows = Array.from(tbody.querySelectorAll('tr'));
      const col = th.cellIndex;
      const type = th.dataset.sort;
      const asc = th.getAttribute('data-dir') !== 'asc';

      table.querySelectorAll('th[data-sort]').forEach(function(h) {
        h.removeAttribute('data-dir');
      });
      th.setAttribute('data-dir', asc ? 'asc' : 'desc');

      rows.sort(function(a, b) {
        let va = a.cells[col].textContent.trim();
        let vb = b.cells[col].textContent.trim();
        if (type === 'num') {
          va = parseInt(va.replace(/,/g, '')) || 0;
          vb = parseInt(vb.replace(/,/g, '')) || 0;
        } else {
          va = va.toLowerCase();
          vb = vb.toLowerCase();
        }
        if (va < vb) return asc ? -1 : 1;
        if (va > vb) return asc ? 1 : -1;
        return 0;
      });

      rows.forEach(function(row) { tbody.appendChild(row); });

      // Re-apply pagination after sort
      const tableId = table.id;
      if (tableId && state[tableId]) {
        state[tableId].page = 0;
        applyVisibility(tableId);
      }
    });
  });

  // Defer/restore image src for hidden rows to avoid unnecessary downloads
  function deferImages(row, hide) {
    const imgs = row.querySelectorAll('img[src], img[data-src]');
    for (let i = 0; i < imgs.length; i++) {
      const img = imgs[i];
      if (hide) {
        if (img.src) {
          img.setAttribute('data-src', img.src);
          img.removeAttribute('src');
        }
      } else {
        const deferred = img.getAttribute('data-src');
        if (deferred) {
          img.src = deferred;
          img.removeAttribute('data-src');
        }
      }
    }
  }

  // Per-table state for pagination + hide-unused
  const state = {};

  function applyVisibility(tableId) {
    const table = document.getElementById(tableId);
    if (!table) return;
    const s = state[tableId];
    const pageSize = s.pageSize;
    const allRows = Array.from(table.querySelectorAll('tbody tr'));
    let visibleIdx = 0;
    const startIdx = s.page * pageSize;
    const endIdx = startIdx + pageSize;

    allRows.forEach(function(row) {
      const isZero = row.hasAttribute('data-zero') && s.hideUnused;
      if (isZero) {
        row.hidden = true;
        deferImages(row, true);
        return;
      }
      const hide = visibleIdx < startIdx || visibleIdx >= endIdx;
      row.hidden = hide;
      deferImages(row, hide);
      visibleIdx++;
    });

    renderPagination(tableId, visibleIdx);
  }

  function renderPagination(tableId, totalVisible) {
    const provider = tableId.replace('table-', '');
    const container = document.getElementById('pag-' + provider);
    if (!container) return;
    container.innerHTML = '';

    const s = state[tableId];
    const totalPages = Math.ceil(totalVisible / s.pageSize);
    if (totalPages <= 1) return;

    const info = document.createElement('span');
    info.className = 'pag-info';
    const start = s.page * s.pageSize + 1;
    const end = Math.min((s.page + 1) * s.pageSize, totalVisible);
    info.textContent = start + '\u2013' + end + ' of ' + totalVisible;
    container.appendChild(info);

    const nav = document.createElement('span');
    nav.className = 'pag-buttons';

    const prevBtn = document.createElement('button');
    prevBtn.textContent = '\u2190 Prev';
    prevBtn.disabled = s.page === 0;
    prevBtn.addEventListener('click', function() {
      if (s.page > 0) { s.page--; applyVisibility(tableId); }
    });
    nav.appendChild(prevBtn);

    // Page buttons (up to 7 with ellipsis)
    const pages = [];
    if (totalPages <= 7) {
      for (let i = 0; i < totalPages; i++) pages.push(i);
    } else {
      pages.push(0);
      const left = Math.max(1, s.page - 1);
      const right = Math.min(totalPages - 2, s.page + 1);
      if (left > 1) pages.push(-1);
      for (let i = left; i <= right; i++) pages.push(i);
      if (right < totalPages - 2) pages.push(-1);
      pages.push(totalPages - 1);
    }

    pages.forEach(function(p) {
      if (p === -1) {
        const ellip = document.createElement('span');
        ellip.className = 'pag-ellipsis';
        ellip.textContent = '\u2026';
        nav.appendChild(ellip);
      } else {
        const btn = document.createElement('button');
        btn.textContent = String(p + 1);
        if (p === s.page) btn.className = 'pag-active';
        btn.addEventListener('click', function() { s.page = p; applyVisibility(tableId); });
        nav.appendChild(btn);
      }
    });

    const nextBtn = document.createElement('button');
    nextBtn.textContent = 'Next \u2192';
    nextBtn.disabled = s.page >= totalPages - 1;
    nextBtn.addEventListener('click', function() {
      if (s.page < totalPages - 1) { s.page++; applyVisibility(tableId); }
    });
    nav.appendChild(nextBtn);

    container.appendChild(nav);
  }

  // Initialize paginated tables
  document.querySelectorAll('table[data-page-size]').forEach(function(table) {
    const pageSize = parseInt(table.dataset.pageSize) || 25;
    state[table.id] = { page: 0, pageSize: pageSize, hideUnused: false };
    applyVisibility(table.id);
  });

  // Shared hide-unused toggle
  const hideToggle = document.getElementById('hide-unused-toggle');
  if (hideToggle) {
    hideToggle.addEventListener('change', function() {
      Object.keys(state).forEach(function(tableId) {
        state[tableId].hideUnused = hideToggle.checked;
        state[tableId].page = 0;
        applyVisibility(tableId);
      });
    });
  }
})();
