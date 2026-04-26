-- Enable pgvector extension
create extension if not exists vector;

-- Users (from Supabase auth or custom)
create table users (
  id uuid primary key,
  github_id text,
  created_at timestamp default now()
);

-- Profiles
create table profiles (
  id uuid primary key references users(id) on delete cascade,
  handle text unique,
  avatar_url text,
  full_name text,
  created_at timestamp default now(),
  updated_at timestamp default now()
);

-- Tags (Skills, Interests)
create table tags (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  category text, -- e.g., 'skill', 'interest'
  created_at timestamp default now()
);

-- User Tags (Many-to-Many)
create table user_tags (
  user_id uuid references users(id) on delete cascade,
  tag_id uuid references tags(id) on delete cascade,
  created_at timestamp default now(),
  primary key (user_id, tag_id)
);

-- Personas (AI Generated)
create table personas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  summary text not null,
  created_at timestamp default now(),
  updated_at timestamp default now()
);

-- Questionnaire Answers
create table questionnaire_answers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  question text not null,
  answer text not null,
  created_at timestamp default now()
);

-- Profile Chunks (for Vector Search)
create table profile_chunks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  content text not null,
  embedding vector(1536), -- Assuming OpenAI embeddings, adjust size if needed
  created_at timestamp default now()
);

-- Matches (Colleagues match score)
create table matches (
  id uuid primary key default gen_random_uuid(),
  user_id_1 uuid references users(id) on delete cascade,
  user_id_2 uuid references users(id) on delete cascade,
  match_score float not null,
  reasoning text,
  created_at timestamp default now(),
  unique(user_id_1, user_id_2)
);

-- RPC Function for Similarity Search
create or replace function match_profile_chunks (
  query_embedding vector(1536),
  match_threshold float,
  match_count int
)
returns table (
  id uuid,
  user_id uuid,
  content text,
  similarity float
)
language sql stable
as $$
  select
    profile_chunks.id,
    profile_chunks.user_id,
    profile_chunks.content,
    1 - (profile_chunks.embedding <=> query_embedding) as similarity
  from profile_chunks
  where 1 - (profile_chunks.embedding <=> query_embedding) > match_threshold
  order by profile_chunks.embedding <=> query_embedding
  limit match_count;
$$;