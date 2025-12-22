function qs(sel, root = document) { return root.querySelector(sel); }
function qsa(sel, root = document) { return Array.from(root.querySelectorAll(sel)); }

function debounce(fn, delay = 300) {
  let t = null;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), delay);
  };
}

function showToast(title, message) {
  const t = qs('#app-toast');
  if (!t) return alert(message);

  qs('#toast-title').textContent = title || 'Mensaje';
  qs('#toast-body').textContent = message || '';

  const toast = bootstrap.Toast.getOrCreateInstance(t, { delay: 3500 });
  toast.show();
}

async function fetchJson(url, options = {}) {
  const res = await fetch(url, options);
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const msg = data?.message || 'Error en la solicitud';
    const err = new Error(msg);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

function setLoading(el, isLoading) {
  if (!el) return;
  el.style.display = isLoading ? '' : 'none';
}

function toQuery(params) {
  const p = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null || String(v).trim() === '') return;
    p.set(k, String(v));
  });
  return p.toString();
}

function badgeEstado(estado) {
  const e = String(estado || '').toLowerCase();
  if (e === 'cerrado') return 'bg-success';
  if (e === 'en curso' || e === 'encurso') return 'bg-primary';
  if (e === 'pendiente') return 'bg-secondary';
  return 'bg-dark';
}

function safeText(v) {
  return (v === null || v === undefined) ? '' : String(v);
}

// Escape HTML (para evitar XSS al renderizar strings)
function escapeHtml(str) {
  return String(str ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
