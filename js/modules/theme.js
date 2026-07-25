const STORAGE_KEY = 'meraj-theme';

function getPreferredTheme() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'light' || stored === 'dark') {
    return stored;
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  document.body.setAttribute('data-theme', theme);
  document.querySelectorAll('[data-theme-toggle]').forEach((button) => {
    const icon = button.querySelector('i');
    if (!icon) return;
    icon.className = theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
  });
}

function toggleTheme() {
  const nextTheme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  localStorage.setItem(STORAGE_KEY, nextTheme);
  applyTheme(nextTheme);
}

function initTheme() {
  applyTheme(getPreferredTheme());
  document.querySelectorAll('[data-theme-toggle]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.preventDefault();
      toggleTheme();
    });
  });
}

export { initTheme, toggleTheme, applyTheme, getPreferredTheme };
