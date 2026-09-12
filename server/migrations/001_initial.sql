-- Migration 001: Initial Users, Profiles, and Migration Tracking Table
-- ResumeX AI Core Ultra

CREATE TABLE IF NOT EXISTS schema_migrations (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    applied_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    email_verified BOOLEAN DEFAULT FALSE,
    verification_token VARCHAR(255),
    verification_token_expires_at TIMESTAMPTZ,
    reset_token VARCHAR(255),
    reset_token_expires_at TIMESTAMPTZ,
    is_demo BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(LOWER(email));
CREATE INDEX IF NOT EXISTS idx_users_verification_token ON users(verification_token);
CREATE INDEX IF NOT EXISTS idx_users_reset_token ON users(reset_token);

CREATE TABLE IF NOT EXISTS profiles (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) DEFAULT 'Software Engineer',
    target_role VARCHAR(255) DEFAULT 'Software Engineer',
    years_of_experience INTEGER DEFAULT 3,
    location VARCHAR(255) DEFAULT 'San Francisco, CA',
    bio TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON profiles(user_id);
