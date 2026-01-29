-- VanlifeVibes Database Schema
-- PostgreSQL 14+

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- User Account Table
CREATE TABLE user_account (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(150) UNIQUE NOT NULL,
    email VARCHAR(254) UNIQUE NOT NULL,
    password VARCHAR(128) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_user_account_username ON user_account(username);
CREATE INDEX idx_user_account_email ON user_account(email);

-- Group Table
CREATE TABLE app_group (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_by UUID NOT NULL REFERENCES user_account(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_app_group_created_by ON app_group(created_by);

-- Group Membership Table
CREATE TABLE group_membership (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    group_id UUID NOT NULL REFERENCES app_group(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES user_account(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL DEFAULT 'member',
    membership_type VARCHAR(20) NOT NULL DEFAULT 'invitation',
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    is_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
    invited_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    confirmed_at TIMESTAMP WITH TIME ZONE,
    rejected_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(group_id, user_id)
);

CREATE INDEX idx_group_membership_group_confirmed ON group_membership(group_id, is_confirmed);
CREATE INDEX idx_group_membership_group_status ON group_membership(group_id, status);
CREATE INDEX idx_group_membership_user_status ON group_membership(user_id, status);
CREATE INDEX idx_group_membership_type_status ON group_membership(membership_type, status);

-- Session Table
CREATE TABLE session (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    group_id UUID NOT NULL REFERENCES app_group(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    candidate_type VARCHAR(100),
    rules JSONB NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'open',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CHECK (status IN ('draft', 'open', 'closed', 'archived'))
);

CREATE INDEX idx_session_group ON session(group_id);
CREATE INDEX idx_session_status ON session(status);

-- Session Shared Group Table
CREATE TABLE session_shared_group (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES session(id) ON DELETE CASCADE,
    group_id UUID NOT NULL REFERENCES app_group(id) ON DELETE CASCADE,
    shared_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(session_id, group_id)
);

CREATE INDEX idx_session_shared_group_session ON session_shared_group(session_id);
CREATE INDEX idx_session_shared_group_group ON session_shared_group(group_id);

-- Candidate Table
CREATE TABLE candidate (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES session(id) ON DELETE CASCADE,
    label VARCHAR(255) NOT NULL,
    image_url VARCHAR(500),
    attributes JSONB,
    external_ref VARCHAR(255),
    created_by UUID REFERENCES user_account(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(session_id, external_ref, label)
);

CREATE INDEX idx_candidate_session ON candidate(session_id);
CREATE INDEX idx_candidate_created_by ON candidate(created_by);
CREATE INDEX idx_candidate_attributes ON candidate USING GIN(attributes);

-- Swipe Table
CREATE TABLE swipe (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    candidate_id UUID NOT NULL REFERENCES candidate(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES user_account(id) ON DELETE CASCADE,
    is_like BOOLEAN NOT NULL,
    swiped_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, candidate_id)
);

CREATE INDEX idx_swipe_candidate ON swipe(candidate_id);
CREATE INDEX idx_swipe_user ON swipe(user_id);

-- Match Table
CREATE TABLE match (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES session(id) ON DELETE CASCADE,
    candidate_id UUID NOT NULL REFERENCES candidate(id) ON DELETE CASCADE,
    matched_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    snapshot JSONB,
    UNIQUE(session_id, candidate_id)
);

CREATE INDEX idx_match_session ON match(session_id);
CREATE INDEX idx_match_candidate ON match(candidate_id);

-- Match Message Table (per-match chat)
CREATE TABLE match_message (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    match_id UUID NOT NULL REFERENCES match(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES user_account(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_match_message_match ON match_message(match_id);
CREATE INDEX idx_match_message_user ON match_message(user_id);

-- Taxonomy Table
CREATE TABLE taxonomy (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT
);

CREATE INDEX idx_taxonomy_name ON taxonomy(name);

-- Term Table
CREATE TABLE term (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    taxonomy_id UUID NOT NULL REFERENCES taxonomy(id) ON DELETE CASCADE,
    value VARCHAR(255) NOT NULL,
    attributes JSONB,
    UNIQUE(taxonomy_id, value)
);

CREATE INDEX idx_term_taxonomy ON term(taxonomy_id);

-- Candidate Term Table (tagging)
CREATE TABLE candidate_term (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    candidate_id UUID NOT NULL REFERENCES candidate(id) ON DELETE CASCADE,
    term_id UUID NOT NULL REFERENCES term(id) ON DELETE CASCADE,
    UNIQUE(candidate_id, term_id)
);

CREATE INDEX idx_candidate_term_candidate ON candidate_term(candidate_id);
CREATE INDEX idx_candidate_term_term ON candidate_term(term_id);

-- Question Table
CREATE TABLE question (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    text TEXT NOT NULL,
    scope VARCHAR(50) NOT NULL,
    candidate_type VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CHECK (scope IN ('global', 'candidate_type', 'session', 'group'))
);

CREATE INDEX idx_question_scope ON question(scope);

-- Answer Option Table
CREATE TABLE answer_option (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    question_id UUID NOT NULL REFERENCES question(id) ON DELETE CASCADE,
    text VARCHAR(255) NOT NULL,
    order_num INTEGER NOT NULL
);

CREATE INDEX idx_answer_option_question ON answer_option(question_id);

-- User Answer Table
CREATE TABLE user_answer (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES user_account(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES question(id) ON DELETE CASCADE,
    session_id UUID REFERENCES session(id) ON DELETE CASCADE,
    answer_option_id UUID REFERENCES answer_option(id) ON DELETE SET NULL,
    answer_value JSONB,
    answered_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, question_id, session_id)
);

CREATE INDEX idx_user_answer_user ON user_answer(user_id);
CREATE INDEX idx_user_answer_question ON user_answer(question_id);
CREATE INDEX idx_user_answer_session ON user_answer(session_id);
