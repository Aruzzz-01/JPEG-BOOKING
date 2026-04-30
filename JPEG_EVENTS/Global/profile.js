// globalProfile.js
document.addEventListener("DOMContentLoaded", () => {

  // REMOVED: hardcoded localhost API_BASE to fix ERR_CONNECTION_REFUSED
  const token = localStorage.getItem("token");

  if (!token) return;

  // ===== ELEMENTS =====
  const avatar = document.querySelector(".avatar");
  const userInfo = document.querySelector(".user-info");

  const profileModal = document.getElementById("profileModal");
  const profileAvatarPreview = document.getElementById("profileAvatarPreview");
  const profileImageInput = document.getElementById("profileImageInput");
  const saveProfileBtn = document.getElementById("saveProfileBtn");
  const closeProfileBtn = document.getElementById("closeProfileBtn");
  const profileName = document.getElementById("profileName");
  const profileEmail = document.getElementById("profileEmail");
  const logoutBtn = document.getElementById("logoutBtn");

  let selectedProfileImage = null;

  // ===== LOAD PROFILE =====
  async function loadProfile() {
    try {
      // FIXED: Using relative path /api/users/me
      const res = await fetch(`/api/users/me`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (!res.ok) throw new Error();

      const data = await res.json();

      // TEXT
      if (profileName)
        profileName.textContent = `${data.first_name} ${data.last_name}`;

      if (profileEmail)
        profileEmail.textContent = data.email;

      // Update name in topbar if it exists
      const usernameDisplay = document.getElementById("usernameDisplay");
      if (usernameDisplay) {
          usernameDisplay.textContent = data.first_name;
      }

      // IMAGE
      if (data.profile_image) {
        if (profileAvatarPreview) {
          profileAvatarPreview.style.backgroundImage = `url(${data.profile_image})`;
          profileAvatarPreview.textContent = "";
        }
        if (avatar) {
          avatar.style.backgroundImage = `url(${data.profile_image})`;
          avatar.textContent = "";
        }
      } else {
        if (profileAvatarPreview) {
          profileAvatarPreview.style.backgroundImage = "";
          profileAvatarPreview.textContent = "PROFILE";
        }
      }

      if (saveProfileBtn)
        saveProfileBtn.style.display = "none";

      selectedProfileImage = null;
    }
    catch (err) {
      console.error("Profile load failed", err);
    }
  }

  // ===== OPEN MODAL =====
  avatar?.addEventListener("click", () => {
    loadProfile();
    if (profileModal)
      profileModal.style.display = "flex";
  });

  closeProfileBtn?.addEventListener("click", () => {
    if (profileModal)
      profileModal.style.display = "none";
  });

  // ===== CLICK AVATAR PREVIEW =====
  profileAvatarPreview?.addEventListener("click", () => {
    profileImageInput?.click();
  });

  // ===== IMAGE SELECT =====
  profileImageInput?.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = ev => {
      selectedProfileImage = ev.target.result;
      if (profileAvatarPreview) {
        profileAvatarPreview.style.backgroundImage = `url(${selectedProfileImage})`;
        profileAvatarPreview.textContent = "";
      }
      if (avatar) {
        avatar.style.backgroundImage = `url(${selectedProfileImage})`;
        avatar.textContent = "";
      }
      if (saveProfileBtn)
        saveProfileBtn.style.display = "inline-block";
    };
    reader.readAsDataURL(file);
  });

  // ===== SAVE PROFILE =====
  saveProfileBtn?.addEventListener("click", async () => {
    if (!selectedProfileImage)
      return alert("No image selected");

    try {
      // FIXED: Corrected path and removed "$" typo
      const res = await fetch(`/api/users/me`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          profile_image: selectedProfileImage
        })
      });

      if (!res.ok) throw new Error();

      saveProfileBtn.style.display = "none";
      selectedProfileImage = null;
      alert("Profile updated");
    }
    catch (err) {
      console.error(err);
      alert("Save failed");
    }
  });

  // ===== LOGOUT =====
  logoutBtn?.addEventListener("click", () => {
    localStorage.clear();
    location.href = "../../index.html";
  });

  // ===== INITIAL LOAD =====
  loadProfile();
});