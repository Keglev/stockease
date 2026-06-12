-- Create users and product tables

-- Stores application users with hashed passwords and assigned roles
CREATE TABLE IF NOT EXISTS app_user (
    id BIGSERIAL PRIMARY KEY,  -- PostgreSQL auto-increment integer primary key
    username VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(255) NOT NULL
);

-- Stores inventory product records with quantity and computed total value
CREATE TABLE IF NOT EXISTS product (
    id BIGSERIAL PRIMARY KEY,  -- PostgreSQL auto-increment integer primary key
    name VARCHAR(255) NOT NULL,
    quantity INTEGER NOT NULL,
    price DOUBLE PRECISION NOT NULL,  -- DOUBLE PRECISION over NUMERIC: acceptable precision trade-off for inventory pricing, not financial accounting
    total_value DOUBLE PRECISION NOT NULL
);
