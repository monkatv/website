(function() {
  'use strict';

  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const MONTH_FULL = ['January', 'February', 'March', 'April', 'May', 'June',
                      'July', 'August', 'September', 'October', 'November', 'December'];
  const DOW = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

  const chevron = d => '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="' + d + '"/></svg>';

  let container, streamer, weekEnds, emptyWeeks;
  let view = 'month';
  let curYear, curMonth, yearRangeStart;
  const weeksByMonth = {};
  const weeksByYear = {};

  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function dateStr(y, m, d) { return y + '-' + pad(m) + '-' + pad(d); }
  function daysInMonth(y, m) { return new Date(y, m, 0).getDate(); }
  function dayOfWeek(y, m, d) {
    return (new Date(y, m - 1, d).getDay() + 6) % 7; // 0=Mon, 6=Sun
  }

  function addDays(y, m, d, n) {
    const dt = new Date(y, m - 1, d + n);
    return { y: dt.getFullYear(), m: dt.getMonth() + 1, d: dt.getDate() };
  }

  function calHeader(title, isStatic) {
    const header = document.createElement('div');
    header.className = 'cal-header';
    header.innerHTML =
      '<button class="cal-nav" data-action="prev" aria-label="Previous">' + chevron('M10 3L5 8L10 13') + '</button>' +
      (isStatic ? '<span class="cal-title cal-title-static">' + title + '</span>'
                : '<button class="cal-title" data-action="up">' + title + '</button>') +
      '<button class="cal-nav" data-action="next" aria-label="Next">' + chevron('M6 3L11 8L6 13') + '</button>';
    return header;
  }

  function render() {
    if (view === 'month') renderMonth();
    else if (view === 'months') renderMonths();
    else renderYears();
  }

  function renderMonth() {
    const frag = document.createDocumentFragment();
    frag.appendChild(calHeader(MONTH_FULL[curMonth - 1] + ' ' + curYear, false));

    const dowRow = document.createElement('div');
    dowRow.className = 'cal-dow-row';
    DOW.forEach(function(d) {
      const span = document.createElement('span');
      span.textContent = d;
      dowRow.appendChild(span);
    });
    frag.appendChild(dowRow);

    const firstDow = dayOfWeek(curYear, curMonth, 1);
    const start = addDays(curYear, curMonth, 1, -firstDow);

    const today = new Date();
    const todayY = today.getFullYear(), todayM = today.getMonth() + 1, todayD = today.getDate();

    const body = document.createElement('div');
    body.className = 'cal-body';

    for (let row = 0; row < 6; row++) {
      const days = [];
      let sundayStr = null;

      for (let col = 0; col < 7; col++) {
        const cell = addDays(start.y, start.m, start.d, row * 7 + col);
        days.push(cell);
        if (col === 6) sundayStr = dateStr(cell.y, cell.m, cell.d);
      }

      // Skip row if entirely outside current month
      if (days[0].m !== curMonth && days[6].m !== curMonth) continue;

      const hasData = weekEnds.has(sundayStr);
      const isEmpty = emptyWeeks.has(sundayStr);

      let weekEl;
      if (hasData) {
        weekEl = document.createElement('a');
        weekEl.className = isEmpty ? 'cal-week cal-has-data cal-empty-week' : 'cal-week cal-has-data';
        weekEl.href = '/' + streamer + '/' + sundayStr + '/';
      } else {
        weekEl = document.createElement('div');
        weekEl.className = 'cal-week';
      }

      days.forEach(function(cell) {
        const span = document.createElement('span');
        let cls = 'cal-day';
        if (cell.m !== curMonth) cls += ' cal-other';
        if (cell.y === todayY && cell.m === todayM && cell.d === todayD) cls += ' cal-today';
        span.className = cls;
        span.textContent = cell.d;
        weekEl.appendChild(span);
      });

      body.appendChild(weekEl);
    }
    frag.appendChild(body);

    container.replaceChildren(frag);
  }

  function renderMonths() {
    const frag = document.createDocumentFragment();
    frag.appendChild(calHeader('' + curYear, false));

    const grid = document.createElement('div');
    grid.className = 'cal-cell-grid';
    for (let m = 1; m <= 12; m++) {
      const ym = curYear + '-' + pad(m);
      const hasData = !!weeksByMonth[ym];
      const btn = document.createElement('button');
      btn.className = hasData ? 'cal-cell cal-has-data' : 'cal-cell';
      btn.dataset.action = 'month';
      btn.dataset.month = String(m);
      btn.textContent = MONTHS[m - 1];
      grid.appendChild(btn);
    }
    frag.appendChild(grid);

    container.replaceChildren(frag);
  }

  function renderYears() {
    if (!yearRangeStart) yearRangeStart = curYear - curYear % 10 - 1;
    const rangeEnd = yearRangeStart + 11;

    const frag = document.createDocumentFragment();
    frag.appendChild(calHeader(yearRangeStart + ' – ' + rangeEnd, true));

    const grid = document.createElement('div');
    grid.className = 'cal-cell-grid';
    for (let y = yearRangeStart; y <= rangeEnd; y++) {
      const hasData = !!weeksByYear['' + y];
      const btn = document.createElement('button');
      btn.className = hasData ? 'cal-cell cal-has-data' : 'cal-cell';
      btn.dataset.action = 'year';
      btn.dataset.year = String(y);
      btn.textContent = '' + y;
      grid.appendChild(btn);
    }
    frag.appendChild(grid);

    container.replaceChildren(frag);
  }

  function onNav(e) {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    e.preventDefault();
    const action = el.dataset.action;

    if (action === 'prev') {
      if (view === 'month') { curMonth--; if (curMonth < 1) { curMonth = 12; curYear--; } }
      else if (view === 'months') { curYear--; }
      else { yearRangeStart -= 12; }
    } else if (action === 'next') {
      if (view === 'month') { curMonth++; if (curMonth > 12) { curMonth = 1; curYear++; } }
      else if (view === 'months') { curYear++; }
      else { yearRangeStart += 12; }
    } else if (action === 'up') {
      if (view === 'month') { view = 'months'; }
      else if (view === 'months') { view = 'years'; yearRangeStart = curYear - curYear % 10 - 1; }
    } else if (action === 'month') {
      curMonth = parseInt(el.dataset.month);
      view = 'month';
    } else if (action === 'year') {
      curYear = parseInt(el.dataset.year);
      view = 'months';
    }

    render();
    const focusTarget = container.querySelector('[data-action="' + action + '"]');
    if (focusTarget) focusTarget.focus();
  }

  window.initWeeksCalendar = function(el, weeks, streamerLogin) {
    container = el;
    container.addEventListener('click', onNav);
    streamer = streamerLogin;
    weekEnds = new Set();
    emptyWeeks = new Set();

    weeks.forEach(function(w) {
      weekEnds.add(w.end_date);
      if (w.vod_count === 0) emptyWeeks.add(w.end_date);
      const ym = w.end_date.substring(0, 7);
      weeksByMonth[ym] = true;
      weeksByYear[w.end_date.substring(0, 4)] = true;
    });

    if (weeks.length > 0) {
      const latest = weeks[weeks.length - 1].end_date;
      curYear = parseInt(latest.substring(0, 4));
      curMonth = parseInt(latest.substring(5, 7));
    } else {
      const now = new Date();
      curYear = now.getFullYear();
      curMonth = now.getMonth() + 1;
    }

    render();
  };
})();
