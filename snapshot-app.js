(() => {
  const dataNode = document.querySelector('#page-data');
  let pageData = null;
  if (dataNode) {
    try { pageData = JSON.parse(dataNode.textContent); } catch (_) { pageData = null; }
  }

  function formatValue(value, unit) {
    const maximumFractionDigits = Math.abs(value) >= 1000 ? 0 : 2;
    const formatted = value.toLocaleString('zh-CN', { maximumFractionDigits });
    return unit ? `${formatted} ${unit}` : formatted;
  }

  function setupTrendWidget(widget) {
    const group = widget.dataset.seriesGroup;
    const chart = widget.querySelector('.trend-chart');
    const selector = widget.querySelector('.chart-series');
    const unitNode = widget.querySelector('.chart-unit');
    const legendNode = widget.querySelector('.chart-legend');
    const singleNode = widget.querySelector('.chart-single-value');
    const summaryBody = widget.closest('.data-section')?.querySelector('.key-data-body');
    const summaryChangeHead = widget.closest('.data-section')?.querySelector('.summary-change-head');
    let chartPoints = [];
    let activeSeries = null;
    let tooltip = null;

    function ensureTooltip() {
      if (tooltip) return tooltip;
      tooltip = document.createElement('div');
      tooltip.className = 'chart-hover-tooltip';
      tooltip.setAttribute('role', 'status');
      tooltip.hidden = true;
      widget.appendChild(tooltip);
      return tooltip;
    }

    function hideTooltip() {
      if (!tooltip) return;
      tooltip.hidden = true;
      tooltip.classList.remove('is-visible');
    }

    function showTooltip(point) {
      const node = ensureTooltip();
      if (!node || !chart || !activeSeries) return;
      const breakNote = activeSeries.series_break_note ? `\n口径提示：${activeSeries.series_break_note}` : '';
      node.textContent = `${point.record.period}\n${activeSeries.label}：${formatValue(point.value, activeSeries.display_unit || activeSeries.unit)}${breakNote}`;
      node.hidden = false;
      node.classList.add('is-visible');
      const chartRect = chart.getBoundingClientRect();
      const shellRect = widget.getBoundingClientRect();
      const anchorX = chartRect.left - shellRect.left + point.x;
      const anchorY = chartRect.top - shellRect.top + point.y;
      const left = Math.min(widget.clientWidth - node.offsetWidth - 8, Math.max(8, anchorX - node.offsetWidth / 2));
      const top = Math.max(8, anchorY - node.offsetHeight - 14);
      node.style.left = `${left}px`;
      node.style.top = `${top}px`;
    }

    function nearestPoint(event) {
      if (!chart || !chartPoints.length) return null;
      const rect = chart.getBoundingClientRect();
      const mouseX = event.clientX - rect.left;
      const mouseY = event.clientY - rect.top;
      if (mouseX < 0 || mouseX > rect.width || mouseY < 0 || mouseY > rect.height) return null;
      let nearest = null;
      let nearestDistance = Infinity;
      chartPoints.forEach((point) => {
        const distance = Math.hypot(mouseX - point.x, mouseY - point.y);
        if (distance < nearestDistance) {
          nearest = point;
          nearestDistance = distance;
        }
      });
      return nearestDistance <= 28 ? nearest : null;
    }

    function handleChartPointer(event) {
      const point = nearestPoint(event);
      if (point) showTooltip(point);
      else hideTooltip();
    }

    function drawChart() {
      hideTooltip();
      chartPoints = [];
      activeSeries = null;
      if (!chart || !selector || !pageData) return;
      const previousContext = chart.getContext('2d');
      if (previousContext) previousContext.clearRect(0, 0, chart.width, chart.height);
      chart.hidden = true;
      if (singleNode) {
        singleNode.replaceChildren();
        singleNode.hidden = true;
      }
      if (legendNode) {
        legendNode.replaceChildren();
        legendNode.hidden = true;
      }
      if (unitNode) unitNode.textContent = '';
      if (tooltip) {
        tooltip.textContent = '';
        tooltip.style.left = '';
        tooltip.style.top = '';
      }
      const seriesList = pageData.series_groups?.[group] || [];
      const series = seriesList.find((item) => item.series_id === selector.value);
      if (!series) return;
      activeSeries = series;
      const fullRecords = series.records || [];
      const chartRecords = fullRecords.slice(-Math.max(1, Number(series.chart_window) || 8));
      if (summaryBody) {
        summaryBody.replaceChildren();
        const visibleRows = [...fullRecords].reverse().slice(0, 6);
        const hasComparison = visibleRows.some((row) => row.yoy !== null && row.yoy !== undefined || row.yoy_pp !== null && row.yoy_pp !== undefined);
        if (summaryChangeHead) summaryChangeHead.hidden = !hasComparison;
        visibleRows.forEach((row) => {
          const tr = document.createElement('tr');
          const period = document.createElement('td');
          period.textContent = row.display_period || row.period;
          const value = document.createElement('td');
          const strong = document.createElement('strong');
          strong.textContent = Number(row.value).toLocaleString('zh-CN', { maximumFractionDigits: 2 });
          const unit = document.createElement('small');
          unit.textContent = ` ${series.display_unit || series.unit || ''}`;
          value.append(strong, unit);
          if (hasComparison) {
            const change = document.createElement('td');
            const comparison = row.yoy_pp ?? row.yoy;
            if (comparison === null || comparison === undefined) {
              change.textContent = '—';
              change.className = 'muted';
            } else {
              change.textContent = `${comparison > 0 ? '+' : ''}${Number(comparison).toFixed(2)}${row.yoy_pp !== null && row.yoy_pp !== undefined ? ' 个百分点' : '%'}`;
              change.className = comparison > 0 ? 'positive' : comparison < 0 ? 'negative' : '';
            }
            tr.append(period, value, change);
          } else {
            tr.append(period, value);
          }
          summaryBody.append(tr);
        });
      }
      if (chartRecords.length === 1) {
        chart.hidden = true;
        if (singleNode) {
          singleNode.replaceChildren();
          const label = document.createElement('small');
          label.textContent = chartRecords[0].display_period || chartRecords[0].period;
          const value = document.createElement('strong');
          value.textContent = formatValue(Number(chartRecords[0].value), series.display_unit || series.unit);
          const note = document.createElement('span');
          note.textContent = '当前仅有一期可比数据';
          singleNode.append(label, value, note);
          singleNode.hidden = false;
        }
        if (unitNode) unitNode.textContent = `单位：${series.display_unit || series.unit}`;
        chart.setAttribute('aria-label', `${series.label}单值`);
        return;
      }
      chart.hidden = false;
      if (singleNode) singleNode.hidden = true;
      if (legendNode) legendNode.hidden = false;
      const rect = chart.getBoundingClientRect();
      const scale = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.max(320, rect.width);
      const height = 300;
      chart.width = width * scale;
      chart.height = height * scale;
      const ctx = chart.getContext('2d');
      ctx.scale(scale, scale);
      ctx.clearRect(0, 0, width, height);
      const pad = { left: 66, right: 52, top: 22, bottom: 48 };
      const values = chartRecords.map((row) => Number.isFinite(Number(row.value)) ? Number(row.value) : null);
      const actual = values.filter((value) => value !== null);
      if (!actual.length) return;
      let min = Math.min(...actual), max = Math.max(...actual);
      if (min === max) { min -= 1; max += 1; }
      const spread = max - min;
      min -= spread * 0.12;
      max += spread * 0.12;
      const x = (index) => pad.left + (width - pad.left - pad.right) * (values.length === 1 ? 0.5 : index / (values.length - 1));
      const y = (value) => pad.top + (height - pad.top - pad.bottom) * (1 - (value - min) / (max - min));
      ctx.font = '11px system-ui';
      ctx.fillStyle = '#71717a';
      ctx.strokeStyle = '#e5e5eb';
      ctx.lineWidth = 1;
      for (let index = 0; index <= 4; index += 1) {
        const yy = pad.top + (height - pad.top - pad.bottom) * index / 4;
        const value = max - (max - min) * index / 4;
        ctx.beginPath();
        ctx.moveTo(pad.left, yy);
        ctx.lineTo(width - pad.right, yy);
        ctx.stroke();
        ctx.fillText(Math.abs(value) >= 1000 ? value.toLocaleString(undefined, { maximumFractionDigits: 0 }) : value.toFixed(1), 4, yy + 4);
      }
      chartRecords.forEach((row, index) => {
        ctx.fillStyle = '#68716c';
        ctx.textAlign = 'center';
        ctx.fillText(row.display_period || row.period, x(index), height - 20);
      });
      ctx.strokeStyle = '#6332FF';
      ctx.lineWidth = 3;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      let open = false;
      values.forEach((value, index) => {
        if (value === null) { open = false; return; }
        if (!open) { ctx.beginPath(); ctx.moveTo(x(index), y(value)); open = true; }
        else ctx.lineTo(x(index), y(value));
        const nextMissing = index === values.length - 1 || values[index + 1] === null;
        if (nextMissing) { ctx.stroke(); open = false; }
      });
      values.forEach((value, index) => {
        if (value === null) return;
        const point = { x: x(index), y: y(value), value, record: chartRecords[index] };
        chartPoints.push(point);
        ctx.beginPath();
        ctx.arc(point.x, point.y, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.strokeStyle = '#6332FF';
        ctx.lineWidth = 2;
        ctx.stroke();
      });
      if (unitNode) unitNode.textContent = `单位：${series.display_unit || series.unit}`;
      const cardinality = chartRecords.length === 2 ? '两期比较（不称为趋势）' : `最近 ${chartRecords.length} 期趋势`;
      if (legendNode) legendNode.textContent = `${series.label} · ${cardinality} · 悬停或点击数据点查看数值 · 不跨频率连线${series.series_break_note ? ` · ${series.series_break_note}` : ''}`;
      chart.setAttribute('aria-label', `${series.label}${chartRecords.length === 2 ? '两期比较' : '趋势图'}`);
    }

    const configuredDefault = widget.dataset.defaultSeries || pageData?.default_series_by_group?.[group];
    const trendSeries = pageData?.series_groups?.[group] || [];
    if (selector && configuredDefault && trendSeries.some((item) => item.series_id === configuredDefault)) {
      selector.value = configuredDefault;
    }
    selector?.addEventListener('change', drawChart);
    chart?.addEventListener('pointermove', handleChartPointer);
    chart?.addEventListener('pointerdown', handleChartPointer);
    chart?.addEventListener('pointerleave', hideTooltip);
    window.addEventListener('resize', drawChart);
    drawChart();
  }

  document.querySelectorAll('.trend-widget').forEach(setupTrendWidget);
})();
