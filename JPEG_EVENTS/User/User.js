document.addEventListener("DOMContentLoaded", async () => {
  // ===== AUTHENTICATION CHECK =====
  const user = Auth.protectPage("user");
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

  // Make default sort newest uploaded
  if (elements.sort1 && !elements.sort1.value) {
    elements.sort1.value = "newest";
  }

  // ===== DATA FETCHING =====
  async function loadEvents() {
    try {
      const res = await fetch("/api/events", {
        headers: {
          Authorization: `Bearer ${token}`
        }
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
    const search = elements.searchInput?.value.toLowerCase().trim() || "";
    const sortBy = elements.sort1?.value || "newest";
    const filterBy = elements.sort2?.value || "";

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    filteredEvents = allEvents.filter(event => {
      const title = event.title?.toLowerCase() || "";
      const description = event.description?.toLowerCase() || "";

      const matchesSearch =
        title.includes(search) || description.includes(search);

      if (!matchesSearch) return false;

      if (filterBy) {
        const eventDate = new Date(event.event_date);
        eventDate.setHours(0, 0, 0, 0);

        if (filterBy === "upcoming" && eventDate <= today) return false;
        if (filterBy === "ongoing" && eventDate.getTime() !== today.getTime()) return false;
        if (filterBy === "expired" && eventDate >= today) return false;
      }

      return true;
    });

    filteredEvents.sort((a, b) => {
      switch (sortBy) {
        case "newest":
          return new Date(b.created_at) - new Date(a.created_at);

        case "oldest":
          return new Date(a.created_at) - new Date(b.created_at);

        case "date_asc":
          return new Date(a.event_date) - new Date(b.event_date);

        case "date_desc":
          return new Date(b.event_date) - new Date(a.event_date);

        case "title_asc":
          return (a.title || "").localeCompare(b.title || "");

        case "title_desc":
          return (b.title || "").localeCompare(a.title || "");

        case "price_asc":
          return Number(a.ticket_price || 0) - Number(b.ticket_price || 0);

        case "price_desc":
          return Number(b.ticket_price || 0) - Number(a.ticket_price || 0);

        case "qty_asc":
          return Number(a.ticket_quantity || 0) - Number(b.ticket_quantity || 0);

        case "qty_desc":
          return Number(b.ticket_quantity || 0) - Number(a.ticket_quantity || 0);

        default:
          return new Date(b.created_at) - new Date(a.created_at);
      }
    });

    renderEvents();
  }

  // ===== UI RENDERING =====
  function renderEvents() {
    elements.container.innerHTML = "";

    if (filteredEvents.length === 0) {
      elements.container.innerHTML = `
        <div class="no-events">No events found matching your criteria.</div>
      `;
      return;
    }

    filteredEvents.forEach(event => {
      const eventDate = event.event_date ? new Date(event.event_date) : null;

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const isExpired = eventDate && eventDate < today;
      const isSoldOut = Number(event.ticket_quantity || 0) <= 0;

      const card = document.createElement("div");
      card.className = "event-card";

      card.innerHTML = `
        <div class="event-left">
          <div class="poster">
            <img src="${event.image_url || "../Images/placeholder.png"}" alt="${event.title || "Event"}">
          </div>

          <div class="text-content">
            <div class="event-title">${event.title || "Untitled Event"}</div>
            <div class="event-description">${event.description || ""}</div>
            <div class="event-tickets">
              Price: ₱${event.ticket_price || 0} | Available: ${event.ticket_quantity || 0}
            </div>
            <div class="event-date">
              ${eventDate ? eventDate.toLocaleDateString() : "TBA"}
            </div>
          </div>
        </div>

        <div class="actions">
          <button class="book-btn" ${isExpired || isSoldOut ? "disabled" : ""}>
            ${isExpired ? "Expired" : isSoldOut ? "Sold Out" : "Book Ticket"}
          </button>
        </div>
      `;

      const bookBtn = card.querySelector(".book-btn");

      if (!isExpired && !isSoldOut) {
        bookBtn.onclick = () => openBookingModal(event);
      }

      elements.container.appendChild(card);
    });
  }

  // ===== MODAL LOGIC =====
  function openBookingModal(event) {
    currentEvent = event;

    elements.eventTitle.textContent = event.title || "Untitled Event";
    elements.eventInfo.textContent = `Price per ticket: ₱${event.ticket_price || 0}`;

    elements.quantityInput.value = 1;
    elements.quantityInput.max = event.ticket_quantity;
    elements.gcashCheckbox.checked = false;

    elements.hashDisplay.style.display = "none";
    elements.hashDisplay.textContent = "";

    elements.confirmBtn.disabled = false;
    elements.confirmBtn.textContent = "Confirm Booking";

    elements.bookingModal.style.display = "flex";
  }

  elements.confirmBtn.onclick = async () => {
    const qty = parseInt(elements.quantityInput.value);

    if (!currentEvent) {
      alert("No event selected.");
      return;
    }

    if (!elements.gcashCheckbox.checked) {
      alert("Please select a payment method.");
      return;
    }

    if (!qty || qty <= 0 || qty > currentEvent.ticket_quantity) {
      alert("Please enter a valid ticket quantity.");
      return;
    }

    elements.confirmBtn.disabled = true;
    elements.confirmBtn.textContent = "Processing...";

    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
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

  window.onclick = event => {
    if (event.target === elements.bookingModal) {
      elements.bookingModal.style.display = "none";
    }
  };

  // ===== INITIAL LOAD =====
  await loadEvents();
});