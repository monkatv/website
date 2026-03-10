(function() {
  'use strict';

  // Format numbers with locale separators
  if (window.formatNumbers) formatNumbers();

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
      var table = th.closest('table');
      var tbody = table.querySelector('tbody');
      var rows = Array.from(tbody.querySelectorAll('tr'));
      var col = th.cellIndex;
      var type = th.dataset.sort;
      var asc = th.getAttribute('data-dir') !== 'asc';

      table.querySelectorAll('th[data-sort]').forEach(function(h) {
        h.removeAttribute('data-dir');
      });
      th.setAttribute('data-dir', asc ? 'asc' : 'desc');

      rows.sort(function(a, b) {
        var va = a.cells[col].textContent.trim();
        var vb = b.cells[col].textContent.trim();
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
      var tableId = table.id;
      if (tableId && state[tableId]) {
        state[tableId].page = 0;
        applyVisibility(tableId);
      }
    });
  });

  // Defer/restore image src for hidden rows to avoid unnecessary downloads
  function deferImages(row, hide) {
    var imgs = row.querySelectorAll('img[src], img[data-src]');
    for (var i = 0; i < imgs.length; i++) {
      var img = imgs[i];
      if (hide) {
        if (img.src) {
          img.setAttribute('data-src', img.src);
          img.removeAttribute('src');
        }
      } else {
        var deferred = img.getAttribute('data-src');
        if (deferred) {
          img.src = deferred;
          img.removeAttribute('data-src');
        }
      }
    }
  }

  // Per-table state for pagination + hide-unused
  var state = {};

  function applyVisibility(tableId) {
    var table = document.getElementById(tableId);
    if (!table) return;
    var s = state[tableId];
    var pageSize = s.pageSize;
    var allRows = Array.from(table.querySelectorAll('tbody tr'));
    var visibleIdx = 0;
    var startIdx = s.page * pageSize;
    var endIdx = startIdx + pageSize;

    allRows.forEach(function(row) {
      var isZero = row.hasAttribute('data-zero') && s.hideUnused;
      if (isZero) {
        row.hidden = true;
        deferImages(row, true);
        return;
      }
      var hide = visibleIdx < startIdx || visibleIdx >= endIdx;
      row.hidden = hide;
      deferImages(row, hide);
      visibleIdx++;
    });

    renderPagination(tableId, visibleIdx);
  }

  function renderPagination(tableId, totalVisible) {
    var provider = tableId.replace('table-', '');
    var container = document.getElementById('pag-' + provider);
    if (!container) return;
    container.innerHTML = '';

    var s = state[tableId];
    var totalPages = Math.ceil(totalVisible / s.pageSize);
    if (totalPages <= 1) return;

    var info = document.createElement('span');
    info.className = 'pag-info';
    var start = s.page * s.pageSize + 1;
    var end = Math.min((s.page + 1) * s.pageSize, totalVisible);
    info.textContent = start + '\u2013' + end + ' of ' + totalVisible;
    container.appendChild(info);

    var nav = document.createElement('span');
    nav.className = 'pag-buttons';

    var prevBtn = document.createElement('button');
    prevBtn.textContent = '\u2190 Prev';
    prevBtn.disabled = s.page === 0;
    prevBtn.addEventListener('click', function() {
      if (s.page > 0) { s.page--; applyVisibility(tableId); }
    });
    nav.appendChild(prevBtn);

    // Page buttons (up to 7 with ellipsis)
    var pages = [];
    if (totalPages <= 7) {
      for (var i = 0; i < totalPages; i++) pages.push(i);
    } else {
      pages.push(0);
      var left = Math.max(1, s.page - 1);
      var right = Math.min(totalPages - 2, s.page + 1);
      if (left > 1) pages.push(-1);
      for (var i = left; i <= right; i++) pages.push(i);
      if (right < totalPages - 2) pages.push(-1);
      pages.push(totalPages - 1);
    }

    pages.forEach(function(p) {
      if (p === -1) {
        var ellip = document.createElement('span');
        ellip.className = 'pag-ellipsis';
        ellip.textContent = '\u2026';
        nav.appendChild(ellip);
      } else {
        var btn = document.createElement('button');
        btn.textContent = String(p + 1);
        if (p === s.page) btn.className = 'pag-active';
        btn.addEventListener('click', (function(page) {
          return function() { s.page = page; applyVisibility(tableId); };
        })(p));
        nav.appendChild(btn);
      }
    });

    var nextBtn = document.createElement('button');
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
    var pageSize = parseInt(table.dataset.pageSize) || 25;
    state[table.id] = { page: 0, pageSize: pageSize, hideUnused: false };
    applyVisibility(table.id);
  });

  // Shared hide-unused toggle
  var hideToggle = document.getElementById('hide-unused-toggle');
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
