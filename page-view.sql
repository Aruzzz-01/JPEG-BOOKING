-- Create a table to track page views and devices
CREATE TABLE page_views (
    id SERIAL PRIMARY KEY,
    event_id INT REFERENCES events(id) ON DELETE CASCADE,
    device_type VARCHAR(50),
    viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add a ticket_type column to bookings table
ALTER TABLE bookings 
ADD COLUMN ticket_type VARCHAR(50) DEFAULT 'Gen Ad';