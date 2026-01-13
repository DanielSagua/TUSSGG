(function () {
  const STORAGE_KEY = 'tussgg-theme';

  function getPreferredTheme() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'dark' || saved === 'light') return saved;

    const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)')?.matches;
    return prefersDark ? 'dark' : 'light';
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-bs-theme', theme);
  }

  function setToggleUI(theme) {
    const toggle = document.getElementById('themeToggle');
    const label = document.getElementById('themeToggleLabel');
    if (!toggle || !label) return;

    toggle.checked = theme === 'dark';
    label.textContent = theme === 'dark' ? '🌙' : '☀️';
  }

  // Aplicar tema lo antes posible
  const initial = getPreferredTheme();
  applyTheme(initial);

  document.addEventListener('DOMContentLoaded', () => {
    setToggleUI(getPreferredTheme());

    const toggle = document.getElementById('themeToggle');
    if (!toggle) return;

    toggle.addEventListener('change', () => {
      const next = toggle.checked ? 'dark' : 'light';
      localStorage.setItem(STORAGE_KEY, next);
      applyTheme(next);
      setToggleUI(next);
    });
  });
})();
