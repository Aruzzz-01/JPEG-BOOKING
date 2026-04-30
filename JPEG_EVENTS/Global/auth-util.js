/**
 * GLOBAL AUTH UTILITY - JPEG Events
 * Include this in your Admin, Staff, and User HTML files.
 */

// REMOVED: hardcoded localhost API_BASE to fix Heartbeat ERR_CONNECTION_REFUSED
const Auth = {
    // 1. WATCHDOG: Periodically check if server is alive
    startHeartbeat: function(interval = 5000) {
        setInterval(async () => {
            // Bypass 1: Do not run on the landing page
            const path = window.location.pathname;
            if (path === "/" || path.endsWith("index.html") || path.toLowerCase().includes("landing")) {
                return;
            }

            // Bypass 2: Do not run if the user isn't logged in
            if (!localStorage.getItem("token")) return;

            try {
                // FIXED: Using relative path '/api/health-check'
                const res = await fetch(`/api/health-check`, { 
                    method: 'GET',
                    cache: 'no-store'
                });
                
                // If the server doesn't respond with a success code, trigger logout
                if (!res.ok) throw new Error("Server Down");
            } catch (err) {
                console.error("Heartbeat failed:", err);
                // Only force logout if the error isn't just a temporary network blip
                // For development in Codespaces, you might want to console.log instead of forceLogout
                // this.forceLogout("Connection to JPEG Events server was lost.");
            }
        }, interval);
    },

    // 2. PROTECTION: Verify token and role on page load
    protectPage: function(requiredRole) {
        const token = localStorage.getItem("token");
        
        // If no token exists, send them back to the login screen
        if (!token) {
            window.location.href = "../../index.html";
            return null;
        }

        try {
            const payload = JSON.parse(atob(token.split(".")[1]));
            
            // Expiry Check
            if (payload.exp && Date.now() >= payload.exp * 1000) {
                return this.forceLogout("Session expired. Please log in again.");
            }

            // Role Check
            if (requiredRole && payload.role !== requiredRole) {
                alert("Unauthorized Access!");
                const target = payload.role === 'admin' 
                    ? "../../Admin/Admin-Events.html" 
                    : "../../User/User-Dashboard.html";
                window.location.href = target;
                return null;
            }
            
            return payload; 
        } catch (e) {
            return this.forceLogout();
        }
    },

    // 3. ACTION: Clear everything and kick user out
    forceLogout: function(message) {
        if (message) alert(message);
        localStorage.clear();
        window.location.href = "../../index.html";
    }
};

// Start the watchdog automatically
Auth.startHeartbeat();