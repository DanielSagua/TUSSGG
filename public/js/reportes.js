document.addEventListener('DOMContentLoaded', () => {
  const form = qs('#form-filtros');
  const sp = qs('#sp-loading');

  const elFrom = qs('#f-from');
  const elTo = qs('#f-to');
  const elEstado = qs('#f-estado');
  const elTipo = qs('#f-tipo');
  const elUbicacion = qs('#f-ubicacion');
  const elPrioridad = qs('#f-prioridad');
  const elSearch = qs('#f-search');

  const btnCsv = qs('#btn-export-csv');
  const btnXlsx = qs('#btn-export-xlsx');

  // KPI elements
  const kpi = {
    total: qs('#kpi-total'),
    abiertos: qs('#kpi-abiertos'),
    cerrados: qs('#kpi-cerrados'),
    atrasados: qs('#kpi-atrasados'),
    avgCierre: qs('#kpi-avg-cierre'),
    medianaCierre: qs('#kpi-mediana-cierre')
  };

  const tbl = {
    estado: qs('#tbl-estado'),
    tipo: qs('#tbl-tipo'),
    ubicacion: qs('#tbl-ubicacion'),
    prioridad: qs('#tbl-prioridad'),
    proveedores: qs('#tbl-proveedores')
  };

  const nfCL = new Intl.NumberFormat('es-CL');
  const nfCLP = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 });

  function toLocalISODate(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function setDefaultDatesIfEmpty() {
    const today = new Date();
    const from = new Date(today);
    from.setDate(from.getDate() - 30);

    if (elFrom && !elFrom.value) elFrom.value = toLocalISODate(from);
    if (elTo && !elTo.value) elTo.value = toLocalISODate(today);
  }

  function buildParams() {
    const params = new URLSearchParams();

    const from = (elFrom?.value || '').trim();
    const to = (elTo?.value || '').trim();
    const estado = (elEstado?.value || '').trim();
    const tipo = (elTipo?.value || '').trim();
    const ubicacion = (elUbicacion?.value || '').trim();
    const prioridad = (elPrioridad?.value || '').trim();
    const search = (elSearch?.value || '').trim();

    if (from) params.set('from', from);
    if (to) params.set('to', to);
    if (estado) params.set('estado', estado);
    if (tipo) params.set('tipo', tipo);
    if (ubicacion) params.set('ubicacion', ubicacion);
    if (prioridad) params.set('prioridad', prioridad);
    if (search) params.set('search', search);

    return params;
  }

  function updateExportLinks(params) {
    const q = params.toString();
    const qs = q ? `?${q}` : '';
    if (btnCsv) btnCsv.href = `/api/trabajos/export.csv${qs}`;
    if (btnXlsx) btnXlsx.href = `/api/trabajos/export.xlsx${qs}`;
  }

  function renderTwoCol(tbody, items, labelKey) {
    if (!tbody) return;
    if (!items?.length) {
      tbody.innerHTML = `<tr><td colspan="2" class="text-muted">Sin datos.</td></tr>`;
      return;
    }
    tbody.innerHTML = items.map(x => `
      <tr>
        <td>${escapeHtml(safeText(x[labelKey] || '—'))}</td>
        <td class="text-end">${escapeHtml(nfCL.format(Number(x.total || 0)))}</td>
      </tr>
    `).join('');
  }

  function renderProveedores(tbody, items) {
    if (!tbody) return;
    if (!items?.length) {
      tbody.innerHTML = `<tr><td colspan="3" class="text-muted">Sin datos.</td></tr>`;
      return;
    }
    tbody.innerHTML = items.map(x => `
      <tr>
        <td>${escapeHtml(safeText(x.proveedor || '—'))}</td>
        <td class="text-end">${escapeHtml(nfCL.format(Number(x.total || 0)))}</td>
        <td class="text-end">${escapeHtml(nfCLP.format(Number(x.monto_total || 0)))}</td>
      </tr>
    `).join('');
  }

  async function load() {
    const params = buildParams();
    updateExportLinks(params);

    if (sp) sp.classList.remove('d-none');

    try {
      const res = await fetchJson(`/api/reportes/resumen?${params.toString()}`);
      const d = res.data;

      if (kpi.total) kpi.total.textContent = nfCL.format(d.kpis.total || 0);
      if (kpi.abiertos) kpi.abiertos.textContent = nfCL.format(d.kpis.abiertos || 0);
      if (kpi.cerrados) kpi.cerrados.textContent = nfCL.format(d.kpis.cerrados_rango || 0);
      if (kpi.atrasados) kpi.atrasados.textContent = nfCL.format(d.kpis.atrasados_sla || 0);

      if (kpi.avgCierre) kpi.avgCierre.textContent = (d.kpis.avg_dias_cierre == null) ? '—' : nfCL.format(Math.round(d.kpis.avg_dias_cierre));
      if (kpi.medianaCierre) kpi.medianaCierre.textContent = (d.kpis.median_dias_cierre == null) ? '—' : nfCL.format(Math.round(d.kpis.median_dias_cierre));

      renderTwoCol(tbl.estado, d.porEstado, 'estado');
      renderTwoCol(tbl.tipo, d.porTipo, 'tipo');
      renderTwoCol(tbl.ubicacion, d.porUbicacion, 'ubicacion');
      renderTwoCol(tbl.prioridad, d.porPrioridad, 'prioridad');
      renderProveedores(tbl.proveedores, d.topProveedores);

    } catch (err) {
      showToast('Error', err.message || 'No se pudieron cargar los reportes.');
    } finally {
      if (sp) sp.classList.add('d-none');
    }
  }

  setDefaultDatesIfEmpty();
  load();

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      await load();
    });
  }
});
