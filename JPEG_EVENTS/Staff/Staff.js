// ================================
// CONFIG & STATE
// ================================
const token = localStorage.getItem("token");

let selectedEventId = null;
let scanner = null;
let isPaused = false;
let pendingTicketCode = null; 

// ================================
// ELEMENT REFERENCES
// ================================
const eventSelect = document.getElementById("eventSelect");
const cameraArea = document.getElementById("cameraArea");
const resultName = document.getElementById("resultName");
const resultTicket = document.getElementById("resultTicket");
const resultStatus = document.getElementById("resultStatus");
const checkedCount = document.getElementById("checkedCount");
const totalCount = document.getElementById("totalCount");
const recentList = document.getElementById("recentList");
const searchInput = document.getElementById("searchInput");
const searchBtn = document.getElementById("searchBtn");

// Create Confirm Button dynamically
const confirmBtn = document.createElement("button");
confirmBtn.id = "confirmCheckInBtn";
confirmBtn.textContent = "CONFIRM CHECK-IN";
confirmBtn.style.display = "none";
confirmBtn.style.width = "100%";
confirmBtn.style.padding = "15px";
confirmBtn.style.backgroundColor = "#28a745";
confirmBtn.style.color = "white";
confirmBtn.style.border = "none";
confirmBtn.style.fontWeight = "bold";
confirmBtn.style.marginTop = "10px";
confirmBtn.style.cursor = "pointer";
resultStatus.parentElement.appendChild(confirmBtn);

let scanBtn = document.getElementById("startScanBtn");
if (!scanBtn) {
    scanBtn = document.createElement("button");
    scanBtn.id = "startScanBtn";
    scanBtn.textContent = "Start Scanner";
    cameraArea.parentElement.insertBefore(scanBtn, cameraArea.nextSibling);
}

// ================================
// INIT
// ================================
document.addEventListener("DOMContentLoaded", async () => {
    // Check Auth first
    if (typeof Auth !== 'undefined') {
        const user = Auth.protectPage('staff');
        if (!user) return;
    }

    await loadEvents();
    
    eventSelect?.addEventListener("change", async () => {
        selectedEventId = eventSelect.value;
        resetUI();
        if (!selectedEventId) return;
        await loadAttendance();
        await loadRecentCheckins();
    });

    scanBtn.addEventListener("click", startScanner);
    confirmBtn.addEventListener("click", confirmCheckIn);

    searchBtn?.addEventListener("click", () => handleSearch(searchInput.value.trim()));
    searchInput?.addEventListener("keypress", (e) => {
        if (e.key === "Enter") handleSearch(searchInput.value.trim());
    });
});

// ================================
// SEARCH LOGIC
// ================================
async function handleSearch(query) {
    if (!selectedEventId) return alert("Select an event first");
    if (!query) return;

    resetUI();
    resultStatus.textContent = "Searching...";

    try {
        // FIXED: Using relative path
        const res = await fetch(`/api/staff/tickets/search?eventId=${selectedEventId}&query=${encodeURIComponent(query)}`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        
        if (!res.ok) throw new Error(`Server error: ${res.status}`);
        
        const data = await res.json();
        showResult(data);

        if (data.valid && !data.already_used && !data.error) {
            pendingTicketCode = data.ticket_code;
            confirmBtn.style.display = "block";
            resultStatus.textContent = "TICKET FOUND: Confirm check-in?";
        }
    } catch (err) {
        console.error("Search error:", err);
        resultStatus.textContent = "Search failed.";
    }
}

// ================================
// SCANNER LOGIC
// ================================
async function startScanner() {
    if (!selectedEventId) return alert("Select an event first");
    if (scanner) return alert("Scanner already running");

    scanner = new Html5Qrcode("cameraArea");
    try {
        const devices = await Html5Qrcode.getCameras();
        if (!devices?.length) return alert("No cameras found");

        await scanner.start(
            { facingMode: "environment" },
            { fps: 10, qrbox: { width: 250, height: 250 } },
            async (decodedText) => {
                if (isPaused) return; 
                isPaused = true;
                cameraArea.style.opacity = "0.3";
                await verifyTicketPreview(decodedText);
            }
        ).catch(err => console.error(err));
    } catch (err) {
        alert("Camera failed. Check permissions.");
    }
}

async function verifyTicketPreview(ticketCode) {
    try {
        resultStatus.textContent = "Validating...";
        // FIXED: Using relative path
        const res = await fetch(`/api/staff/scan-preview`, {
            method: "POST",
            headers: { 
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({ ticket_code: ticketCode, selected_event_id: selectedEventId }),
        });
        
        if (!res.ok) throw new Error(`Server error: ${res.status}`);
        
        const data = await res.json();
        showResult(data);

        if (data.valid && !data.already_used && !data.error) {
            pendingTicketCode = ticketCode;
            confirmBtn.style.display = "block";
        } else {
            setTimeout(resetScanner, 3000);
        }
    } catch (err) {
        console.error("Scan preview error:", err);
        resultStatus.textContent = "Server Error";
        setTimeout(resetScanner, 3000);
    }
}

// ================================
// CONFIRM CHECK-IN
// ================================
async function confirmCheckIn() {
    if (!pendingTicketCode || !selectedEventId) return;
    confirmBtn.disabled = true;
    confirmBtn.textContent = "Checking in...";

    try {
        // FIXED: Using relative path
        const res = await fetch(`/api/staff/confirm-checkin`, {
            method: "POST",
            headers: { 
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({ ticket_code: pendingTicketCode, selected_event_id: selectedEventId }),
        });
        
        if (!res.ok) throw new Error(`Server error: ${res.status}`);
        
        const data = await res.json();

        if (data.success) {
            resultStatus.textContent = "SUCCESSFULLY CHECKED IN";
            resultStatus.style.color = "limegreen";
            await loadAttendance();
            await loadRecentCheckins();
        } else {
            alert(data.message || "Failed");
        }
    } catch (err) { 
        console.error("Confirm check-in error:", err);
        alert("Failed to connect to the server.");
    } finally {
        setTimeout(() => {
            confirmBtn.disabled = false;
            confirmBtn.textContent = "CONFIRM CHECK-IN";
            resetScanner();
            resetUI();
        }, 1500);
    }
}

// ================================
// HELPERS
// ================================
function showResult(data) {
    resultName.textContent = data.name || "Not Found";
    resultTicket.textContent = data.ticket_code || "-";
    
    if (data.error) {
        resultStatus.textContent = data.message;
        resultStatus.style.color = "red";
    } else if (data.already_used) {
        resultStatus.textContent = "ALREADY USED";
        resultStatus.style.color = "orange";
    } else if (data.valid) {
        resultStatus.textContent = "VALID TICKET";
        resultStatus.style.color = "limegreen";
    } else {
        resultStatus.textContent = data.message || "INVALID";
        resultStatus.style.color = "red";
    }
}

function resetScanner() {
    isPaused = false;
    pendingTicketCode = null;
    confirmBtn.style.display = "none";
    cameraArea.style.opacity = "1";
    resultStatus.textContent = "Ready";
    resultStatus.style.color = "white";
}

function resetUI() {
    resultName.textContent = "-";
    resultTicket.textContent = "-";
    resultStatus.textContent = "Ready";
    confirmBtn.style.display = "none";
}

async function loadEvents() {
    try {
        // FIXED: Using relative path
        const res = await fetch(`/api/staff/events`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        
        if (!res.ok) throw new Error(`Server error: ${res.status}`);
        
        const events = await res.json();
        if (eventSelect) {
            eventSelect.innerHTML = `<option value="">Select Today's Event</option>`;
            events.forEach(evt => {
                const option = document.createElement("option");
                option.value = evt.id;
                option.textContent = evt.title;
                eventSelect.appendChild(option);
            });
        }
    } catch (err) { 
        console.error("Failed to load events:", err); 
    }
}

async function loadAttendance() {
    if (!selectedEventId) return;
    try {
        // FIXED: Using relative path
        const res = await fetch(`/api/staff/attendance/${selectedEventId}`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        
        if (!res.ok) throw new Error(`Server error: ${res.status}`);
        
        const data = await res.json();
        if (checkedCount) checkedCount.textContent = data.checked || 0;
        if (totalCount) totalCount.textContent = data.total || 0;
    } catch (err) {
        console.error("Failed to load attendance:", err);
    }
}

async function loadRecentCheckins() {
    if (!selectedEventId) return;
    try {
        // FIXED: Using relative path
        const res = await fetch(`/api/staff/recent/${selectedEventId}`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        
        if (!res.ok) {
            recentList.innerHTML = "<li>Error loading recent check-ins</li>";
            throw new Error(`Server error: ${res.status}`);
        }
        
        const list = await res.json();
        if (recentList) {
            recentList.innerHTML = "";
            if (list.length === 0) {
                recentList.innerHTML = "<li>No recent check-ins</li>";
                return;
            }
            list.forEach(item => {
                const li = document.createElement("li");
                li.textContent = `${item.first_name} ${item.last_name} (${new Date(item.checked_in_at).toLocaleTimeString()})`;
                recentList.appendChild(li);
            });
        }
    } catch (err) {
        console.error("Failed to fetch recent check-ins:", err);
    }
}