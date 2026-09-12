-- Migration 003: Core Resume Tables & Sections
-- ResumeX AI Core Ultra

CREATE TABLE IF NOT EXISTS resumes (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    profile_id VARCHAR(64) REFERENCES profiles(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    raw_text TEXT,
    file_type VARCHAR(64),
    file_name VARCHAR(255),
    template_id VARCHAR(64) DEFAULT 'ats-classic',
    current_version_id VARCHAR(64),
    ats_score INTEGER DEFAULT 85,
    score_json JSONB,
    data_json JSONB,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_resumes_user_id ON resumes(user_id);
CREATE INDEX IF NOT EXISTS idx_resumes_created_at ON resumes(created_at);

CREATE TABLE IF NOT EXISTS resume_versions (
    id VARCHAR(64) PRIMARY KEY,
    resume_id VARCHAR(64) NOT NULL REFERENCES resumes(id) ON DELETE CASCADE,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    version_name VARCHAR(255) NOT NULL,
    resume_data_json JSONB NOT NULL,
    score_json JSONB,
    ats_score INTEGER DEFAULT 85,
    change_summary TEXT,
    is_active BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_versions_resume_id ON resume_versions(resume_id);
CREATE INDEX IF NOT EXISTS idx_versions_user_id ON resume_versions(user_id);

CREATE TABLE IF NOT EXISTS resume_sections (
    id VARCHAR(64) PRIMARY KEY,
    resume_id VARCHAR(64) NOT NULL REFERENCES resumes(id) ON DELETE CASCADE,
    section_type VARCHAR(64) NOT NULL,
    display_title VARCHAR(255) NOT NULL,
    order_index INTEGER DEFAULT 0,
    is_visible BOOLEAN DEFAULT TRUE,
    content_json JSONB,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sections_resume_id ON resume_sections(resume_id);

CREATE TABLE IF NOT EXISTS skills (
    id VARCHAR(64) PRIMARY KEY,
    resume_id VARCHAR(64) NOT NULL REFERENCES resumes(id) ON DELETE CASCADE,
    category VARCHAR(128) NOT NULL,
    name VARCHAR(128) NOT NULL,
    proficiency VARCHAR(64) DEFAULT 'Proficient',
    years INTEGER,
    evidence TEXT,
    confidence NUMERIC(4,2) DEFAULT 1.00,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_skills_resume_id ON skills(resume_id);
CREATE INDEX IF NOT EXISTS idx_skills_name ON skills(name);

CREATE TABLE IF NOT EXISTS experiences (
    id VARCHAR(64) PRIMARY KEY,
    resume_id VARCHAR(64) NOT NULL REFERENCES resumes(id) ON DELETE CASCADE,
    company VARCHAR(255) NOT NULL,
    role VARCHAR(255) NOT NULL,
    location VARCHAR(255),
    start_date VARCHAR(64),
    end_date VARCHAR(64),
    is_current BOOLEAN DEFAULT FALSE,
    bullets_json JSONB,
    technologies_json JSONB,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_exp_resume_id ON experiences(resume_id);

CREATE TABLE IF NOT EXISTS projects (
    id VARCHAR(64) PRIMARY KEY,
    resume_id VARCHAR(64) NOT NULL REFERENCES resumes(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    role VARCHAR(255),
    link VARCHAR(512),
    bullets_json JSONB,
    technologies_json JSONB,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_projects_resume_id ON projects(resume_id);

CREATE TABLE IF NOT EXISTS education (
    id VARCHAR(64) PRIMARY KEY,
    resume_id VARCHAR(64) NOT NULL REFERENCES resumes(id) ON DELETE CASCADE,
    institution VARCHAR(255) NOT NULL,
    degree VARCHAR(255) NOT NULL,
    field_of_study VARCHAR(255),
    start_date VARCHAR(64),
    end_date VARCHAR(64),
    gpa VARCHAR(32),
    honors_json JSONB,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_edu_resume_id ON education(resume_id);

CREATE TABLE IF NOT EXISTS certifications (
    id VARCHAR(64) PRIMARY KEY,
    resume_id VARCHAR(64) NOT NULL REFERENCES resumes(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    issuer VARCHAR(255) NOT NULL,
    issue_date VARCHAR(64),
    credential_id VARCHAR(128),
    link VARCHAR(512),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_certs_resume_id ON certifications(resume_id);

CREATE TABLE IF NOT EXISTS achievements (
    id VARCHAR(64) PRIMARY KEY,
    resume_id VARCHAR(64) NOT NULL REFERENCES resumes(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    date VARCHAR(64),
    metric VARCHAR(128),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ach_resume_id ON achievements(resume_id);
