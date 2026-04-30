document.addEventListener("DOMContentLoaded", async () => {
  // ===== AUTHENTICATION CHECK =====
  const user = Auth.protectPage('user');
  if (!user) return;

  const token = localStorage.getItem("token");

  if (!token) {
    location.href = "../../index.html";
    return;
  }

  // ===== DOM ELEMENTS =====
  const elements = {
    container: document.getElementById("eventContainer"),
    searchInput: document.getElementById("searchInput"),
    sort1: document.getElementById("sortCategory1"),
    sort2: document.getElementById("sortCategory2"),
    // Booking Modal
    bookingModal: document.getElementById("bookingModal"),
    eventTitle: document.getElementById("eventTitleBooking"),
    eventInfo: document.getElementById("eventInfoBooking"),
    quantityInput: document.getElementById("ticketQuantity"),
    gcashCheckbox: document.getElementById("GCash"),
    cancelBtn: document.getElementById("cancelBookingBtn"),
    confirmBtn: document.getElementById("confirmBookingBtn"),
    hashDisplay: document.getElementById("ticketHashDisplay")
  };

  let allEvents = [];
  let filteredEvents = [];
  let currentEvent = null;

  // ===== DATA FETCHING =====
  async function loadEvents() {
    try {
      // FIXED: Using relative URL to prevent localhost connection errors
      const res = await fetch(`/api/events`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to load events");

      allEvents = await res.json();
      applyFilters();
    } catch (err) {
      console.error(err);
      alert("Failed to load events. Please try again later.");
    }
  }

  // ===== FILTERING & SORTING =====
  function applyFilters() {
    const search = elements.searchInput?.value.toLowerCase() || "";
    const sortBy = elements.sort1?.value || "";
    const filterBy = elements.sort2?.value || "";

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 1. Filter by Search & Category
    filteredEvents = allEvents.filter(e => {
      const matchesSearch = e.title.toLowerCase().includes(search) || 
                            e.description.toLowerCase().includes(search);
      
      if (!matchesSearch) return false;

      // FIXED: Safe date comparison
      if (filterBy) {
        const d = new Date(e.event_date);
        d.setHours(0, 0, 0, 0); // Normalize the event date time for accurate comparison
        
        if (filterBy === "upcoming" && d <= today) return false;
        if (filterBy === "ongoing" && d.getTime() !== today.getTime()) return false;
        if (filterBy === "expired" && d >= today) return false;
      }

      return true;
    });

    // 2. Sort
    if (sortBy) {
      filteredEvents.sort((a, b) => {
        switch (sortBy) {
          case "date_asc":   return new Date(a.event_date) - new Date(b.event_date);
          case "date_desc":  return new Date(b.event_date) - new Date(a.event_date);
          case "title_asc":  return a.title.localeCompare(b.title);
          case "title_desc": return b.title.localeCompare(a.title);
          case "price_asc":  return a.ticket_price - b.ticket_price;
          case "price_desc": return b.ticket_price - a.ticket_price;
          case "qty_asc":    return a.ticket_quantity - b.ticket_quantity;
          case "qty_desc":   return b.ticket_quantity - a.ticket_quantity;
          default: return 0;
        }
      });
    }

    renderEvents();
  }

  // ===== UI RENDERING =====
  function renderEvents() {
    elements.container.innerHTML = "";

    if (filteredEvents.length === 0) {
      elements.container.innerHTML = `<div class="no-events">No events found matching your criteria.</div>`;
      return;
    }

    filteredEvents.forEach(event => {
      const eventDate = event.event_date ? new Date(event.event_date) : null;
      const isExpired = eventDate && eventDate < new Date().setHours(0,0,0,0);

      const card = document.createElement("div");
      card.className = "event-card";
      card.innerHTML = `
        <div class="event-left">
          <div class="poster">
            <img src="${event.image_url || '../Images/placeholder.png'}" alt="${event.title}">
          </div>
          <div class="text-content">
            <div class="event-title">${event.title}</div>
            <div class="event-description">${event.description}</div>
            <div class="event-tickets">Price: ₱${event.ticket_price} | Available: ${event.ticket_quantity}</div>
            <div class="event-date">${eventDate ? eventDate.toLocaleDateString() : "TBA"}</div>
          </div>
        </div>
        <div class="actions">
          <button class="book-btn" ${isExpired || event.ticket_quantity <= 0 ? "disabled" : ""}>
            ${isExpired ? "Expired" : event.ticket_quantity <= 0 ? "Sold Out" : "Book Ticket"}
          </button>
        </div>
      `;

      const btn = card.querySelector(".book-btn");
      if (!isExpired && event.ticket_quantity > 0) {
        btn.onclick = () => openBookingModal(event);
      }
      elements.container.appendChild(card);
    });
  }

  // ===== MODAL LOGIC =====
  function openBookingModal(event) {
    currentEvent = event;
    elements.eventTitle.textContent = event.title;
    elements.eventInfo.textContent = `Price per ticket: ₱${event.ticket_price}`;
    
    // Reset Modal State
    elements.quantityInput.value = 1;
    elements.quantityInput.max = event.ticket_quantity;
    elements.gcashCheckbox.checked = false; // Important: Clear previous selection
    elements.hashDisplay.style.display = "none";
    elements.confirmBtn.disabled = false;
    elements.confirmBtn.textContent = "Confirm Booking";
    
    elements.bookingModal.style.display = "flex";
  }

  elements.confirmBtn.onclick = async () => {
    const qty = parseInt(elements.quantityInput.value);

    // 1. Validation: GCash Checked
    if (!elements.gcashCheckbox.checked) {
      alert("Please select a payment method.");
      return;
    }

    // 2. Validation: Quantity
    if (!qty || qty <= 0 || qty > currentEvent.ticket_quantity) {
      alert("Please enter a valid ticket quantity.");
      return;
    }

    // 3. Process Booking
    elements.confirmBtn.disabled = true;
    elements.confirmBtn.textContent = "Processing...";

    try {
      // FIXED: Using relative URL to prevent localhost connection errors
      const res = await fetch(`/api/bookings`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json", 
          "Authorization": `Bearer ${token}` 
        },
        body: JSON.stringify({ 
          event_id: currentEvent.id, 
          quantity: qty,
          payment_method: "GCash" 
        })
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || "Booking failed");
      }

      elements.hashDisplay.style.display = "block";
      elements.hashDisplay.style.color = "#2ecc71";
      elements.hashDisplay.textContent = "✓ Booking Successful! Redirecting...";

      // Refresh data and close
      await loadEvents();
      setTimeout(() => {
        elements.bookingModal.style.display = "none";
      }, 2000);

    } catch (err) {
      console.error(err);
      alert(err.message);
      elements.confirmBtn.disabled = false;
      elements.confirmBtn.textContent = "Confirm Booking";
    }
  };

  elements.cancelBtn.onclick = () => {
    elements.bookingModal.style.display = "none";
  };

  // ===== EVENT LISTENERS =====
  elements.searchInput?.addEventListener("input", applyFilters);
  elements.sort1?.addEventListener("change", applyFilters);
  elements.sort2?.addEventListener("change", applyFilters);

  // Close modal on outside click
  window.onclick = (event) => {
    if (event.target == elements.bookingModal) {
      elements.bookingModal.style.display = "none";
    }
  };

  // ===== INITIAL LOAD =====
  await loadEvents();
});