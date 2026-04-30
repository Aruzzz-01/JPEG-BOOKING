/**
 * THEME.JS - Global Theme Manager
 * Place this script in the <head> of every HTML file to prevent flickering.
 */

// 1. IMMEDIATE EXECUTION
// This runs before the body is parsed, ensuring the correct colors are set instantly.
(function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
})();

// 2. DOM CONTENT LOADED
// Handles the dropdown logic once the HTML elements exist.
document.addEventListener('DOMContentLoaded', () => {
    const themeSelect = document.getElementById('themeSelect');
    const currentTheme = localStorage.getItem('theme') || 'dark';

    if (themeSelect) {
        // Synchronize the dropdown value with the active theme
        themeSelect.value = currentTheme;

        // Listen for manual changes
        themeSelect.addEventListener('change', () => {
            const newTheme = themeSelect.value;
            applyTheme(newTheme);
        });
    }
});

/**
 * Global helper to apply theme and save state
 * @param {string} theme - 'light' or 'dark'
 */
// Change this function to ONLY change the look
function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    // Remove the localStorage.setItem line from here!
}

document.addEventListener('DOMContentLoaded', () => {
    const themeSelect = document.getElementById('themeSelect');
    if (themeSelect) {
        themeSelect.addEventListener('change', () => {
            applyTheme(themeSelect.value); // Just previews the change
        });
    }
});

// 3. MULTI-TAB SYNCHRONIZATION
// If you change the theme in Settings, this updates all other open tabs (Dashboard/Scanner)
window.addEventListener('storage', (event) => {
    if (event.key === 'theme') {
        const newTheme = event.newValue;
        document.documentElement.setAttribute('data-theme', newTheme);
        
        // Also update the dropdown if it exists on the current page
        const themeSelect = document.getElementById('themeSelect');
        if (themeSelect) {
            themeSelect.value = newTheme;
        }
    }
});