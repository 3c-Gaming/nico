CREATE TABLE IF NOT EXISTS user_preferences (
  id TEXT PRIMARY KEY DEFAULT 'global',
  pinned_numeros JSONB NOT NULL DEFAULT '[]'::jsonb,
  pinned_funis JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO user_preferences (id, pinned_numeros, pinned_funis)
VALUES ('global', '[]'::jsonb, '[]'::jsonb)
ON CONFLICT (id) DO NOTHING;
