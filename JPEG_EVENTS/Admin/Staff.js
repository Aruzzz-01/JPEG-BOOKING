document.addEventListener("DOMContentLoaded", () => {
    // Check Auth Utility
    if (typeof Auth !== 'undefined') {
        const user = Auth.protectPage('admin');
        if (!user) return;
    }

    const token = localStorage.getItem("token");

    // 1. GLOBAL STATE
    let allUsers = [];

    // ===== AUTH PROTECTION =====
    if (!token) return window.location.href = "../../index.html";

    let userPayload;
    try {
        userPayload = JSON.parse(atob(token.split(".")[1]));
    } catch {
        localStorage.clear();
        return window.location.href = "../../index.html";
    }

    if (userPayload.role !== "admin") {
        window.location.href = "../../User/User-Dashboard.html";
    }

    // ===== DOM ELEMENTS =====
    const addBtn = document.querySelector('.add-btn');
    const addStaffModal = document.getElementById('addStaffModal');
    const closeAddStaffBtn = document.getElementById('closeAddStaffBtn');
    const addStaffForm = document.getElementById('addStaffForm');
    
    const staffFirstNameInput = document.getElementById('staffFirstName');
    const staffLastNameInput = document.getElementById('staffLastName');
    const staffEmailInput = document.getElementById('staffEmail');
    const staffPasswordInput = document.getElementById('staffPassword');
    const staffRoleInput = document.getElementById('staffRole');
    
    const staffContainer = document.getElementById('staffContainer');
    const searchInput = document.getElementById('staffSearch'); 

    const roleTabs = document.querySelectorAll('.role-tab');
let selectedRole = "all";

    // ===== API HELPER =====
    async function apiRequest(endpoint, options = {}) {
        // FIXED: Using relative path to prevent localhost connection errors
        const response = await fetch(endpoint, {
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
                ...options.headers
            },
            ...options
        });

        if (!response.ok) {
            const text = await response.text();
            throw new Error(text || "Request failed");
        }
        if (response.status === 204) return null;
        return response.json();
    }

    // ===== MODAL HANDLERS =====
    addBtn?.addEventListener('click', () => {
        addStaffForm?.reset(); 
        if (addStaffModal) addStaffModal.style.display = 'flex';
    });
    
    closeAddStaffBtn?.addEventListener('click', () => {
        if (addStaffModal) addStaffModal.style.display = 'none';
    });
    
    window.addEventListener('click', e => {
        if (e.target === addStaffModal) addStaffModal.style.display = 'none';
    });

    // ===== RENDER LOGIC =====
    function createStaffCard(user) {
        const card = document.createElement('div');
        card.className = 'event-card staff-item';
        card.style.padding = "20px";
        card.style.marginBottom = "20px";

        if (user.role === 'admin') {
            card.style.border = "2px solid #ffffff";
        }

        const hasImage = user.profile_image && user.profile_image.trim() !== "";
        const avatarSrc = hasImage 
            ? user.profile_image 
            : `https://ui-avatars.com/api/?name=${user.first_name}+${user.last_name}&background=random&color=fff`;

        const displayRole = (user.role || 'staff').toUpperCase();

        card.innerHTML = `
            <div class="event-left">
                <div class="poster">
                    <img src="${avatarSrc}" alt="Avatar" style="width: 100%; height: 100%; object-fit: cover;">
                </div>
                <div class="text-content" style="margin-left: 20px; margin-top: 0;">
                    <div class="event-title" style="font-size: 32px;">
                        ${user.first_name} ${user.last_name}
                        <span style="font-size: 14px; background: rgba(255,255,255,0.2); padding: 2px 8px; border-radius: 4px; vertical-align: middle; margin-left: 10px;">
                            ${displayRole}
                        </span>
                    </div>
                    <div class="event-description" style="font-size: 18px; opacity: 0.7;">${user.email}</div>
                    <div class="event-description" style="font-size: 18px; color: #2ecc71; margin-top: 8px;">
   ${user.role === 'staff' ? `
    <div class="event-description" style="font-size: 18px; color: #2ecc71; margin-top: 8px;">
        Scanned Tickets: ${user.scan_count || 0}
    </div>
` : ''}
</div>
                </div>
            </div>
            <div class="actions">
                <button class="delete" title="Remove User">🗑</button>
            </div>
        `;

        card.querySelector('.delete').addEventListener('click', async () => {
            if (!confirm(`Remove ${user.first_name} (${displayRole})?`)) return;
            try {
                await apiRequest(`/api/staff/${user.id}`, { method: 'DELETE' });
                card.remove();
                allUsers = allUsers.filter(u => String(u.id) !== String(user.id));
            } catch (err) { 
                alert(err.message); 
            }
        });

        staffContainer.appendChild(card);
    }

    function renderList(list) {
        if (!staffContainer) return;
        staffContainer.innerHTML = "";
        if (list.length === 0) {
            staffContainer.innerHTML = "<p style='padding: 20px; opacity: 0.5;'>No accounts found.</p>";
            return;
        }
        list.forEach(createStaffCard);
    }

    // ===== SEARCH LOGIC =====
    // ===== SEARCH + ROLE FILTER LOGIC =====
function applyStaffFilters() {
    const query = searchInput?.value.toLowerCase() || "";
    

    const filtered = allUsers.filter(u => {
        const matchesSearch =
            u.first_name.toLowerCase().includes(query) ||
            u.last_name.toLowerCase().includes(query) ||
            u.email.toLowerCase().includes(query);

        const matchesRole =
            selectedRole === "all" || u.role === selectedRole;

        return matchesSearch && matchesRole;
    });

    renderList(filtered);
}

searchInput?.addEventListener('input', applyStaffFilters);
 
    roleTabs.forEach(tab => {
    tab.addEventListener('click', () => {
        roleTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        selectedRole = tab.dataset.role;
        applyStaffFilters();
    });
});

    // ===== INITIAL LOAD =====
    async function loadStaff() {
        try {
            const data = await apiRequest('/api/staff');
            allUsers = Array.isArray(data) ? data : [];
            applyStaffFilters();
        } catch (err) {
            console.error("Failed to load users:", err.message);
            if (staffContainer) staffContainer.innerHTML = "<p style='color: red; padding: 20px;'>Error loading staff.</p>";
        }
    }

    // ===== FORM SUBMIT =====
    addStaffForm?.addEventListener('submit', async (e) => {
        e.preventDefault();

        const payload = {
            firstName: staffFirstNameInput.value.trim(),
            lastName: staffLastNameInput.value.trim(),
            email: staffEmailInput.value.trim(),
            password: staffPasswordInput.value.trim() || Math.random().toString(36).slice(-8),
            role: staffRoleInput.value
        };

        try {
            const newUser = await apiRequest('/api/staff', {
                method: 'POST',
                body: JSON.stringify(payload)
            });

            alert(`${payload.role.toUpperCase()} added successfully.`);
            if (addStaffModal) addStaffModal.style.display = 'none';
            addStaffForm.reset();
            
            allUsers.push(newUser); 
            createStaffCard(newUser);
        } catch (err) {
            alert(`Failed to add user: ${err.message}`);
        }
    });

    loadStaff();
});