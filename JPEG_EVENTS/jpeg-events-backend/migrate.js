import { pool } from './database.js';

async function runMigration() {
    try {
        console.log("🚀 Connecting to database...");
        
        await pool.query(`
            CREATE TABLE IF NOT EXISTS page_views (
                id SERIAL PRIMARY KEY,
                event_id INT REFERENCES events(id) ON DELETE CASCADE,
                viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                device_type VARCHAR(20) DEFAULT 'Desktop',
                ip_address VARCHAR(45)
            );
        `);
        console.log("✅ Table 'page_views' is ready.");

        await pool.query(`
            ALTER TABLE bookings ADD COLUMN IF NOT EXISTS device_type VARCHAR(20) DEFAULT 'Desktop';
        `);
        console.log("✅ Column 'device_type' added to bookings.");

        console.log("🎉 Database updated successfully!");
        process.exit(0);
    } catch (err) {
        console.error("❌ Migration failed:", err.message);
        process.exit(1);
    }
}

runMigration();