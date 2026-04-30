import express from 'express';
import bcrypt from 'bcrypt';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool, testConnection } from './database.js';

// ==========================================
// SETUP & CONFIGURATION
// ==========================================
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;
const JWT_SECRET = 'super-secret-key';

// ==========================================
// 1. GLOBAL MIDDLEWARE
// ==========================================
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'HEAD', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, '../')));

// ==========================================
// 2. HEALTH CHECK & INIT
// ==========================================
app.head('/api/health-check', (req, res) => res.status(200).end());
app.get('/api/health-check', (req, res) => res.status(200).send("OK"));

testConnection();

// ==========================================
// 3. AUTHENTICATION MIDDLEWARE
// ==========================================
app.use((req, res, next) => {
    const authHeader = req.headers['authorization'];
    if (!authHeader) {
        req.user = null;
        return next();
    }
    try {
        const token = authHeader.split(' ')[1];
        req.user = jwt.verify(token, JWT_SECRET);
    } catch {
        req.user = null;
    }
    next();
});

function requireRole(roles) {
    return (req, res, next) => {
        if (!req.user) return res.status(401).send("Not logged in.");
        const allowedRoles = Array.isArray(roles) ? roles : [roles];
        if (!allowedRoles.includes(req.user.role)) return res.status(403).send("Access denied.");
        next();
    };
}

// ==========================================
// 4. HELPERS
// ==========================================
function getEventStatus(event_date) {
    if (!event_date) return "unknown";
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const eventDate = new Date(event_date);
    eventDate.setHours(0, 0, 0, 0);
    if (eventDate < today) return "expired";
    if (eventDate.getTime() === today.getTime()) return "ongoing";
    return "upcoming";
}

// ==========================================
// 5. PUBLIC AUTH ROUTES
// ==========================================
app.post('/signup', async (req, res) => {
    const { firstName, lastName, email, password } = req.body;
    if (!firstName || !lastName || !email || !password) return res.status(400).send("Missing fields.");
    try {
        const exists = await pool.query('SELECT id FROM users WHERE email=$1', [email]);
        if (exists.rows.length) return res.status(400).send("User exists.");
        const hash = await bcrypt.hash(password, 10);
        await pool.query(
            `INSERT INTO users (first_name, last_name, email, password_hash, role) VALUES ($1,$2,$3,$4,'user')`,
            [firstName, lastName, email, hash]
        );
        res.send("Account created.");
    } catch (err) { res.status(500).send("Signup failed."); }
});

app.post('/login', async (req, res) => {
    const { email, password, expectedRole } = req.body;
    try {
        const result = await pool.query('SELECT * FROM users WHERE email=$1', [email]);
        if (!result.rows.length) return res.status(401).send("Invalid credentials.");
        const user = result.rows[0];
        const match = await bcrypt.compare(password, user.password_hash);
        if (!match) return res.status(401).send("Invalid credentials.");

        if (expectedRole === "user" && user.role !== "user") return res.status(403).send("Wrong role.");
        if (expectedRole === "admin" && !["admin", "staff"].includes(user.role)) return res.status(403).send("Wrong role.");

        const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '2h' });
        res.json({ token });
    } catch (err) { res.status(500).send("Login failed."); }
});

// ==========================================
// 6. PROTECTED API ROUTES
// ==========================================

// --- Profile ---
app.get('/api/users/me', async (req, res) => {
    if (!req.user) return res.status(401).send("Not logged in.");
    const result = await pool.query(`SELECT id, first_name, last_name, email, role, profile_image FROM users WHERE id=$1`, [req.user.id]);
    res.json(result.rows[0]);
});

app.put('/api/users/me', async (req, res) => {
    if (!req.user) return res.status(401).send("Not logged in.");
    const { firstName, lastName, email, profile_image } = req.body;
    try {
        await pool.query(
            `UPDATE users
             SET first_name = $1, last_name = $2, email = $3, profile_image = COALESCE($4, profile_image)
             WHERE id = $5`,
            [firstName, lastName, email, profile_image || null, req.user.id]
        );
        res.send("Updated.");
    } catch (err) {
        console.error("DATABASE ERROR:", err.message);
        res.status(500).send("Update failed: " + err.message);
    }
});

app.put('/api/users/me/password', async (req, res) => {
    if (!req.user) return res.status(401).send("Not logged in.");
    const { current, newPassword } = req.body;
    try {
        const result = await pool.query('SELECT password_hash FROM users WHERE id=$1', [req.user.id]);
        if (!result.rows.length) return res.status(404).send("User not found.");
        const user = result.rows[0];
        const match = await bcrypt.compare(current, user.password_hash);
        if (!match) return res.status(401).send("Current password is incorrect.");
        const hash = await bcrypt.hash(newPassword, 10);
        await pool.query('UPDATE users SET password_hash=$1 WHERE id=$2', [hash, req.user.id]);
        res.send("Password updated successfully.");
    } catch (err) { res.status(500).send("Server error during password update."); }
});

app.delete('/api/users/me', async (req, res) => {
    if (!req.user) return res.status(401).send("Not logged in.");
    const { password } = req.body;
    if (!password) return res.status(400).send("Password required to delete account.");
    try {
        const result = await pool.query('SELECT password_hash FROM users WHERE id=$1', [req.user.id]);
        if (!result.rows.length) return res.status(404).send("User not found.");
        const user = result.rows[0];
        const match = await bcrypt.compare(password, user.password_hash);
        if (!match) return res.status(401).send("Incorrect password.");
        await pool.query('DELETE FROM users WHERE id=$1', [req.user.id]);
        res.send("Account deleted successfully.");
    } catch (err) { res.status(500).send("Server error during deletion."); }
});

// --- Admin: Staff Management ---
app.get('/api/staff', requireRole('admin'), async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT id, first_name, last_name, email, profile_image, role
            FROM users
            WHERE role IN ('staff', 'admin')
            ORDER BY id ASC
        `);
        res.json(result.rows);
    } catch (err) { res.status(500).send("Database error"); }
});

app.post('/api/staff', requireRole('admin'), async (req, res) => {
    const { firstName, lastName, email, password, role } = req.body;
    const userRole = role || 'staff';
    try {
        const hash = await bcrypt.hash(password, 10);
        const result = await pool.query(
            `INSERT INTO users (first_name, last_name, email, password_hash, role)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING id, first_name, last_name, email, profile_image, role`,
            [firstName, lastName, email, hash, userRole]
        );
        res.json(result.rows[0]);
    } catch (err) { res.status(500).send("User creation failed."); }
});

app.delete('/api/staff/:id', requireRole('admin'), async (req, res) => {
    try {
        const { id } = req.params;
        if (parseInt(id) === req.user.id) return res.status(400).send("You cannot delete your own account.");
        const result = await pool.query('DELETE FROM users WHERE id = $1', [id]);
        if (result.rowCount === 0) return res.status(404).send("User not found.");
        res.json({ success: true, message: "User deleted successfully" });
    } catch (err) { res.status(500).send("Failed to delete user"); }
});

// --- Admin: Events & Dashboard ---
app.post('/api/events', requireRole('admin'), async (req, res) => {
    const { title, description, image_url, ticket_price, ticket_quantity, event_date } = req.body;
    try {
        const prefix = title.substring(0, 3).toUpperCase();
        const event_code = `${prefix}-${Math.floor(1000 + Math.random() * 9000)}`;
        const result = await pool.query(
            `INSERT INTO events (title, description, image_url, ticket_price, ticket_quantity, event_date, event_code)
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
            [title, description, image_url, ticket_price, ticket_quantity, event_date, event_code]
        );
        res.json(result.rows[0]);
    } catch (err) { res.status(500).send("Creation failed."); }
});

app.delete('/api/events/:id', requireRole('admin'), async (req, res) => {
    await pool.query('DELETE FROM events WHERE id=$1', [req.params.id]);
    res.json({ success: true });
});

app.get('/api/admin/dashboard', requireRole('admin'), async (req, res) => {
    try {
        // 1. Basic Stats (Updated to include page_views)
        const summaryPromise = pool.query(`
            SELECT 
                (SELECT COUNT(id) FROM bookings) AS total_tickets_sold, 
                (SELECT COALESCE(SUM(price_paid), 0) FROM bookings) AS total_revenue,
                (SELECT COUNT(id) FROM page_views) AS total_views
        `);

        // 2. Revenue Trend (Line Chart)
        const trendPromise = pool.query(`
            SELECT TO_CHAR(created_at, 'YYYY-MM-DD') AS date, SUM(price_paid) AS amount 
            FROM bookings GROUP BY date ORDER BY date ASC LIMIT 30
        `);

        // 3. Performance Table
        const eventsPromise = pool.query(`
            SELECT e.id, e.title, e.ticket_quantity AS capacity, COUNT(b.id) AS sold, 
            SUM(CASE WHEN b.checked_in = true THEN 1 ELSE 0 END) AS attended, 
            COALESCE(SUM(b.price_paid), 0) AS revenue 
            FROM events e LEFT JOIN bookings b ON e.id = b.event_id 
            GROUP BY e.id ORDER BY e.event_date DESC
        `);

        // 4. Ticket Types (Doughnut Chart)
        const ticketTypesPromise = pool.query(`
            SELECT 
                CASE 
                    WHEN price_paid >= 1000 THEN 'VIP'
                    WHEN price_paid >= 500 THEN 'Early Bird'
                    ELSE 'Gen Ad'
                END as label,
                COUNT(*) as value
            FROM bookings
            GROUP BY label
        `);

        // 5. Platform Distribution (Bar Chart)
        const platformPromise = pool.query(`
            SELECT COALESCE(device_type, 'Desktop') as label, COUNT(*) as value 
            FROM bookings GROUP BY label
        `);

        const [summary, trend, events, ticketTypes, platforms] = await Promise.all([
            summaryPromise, trendPromise, eventsPromise, ticketTypesPromise, platformPromise
        ]);

        const totalSold = parseInt(summary.rows[0].total_tickets_sold);
        const totalViews = parseInt(summary.rows[0].total_views) || 1; 

        res.json({ 
            stats: {
                ...summary.rows[0],
                conversion_rate: ((totalSold / totalViews) * 100).toFixed(1)
            }, 
            chartData: trend.rows, 
            events: events.rows,
            ticketTypes: ticketTypes.rows, 
            platforms: platforms.rows 
        });
    } catch (err) { 
        console.error(err);
        res.status(500).send("Admin data load failed"); 
    }
});

// --- Public/User: Events & Bookings ---

app.get('/api/events', async (req, res) => {
    const result = await pool.query(`SELECT * FROM events ORDER BY event_date ASC`);
    const events = result.rows.map(e => ({ ...e, status: getEventStatus(e.event_date) }));
    res.json(events);
});

// NEW: Track Page Views for Conversion Analytics
app.post('/api/events/:id/view', async (req, res) => {
    const { id } = req.params;
    const { device } = req.body;
    try {
        await pool.query(
            'INSERT INTO page_views (event_id, device_type) VALUES ($1, $2)',
            [id, device || 'Desktop']
        );
        res.status(204).send();
    } catch (err) {
        console.error("View tracking error:", err);
        res.status(500).end();
    }
});

app.post('/api/bookings', requireRole('user'), async (req, res) => {
    // Note: Added 'device' to the destructuring here
    const { event_id, quantity, device } = req.body;
    const qtyToBook = parseInt(quantity);
    if (!qtyToBook || qtyToBook <= 0) return res.status(400).send("Invalid quantity");

    try {
        const eventResult = await pool.query('SELECT * FROM events WHERE id=$1', [event_id]);
        if (!eventResult.rows.length) return res.status(404).send("Event not found");

        const event = eventResult.rows[0];
        if (event.ticket_quantity < qtyToBook) return res.status(400).send("Not enough tickets available!");

        const dateString = new Date(event.event_date).toISOString().split('T')[0].replace(/-/g, '');
        const generatedTickets = [];

        await pool.query('BEGIN');
        for (let i = 0; i < qtyToBook; i++) {
            const randomChars = Math.random().toString(36).substring(2, 8).toUpperCase();
            const ticketCode = `${event.event_code}-${event.id}-${dateString}-${randomChars}`;
            
            // Fixed the INSERT query to include device_type properly inside the transaction
            await pool.query(
                `INSERT INTO bookings (user_id, event_id, quantity, ticket_hash, price_paid, device_type) 
                 VALUES ($1, $2, 1, $3, $4, $5)`, 
                [req.user.id, event_id, ticketCode, event.ticket_price, device || 'Desktop']
            );
            generatedTickets.push(ticketCode);
        }
        await pool.query(`UPDATE events SET ticket_quantity = ticket_quantity - $1 WHERE id = $2`, [qtyToBook, event_id]);
        await pool.query('COMMIT');

        res.json({ success: true, message: `Booked ${qtyToBook} tickets.`, tickets: generatedTickets });
    } catch (err) {
        await pool.query('ROLLBACK');
        console.error(err);
        res.status(500).send("Booking failed");
    }
});

app.get('/api/bookings', requireRole('user'), async (req, res) => {
    const result = await pool.query(`SELECT b.ticket_hash as ticket_code, b.quantity, b.checked_in as scanned, e.title, e.event_date, e.image_url FROM bookings b JOIN events e ON e.id = b.event_id WHERE b.user_id = $1 ORDER BY b.id DESC`, [req.user.id]);
    res.json(result.rows);
});

// --- Staff: Scanning & Attendance ---
app.get('/api/staff/events', requireRole(['admin', 'staff']), async (req, res) => {
    try {
        const now = new Date().toLocaleDateString('en-CA');
        const result = await pool.query(`SELECT id, title, event_date FROM events WHERE event_date = $1 ORDER BY title ASC`, [now]);
        res.json(result.rows);
    } catch (err) { res.status(500).send("Error loading active events"); }
});

app.post('/api/staff/scan-preview', requireRole(['admin', 'staff']), async (req, res) => {
    const { ticket_code, selected_event_id } = req.body;
    try {
        const result = await pool.query(`SELECT b.id, b.checked_in, b.event_id, u.first_name, u.last_name, e.event_date, e.title FROM bookings b JOIN users u ON u.id = b.user_id JOIN events e ON e.id = b.event_id WHERE b.ticket_hash = $1`, [ticket_code]);
        if (!result.rows.length) return res.json({ valid: false, message: "Ticket Not Found" });
        
        const ticket = result.rows[0];
        if (String(ticket.event_id) !== String(selected_event_id)) return res.json({ error: true, valid: false, message: `WRONG EVENT: This is for ${ticket.title}` });

        const now = new Date().toLocaleDateString('en-CA');
        const eventDateStr = new Date(ticket.event_date).toLocaleDateString('en-CA');
        
        if (eventDateStr > now) return res.json({ error: true, valid: false, message: "ERROR: EVENT IS UPCOMING" });
        if (eventDateStr < now) return res.json({ error: true, valid: false, message: "ERROR: EVENT HAS EXPIRED" });

        res.json({ valid: true, already_used: ticket.checked_in, name: `${ticket.first_name} ${ticket.last_name}`, ticket_hash: ticket_code });
    } catch (err) { res.status(500).json({ error: true, message: "Server Error" }); }
});

app.post('/api/staff/confirm-checkin', requireRole(['admin', 'staff']), async (req, res) => {
    const { ticket_code, selected_event_id } = req.body;
    try {
        const result = await pool.query(`SELECT b.id, b.checked_in FROM bookings b WHERE b.ticket_hash = $1 AND b.event_id = $2`, [ticket_code, selected_event_id]);
        if (!result.rows.length || result.rows[0].checked_in) return res.status(400).json({ success: false, message: "Invalid Request or Already Scanned" });
        
        await pool.query(`UPDATE bookings SET checked_in=true, checked_in_at=NOW(), checked_in_by=$1 WHERE id=$2`, [req.user.id, result.rows[0].id]);
        res.json({ success: true, message: "Check-in Confirmed" });
    } catch (err) { res.status(500).json({ success: false, message: "Database Update Failed" }); }
});

app.get('/api/staff/attendance/:eventId', requireRole(['admin', 'staff']), async (req, res) => {
    const total = await pool.query(`SELECT COUNT(*) FROM bookings WHERE event_id=$1`, [req.params.eventId]);
    const checked = await pool.query(`SELECT COUNT(*) FROM bookings WHERE event_id=$1 AND checked_in=true`, [req.params.eventId]);
    res.json({ total: parseInt(total.rows[0].count), checked: parseInt(checked.rows[0].count) });
});

app.get('/api/staff/recent/:eventId', requireRole(['admin', 'staff']), async (req, res) => {
    const { eventId } = req.params;
    try {
        const result = await pool.query(`
            SELECT u.first_name, u.last_name, b.checked_in_at
            FROM bookings b
            JOIN users u ON u.id = b.user_id
            WHERE b.event_id = $1 AND b.checked_in = true
            ORDER BY b.checked_in_at DESC
            LIMIT 10
        `, [eventId]);
        res.json(result.rows);
    } catch (err) {
        console.error("Error fetching recent check-ins:", err);
        res.status(500).json({ error: true, message: "Failed to load recent check-ins" });
    }
});

// ==========================================
// START SERVER
// ==========================================

// This is the specific fix for GitHub Codespaces 504 Gateway errors!
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on http://0.0.0.0:${PORT}`);
    console.log(`🔗 Make sure Port ${PORT} is set to 'Public' in the Ports tab!`);
});