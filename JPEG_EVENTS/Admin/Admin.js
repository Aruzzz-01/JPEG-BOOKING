document.addEventListener("DOMContentLoaded", () => {
    // Check Auth
    if (typeof Auth !== 'undefined') {
        const user = Auth.protectPage('admin');
        if (!user) return;
    }

    // ===== AUTH =====
    const token = localStorage.getItem("token");
    if (!token) return window.location.href = "../../index.html";

    let userPayload;
    try {
        userPayload = JSON.parse(atob(token.split(".")[1]));
    } catch {
        localStorage.clear();
        return window.location.href = "../../index.html";
    }

    if (userPayload.role !== "admin") window.location.href = "../../User/User-Dashboard.html";

    // ===== ELEMENTS =====
    const eventDateInput = document.getElementById("eventDate");
    const container = document.getElementById("eventContainer");
    const addBtn = document.querySelector(".add-btn");
    const eventModal = document.getElementById("uploadModal");
    const cancelBtn = document.getElementById("cancelBtn");
    const uploadBtn = document.getElementById("uploadBtn");
    const titleInput = document.getElementById("eventTitle");
    const descInput = document.getElementById("eventDesc");
    const imgInput = document.getElementById("eventImage");
    const croppedResult = document.getElementById('croppedResult');
    const cropperWrap = document.getElementById('cropperWrap');
    const imageToCrop = document.getElementById('imageToCrop');
    const saveCropBtn = document.getElementById('saveCropBtn');
    const ticketPriceInput = document.getElementById("ticketPrice");
    const ticketQuantityInput = document.getElementById("ticketQuantity");
    const previewIcon = document.querySelector('.upload-icon');
    const previewText = document.querySelector('.upload-hover');

    let cropper;
    let finalCroppedImageBase64 = null;

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
            const errorText = await response.text();
            throw new Error(errorText || "Request failed");
        }
        if (response.status === 204) return null;
        return response.json();
    }

    // ===== LOAD EVENTS =====
    async function loadEvents() {
        try {
            if (container) container.innerHTML = "";
            const events = await apiRequest("/api/events");
            events.forEach(renderEventCard);
        } catch (err) {
            console.error("Load Events Error:", err.message);
        }
    }

    function renderEventCard(event) {
        const card = document.createElement("div");
        card.className = "event-card";
        card.innerHTML = `
            <div class="event-left">
                <div class="poster">
                    <img src="${event.image_url || ""}" alt="Event Image">
                </div>
                <div class="text-content">
                    <div class="event-title">${event.title || "Untitled"}</div>
                    <div class="event-code">Code: ${event.event_code || "Generating..."}</div>
                    <div class="event-description">${event.description || ""}</div>
                    <div class="event-tickets">
                        Price: ₱${event.ticket_price || 0} | Remaining: ${event.ticket_quantity || 0}
                    </div>
                </div>
            </div>
            <div class="actions">
                <button class="icon-btn delete">🗑</button>
            </div>
        `;
        card.querySelector(".delete").addEventListener("click", async () => {
            if (!confirm("Delete this event?")) return;
            try {
                await apiRequest(`/api/events/${event.id}`, { method: "DELETE" });
                card.remove();
            } catch (err) {
                alert(err.message);
            }
        });
        if (container) container.prepend(card);
    }

    // ===== CROPPER LOGIC =====
    imgInput?.addEventListener("change", function(e) {
        const file = e.target.files[0];
        if (!file) return;
        
        if (file.size > 5 * 1024 * 1024) {
            alert("Image too big (max 5MB).");
            imgInput.value = "";
            return;
        }

        const reader = new FileReader();
        reader.onload = function(event) {
            if (imageToCrop) {
                imageToCrop.src = event.target.result;
                if (cropperWrap) cropperWrap.style.display = 'block';
                
                if (cropper) cropper.destroy();
                
                cropper = new Cropper(imageToCrop, {
                    aspectRatio: 1,
                    viewMode: 1,
                    autoCropArea: 1,
                });
            }
        };
        reader.readAsDataURL(file);
    });

    saveCropBtn?.addEventListener('click', function() {
        if (!cropper) return;

        const canvas = cropper.getCroppedCanvas({
            width: 500,
            height: 500
        });

        finalCroppedImageBase64 = canvas.toDataURL("image/jpeg", 0.9);
        
        if (croppedResult) {
            croppedResult.src = finalCroppedImageBase64;
            croppedResult.style.display = 'block';
        }
        
        if (cropperWrap) cropperWrap.style.display = 'none';
        previewIcon?.style.setProperty('display', 'none');
        previewText?.style.setProperty('display', 'none');
    });

    // ===== MODALS =====
    addBtn?.addEventListener("click", () => eventModal.style.display = "flex");
    
    cancelBtn?.addEventListener("click", () => {
        eventModal.style.display = "none";
        resetForm();
    });

    uploadBtn?.addEventListener("click", async () => {
        if (!finalCroppedImageBase64) return alert("Please set and crop your image first.");

        const payload = {
            title: titleInput.value.trim(),
            description: descInput.value.trim(),
            image_url: finalCroppedImageBase64,
            ticket_price: parseFloat(ticketPriceInput.value) || 0,
            ticket_quantity: parseInt(ticketQuantityInput.value) || 0,
            event_date: eventDateInput.value
        };

        try {
            const newEvent = await apiRequest("/api/events", { 
                method: "POST", 
                body: JSON.stringify(payload) 
            });
            renderEventCard(newEvent);
            resetForm();
            if (eventModal) eventModal.style.display = "none";
        } catch (err) {
            alert(err.message);
        }
    });

    function resetForm() {
        titleInput.value = "";
        descInput.value = "";
        imgInput.value = "";
        ticketPriceInput.value = "";
        ticketQuantityInput.value = "";
        eventDateInput.value = "";
        
        finalCroppedImageBase64 = null;
        if (croppedResult) {
            croppedResult.src = "";
            croppedResult.style.display = 'none';
        }
        if (cropperWrap) cropperWrap.style.display = 'none';
        if (previewIcon) previewIcon.style.display = 'flex';
        if (previewText) previewText.style.display = 'block';
        if (cropper) cropper.destroy();
    }

    loadEvents();
});