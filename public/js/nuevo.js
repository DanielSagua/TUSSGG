document.addEventListener('DOMContentLoaded', () => {
  const form = qs('#form-nuevo');
  const btn = qs('#btn-guardar');
  const spinner = qs('#spinner-guardar');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    form.classList.add('was-validated');
    if (!form.checkValidity()) {
      showToast('Validación', 'Revisa los campos obligatorios.');
      return;
    }

    // Validación de archivos (antes/después máx 2)
    const antes = form.querySelector('input[name="antes"]').files;
    const despues = form.querySelector('input[name="despues"]').files;

    if (antes.length > 2) return showToast('Adjuntos', 'Imagen antes: máximo 2 archivos.');
    if (despues.length > 2) return showToast('Adjuntos', 'Imagen después: máximo 2 archivos.');

    btn.disabled = true;
    spinner.classList.remove('d-none');

    try {
      const fd = new FormData(form);
      const res = await fetchJson('/api/trabajos', { method: 'POST', body: fd });

      showToast('OK', 'Trabajo creado correctamente.');
      window.location.href = `/trabajos/${res.data.id}`;
    } catch (err) {
      if (err.data?.fields) {
        showToast('Validación', Object.values(err.data.fields).join(' '));
      } else {
        showToast('Error', err.message || 'No se pudo crear el trabajo.');
      }
    } finally {
      btn.disabled = false;
      spinner.classList.add('d-none');
    }
  });
});
