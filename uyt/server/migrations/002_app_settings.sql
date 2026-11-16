-- Instance-level settings generated at first start (e.g. Web Push VAPID keys).
CREATE TABLE app_settings (
  key        text PRIMARY KEY,
  value      jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
