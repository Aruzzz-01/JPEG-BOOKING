document.addEventListener("DOMContentLoaded", async () => {
    // 1. SECURITY & AUTH CHECK
    // Ensure Auth utility is loaded via auth-util.js
    if (typeof Auth === 'undefined') {
        console.error("Auth Utility missing!");
        return;
    }

    const user = Auth.protectPage('user');
    if (!user) return;

    const token = localStorage.getItem("token");

    // ===== UI LOGIC: ACCORDION =====
    document.querySelectorAll('.settings-header').forEach(header => {
        header.addEventListener('click', () => {
            const content = header.nextElementSibling;
            const category = header.parentElement;
            const isOpen = category.classList.contains('open');

            // Close other sections for a clean accordion effect
            document.querySelectorAll('.settings-category').forEach(cat => {
                cat.classList.remove('open');
                cat.querySelector('.settings-content').style.maxHeight = null;
            });

            if (!isOpen) {
                category.classList.add('open');
                content.style.maxHeight = content.scrollHeight + 40 + "px";
            }
        });
    });

    // ===== THEME PREVIEW =====
    const themeSelect = document.getElementById('themeSelect');
    const previewArea = document.getElementById('previewArea');

    if (themeSelect) {
        // Set dropdown to current theme
        themeSelect.value = localStorage.getItem('theme') || 'dark';

        themeSelect.addEventListener('change', (e) => {
            const theme = e.target.value;
            if (previewArea) {
                previewArea.style.backgroundColor = theme === 'light' ? "#ffffff" : "#3a2a55";
                previewArea.style.color = theme === 'light' ? "#111111" : "#ffffff";
            }
        });
    }

    // ===== DATA FETCHING: INITIAL LOAD =====
    async function fetchUserCurrentData() {
        try {
            // FIXED: Using relative path to solve ERR_CONNECTION_REFUSED
            const res = await fetch('/api/users/me', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (!res.ok) throw new Error("Failed to fetch user data");
            
            const data = await res.json();

            // Populate form fields
            const fNameInput = document.getElementById('firstName');
            const lNameInput = document.getElementById('lastName');
            const emailInput = document.getElementById('email');

            if (fNameInput) fNameInput.value = data.first_name || "";
            if (lNameInput) lNameInput.value = data.last_name || "";
            if (emailInput) emailInput.value = data.email || "";

            // Update Top Bar Name Display
            const topBarName = document.getElementById('userName');
            if (topBarName) topBarName.textContent = data.first_name;

        } catch (err) {
            console.error("Initialization failed:", err);
        }
    }

    // ===== SAVE ACTIONS =====
    document.querySelectorAll('.save-category-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const category = btn.dataset.category;

            // Update Profile Info
            if (category === 'profileInfo') {
                const payload = {
                    firstName: document.getElementById('firstName').value.trim(),
                    lastName: document.getElementById('lastName').value.trim(),
                    email: document.getElementById('email').value.trim()
                };
                await updateData('/api/users/me', 'PUT', payload);
            }

            // Update Password
            if (category === 'passwordSection') {
                const current = document.getElementById('currentPassword').value;
                const newPassword = document.getElementById('newPassword').value;
                const confirm = document.getElementById('confirmPassword').value;

                if (!current || !newPassword) return alert("Please fill in the password fields.");
                if (newPassword !== confirm) return alert("New passwords do not match.");
                
                await updateData('/api/users/me/password', 'PUT', { current, newPassword });
                
                // Clear fields after attempt
                document.getElementById('currentPassword').value = "";
                document.getElementById('newPassword').value = "";
                document.getElementById('confirmPassword').value = "";
            }

            // Update Preferences (Local Only)
            if (category === 'preferencesSection') {
                const selectedTheme = themeSelect.value;
                localStorage.setItem('theme', selectedTheme);
                document.documentElement.setAttribute('data-theme', selectedTheme);
                alert("Theme preferences saved!");
            }
        });
    });

    // ===== GENERIC UPDATE HELPER =====
    async function updateData(endpoint, method, body) {
        try {
            const res = await fetch(endpoint, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(body)
            });
            
            const text = await res.text();
            alert(text);

            if (res.ok && endpoint === '/api/users/me' && method === 'PUT') {
                await fetchUserCurrentData();
            }
        } catch (err) {
            console.error("Update failed:", err);
            alert("Connection error. Is the server running?");
        }
    }

    // ===== ACCOUNT DELETION =====
    const deleteBtn = document.getElementById('deleteAccountBtn');
    deleteBtn?.addEventListener('click', async () => {
        const password = prompt("For security, please enter your password to delete your account:");
        if (!password) return;

        if (confirm("WARNING: This will permanently delete your JPEG Events account. Continue?")) {
            await updateData('/api/users/me', 'DELETE', { password });
            localStorage.clear();
            window.location.href = "../../index.html";
        }
    });

    // Run initial load
    await fetchUserCurrentData();
});