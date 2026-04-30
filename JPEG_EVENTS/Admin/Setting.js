(() => {
    // ==========================================
    // CONFIG & HELPERS (Scoped to this file)
    // ==========================================
    // REMOVED: API_BASE = "http://localhost:3000" to fix connection issues
    const getToken = () => localStorage.getItem('token');

    document.addEventListener('DOMContentLoaded', () => {
        
        // 1. SECURITY CHECK
        if (typeof Auth !== 'undefined') {
            const user = Auth.protectPage('admin');
            if (!user) return; 
        }

        // ==========================================
        // UI LOGIC: Accordion (Single-Open Logic)
        // ==========================================
        document.querySelectorAll('.settings-header').forEach(header => {
            header.addEventListener('click', () => {
                const category = header.parentElement;
                const content = category.querySelector('.settings-content');
                const isOpen = category.classList.contains('open');

                // Close all other categories
                document.querySelectorAll('.settings-category').forEach(el => {
                    el.classList.remove('open');
                    const elContent = el.querySelector('.settings-content');
                    if (elContent) elContent.style.maxHeight = null;
                });

                if (!isOpen) {
                    category.classList.add('open');
                    if (content) {
                        content.style.maxHeight = content.scrollHeight + 30 + "px"; 
                    }
                }
            });
        });

        // ==========================================
        // THEME PREVIEW & MANAGEMENT
        // ==========================================
        const themeSelect = document.getElementById('themeSelect');
        const previewArea = document.getElementById('previewArea');

        if (themeSelect) {
            const currentTheme = localStorage.getItem('theme') || 'dark';
            themeSelect.value = currentTheme;

            themeSelect.addEventListener('change', (e) => {
                const theme = e.target.value;
                document.documentElement.setAttribute('data-theme', theme);

                if (previewArea) {
                    const isLight = theme === 'light';
                    previewArea.style.backgroundColor = isLight ? "#ffffff" : "#3a2a55";
                    previewArea.style.color = isLight ? "#111111" : "#ffffff";
                }
            });
        }

        // ==========================================
        // SAVE ACTIONS
        // ==========================================
        document.querySelectorAll('.save-category-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const categoryId = btn.dataset.category;
                const token = getToken();

                if (!token) {
                    Auth.forceLogout("Session expired. Please log in again.");
                    return;
                }

                if (categoryId === 'preferencesSection') {
                    const selectedTheme = themeSelect.value;
                    localStorage.setItem('theme', selectedTheme);
                    showSuccessFeedback(btn, "Preferences Saved!");
                }
            });
        });

        function showSuccessFeedback(button, message) {
            const originalText = button.textContent;
            button.textContent = message;
            button.style.backgroundColor = "#28a745"; 

            setTimeout(() => {
                button.textContent = originalText;
                button.style.backgroundColor = ""; 
            }, 2000);
        }

        // ==========================================
        // PROFILE MODAL (Avatar Click)
        // ==========================================
        const avatarContainer = document.getElementById('avatar');
        const profileModal = document.getElementById('profileModal');
        const closeProfileBtn = document.getElementById('closeProfileBtn');

        if (avatarContainer && profileModal) {
            avatarContainer.addEventListener('click', () => {
                // Trigger the global profile load if available
                if (typeof loadProfile === 'function') loadProfile();
                profileModal.style.display = 'flex';
            });
            closeProfileBtn.addEventListener('click', () => profileModal.style.display = 'none');
            
            window.addEventListener('click', (e) => {
                if (e.target === profileModal) profileModal.style.display = 'none';
            });
        }
    });
})();