document.addEventListener('DOMContentLoaded', async () => {
  const id = Number(window.__TRABAJO_ID__);
  const subtitle = qs('#job-subtitle');
  const estadoActual = qs('#estado-actual');
  const gallery = qs('#gallery');

  const formEditar = qs('#form-editar');
  const btnGuardar = qs('#btn-guardar');
  const spGuardar = qs('#spinner-guardar');

  const formAdj = qs('#form-adjuntos');
  const btnSubir = qs('#btn-subir');
  const spSubir = qs('#spinner-subir');

  async function load() {
    try {
      const res = await fetchJson(`/api/trabajos/${id}`);
      const t = res.data;

      subtitle.textContent = `Creado: ${t.fecha_creacion_str || t.fecha_creacion} • Ubicación: ${t.ubicacion_nombre} • Tipo: ${t.tipo_nombre}`;
      estadoActual.textContent = `Estado: ${t.estado_nombre}`;

      // fill form
      setVal('creado_por_nombre', t.creado_por_nombre);
      setVal('creado_por_correo', t.creado_por_correo);
      setVal('proveedor', t.proveedor);
      setVal('orden_compra', t.orden_compra);
      setVal('descripcion', t.descripcion);
      setVal('ubicacion_id', t.ubicacion_id);
      setVal('tipo_id', t.tipo_id);
      setVal('estado_id', t.estado_id);
      setVal('valor_neto', t.valor_neto);
      setVal('fecha_reparacion', t.fecha_reparacion ? String(t.fecha_reparacion).slice(0,10) : '');
      setVal('solicitado_por', t.solicitado_por);
      setVal('observaciones', t.observaciones);
      setVal('prioridad_id', t.prioridad_id);
      setVal('fecha_objetivo', t.fecha_objetivo ? String(t.fecha_objetivo).slice(0,10) : '');
      setVal('responsable_nombre', t.responsable_nombre);
      setVal('responsable_correo', t.responsable_correo);

      renderGallery(t.adjuntos || []);
    } catch (err) {
      showToast('Error', err.message || 'No se pudo cargar el detalle.');
      subtitle.textContent = 'Error al cargar.';
    }
  }

  function setVal(name, value) {
    const el = formEditar.querySelector(`[name="${name}"]`);
    if (!el) return;
    el.value = value === null || value === undefined ? '' : String(value);
  }

  function renderGallery(adjuntos) {
    if (!adjuntos.length) {
      gallery.innerHTML = `<div class="col-12 text-muted">Sin imágenes.</div>`;
      return;
    }

    gallery.innerHTML = adjuntos.map(a => `
      <div class="col-6">
        <div class="border rounded-3 p-2 bg-white">
          <div class="d-flex justify-content-between align-items-center mb-2">
            <span class="badge bg-dark">${escapeHtml(a.tipo_adjunto || a.tipo || '')}</span>
            <button class="btn btn-sm btn-outline-danger" data-del="${a.id}">Eliminar</button>
          </div>
          <a href="${a.ruta_archivo}" target="_blank" rel="noopener">
            <img class="gallery-img" src="${a.ruta_archivo}" alt="adjunto">
          </a>
        </div>
      </div>
    `).join('');

    qsa('button[data-del]', gallery).forEach(btn => {
      btn.addEventListener('click', async () => {
        const adjId = Number(btn.getAttribute('data-del'));
        if (!Number.isInteger(adjId)) return;
        if (!confirm('¿Eliminar adjunto?')) return;

        btn.disabled = true;
        try {
          await fetchJson(`/api/adjuntos/${adjId}`, { method: 'DELETE' });
          showToast('OK', 'Adjunto eliminado.');
          await load();
        } catch (err) {
          showToast('Error', err.message || 'No se pudo eliminar.');
          btn.disabled = false;
        }
      });
    });
  }

  // Escape básico para evitar inyección en innerHTML
  function escapeHtml(str) {
    return String(str)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

// Comentarios
const formComentario = qs('#form-comentario');
const inputComentario = qs('#comentario-texto');
const btnComentar = qs('#btn-comentar');
const spComentar = qs('#spinner-comentar');
const boxComentarios = qs('#comentarios');

// Bitácora
const boxLogs = qs('#logs');

async function loadComentarios() {
  if (!boxComentarios) return;
  const res = await fetchJson(`/api/trabajos/${id}/comentarios`);
  const items = res.data || [];
  if (!items.length) {
    boxComentarios.innerHTML = `<div class="text-muted">Sin comentarios.</div>`;
    return;
  }
  boxComentarios.innerHTML = items.map(c => `
    <div class="border rounded-3 p-2 bg-white">
      <div class="d-flex justify-content-between align-items-center">
        <div class="small text-muted">
          ${escapeHtml(c.autor_nombre || '—')} • ${escapeHtml(c.fecha_creacion || '')}
        </div>
        <button class="btn btn-sm btn-outline-danger" data-del-com="${c.id}">Eliminar</button>
      </div>
      <div class="mt-1">${escapeHtml(c.comentario)}</div>
    </div>
  `).join('');

  qsa('button[data-del-com]', boxComentarios).forEach(b => {
    b.addEventListener('click', async () => {
      const cid = Number(b.getAttribute('data-del-com'));
      if (!confirm('¿Eliminar comentario?')) return;
      b.disabled = true;
      try {
        await fetchJson(`/api/comentarios/${cid}`, { method: 'DELETE' });
        showToast('OK', 'Comentario eliminado.');
        await loadComentarios();
        await loadLogs();
      } catch (err) {
        showToast('Error', err.message || 'No se pudo eliminar.');
        b.disabled = false;
      }
    });
  });
}

async function loadLogs() {
  if (!boxLogs) return;
  const res = await fetchJson(`/api/trabajos/${id}/logs`);
  const items = res.data || [];
  if (!items.length) {
    boxLogs.innerHTML = `<div class="text-muted">Sin registros.</div>`;
    return;
  }
  boxLogs.innerHTML = items.map(l => `
    <div class="border rounded-3 p-2 bg-white">
      <div class="d-flex justify-content-between align-items-center">
        <div class="small">
          <span class="badge bg-dark">${escapeHtml(l.accion)}</span>
          <span class="text-muted ms-2">${escapeHtml(l.fecha || '')}</span>
        </div>
        <div class="small text-muted">${escapeHtml(l.actor_nombre || '')}</div>
      </div>
      ${l.detalle_json ? `<pre class="mt-2 mb-0 small text-muted" style="white-space: pre-wrap;">${escapeHtml(JSON.stringify(l.detalle_json, null, 2))}</pre>` : ''}
    </div>
  `).join('');
}

if (formComentario) {
  formComentario.addEventListener('submit', async (e) => {
    e.preventDefault();
    const txt = (inputComentario?.value || '').trim();
    if (!txt) return;

    btnComentar.disabled = true;
    spComentar.classList.remove('d-none');

    try {
      await fetchJson(`/api/trabajos/${id}/comentarios`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comentario: txt })
      });
      inputComentario.value = '';
      await loadComentarios();
      await loadLogs();
      showToast('OK', 'Comentario agregado.');
    } catch (err) {
      showToast('Error', err.message || 'No se pudo agregar.');
    } finally {
      btnComentar.disabled = false;
      spComentar.classList.add('d-none');
    }
  });
}

  // Guardar cambios
  formEditar.addEventListener('submit', async (e) => {
    e.preventDefault();
    formEditar.classList.add('was-validated');
    if (!formEditar.checkValidity()) {
      showToast('Validación', 'Revisa los campos obligatorios.');
      return;
    }

    btnGuardar.disabled = true;
    spGuardar.classList.remove('d-none');

    try {
      const payload = Object.fromEntries(new FormData(formEditar).entries());
      delete payload.id;

      await fetchJson(`/api/trabajos/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      showToast('OK', 'Cambios guardados.');
      await load();
    } catch (err) {
      showToast('Error', err.message || 'No se pudo guardar.');
    } finally {
      btnGuardar.disabled = false;
      spGuardar.classList.add('d-none');
    }
  });

  // Estado rápido (por nombre)
  qsa('button[data-estado]').forEach(b => {
    b.addEventListener('click', async () => {
      const estadoNombre = b.getAttribute('data-estado');
      const select = formEditar.querySelector('[name="estado_id"]');
      const option = Array.from(select.options).find(o => o.text.trim().toLowerCase() === estadoNombre.trim().toLowerCase());
      if (!option) return showToast('Estado', 'No se encontró el estado en el catálogo.');

      b.disabled = true;
      try {
        await fetchJson(`/api/trabajos/${id}/estado`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ estado_id: Number(option.value) })
        });

        showToast('OK', `Estado cambiado a ${estadoNombre}.`);
        await load();
      } catch (err) {
        showToast('Error', err.message || 'No se pudo cambiar el estado.');
      } finally {
        b.disabled = false;
      }
    });
  });

  // Subir adjuntos
  formAdj.addEventListener('submit', async (e) => {
    e.preventDefault();

    const antes = formAdj.querySelector('input[name="antes"]').files;
    const despues = formAdj.querySelector('input[name="despues"]').files;
    if (antes.length > 2) return showToast('Adjuntos', 'Imagen antes: máximo 2 archivos.');
    if (despues.length > 2) return showToast('Adjuntos', 'Imagen después: máximo 2 archivos.');

    btnSubir.disabled = true;
    spSubir.classList.remove('d-none');

    try {
      const fd = new FormData(formAdj);
      await fetchJson(`/api/trabajos/${id}/adjuntos`, { method: 'POST', body: fd });

      showToast('OK', 'Adjuntos subidos.');
      formAdj.reset();
      await load();
    } catch (err) {
      showToast('Error', err.message || 'No se pudo subir.');
    } finally {
      btnSubir.disabled = false;
      spSubir.classList.add('d-none');
    }
  });

  await load();
});
