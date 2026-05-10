-- PostgreSQL initialization for Comedor System
-- This file runs once when the database is first created

-- Enable useful extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Set timezone
SET timezone = 'America/Asuncion';

-- Confirm initialization
SELECT 'Comedor database initialized successfully' AS status;
