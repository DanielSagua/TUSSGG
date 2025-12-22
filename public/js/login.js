document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('form-login');
  const clave = document.getElementById('clave');
  const btn = document.getElementById('btn-login');
  const spinner = document.getElementById('spinner-login');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    form.classList.add('was-validated');
    if (!clave.value.trim()) {
      clave.focus();
      return;
    }

    btn.disabled = true;
    spinner.classList.remove('d-none');

    try {
      await fetchJson('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clave: clave.value })
      });

      window.location.href = '/trabajos';
    } catch (err) {
      showToast('Login', err.message || 'Clave incorrecta');
      clave.select();
    } finally {
      btn.disabled = false;
      spinner.classList.add('d-none');
    }
  });
});
