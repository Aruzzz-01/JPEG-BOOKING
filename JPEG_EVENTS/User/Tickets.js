document.addEventListener("DOMContentLoaded", async () => {
    const user = Auth.protectPage('user');
    if (!user) return;

    // REMOVED: API_BASE = "http://localhost:3000" to fix ERR_CONNECTION_REFUSED
    const token = localStorage.getItem("token");

    if (!token) return window.location.href = "../../index.html";

    let payload;
    try { 
        payload = JSON.parse(atob(token.split(".")[1])); 
    } catch { 
        localStorage.clear(); 
        return window.location.href = "../../index.html"; 
    }

    if (payload.role !== "user") return window.location.href = "../../Admin/Admin-Dashboard.html";

    // ===== DOM ELEMENTS =====
    const container = document.getElementById("eventContainer");
    const searchInput = document.getElementById("searchInput");
    const sortCategory1 = document.getElementById("sortCategory1");
    const sortCategory2 = document.getElementById("sortCategory2");

    // ===== QR MODAL SETUP =====
    const qrModal = document.createElement("div");
    qrModal.id = "qrModal";
    qrModal.className = "modal";
    qrModal.innerHTML = `
        <div class="modal-content" style="text-align:center;">
            <h3>Your Ticket QR Code</h3>
            <div id="qrCanvas" style="display: flex; justify-content: center; margin: 20px 0;"></div>
            <div id="qrCodeText" style="margin-top:10px; font-weight:bold; font-family: monospace;"></div>
            <button id="closeQR" class="cancel-btn" style="margin-top:15px; width: 100%; padding: 10px;">Close</button>
        </div>
    `;
    document.body.appendChild(qrModal);

    const qrCanvas = document.getElementById("qrCanvas");
    const qrCodeText = document.getElementById("qrCodeText");
    const closeQR = document.getElementById("closeQR");
    closeQR.addEventListener("click", () => qrModal.style.display = "none");

    // ===== STATE VARS =====
    let allTickets = [];
    let filteredTickets = [];
    const ticketCards = new Map();

    // ===== HELPERS =====
    function getEventStatus(ticket) {
        if (!ticket.event_date) return { text: "Unknown", color: "gray" };

        const today = new Date(); 
        today.setHours(0,0,0,0);
        const eventDate = new Date(ticket.event_date); 
        eventDate.setHours(0,0,0,0);

        if (ticket.scanned) {
            return { text: "Scanned / Used", color: "#f39c12" }; 
        }

        if (eventDate < today) {
            return { text: "Expired (Not Used)", color: "#e74c3c" }; 
        }
        
        if (eventDate.getTime() === today.getTime()) {
            return { text: "Ongoing - Valid Today", color: "#2ecc71" }; 
        }

        return { text: "Upcoming - Valid", color: "#3498db" }; 
    }

    function showQR(code) {
        if (typeof QRCode === 'undefined') {
            alert("QR Library missing! Make sure the QRCode.js script is included in your HTML.");
            return;
        }
        qrModal.style.display = "flex";
        qrCanvas.innerHTML = "";
        
        new QRCode(qrCanvas, { text: code, width: 220, height: 220 });
        
        qrCodeText.innerHTML = `
            <small style="color: gray; font-size: 10px;">TICKET DATA</small><br>
            <span style="letter-spacing: 1px;">${code}</span>
        `;
    }

    // ===== APPLY FILTERS + SORT + SEARCH =====
    function applyFilters() {
        const search = searchInput?.value.toLowerCase() || "";
        const sort1 = sortCategory1?.value || "";
        const filter2 = sortCategory2?.value || "";

        filteredTickets = [...allTickets];

        const todayStart = new Date();
        todayStart.setHours(0,0,0,0);
        const todayEnd = new Date();
        todayEnd.setHours(23,59,59,999);

        if (search) {
            filteredTickets = filteredTickets.filter(t =>
                (t.title && t.title.toLowerCase().includes(search)) ||
                (t.ticket_code && t.ticket_code.toLowerCase().includes(search))
            );
        }

        if (filter2) {
            filteredTickets = filteredTickets.filter(t => {
                if (filter2 === "scanned") return t.scanned === true;
                if (!t.event_date) return false;
                const d = new Date(t.event_date);
                if (filter2 === "upcoming") return d > todayEnd && !t.scanned;
                if (filter2 === "ongoing") return d >= todayStart && d <= todayEnd && !t.scanned;
                if (filter2 === "expired") return d < todayStart && !t.scanned;
            });
        }

        if (sort1) {
            filteredTickets.sort((a, b) => {
                switch (sort1) {
                    case "date_asc": return new Date(a.event_date || 0) - new Date(b.event_date || 0);
                    case "date_desc": return new Date(b.event_date || 0) - new Date(a.event_date || 0);
                    case "title_asc": return (a.title || "").localeCompare(b.title || "");
                    case "title_desc": return (b.title || "").localeCompare(a.title || "");
                    case "qty_asc": return (a.quantity || 0) - (b.quantity || 0);
                    case "qty_desc": return (b.quantity || 0) - (a.quantity || 0);
                }
            });
        }

        renderTickets();
    }

    // ===== RENDER TICKETS =====
    function renderTickets() {
        container.innerHTML = "";
        ticketCards.clear(); 

        if (filteredTickets.length === 0) {
            container.innerHTML = `<div class="no-tickets">No tickets found.</div>`;
            return;
        }

        filteredTickets.forEach(renderTicketCard);
    }

    function renderTicketCard(ticket) {
        const card = document.createElement("div");
        card.className = "ticket-card";
        const statusObj = getEventStatus(ticket);

        card.innerHTML = `
            <div class="poster">
                <img src="${ticket.image_url || 'https://via.placeholder.com/150'}" alt="${ticket.title}">
            </div>
            <div class="text-content">
                <div class="ticket-title">${ticket.title}</div>
                <div class="event-description" style="color:${statusObj.color}; font-weight:bold;">
                    Status: ${statusObj.text}
                </div>
                <div class="ticket-qty">Quantity: ${ticket.quantity}</div>
                <button class="qr-btn">See QR</button>
            </div>
        `;

        card.querySelector(".qr-btn").addEventListener("click", () => showQR(ticket.ticket_code));
        container.appendChild(card);
        ticketCards.set(ticket.ticket_code, card);
    }

    // ===== DATA LOADING =====
    async function loadTickets() {
        try {
            // FIXED: Using relative path /api/bookings
            const res = await fetch(`/api/bookings`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            if (!res.ok) throw new Error("Failed to load");

            allTickets = await res.json();
            applyFilters();

        } catch (err) {
            console.error(err);
            if (allTickets.length === 0) {
                container.innerHTML = `<div class="no-tickets" style="color:red;">Error loading tickets.</div>`;
            }
        }
    }

    searchInput?.addEventListener("input", applyFilters);
    sortCategory1?.addEventListener("change", applyFilters);
    sortCategory2?.addEventListener("change", applyFilters);

    window.addEventListener("click", (e) => {
        if (e.target === qrModal) qrModal.style.display = "none";
    });

    await loadTickets();
    setInterval(loadTickets, 5000);
});