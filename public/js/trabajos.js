document.addEventListener('DOMContentLoaded', () => {
  const form = qs('#filters');
  const tbody = qs('#tbody');
  const meta = qs('#meta');
  const loading = qs('#loading');
  const btnClear = qs('#btn-clear');

  const load = debounce(async () => {
    setLoading(loading, true);
    try {
      const params = Object.fromEntries(new FormData(form).entries());
      const query = toQuery({ ...params, page: 1, pageSize: 100 });

      const res = await fetchJson(`/api/trabajos?${query}`);
      const rows = res.data || [];
      meta.textContent = `Mostrando ${rows.length} de ${res.meta?.total ?? rows.length} (últimos)`;

      if (!rows.length) {
        tbody.innerHTML = `<tr><td colspan="9" class="text-muted">Sin resultados.</td></tr>`;
        return;
      }

      tbody.innerHTML = rows.map(r => `
        <tr>
          <td>#${r.id}</td>
          <td>${safeText(r.fecha_creacion)}</td>
          <td class="text-truncate" style="max-width: 360px;">${escapeHtml(safeText(r.descripcion))}</td>
          <td><span class="badge ${badgeEstado(r.estado)}">${escapeHtml(safeText(r.estado))}</span></td>
          <td>${escapeHtml(safeText(r.tipo))}</td>
          <td>${escapeHtml(safeText(r.ubicacion))}</td>
          <td>${escapeHtml(safeText(r.prioridad || ''))}</td>
          <td>
            ${r.atrasado ? '<span class="badge bg-danger">Atrasado</span>' : '<span class="text-muted small">OK</span>'}
            ${Number.isInteger(r.dias_abierto) ? `<div class="text-muted small">${r.dias_abierto}d</div>` : ''}
          </td>
          <td class="text-end">
            <a class="btn btn-sm btn-outline-primary" href="/trabajos/${r.id}">Ver</a>
          </td>
        </tr>
      `).join('');
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="9" class="text-danger">Error: ${escapeHtml(err.message || 'No se pudo cargar')}</td></tr>`;
    } finally {
      setLoading(loading, false);
    }
  }, 250);

  // Escape básico para evitar inyección en innerHTML
  function escapeHtml(str) {
    return String(str)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  qsa('input,select', form).forEach(el => el.addEventListener('input', load));
  btnClear.addEventListener('click', () => {
    form.reset();
    load();
  });

  load();
});
