(function() {
  'use strict';

  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const MONTH_FULL = ['January', 'February', 'March', 'April', 'May', 'June',
                      'July', 'August', 'September', 'October', 'November', 'December'];
  const DOW = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

  const SVG_NS = 'http://www.w3.org/2000/svg';
  const CHEVRON_LEFT = 'M10 3L5 8L10 13';
  const CHEVRON_RIGHT = 'M6 3L11 8L6 13';

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

  function chevron(pathD) {
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('width', '14');
    svg.setAttribute('height', '14');
    svg.setAttribute('viewBox', '0 0 16 16');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2.5');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', pathD);
    svg.appendChild(path);
    return svg;
  }

  function calHeader(title, isStatic) {
    const header = document.createElement('div');
    header.className = 'cal-header';

    const prev = document.createElement('button');
    prev.className = 'cal-nav';
    prev.dataset.action = 'prev';
    prev.setAttribute('aria-label', 'Previous');
    prev.appendChild(chevron(CHEVRON_LEFT));
    header.appendChild(prev);

    let titleEl;
    if (isStatic) {
      titleEl = document.createElement('span');
      titleEl.className = 'cal-title cal-title-static';
    } else {
      titleEl = document.createElement('button');
      titleEl.className = 'cal-title';
      titleEl.dataset.action = 'up';
    }
    titleEl.textContent = title;
    header.appendChild(titleEl);

    const next = document.createElement('button');
    next.className = 'cal-nav';
    next.dataset.action = 'next';
    next.setAttribute('aria-label', 'Next');
    next.appendChild(chevron(CHEVRON_RIGHT));
    header.appendChild(next);

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
    bindNav();
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
    bindNav();
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
    bindNav();
  }

  function bindNav() {
    container.querySelectorAll('[data-action]').forEach(function(el) {
      el.addEventListener('click', function(e) {
        e.preventDefault();
        const action = this.getAttribute('data-action');

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
          curMonth = parseInt(this.getAttribute('data-month'));
          view = 'month';
        } else if (action === 'year') {
          curYear = parseInt(this.getAttribute('data-year'));
          view = 'months';
        }

        render();
      });
    });
  }

  window.initWeeksCalendar = function(el, weeks, streamerLogin) {
    container = el;
    streamer = streamerLogin;
    weekEnds = new Set();
    emptyWeeks = new Set();

    weeks.forEach(function(w) {
      weekEnds.add(w.end_date);
      if (w.vod_count === 0) emptyWeeks.add(w.end_date);
      const ym = w.end_date.substring(0, 7);
      if (!weeksByMonth[ym]) weeksByMonth[ym] = [];
      weeksByMonth[ym].push(w.end_date);
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
