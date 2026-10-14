(function() {
  'use strict';

  const SVG_NS = 'http://www.w3.org/2000/svg';
  const utc = opts => new Intl.DateTimeFormat('en-US', Object.assign({ timeZone: 'UTC' }, opts));
  const fmtMD = utc({ month: 'short', day: '2-digit' });
  const fmtMDY = utc({ month: 'short', day: '2-digit', year: 'numeric' });
  const fmtShort = utc({ month: 'short', day: 'numeric' });
  const fmtMonth = utc({ month: 'short' });
  const fmtMonthYY = utc({ month: 'short', year: '2-digit' });
  const formatNum = new Intl.NumberFormat('en', { notation: 'compact' }).format;
  const hourLabel = h => h === 0 ? '12 AM' : h < 12 ? h + ' AM' : h === 12 ? '12 PM' : (h - 12) + ' PM';

  // "2026-03-02", "2026-03-08" -> "Mar 02 – Mar 08, 2026"
  function formatDateRange(startIso, endIso) {
    return (startIso ? fmtMD.format(new Date(startIso)) + ' – ' : '') + fmtMDY.format(new Date(endIso));
  }

  // Screen-reader summary appended to a chart container.
  function srNote(container, text) {
    const div = document.createElement('div');
    div.className = 'sr-only';
    div.textContent = text;
    container.appendChild(div);
  }

  function svgEl(tag, attrs) {
    const el = document.createElementNS(SVG_NS, tag);
    for (const k in attrs) el.setAttribute(k, attrs[k]);
    return el;
  }

  // Tooltip that follows the cursor inside `container`, flipping left near the right edge.
  const nearCursor = container => function(e) {
    const cr = container.getBoundingClientRect();
    let tx = e.clientX - cr.left + 8;
    if (tx + 120 > cr.width) tx = e.clientX - cr.left - 120;
    return { left: tx, top: e.clientY - cr.top - 28 };
  };

  /**
   * attachTooltip(rect, hoverFill, restoreFn, tooltip, contentFn, positionFn)
   *
   * Shared tooltip wiring for bar charts, sparklines, and hourly charts.
   * contentFn(): returns [line1, line2] text strings for the tooltip.
   * positionFn(e): returns {left, top} in px for tooltip placement.
   */
  function attachTooltip(rect, hoverFill, restoreFn, tooltip, contentFn, positionFn) {
    rect.addEventListener('mouseenter', function() {
      if (hoverFill) this.setAttribute('fill', hoverFill);
      const lines = contentFn();
      tooltip.textContent = '';
      tooltip.appendChild(document.createTextNode(lines[0]));
      tooltip.appendChild(document.createElement('br'));
      tooltip.appendChild(document.createTextNode(lines[1]));
      tooltip.style.opacity = '1';
    });
    rect.addEventListener('mousemove', function(e) {
      const pos = positionFn(e);
      tooltip.style.left = pos.left + 'px';
      tooltip.style.top = pos.top + 'px';
    });
    rect.addEventListener('mouseleave', function() {
      if (restoreFn) restoreFn(this);
      tooltip.style.opacity = '0';
    });
  }

  /**
   * renderBarChart(containerId, weeks)
   *
   * weeks: [{end_date, messages_total, ...}]
   */
  window.renderBarChart = function(containerId, weeks) {
    const container = document.getElementById(containerId);
    if (!container || !weeks || weeks.length === 0) return;

    const values = weeks.map(w => ({ date: w.end_date, startDate: w.start_date || '', val: w.messages_total || 0 }));
    const maxVal = Math.max(...values.map(v => v.val)) || 1;

    // Layout: fixed Y-axis on left, scrollable plot area on right
    const axisWidth = 44;
    const marginBottom = 24;
    const marginTop = 8;
    const marginRight = 4;
    const chartHeight = 300;
    const plotHeight = chartHeight - marginTop - marginBottom;

    // Size bars so 52 weeks fill the scrollable area
    const visibleBars = Math.min(52, values.length);
    const scrollWidth = container.clientWidth - axisWidth;
    const barSlot = Math.ceil(scrollWidth / visibleBars);
    const barGap = Math.max(1, Math.round(barSlot * 0.2));
    const barWidth = barSlot - barGap;
    const barsTotal = values.length * (barWidth + barGap) + marginRight;

    // Build wrapper: [axis (fixed)] [scrollable bars]
    const wrapper = document.createElement('div');
    wrapper.className = 'chart-wrapper';
    wrapper.style.display = 'flex';

    // === Y-axis SVG (fixed) ===
    const axisSvg = svgEl('svg', {
      viewBox: '0 0 ' + axisWidth + ' ' + chartHeight,
      class: 'bar-chart-svg'
    });
    axisSvg.style.width = axisWidth + 'px';
    axisSvg.style.height = 'auto';
    axisSvg.style.flexShrink = '0';

    const tickCount = 4;
    for (let t = 1; t <= tickCount; t++) {
      const y = marginTop + plotHeight - (plotHeight * t / tickCount);
      const label = svgEl('text', {
        x: axisWidth - 6, y: y + 3,
        'text-anchor': 'end',
        fill: 'var(--text-muted)',
        'font-size': '9'
      });
      label.textContent = formatNum(Math.round(maxVal * t / tickCount));
      axisSvg.appendChild(label);
    }
    wrapper.appendChild(axisSvg);

    // === Scrollable bars area ===
    const scrollArea = document.createElement('div');
    scrollArea.className = 'chart-scroll';
    scrollArea.style.overflowX = 'scroll';
    scrollArea.style.flex = '1';
    scrollArea.style.minWidth = '0';
    scrollArea.style.position = 'relative';
    scrollArea.style.paddingBottom = '14px';

    const barsSvg = svgEl('svg', {
      viewBox: '0 0 ' + barsTotal + ' ' + chartHeight,
      class: 'bar-chart-svg',
      role: 'img',
      'aria-label': 'Weekly message volume chart'
    });
    barsSvg.style.width = barsTotal + 'px';
    barsSvg.style.height = 'auto';
    barsSvg.style.display = 'block';

    // Grid lines
    for (let t = 0; t <= tickCount; t++) {
      const y = marginTop + plotHeight - (plotHeight * t / tickCount);
      barsSvg.appendChild(svgEl('line', {
        x1: 0, y1: y,
        x2: barsTotal, y2: y,
        stroke: 'var(--border)', 'stroke-width': '0.5'
      }));
    }

    // X-axis month labels
    let lastMonth = '';
    for (let i = 0; i < values.length; i++) {
      const monthKey = values[i].date.slice(0, 7);
      if (monthKey !== lastMonth) {
        lastMonth = monthKey;
        const d = new Date(values[i].date);
        const x = i * (barWidth + barGap) + barWidth / 2;
        const monthLabel = svgEl('text', {
          x: x, y: chartHeight - 4,
          'text-anchor': 'start',
          fill: 'var(--text-muted)',
          'font-size': '9'
        });
        monthLabel.textContent = (d.getUTCMonth() === 0 || i === 0 ? fmtMonthYY : fmtMonth).format(d);
        barsSvg.appendChild(monthLabel);
      }
    }

    // Tooltip
    const tooltip = document.createElement('div');
    tooltip.className = 'chart-tooltip';

    // Bars
    for (let i = 0; i < values.length; i++) {
      let barH = (values[i].val / maxVal) * plotHeight;
      if (barH < 1 && values[i].val > 0) barH = 1;
      const fill = values[i].val === maxVal ? 'var(--chart-bar-hover)' : 'var(--chart-bar)';
      const rect = svgEl('rect', {
        x: i * (barWidth + barGap), y: marginTop + plotHeight - barH,
        width: barWidth, height: barH,
        fill: fill,
        rx: '1'
      });
      attachTooltip(rect, 'var(--chart-bar-hover)', el => el.setAttribute('fill', fill), tooltip,
        () => [formatDateRange(values[i].startDate, values[i].date), values[i].val.toLocaleString('en-US') + ' msgs'],
        function(e) {
          const cr = scrollArea.getBoundingClientRect();
          let tx = e.clientX - cr.left + scrollArea.scrollLeft;
          const maxX = scrollArea.scrollLeft + scrollArea.clientWidth - tooltip.offsetWidth - 4;
          if (tx > maxX) tx = maxX;
          let ty = e.clientY - cr.top - 32;
          if (ty < 0) ty = e.clientY - cr.top + 16;
          return { left: tx, top: ty };
        }
      );
      barsSvg.appendChild(rect);
    }

    scrollArea.appendChild(barsSvg);
    scrollArea.appendChild(tooltip);
    wrapper.appendChild(scrollArea);
    container.appendChild(wrapper);

    // Scroll to the right so latest weeks are visible
    scrollArea.scrollLeft = scrollArea.scrollWidth;

    // Screen-reader summary
    const total = values.reduce((sum, v) => sum + v.val, 0);
    srNote(container, 'Bar chart: ' + values.length + ' weeks, total ' + total.toLocaleString('en-US') + ' messages, peak ' + maxVal.toLocaleString('en-US'));
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
    const dates = opts.dates || [];
    const startDates = opts.startDates || [];
    const container = document.getElementById(containerId);
    if (!container || !values || values.length < 2) return;

    const width = 200;
    const height = 36;
    const padX = 3;
    const padY = 4;
    const padBottom = 1;

    const maxVal = Math.max(...values);
    const minVal = Math.min(...values);
    const range = maxVal - minVal || 1;

    const coords = values.map((v, i) => ({
      x: padX + (i / (values.length - 1)) * (width - 2 * padX),
      y: padY + (1 - (v - minVal) / range) * (height - padY - padBottom)
    }));
    const pointStr = coords.map(c => c.x.toFixed(1) + ',' + c.y.toFixed(1));

    const svg = svgEl('svg', {
      viewBox: '0 0 ' + width + ' ' + height,
      preserveAspectRatio: 'none',
      class: 'sparkline-svg',
      role: 'img',
      'aria-label': 'Message trend'
    });
    svg.style.width = '100%';
    svg.style.height = '100%';

    // Area fill
    const areaStr = pointStr.join(' ') +
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
    let tooltip = null;
    if (dates.length === values.length) {
      const dot = svgEl('circle', {
        r: '2.5', fill: 'var(--chart-bar)', opacity: '0',
        'vector-effect': 'non-scaling-stroke',
        stroke: 'var(--bg)', 'stroke-width': '1'
      });
      svg.appendChild(dot);

      tooltip = document.createElement('div');
      tooltip.className = 'chart-tooltip';
      tooltip.style.fontSize = '.7rem';

      const slotWidth = (width - 2 * padX) / (values.length - 1);
      for (let i = 0; i < values.length; i++) {
        const hitX = i === 0 ? 0 : coords[i].x - slotWidth / 2;
        const hitW = i === 0 || i === values.length - 1 ? slotWidth / 2 + padX : slotWidth;
        const hit = svgEl('rect', {
          x: hitX, y: 0, width: hitW, height: height,
          fill: 'transparent', cursor: 'pointer'
        });
        attachTooltip(hit, null, () => dot.setAttribute('opacity', '0'), tooltip,
          function() {
            dot.setAttribute('cx', coords[i].x);
            dot.setAttribute('cy', coords[i].y);
            dot.setAttribute('opacity', '1');
            return [formatDateRange(startDates[i] || '', dates[i]), values[i].toLocaleString('en-US') + ' msgs'];
          },
          nearCursor(container)
        );
        svg.appendChild(hit);
      }
    }

    container.style.position = 'relative';
    const plot = document.createElement('div');
    plot.className = 'sparkline-plot';
    plot.appendChild(svg);
    const yMax = document.createElement('span');
    yMax.className = 'sparkline-ylabel sparkline-ylabel-max';
    yMax.textContent = formatNum(maxVal);
    const yMin = document.createElement('span');
    yMin.className = 'sparkline-ylabel sparkline-ylabel-min';
    yMin.textContent = formatNum(minVal);
    plot.appendChild(yMax);
    plot.appendChild(yMin);
    container.appendChild(plot);
    if (tooltip) container.appendChild(tooltip);

    // Labels below sparkline
    if (dates.length >= 2) {
      const dl = document.createElement('div');
      dl.className = 'sparkline-dates';
      const s1 = document.createElement('span');
      s1.textContent = fmtShort.format(new Date(dates[0]));
      const s3 = document.createElement('span');
      s3.textContent = fmtShort.format(new Date(dates[dates.length - 1]));
      dl.appendChild(s1);
      dl.appendChild(s3);
      container.appendChild(dl);
    }

    // Screen-reader summary
    srNote(container, 'Message trend over ' + values.length + ' weeks: minimum ' + minVal.toLocaleString('en-US') + ', maximum ' + maxVal.toLocaleString('en-US') + ', latest ' + values[values.length - 1].toLocaleString('en-US'));
  };

  /**
   * renderHourlyChart(containerId, hours)
   *
   * hours: [int x 24] — message counts per hour (0–23)
   * Renders a compact 24-bar chart showing chat activity by hour of day.
   */
  window.renderHourlyChart = function(containerId, hours) {
    const container = document.getElementById(containerId);
    if (!container || !hours || hours.length !== 24) return;

    const maxVal = Math.max(...hours);
    if (maxVal === 0) return;

    const axisW = 44;
    const plotW = 600;
    const W = axisW + plotW;
    const marginTop = 12;
    const barH = 80;
    const labelH = 16;
    const H = marginTop + barH + labelH;
    const gap = 3;
    const barW = (plotW - gap * 23) / 24;

    const svg = svgEl('svg', {
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
    const tickCount = 3;
    for (let t = 0; t <= tickCount; t++) {
      const ty = marginTop + barH - (barH * t / tickCount);
      svg.appendChild(svgEl('line', {
        x1: axisW, y1: ty, x2: W, y2: ty,
        stroke: 'var(--border)', 'stroke-width': '0.5'
      }));
      if (t > 0) {
        const label = svgEl('text', {
          x: axisW - 4, y: ty + 3,
          'text-anchor': 'end',
          fill: 'var(--text-muted)',
          'font-size': '9'
        });
        label.textContent = formatNum(Math.round(maxVal * t / tickCount));
        svg.appendChild(label);
      }
    }

    const tooltip = document.createElement('div');
    tooltip.className = 'chart-tooltip';

    const HOUR_LABELS = ['12a','','','3a','','','6a','','','9a','','','12p','','','3p','','','6p','','','9p','',''];

    for (let i = 0; i < 24; i++) {
      let h = (hours[i] / maxVal) * barH;
      if (h < 1 && hours[i] > 0) h = 1;
      const x = axisW + i * (barW + gap);
      const fill = hours[i] === maxVal ? 'var(--chart-bar-hover)' : 'var(--chart-bar)';

      const rect = svgEl('rect', { x: x, y: marginTop + barH - h, width: barW, height: h, fill: fill, rx: '2' });
      attachTooltip(rect, 'var(--chart-bar-hover)', el => el.setAttribute('fill', fill), tooltip,
        () => [hourLabel(i), hours[i].toLocaleString('en-US') + ' msgs'],
        nearCursor(container)
      );
      svg.appendChild(rect);

      // Hour labels
      if (HOUR_LABELS[i]) {
        const lbl = svgEl('text', {
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

    // Screen-reader summary
    const peakHour = hours.indexOf(maxVal);
    srNote(container, 'Hourly activity: ' + hours.reduce((a, b) => a + b, 0).toLocaleString('en-US') + ' total messages, peak at ' + hourLabel(peakHour) + ' (' + maxVal.toLocaleString('en-US') + ')');
  };
})();
