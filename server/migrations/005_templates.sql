-- Migration 005: Templates Engine Catalog Table
-- ResumeX AI Core Ultra

CREATE TABLE IF NOT EXISTS templates (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(64) NOT NULL,
    description TEXT,
    config_json JSONB NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_templates_category ON templates(category);
CREATE INDEX IF NOT EXISTS idx_templates_is_active ON templates(is_active);
