create table users (
  id uuid primary key,
  github_id text,
  created_at timestamp default now()
);