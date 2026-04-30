import pkg from 'pg';
const { Pool } = pkg;

export const pool = new Pool({
  user: 'node',             // The Owner shown in your \dt list
  host: 'localhost', 
  database: 'postgres',     // The DB where you ran the restore
  password: '',             // No password needed for local "trust" auth
  port: 5432,
  // This tells the app exactly where the "lock" file is located
  host: '/workspaces/JPEG-BOOKING/local_db' 
});

export async function testConnection() {
  try {
    const result = await pool.query('SELECT NOW()');
    console.log('✅ PostgreSQL connected! Time:', result.rows[0].now);
    
    // Check if we can see the data
    const tableCheck = await pool.query('SELECT COUNT(*) FROM users');
    console.log(`📊 Found ${tableCheck.rows[0].count} users in the database.`);
  } catch (err) {
    console.error('❌ DB connection error:', err.message);
  }
}
// /usr/lib/postgresql/15/bin/pg_ctl -D /workspaces/JPEG-BOOKING/local_db -o "-p 5432 -k /workspaces/JPEG-BOOKING/local_db" -l /workspaces/JPEG-BOOKING/db_log start