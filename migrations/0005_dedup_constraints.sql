-- Index for fast (name, city, state) lookups used by idempotent merger
CREATE INDEX IF NOT EXISTS facilities_name_city_state_idx
  ON facilities (name, city, state);
