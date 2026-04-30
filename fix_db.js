const { Client } = require('pg');
const client = new Client({
  user: 'postgres',
  host: 'localhost',
  database: 'postgres',
  port: 5432,
});

async function run() {
  await client.connect();
  await client.query('CREATE DATABASE jpeg_db');
  console.log("✅ Database jpeg_db created successfully!");
  await client.end();
}

run().catch(err => console.error("❌ Error:", err.message));