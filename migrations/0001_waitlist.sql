-- The waitlist's two tables. D1 was chosen over KV at 8.8's Gate B because "are they
-- already on the list?" is a state the page *designs* for, and KV's eventual consistency
-- would answer it wrongly for up to a minute after a signup.

CREATE TABLE IF NOT EXISTS signups (
  email      TEXT PRIMARY KEY,          -- the UNIQUE constraint IS the duplicate check
  locale     TEXT NOT NULL,
  ip_hash    TEXT NOT NULL,             -- salted SHA-256. The address itself is never stored
  created_at INTEGER NOT NULL           -- epoch ms
);

CREATE INDEX IF NOT EXISTS signups_created_at ON signups (created_at);

-- Every submission lands here, accepted or refused, because a limiter that only counts
-- successes is a limiter a bot never meets.
CREATE TABLE IF NOT EXISTS attempts (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  ip_hash    TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS attempts_source ON attempts (ip_hash, created_at);
