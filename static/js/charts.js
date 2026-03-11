(function() {
  'use strict';

  var SVG_NS = 'http://www.w3.org/2000/svg';
  var MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  // "2026-03-01" -> "Mar 01, 2026"
  function formatDate(iso) {
    var p = iso.split('-');
    return MONTHS[parseInt(p[1], 10) - 1] + ' ' + p[2] + ', ' + p[0];
  }

  // "2026-03-02", "2026-03-08" -> "Mar 02 – Mar 08, 2026"
  function formatDateRange(startIso, endIso) {
    if (startIso) {
      return formatDate(startIso).replace(/,\s*\d{4}$/, '') + ' \u2013 ' + formatDate(endIso);
    }
    return formatDate(endIso);
  }

  function formatNum(n) {
    if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (n >= 1000) return (n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, '') + 'K';
    return String(n);
  }

  function svgEl(tag, attrs) {
    var el = document.createElementNS(SVG_NS, tag);
    if (attrs) {
      for (var k in attrs) {
        if (attrs.hasOwnProperty(k)) el.setAttribute(k, attrs[k]);
      }
    }
    return el;
  }

  /**
   * renderBarChart(containerId, weeks, options)
   *
   * weeks: [{end_date, messages_total, ...}]
   * options: { streamer: "fl0m", field: "messages_total" }
   */
  window.renderBarChart = function(containerId, weeks, options) {
    var container = document.getElementById(containerId);
    if (!container || !weeks || weeks.length === 0) return;

    var field = (options && options.field) || 'messages_total';

    var values = [];
    for (var i = 0; i < weeks.length; i++) {
      values.push({
        date: weeks[i].end_date,
        startDate: weeks[i].start_date || '',
        val: weeks[i][field] || 0
      });
    }

    var maxVal = 0;
    for (var i = 0; i < values.length; i++) {
      if (values[i].val > maxVal) maxVal = values[i].val;
    }
    if (maxVal === 0) maxVal = 1;

    // Layout: fixed Y-axis on left, scrollable plot area on right
    var axisWidth = 44;
    var marginBottom = 24;
    var marginTop = 8;
    var marginRight = 4;
    var chartHeight = 300;
    var plotHeight = chartHeight - marginTop - marginBottom;

    // Size bars so 52 weeks fill the scrollable area
    var visibleBars = Math.min(52, values.length);
    var scrollWidth = container.clientWidth - axisWidth;
    var barSlot = Math.ceil(scrollWidth / visibleBars);
    var barGap = Math.max(1, Math.round(barSlot * 0.2));
    var barWidth = barSlot - barGap;
    var barsTotal = values.length * (barWidth + barGap) + marginRight;

    // Build wrapper: [axis (fixed)] [scrollable bars]
    var wrapper = document.createElement('div');
    wrapper.className = 'chart-wrapper';
    wrapper.style.display = 'flex';

    // === Y-axis SVG (fixed) ===
    var axisSvg = svgEl('svg', {
      viewBox: '0 0 ' + axisWidth + ' ' + chartHeight,
      class: 'bar-chart-svg'
    });
    axisSvg.style.width = axisWidth + 'px';
    axisSvg.style.height = 'auto';
    axisSvg.style.flexShrink = '0';

    var tickCount = 4;
    for (var t = 0; t <= tickCount; t++) {
      var tickVal = Math.round(maxVal * t / tickCount);
      var y = marginTop + plotHeight - (plotHeight * t / tickCount);
      if (t > 0) {
        var label = svgEl('text', {
          x: axisWidth - 6, y: y + 3,
          'text-anchor': 'end',
          fill: 'var(--text-muted)',
          'font-size': '9'
        });
        label.textContent = formatNum(tickVal);
        axisSvg.appendChild(label);
      }
    }
    wrapper.appendChild(axisSvg);

    // === Scrollable bars area ===
    var scrollArea = document.createElement('div');
    scrollArea.className = 'chart-scroll';
    scrollArea.style.overflowX = 'scroll';
    scrollArea.style.flex = '1';
    scrollArea.style.minWidth = '0';
    scrollArea.style.position = 'relative';
    scrollArea.style.paddingBottom = '14px';

    var barsSvg = svgEl('svg', {
      viewBox: '0 0 ' + barsTotal + ' ' + chartHeight,
      class: 'bar-chart-svg',
      role: 'img',
      'aria-label': 'Weekly message volume chart'
    });
    barsSvg.style.width = barsTotal + 'px';
    barsSvg.style.height = 'auto';
    barsSvg.style.display = 'block';

    // Grid lines
    for (var t = 0; t <= tickCount; t++) {
      var y = marginTop + plotHeight - (plotHeight * t / tickCount);
      barsSvg.appendChild(svgEl('line', {
        x1: 0, y1: y,
        x2: barsTotal, y2: y,
        stroke: 'var(--border)', 'stroke-width': '0.5'
      }));
    }

    // X-axis month labels
    var lastMonth = '';
    for (var i = 0; i < values.length; i++) {
      var parts = values[i].date.split('-');
      var monthKey = parts[0] + '-' + parts[1];
      if (monthKey !== lastMonth) {
        lastMonth = monthKey;
        var monthIdx = parseInt(parts[1], 10) - 1;
        var labelText = MONTHS[monthIdx];
        if (monthIdx === 0 || i === 0) {
          labelText = MONTHS[monthIdx] + ' ' + parts[0].slice(2);
        }
        var x = i * (barWidth + barGap) + barWidth / 2;
        var monthLabel = svgEl('text', {
          x: x, y: chartHeight - 4,
          'text-anchor': 'start',
          fill: 'var(--text-muted)',
          'font-size': '9'
        });
        monthLabel.textContent = labelText;
        barsSvg.appendChild(monthLabel);
      }
    }

    // Tooltip
    var tooltip = document.createElement('div');
    tooltip.className = 'chart-tooltip';

    // Bars
    for (var i = 0; i < values.length; i++) {
      var barH = (values[i].val / maxVal) * plotHeight;
      if (barH < 1 && values[i].val > 0) barH = 1;
      var x = i * (barWidth + barGap);
      var y = marginTop + plotHeight - barH;

      var isMax = values[i].val === maxVal;
      var rect = svgEl('rect', {
        x: x, y: y,
        width: barWidth, height: barH,
        fill: isMax ? 'var(--chart-bar-hover)' : 'var(--chart-bar)',
        rx: '1',
        'data-date': values[i].date,
        'data-start-date': values[i].startDate,
        'data-val': values[i].val,
        'data-max': isMax ? '1' : ''
      });
      rect.addEventListener('mouseenter', function() {
        this.setAttribute('fill', 'var(--chart-bar-hover)');
        var d = formatDateRange(this.getAttribute('data-start-date'), this.getAttribute('data-date'));
        var v = Number(this.getAttribute('data-val')).toLocaleString();
        tooltip.innerHTML = d + '<br>' + v + ' msgs';
        tooltip.style.opacity = '1';
      });
      rect.addEventListener('mousemove', function(e) {
        var cr = scrollArea.getBoundingClientRect();
        var tx = e.clientX - cr.left + scrollArea.scrollLeft;
        var maxX = scrollArea.scrollLeft + scrollArea.clientWidth - tooltip.offsetWidth - 4;
        if (tx > maxX) tx = maxX;
        tooltip.style.left = tx + 'px';
        var ty = e.clientY - cr.top - 32;
        if (ty < 0) ty = e.clientY - cr.top + 16;
        tooltip.style.top = ty + 'px';
      });
      rect.addEventListener('mouseleave', function() {
        this.setAttribute('fill', this.getAttribute('data-max') ? 'var(--chart-bar-hover)' : 'var(--chart-bar)');
        tooltip.style.opacity = '0';
      });

      barsSvg.appendChild(rect);
    }

    scrollArea.appendChild(barsSvg);
    scrollArea.appendChild(tooltip);
    wrapper.appendChild(scrollArea);
    container.appendChild(wrapper);

    // Scroll to the right so latest weeks are visible
    scrollArea.scrollLeft = scrollArea.scrollWidth;
  };

  /**
   * renderSparkline(containerId, values, opts)
   *
   * values: [number, number, ...]
   * opts.dates: [string, ...] — date strings for x-axis labels
   * Renders an SVG sparkline with area fill, dots, and date labels.
   */
  window.renderSparkline = function(containerId, values, opts) {
    opts = opts || {};
    var dates = opts.dates || [];
    var startDates = opts.startDates || [];
    var container = document.getElementById(containerId);
    if (!container || !values || values.length < 2) return;

    var width = 200;
    var height = 36;
    var padX = 3;
    var padY = 4;

    var maxVal = 0;
    var minVal = Infinity;
    for (var i = 0; i < values.length; i++) {
      if (values[i] > maxVal) maxVal = values[i];
      if (values[i] < minVal) minVal = values[i];
    }
    var range = maxVal - minVal;
    if (range === 0) range = 1;

    var coords = [];
    for (var i = 0; i < values.length; i++) {
      var x = padX + (i / (values.length - 1)) * (width - 2 * padX);
      var y = padY + (1 - (values[i] - minVal) / range) * (height - 2 * padY);
      coords.push({x: x, y: y});
    }

    var pointStr = [];
    for (var i = 0; i < coords.length; i++) {
      pointStr.push(coords[i].x.toFixed(1) + ',' + coords[i].y.toFixed(1));
    }

    var svg = svgEl('svg', {
      viewBox: '0 0 ' + width + ' ' + height,
      preserveAspectRatio: 'none',
      class: 'sparkline-svg',
      role: 'img',
      'aria-label': 'Message trend'
    });
    svg.style.width = '100%';
    svg.style.height = '100%';

    // Area fill
    var areaStr = pointStr.join(' ') +
      ' ' + coords[coords.length - 1].x.toFixed(1) + ',' + height +
      ' ' + coords[0].x.toFixed(1) + ',' + height;
    svg.appendChild(svgEl('polygon', {
      points: areaStr,
      fill: 'var(--chart-bar)',
      opacity: '0.1'
    }));

    // Line
    svg.appendChild(svgEl('polyline', {
      points: pointStr.join(' '),
      fill: 'none',
      stroke: 'var(--chart-bar)',
      'stroke-width': '1.5',
      'stroke-linejoin': 'round',
      'stroke-linecap': 'round',
      'vector-effect': 'non-scaling-stroke'
    }));

    // Hover interaction: dot + tooltip
    if (dates.length === values.length) {
      var dot = svgEl('circle', {
        r: '2.5', fill: 'var(--chart-bar)', opacity: '0',
        'vector-effect': 'non-scaling-stroke',
        stroke: 'var(--bg)', 'stroke-width': '1'
      });
      svg.appendChild(dot);

      var tooltip = document.createElement('div');
      tooltip.className = 'chart-tooltip';
      tooltip.style.fontSize = '.7rem';

      var slotWidth = (width - 2 * padX) / (values.length - 1);
      for (var i = 0; i < values.length; i++) {
        (function(idx) {
          var hitX = idx === 0 ? 0 : coords[idx].x - slotWidth / 2;
          var hitW = idx === 0 || idx === values.length - 1 ? slotWidth / 2 + padX : slotWidth;
          var hit = svgEl('rect', {
            x: hitX, y: 0, width: hitW, height: height,
            fill: 'transparent', cursor: 'pointer'
          });
          hit.addEventListener('mouseenter', function() {
            dot.setAttribute('cx', coords[idx].x);
            dot.setAttribute('cy', coords[idx].y);
            dot.setAttribute('opacity', '1');
            tooltip.innerHTML = formatDateRange(startDates[idx] || '', dates[idx]) + '<br>' + values[idx].toLocaleString() + ' msgs';
            tooltip.style.opacity = '1';
          });
          hit.addEventListener('mousemove', function(e) {
            var cr = container.getBoundingClientRect();
            var tx = e.clientX - cr.left + 8;
            if (tx + 120 > cr.width) tx = e.clientX - cr.left - 120;
            tooltip.style.left = tx + 'px';
            tooltip.style.top = (e.clientY - cr.top - 28) + 'px';
          });
          hit.addEventListener('mouseleave', function() {
            dot.setAttribute('opacity', '0');
            tooltip.style.opacity = '0';
          });
          svg.appendChild(hit);
        })(i);
      }

      container.style.position = 'relative';
    }

    container.appendChild(svg);
    if (tooltip) container.appendChild(tooltip);

    // Labels below sparkline
    if (dates.length >= 2) {
      function shortDate(s) {
        var p = s.split('-');
        return MONTHS[parseInt(p[1], 10) - 1] + ' ' + parseInt(p[2], 10);
      }
      var dl = document.createElement('div');
      dl.className = 'sparkline-dates';
      var s1 = document.createElement('span');
      s1.textContent = shortDate(dates[0]);
      var s2 = document.createElement('span');
      s2.textContent = formatNum(minVal) + '\u2013' + formatNum(maxVal);
      var s3 = document.createElement('span');
      s3.textContent = shortDate(dates[dates.length - 1]);
      dl.appendChild(s1);
      dl.appendChild(s2);
      dl.appendChild(s3);
      container.appendChild(dl);
    }
  };

  /**
   * renderHourlyChart(containerId, hours)
   *
   * hours: [int x 24] — message counts per hour (0–23)
   * Renders a compact 24-bar chart showing chat activity by hour of day.
   */
  window.renderHourlyChart = function(containerId, hours) {
    var container = document.getElementById(containerId);
    if (!container || !hours || hours.length !== 24) return;

    var maxVal = 0;
    for (var i = 0; i < 24; i++) {
      if (hours[i] > maxVal) maxVal = hours[i];
    }
    if (maxVal === 0) return;

    var axisW = 44;
    var plotW = 600;
    var W = axisW + plotW;
    var marginTop = 12;
    var barH = 80;
    var labelH = 16;
    var H = marginTop + barH + labelH;
    var gap = 3;
    var barW = (plotW - gap * 23) / 24;

    var svg = svgEl('svg', {
      viewBox: '0 0 ' + W + ' ' + H,
      preserveAspectRatio: 'xMidYMid meet',
      role: 'img',
      'aria-label': 'Hourly chat activity'
    });
    svg.style.width = '100%';
    svg.style.height = 'auto';
    svg.style.display = 'block';
    svg.style.overflow = 'visible';

    // Y-axis ticks and grid lines
    var tickCount = 3;
    for (var t = 0; t <= tickCount; t++) {
      var tickVal = Math.round(maxVal * t / tickCount);
      var ty = marginTop + barH - (barH * t / tickCount);
      svg.appendChild(svgEl('line', {
        x1: axisW, y1: ty, x2: W, y2: ty,
        stroke: 'var(--border)', 'stroke-width': '0.5'
      }));
      if (t > 0) {
        var label = svgEl('text', {
          x: axisW - 4, y: ty + 3,
          'text-anchor': 'end',
          fill: 'var(--text-muted)',
          'font-size': '9'
        });
        label.textContent = formatNum(tickVal);
        svg.appendChild(label);
      }
    }

    var tooltip = document.createElement('div');
    tooltip.className = 'chart-tooltip';

    var HOUR_LABELS = ['12a','','','3a','','','6a','','','9a','','','12p','','','3p','','','6p','','','9p','',''];

    for (var i = 0; i < 24; i++) {
      var h = (hours[i] / maxVal) * barH;
      if (h < 1 && hours[i] > 0) h = 1;
      var x = axisW + i * (barW + gap);
      var y = marginTop + barH - h;
      var isMax = hours[i] === maxVal;

      var rect = svgEl('rect', {
        x: x, y: y, width: barW, height: h,
        fill: isMax ? 'var(--chart-bar-hover)' : 'var(--chart-bar)',
        rx: '2',
        'data-hour': i, 'data-val': hours[i], 'data-max': isMax ? '1' : ''
      });

      (function(r, idx) {
        r.addEventListener('mouseenter', function() {
          this.setAttribute('fill', 'var(--chart-bar-hover)');
          var hr = idx;
          var ampm = hr === 0 ? '12 AM' : hr < 12 ? hr + ' AM' : hr === 12 ? '12 PM' : (hr - 12) + ' PM';
          tooltip.innerHTML = ampm + '<br>' + Number(this.getAttribute('data-val')).toLocaleString() + ' msgs';
          tooltip.style.opacity = '1';
        });
        r.addEventListener('mousemove', function(e) {
          var cr = container.getBoundingClientRect();
          var tx = e.clientX - cr.left + 8;
          if (tx + 120 > cr.width) tx = e.clientX - cr.left - 120;
          tooltip.style.left = tx + 'px';
          tooltip.style.top = (e.clientY - cr.top - 28) + 'px';
        });
        r.addEventListener('mouseleave', function() {
          this.setAttribute('fill', this.getAttribute('data-max') ? 'var(--chart-bar-hover)' : 'var(--chart-bar)');
          tooltip.style.opacity = '0';
        });
      })(rect, i);

      svg.appendChild(rect);

      // Hour labels
      if (HOUR_LABELS[i]) {
        var lbl = svgEl('text', {
          x: x + barW / 2, y: H - 2,
          'text-anchor': 'middle',
          fill: 'var(--text-muted)',
          'font-size': '9'
        });
        lbl.textContent = HOUR_LABELS[i];
        svg.appendChild(lbl);
      }
    }

    container.style.position = 'relative';
    container.appendChild(svg);
    container.appendChild(tooltip);
  };
})();
