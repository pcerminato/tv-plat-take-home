-- 0001_init.sql — baseline schema.

CREATE TABLE IF NOT EXISTS users (
  id   bigint PRIMARY KEY,
  name text   NOT NULL,
  role text   NOT NULL CHECK (role IN ('member', 'admin'))
);

CREATE TABLE IF NOT EXISTS resources (
  id         bigint      PRIMARY KEY,
  owner_id   bigint      NOT NULL REFERENCES users(id),
  type       text        NOT NULL,
  status     text        NOT NULL,
  title      text        NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS resource_shares (
  resource_id bigint NOT NULL REFERENCES resources(id),
  user_id     bigint NOT NULL REFERENCES users(id),
  PRIMARY KEY (resource_id, user_id)
);

-- Plain FK index a naive baseline would add for owner lookups.
CREATE INDEX IF NOT EXISTS idx_resources_owner_id ON resources(owner_id);
CREATE INDEX IF NOT EXISTS idx_resource_shares_resource_id ON resource_shares (resource_id);
-- INDEX to directly access the user_id and directly retrieve the corresponding resources
CREATE INDEX IF NOT EXISTS idx_resource_shares_user_resource ON resource_shares (user_id, resource_id);