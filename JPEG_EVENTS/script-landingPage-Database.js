document.addEventListener("DOMContentLoaded", () => {
  // ============================
  // ELEMENTS
  // ============================
  const loginBtn = document.querySelector(".login-btn");
  const modalOverlay = document.getElementById("loginModal");
  const createBtn = document.querySelector(".create-btn");
  const closeLoginBtn = document.getElementById("closeModal");
  const modalTitle = document.querySelector(".modal-title");
  const toggleLink = document.querySelector(".toggle-link");
  const loginSubmitBtn = document.querySelector(".login-btn-1");

  const emailInput = modalOverlay.querySelector('input[type="email"]');
  const passwordInput = modalOverlay.querySelector('input[type="password"]');

  const createModal = document.getElementById("createModal");
  const closeCreateModal = document.getElementById("closeCreateModal");
  const submitCreate = document.getElementById("submitCreate");
  const backToLogin = document.querySelector(".back-to-login");

  const firstName = document.getElementById("firstName");
  const lastName = document.getElementById("lastName");
  const createEmailInput = document.getElementById("createEmail");
  const createPasswordInput = document.getElementById("createPassword");
  const confirmPasswordInput = document.getElementById("confirmPassword");

  // ============================
  // AUTO-REDIRECT IF LOGGED IN
  // ============================
  const storedRole = localStorage.getItem("role");
  if (storedRole === "user") window.location.href = "../User/User-Dashboard.html";
  if (storedRole === "admin") window.location.href = "../Admin/Admin-Events.html";
  if (storedRole === "staff") window.location.href = "../Staff/Staff-Dashboard.html";

  // ============================
  // STATE
  // ============================
  let currentMode = "user"; // default login mode

  // ============================
  // OPEN LOGIN MODAL
  // ============================
  loginBtn.addEventListener("click", () => {
    modalOverlay.classList.add("active");
    setMode("user");
  });

  // ============================
  // CLOSE MODALS
  // ============================
  closeLoginBtn.addEventListener("click", () => modalOverlay.classList.remove("active"));
  closeCreateModal.addEventListener("click", () => createModal.classList.remove("active"));

  modalOverlay.addEventListener("click", () => modalOverlay.classList.remove("active"));
  createModal.addEventListener("click", () => createModal.classList.remove("active"));

  modalOverlay.querySelector(".modal").addEventListener("click", e => e.stopPropagation());
  createModal.querySelector(".modal").addEventListener("click", e => e.stopPropagation());

  // ============================
  // TOGGLE LOGIN TYPE
  // ============================
  toggleLink.addEventListener("click", () => {
    setMode(currentMode === "user" ? "admin" : "user");
  });

  function setMode(mode) {
    currentMode = mode;
    emailInput.value = "";
    passwordInput.value = "";

    if (mode === "user") {
      modalTitle.textContent = "User Login";
      toggleLink.textContent = "Log in as Admin or Staff";
      createBtn.style.display = "block"; // allow account creation
    } else {
      modalTitle.textContent = "Admin & Staff Login";
      toggleLink.textContent = "Log in as User";
      createBtn.style.display = "none"; // hide creation button
    }
  }

  // ============================
  // LOGIN SUBMIT
  // ============================
  loginSubmitBtn.addEventListener("click", async () => {
    const email = emailInput.value.trim();
    const password = passwordInput.value.trim();

    if (!email || !password) return alert("Please fill in all fields.");

    try {
      // FIXED SYNTAX ERROR HERE
      const res = await fetch('/login', {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          expectedRole: currentMode
        })
      });

      const text = await res.text();
      
      // If server returns an error code (401, 403, 500)
      if (!res.ok) {
        // We parse text instead of JSON initially because error messages are sent as plain strings
        return alert(text); 
      }

      // If login is successful, parse the JSON token
      const data = JSON.parse(text);
      const payload = JSON.parse(atob(data.token.split(".")[1]));

      // ========================
      // STORE TOKEN + REDIRECT
      // ========================
      localStorage.setItem("token", data.token);
      localStorage.setItem("role", payload.role);
      localStorage.setItem("userId", payload.id);

      if (payload.role === "user") window.location.href = "../User/User-Dashboard.html";
      if (payload.role === "admin") window.location.href = "../Admin/Admin-Dashboard.html";
      if (payload.role === "staff") window.location.href = "../Staff/Staff-Dashboard.html";

      modalOverlay.classList.remove("active");

    } catch (err) {
      console.error("Login Error:", err);
      alert("Server error. Please check your connection.");
    }
  });

  // ============================
  // CREATE ACCOUNT MODAL
  // ============================
  createBtn.addEventListener("click", () => {
    modalOverlay.classList.remove("active");
    createModal.classList.add("active");
    resetCreateModal();
  });

  backToLogin.addEventListener("click", () => {
    createModal.classList.remove("active");
    modalOverlay.classList.add("active");
    setMode("user");
  });

  // ============================
  // CREATE ACCOUNT SUBMIT
  // ============================
  submitCreate.addEventListener("click", async () => {
    const fName = firstName.value.trim();
    const lName = lastName.value.trim();
    const email = createEmailInput.value.trim();
    const password = createPasswordInput.value.trim();
    const confirmPass = confirmPasswordInput.value.trim();

    if (!fName || !lName || !email || !password || !confirmPass) {
      return alert("Please fill in all fields.");
    }
    if (password !== confirmPass) {
      return alert("Passwords do not match. Please try again.");
    }

    try {
      // REMOVED HARDCODED LOCALHOST URL HERE
      const res = await fetch("/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName: fName, lastName: lName, email, password })
      });

      const text = await res.text();
      if (!res.ok) return alert(text);

      alert("Account created successfully! Please log in.");
      createModal.classList.remove("active");
      modalOverlay.classList.add("active");
      setMode("user");
    } catch (err) {
      console.error("Signup Error:", err);
      alert("Server error during signup.");
    }
  });

  // ============================
  // HELPER: RESET CREATE MODAL
  // ============================
  function resetCreateModal() {
    firstName.value = "";
    lastName.value = "";
    createEmailInput.value = "";
    createPasswordInput.value = "";
    confirmPasswordInput.value = "";
  }

  // ============================
  // FILTER EXTENSION NOISE (MetaMask)
  // ============================
  window.addEventListener("message", (e) => {
    if (e.data?.target === "metamask-inpage") return;
  });
});