(function() {
  'use strict';

  const SVG_NS = 'http://www.w3.org/2000/svg';
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  // "2026-03-01" -> "Mar 01, 2026"
  function formatDate(iso) {
    const p = iso.split('-');
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
    const el = document.createElementNS(SVG_NS, tag);
    if (attrs) {
      for (const k in attrs) {
        if (attrs.hasOwnProperty(k)) el.setAttribute(k, attrs[k]);
      }
    }
    return el;
  }

  /**
   * attachTooltip(rects, container, tooltip, contentFn, positionFn)
   *
   * Shared tooltip wiring for bar charts, sparklines, and hourly charts.
   * contentFn(el): returns [line1, line2] text strings for the tooltip.
   * positionFn(e): returns {left, top} in px for tooltip placement.
   */
  function attachTooltip(rect, hoverFill, restoreFn, container, tooltip, contentFn, positionFn) {
    rect.addEventListener('mouseenter', function() {
      if (hoverFill) this.setAttribute('fill', hoverFill);
      const lines = contentFn(this);
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
   * renderBarChart(containerId, weeks, options)
   *
   * weeks: [{end_date, messages_total, ...}]
   * options: { streamer: "fl0m", field: "messages_total" }
   */
  window.renderBarChart = function(containerId, weeks, options) {
    const container = document.getElementById(containerId);
    if (!container || !weeks || weeks.length === 0) return;

    const field = (options && options.field) || 'messages_total';

    const values = [];
    for (let i = 0; i < weeks.length; i++) {
      values.push({
        date: weeks[i].end_date,
        startDate: weeks[i].start_date || '',
        val: weeks[i][field] || 0
      });
    }

    let maxVal = 0;
    for (let i = 0; i < values.length; i++) {
      if (values[i].val > maxVal) maxVal = values[i].val;
    }
    if (maxVal === 0) maxVal = 1;

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
    for (let t = 0; t <= tickCount; t++) {
      const tickVal = Math.round(maxVal * t / tickCount);
      const y = marginTop + plotHeight - (plotHeight * t / tickCount);
      if (t > 0) {
        const label = svgEl('text', {
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
      const parts = values[i].date.split('-');
      const monthKey = parts[0] + '-' + parts[1];
      if (monthKey !== lastMonth) {
        lastMonth = monthKey;
        const monthIdx = parseInt(parts[1], 10) - 1;
        let labelText = MONTHS[monthIdx];
        if (monthIdx === 0 || i === 0) {
          labelText = MONTHS[monthIdx] + ' ' + parts[0].slice(2);
        }
        const x = i * (barWidth + barGap) + barWidth / 2;
        const monthLabel = svgEl('text', {
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
    const tooltip = document.createElement('div');
    tooltip.className = 'chart-tooltip';

    // Bars
    for (let i = 0; i < values.length; i++) {
      let barH = (values[i].val / maxVal) * plotHeight;
      if (barH < 1 && values[i].val > 0) barH = 1;
      const x = i * (barWidth + barGap);
      const y = marginTop + plotHeight - barH;

      const isMax = values[i].val === maxVal;
      const rect = svgEl('rect', {
        x: x, y: y,
        width: barWidth, height: barH,
        fill: isMax ? 'var(--chart-bar-hover)' : 'var(--chart-bar)',
        rx: '1',
        'data-date': values[i].date,
        'data-start-date': values[i].startDate,
        'data-val': values[i].val,
        'data-max': isMax ? '1' : ''
      });
      attachTooltip(rect, 'var(--chart-bar-hover)',
        function(el) { el.setAttribute('fill', el.getAttribute('data-max') ? 'var(--chart-bar-hover)' : 'var(--chart-bar)'); },
        scrollArea, tooltip,
        function(el) {
          return [
            formatDateRange(el.getAttribute('data-start-date'), el.getAttribute('data-date')),
            Number(el.getAttribute('data-val')).toLocaleString() + ' msgs'
          ];
        },
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

    let maxVal = 0;
    let minVal = Infinity;
    for (let i = 0; i < values.length; i++) {
      if (values[i] > maxVal) maxVal = values[i];
      if (values[i] < minVal) minVal = values[i];
    }
    let range = maxVal - minVal;
    if (range === 0) range = 1;

    const coords = [];
    for (let i = 0; i < values.length; i++) {
      const x = padX + (i / (values.length - 1)) * (width - 2 * padX);
      const y = padY + (1 - (values[i] - minVal) / range) * (height - 2 * padY);
      coords.push({x: x, y: y});
    }

    const pointStr = [];
    for (let i = 0; i < coords.length; i++) {
      pointStr.push(coords[i].x.toFixed(1) + ',' + coords[i].y.toFixed(1));
    }

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
        attachTooltip(hit, null,
          null, container, tooltip,
          function() {
            dot.setAttribute('cx', coords[i].x);
            dot.setAttribute('cy', coords[i].y);
            dot.setAttribute('opacity', '1');
            return [
              formatDateRange(startDates[i] || '', dates[i]),
              values[i].toLocaleString() + ' msgs'
            ];
          },
          function(e) {
            const cr = container.getBoundingClientRect();
            let tx = e.clientX - cr.left + 8;
            if (tx + 120 > cr.width) tx = e.clientX - cr.left - 120;
            return { left: tx, top: e.clientY - cr.top - 28 };
          }
        );
        hit.addEventListener('mouseleave', function() {
          dot.setAttribute('opacity', '0');
        });
        svg.appendChild(hit);
      }

      container.style.position = 'relative';
    }

    container.appendChild(svg);
    if (tooltip) container.appendChild(tooltip);

    // Labels below sparkline
    if (dates.length >= 2) {
      function shortDate(s) {
        const p = s.split('-');
        return MONTHS[parseInt(p[1], 10) - 1] + ' ' + parseInt(p[2], 10);
      }
      const dl = document.createElement('div');
      dl.className = 'sparkline-dates';
      const s1 = document.createElement('span');
      s1.textContent = shortDate(dates[0]);
      const s2 = document.createElement('span');
      s2.textContent = formatNum(minVal) + '\u2013' + formatNum(maxVal);
      const s3 = document.createElement('span');
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
    const container = document.getElementById(containerId);
    if (!container || !hours || hours.length !== 24) return;

    let maxVal = 0;
    for (let i = 0; i < 24; i++) {
      if (hours[i] > maxVal) maxVal = hours[i];
    }
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
      const tickVal = Math.round(maxVal * t / tickCount);
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
        label.textContent = formatNum(tickVal);
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
      const y = marginTop + barH - h;
      const isMax = hours[i] === maxVal;

      const rect = svgEl('rect', {
        x: x, y: y, width: barW, height: h,
        fill: isMax ? 'var(--chart-bar-hover)' : 'var(--chart-bar)',
        rx: '2',
        'data-hour': i, 'data-val': hours[i], 'data-max': isMax ? '1' : ''
      });

      attachTooltip(rect, 'var(--chart-bar-hover)',
        function(el) { el.setAttribute('fill', el.getAttribute('data-max') ? 'var(--chart-bar-hover)' : 'var(--chart-bar)'); },
        container, tooltip,
        function(el) {
          const ampm = i === 0 ? '12 AM' : i < 12 ? i + ' AM' : i === 12 ? '12 PM' : (i - 12) + ' PM';
          return [ampm, Number(el.getAttribute('data-val')).toLocaleString() + ' msgs'];
        },
        function(e) {
          const cr = container.getBoundingClientRect();
          let tx = e.clientX - cr.left + 8;
          if (tx + 120 > cr.width) tx = e.clientX - cr.left - 120;
          return { left: tx, top: e.clientY - cr.top - 28 };
        }
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
  };
})();
