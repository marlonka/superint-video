// Resolve the user's theme before Studio paints. No network or user data leaves the app.
(() => {
  let saved;
  try {
    saved = localStorage.getItem('superint-theme');
  } catch {
    /* Storage can be disabled. */
  }
  const theme =
    saved === 'dark' || saved === 'light'
      ? saved
      : matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light';
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  const chrome = document.querySelector('meta[name="theme-color"]');
  if (chrome) chrome.content = theme === 'dark' ? '#0e0e0e' : '#f7f7f7';
})();
