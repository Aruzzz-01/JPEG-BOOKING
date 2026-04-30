document.addEventListener('DOMContentLoaded', () => {
  const user = Auth.protectPage('staff');
  if (!user) return;

  // 1. Accordion Toggle
  document.querySelectorAll('.settings-header').forEach(header => {
    header.addEventListener('click', () => {
      header.parentElement.classList.toggle('open');
    });
  });

  // 2. Live Preview Logic (See changes instantly)
  const themeSelect = document.getElementById('themeSelect');
  const previewArea = document.getElementById('previewArea');

  if (themeSelect && previewArea) {
    themeSelect.addEventListener('change', (e) => {
      const theme = e.target.value;
      // Apply to preview card only
      if (theme === 'light') {
        previewArea.style.backgroundColor = "#ffffff";
        previewArea.style.color = "#111111";
      } else {
        previewArea.style.backgroundColor = "#3a2a55";
        previewArea.style.color = "#ffffff";
      }
    });
  }

  // 3. Permanent Save
  const saveBtn = document.querySelector('.save-category-btn');
  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      const selectedTheme = themeSelect.value;
      
      // Save to LocalStorage for the whole app to use
      localStorage.setItem('theme', selectedTheme);
      
      // Apply to the actual page immediately
      document.documentElement.setAttribute('data-theme', selectedTheme);
      
      alert('Staff preferences updated!');
    });
  }
});