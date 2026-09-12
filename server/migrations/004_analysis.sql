-- Migration 004: Analysis, Matching, Issues, and Career Gaps
-- ResumeX AI Core Ultra

CREATE TABLE IF NOT EXISTS job_descriptions (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    company VARCHAR(255),
    location VARCHAR(255),
    raw_text TEXT NOT NULL,
    required_skills_json JSONB,
    preferred_skills_json JSONB,
    domain_keywords_json JSONB,
    responsibilities_json JSONB,
    experience_years_required INTEGER DEFAULT 3,
    seniority_level VARCHAR(64) DEFAULT 'Mid',
    education_required BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_jd_user_id ON job_descriptions(user_id);

CREATE TABLE IF NOT EXISTS job_matches (
    id VARCHAR(64) PRIMARY KEY,
    resume_id VARCHAR(64) NOT NULL REFERENCES resumes(id) ON DELETE CASCADE,
    job_id VARCHAR(64) NOT NULL REFERENCES job_descriptions(id) ON DELETE CASCADE,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    overall_match INTEGER NOT NULL,
    skill_match INTEGER NOT NULL,
    semantic_match INTEGER NOT NULL,
    keyword_match INTEGER NOT NULL,
    experience_match INTEGER NOT NULL,
    education_match INTEGER NOT NULL,
    responsibility_match INTEGER NOT NULL,
    matched_skills_json JSONB,
    missing_skills_json JSONB,
    recommendations_json JSONB,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_jm_resume_job ON job_matches(resume_id, job_id);
CREATE INDEX IF NOT EXISTS idx_jm_user_id ON job_matches(user_id);

CREATE TABLE IF NOT EXISTS analyses (
    id VARCHAR(64) PRIMARY KEY,
    resume_id VARCHAR(64) NOT NULL REFERENCES resumes(id) ON DELETE CASCADE,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    overall_score INTEGER NOT NULL,
    ats_score INTEGER NOT NULL,
    breakdown_json JSONB NOT NULL,
    parsing_health_json JSONB,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_analyses_resume_id ON analyses(resume_id);
CREATE INDEX IF NOT EXISTS idx_analyses_user_id ON analyses(user_id);

CREATE TABLE IF NOT EXISTS analysis_issues (
    id VARCHAR(64) PRIMARY KEY,
    resume_id VARCHAR(64) NOT NULL REFERENCES resumes(id) ON DELETE CASCADE,
    analysis_id VARCHAR(64) REFERENCES analyses(id) ON DELETE CASCADE,
    section VARCHAR(64) NOT NULL,
    issue_type VARCHAR(64) NOT NULL,
    severity VARCHAR(32) NOT NULL,
    evidence TEXT NOT NULL,
    reason TEXT NOT NULL,
    suggestion TEXT NOT NULL,
    confidence NUMERIC(4,2) DEFAULT 0.95,
    status VARCHAR(32) DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_issues_resume_id ON analysis_issues(resume_id);

CREATE TABLE IF NOT EXISTS suggestions (
    id VARCHAR(64) PRIMARY KEY,
    resume_id VARCHAR(64) NOT NULL REFERENCES resumes(id) ON DELETE CASCADE,
    issue_id VARCHAR(64) REFERENCES analysis_issues(id) ON DELETE CASCADE,
    original_text TEXT NOT NULL,
    suggested_text TEXT NOT NULL,
    reason TEXT NOT NULL,
    change_type VARCHAR(64) DEFAULT 'enhancement',
    status VARCHAR(32) DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_suggestions_resume_id ON suggestions(resume_id);

CREATE TABLE IF NOT EXISTS accepted_changes (
    id VARCHAR(64) PRIMARY KEY,
    resume_id VARCHAR(64) NOT NULL REFERENCES resumes(id) ON DELETE CASCADE,
    suggestion_id VARCHAR(64) REFERENCES suggestions(id) ON DELETE SET NULL,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    original_text TEXT NOT NULL,
    new_text TEXT NOT NULL,
    accepted_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ac_resume_id ON accepted_changes(resume_id);
CREATE INDEX IF NOT EXISTS idx_ac_user_id ON accepted_changes(user_id);

CREATE TABLE IF NOT EXISTS career_gaps (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    target_role VARCHAR(255) NOT NULL,
    analysis_json JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_career_gaps_user_role ON career_gaps(user_id, target_role);
