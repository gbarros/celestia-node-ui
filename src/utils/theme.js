/**
 * Theme management utilities for light/dark mode
 */

/**
 * Get the preferred theme from localStorage or OS preference
 * @returns {string} - 'light' or 'dark'
 */
export function getPreferredTheme() {
  // Check if theme is saved in localStorage
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme) {
    return savedTheme;
  }
  
  // Otherwise, check OS preference
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/**
 * Apply the theme to the document
 * @param {string} theme - 'light' or 'dark'
 */
export function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);
  
  // Update icons visibility
  const lightIcon = document.getElementById('lightIcon');
  const darkIcon = document.getElementById('darkIcon');
  
  if (lightIcon && darkIcon) {
    lightIcon.style.display = theme === 'light' ? 'none' : 'inline-block';
    darkIcon.style.display = theme === 'dark' ? 'none' : 'inline-block';
  }
  
  // Update Bootstrap elements for dark mode
  updateBootstrapForDarkMode(theme === 'dark');
}

/**
 * Update Bootstrap elements for dark mode
 * @param {boolean} isDark - Whether dark mode is active
 */
function updateBootstrapForDarkMode(isDark) {
  // Update form controls
  const formControls = document.querySelectorAll('.form-control, .form-select');
  formControls.forEach(control => {
    if (isDark) {
      control.classList.add('form-control-dark');
      control.style.backgroundColor = '#333';
      control.style.borderColor = '#444';
      control.style.color = '#e6e6e6';
    } else {
      control.classList.remove('form-control-dark');
      control.style.backgroundColor = '';
      control.style.borderColor = '';
      control.style.color = '';
    }
  });
  
  // Update input groups
  const inputGroups = document.querySelectorAll('.input-group-text');
  inputGroups.forEach(group => {
    if (isDark) {
      group.style.backgroundColor = '#444';
      group.style.borderColor = '#555';
      group.style.color = '#e6e6e6';
    } else {
      group.style.backgroundColor = '';
      group.style.borderColor = '';
      group.style.color = '';
    }
  });
}

/**
 * Initialize theme functionality
 */
export function initTheme() {
  // Apply initial theme
  const theme = getPreferredTheme();
  applyTheme(theme);
  
  // Set up theme toggle
  const themeToggle = document.getElementById('themeToggle');
  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      const currentTheme = document.documentElement.getAttribute('data-theme');
      const newTheme = currentTheme === 'light' ? 'dark' : 'light';
      applyTheme(newTheme);
    });
  }
  
  // Add observer to watch for dark mode changes
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.attributeName === 'data-theme') {
        const theme = document.documentElement.getAttribute('data-theme');
        updateBootstrapForDarkMode(theme === 'dark');
      }
    });
  });
  
  observer.observe(document.documentElement, { attributes: true });
  
  // Listen for OS theme changes
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    if (!localStorage.getItem('theme')) {
      // Only auto-switch if user hasn't manually set a preference
      applyTheme(e.matches ? 'dark' : 'light');
    }
  });
}
