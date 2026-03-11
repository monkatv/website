(function() {
  'use strict';

  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const MONTH_FULL = ['January', 'February', 'March', 'April', 'May', 'June',
                      'July', 'August', 'September', 'October', 'November', 'December'];
  const DOW = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

  let container, streamer, weekEnds;
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
    let html = '<div class="cal-header">';
    html += '<button class="cal-nav" data-action="prev"><svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10 3L5 8L10 13"/></svg></button>';
    if (isStatic) {
      html += '<span class="cal-title cal-title-static">' + title + '</span>';
    } else {
      html += '<button class="cal-title" data-action="up">' + title + '</button>';
    }
    html += '<button class="cal-nav" data-action="next"><svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3L11 8L6 13"/></svg></button>';
    html += '</div>';
    return html;
  }

  function render() {
    if (view === 'month') renderMonth();
    else if (view === 'months') renderMonths();
    else renderYears();
  }

  function renderMonth() {
    let html = calHeader(MONTH_FULL[curMonth - 1] + ' ' + curYear, false);

    html += '<div class="cal-dow-row">';
    DOW.forEach(function(d) { html += '<span>' + d + '</span>'; });
    html += '</div>';

    const firstDow = dayOfWeek(curYear, curMonth, 1);
    const start = addDays(curYear, curMonth, 1, -firstDow);

    const today = new Date();
    const todayY = today.getFullYear(), todayM = today.getMonth() + 1, todayD = today.getDate();

    html += '<div class="cal-body">';
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

      if (hasData) {
        html += '<a class="cal-week cal-has-data" href="/' + streamer + '/' + sundayStr + '/">';
      } else {
        html += '<div class="cal-week">';
      }

      days.forEach(function(cell) {
        let cls = 'cal-day';
        if (cell.m !== curMonth) cls += ' cal-other';
        if (cell.y === todayY && cell.m === todayM && cell.d === todayD) cls += ' cal-today';
        html += '<span class="' + cls + '">' + cell.d + '</span>';
      });

      html += hasData ? '</a>' : '</div>';
    }
    html += '</div>';

    container.innerHTML = html;
    bindNav();
  }

  function renderMonths() {
    let html = calHeader('' + curYear, false);

    html += '<div class="cal-cell-grid">';
    for (let m = 1; m <= 12; m++) {
      const ym = curYear + '-' + pad(m);
      const hasData = !!weeksByMonth[ym];
      let cls = 'cal-cell';
      if (hasData) cls += ' cal-has-data';
      html += '<button class="' + cls + '" data-action="month" data-month="' + m + '">' + MONTHS[m - 1] + '</button>';
    }
    html += '</div>';

    container.innerHTML = html;
    bindNav();
  }

  function renderYears() {
    if (!yearRangeStart) yearRangeStart = curYear - curYear % 10 - 1;
    const rangeEnd = yearRangeStart + 11;

    let html = calHeader(yearRangeStart + ' \u2013 ' + rangeEnd, true);

    html += '<div class="cal-cell-grid">';
    for (let y = yearRangeStart; y <= rangeEnd; y++) {
      const hasData = !!weeksByYear['' + y];
      let cls = 'cal-cell';
      if (hasData) cls += ' cal-has-data';
      html += '<button class="' + cls + '" data-action="year" data-year="' + y + '">' + y + '</button>';
    }
    html += '</div>';

    container.innerHTML = html;
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

    weeks.forEach(function(w) {
      weekEnds.add(w.end_date);
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
