-- Migration 006: Audit Events, Audit Logs, Exports & Security Hardening
-- ResumeX AI Core Ultra

CREATE TABLE IF NOT EXISTS exports (
    id VARCHAR(64) PRIMARY KEY,
    resume_id VARCHAR(64) NOT NULL REFERENCES resumes(id) ON DELETE CASCADE,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    format VARCHAR(32) NOT NULL,
    file_url TEXT,
    status VARCHAR(32) DEFAULT 'completed',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_exports_user_id ON exports(user_id);
CREATE INDEX IF NOT EXISTS idx_exports_resume_id ON exports(resume_id);

CREATE TABLE IF NOT EXISTS audit_events (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(128) NOT NULL,
    resource_type VARCHAR(64) NOT NULL,
    resource_id VARCHAR(64),
    details_json JSONB,
    ip_address VARCHAR(64),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_user_id ON audit_events(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_events(action);
CREATE INDEX IF NOT EXISTS idx_audit_created_at ON audit_events(created_at);

CREATE TABLE IF NOT EXISTS audit_logs (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(128) NOT NULL,
    entity_type VARCHAR(64),
    entity_id VARCHAR(64),
    resource_type VARCHAR(64),
    resource_id VARCHAR(64),
    details_json JSONB,
    ip_address VARCHAR(64),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
