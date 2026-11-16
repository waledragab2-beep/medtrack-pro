-- UYT initial schema. Multi-tenant: every tenant-owned row carries brand_id.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;

CREATE TYPE member_role AS ENUM ('owner', 'manager', 'cashier');
CREATE TYPE order_status AS ENUM ('preparing', 'ready', 'picked_up', 'cancelled');
CREATE TYPE device_platform AS ENUM ('web', 'android', 'ios');
CREATE TYPE push_provider AS ENUM ('fcm', 'apns', 'webpush', 'expo');
CREATE TYPE notification_kind AS ENUM ('ready', 'reminder');
CREATE TYPE notification_status AS ENUM ('pending', 'sent', 'delivered', 'failed', 'canceled');
CREATE TYPE subscription_status AS ENUM ('trialing', 'active', 'past_due', 'canceled');

CREATE TABLE users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         citext UNIQUE NOT NULL,
  password_hash text NOT NULL,
  full_name     text NOT NULL,
  locale        text NOT NULL DEFAULT 'ar',
  created_at    timestamptz NOT NULL DEFAULT now(),
  last_login_at timestamptz
);

CREATE TABLE refresh_tokens (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  bytea UNIQUE NOT NULL,
  user_agent  text,
  expires_at  timestamptz NOT NULL,
  revoked_at  timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE brands (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                  citext UNIQUE NOT NULL,
  name                  text NOT NULL,
  name_en               text,
  tagline               text,
  tagline_en            text,
  logo_url              text,
  cover_url             text,
  gallery               jsonb NOT NULL DEFAULT '[]',
  theme                 jsonb NOT NULL DEFAULT '{}',
  social                jsonb NOT NULL DEFAULT '{}',
  google_review_url     text,
  notification_settings jsonb NOT NULL DEFAULT '{}',
  default_locale        text NOT NULL DEFAULT 'ar',
  timezone              text NOT NULL DEFAULT 'Africa/Cairo',
  currency              text NOT NULL DEFAULT 'EGP',
  plan                  text NOT NULL DEFAULT 'starter',
  subscription_status   subscription_status NOT NULL DEFAULT 'trialing',
  trial_ends_at         timestamptz DEFAULT now() + interval '14 days',
  is_demo               boolean NOT NULL DEFAULT false,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE branches (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id               uuid NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  slug                   citext UNIQUE NOT NULL,           -- used in the store QR: /s/<slug>
  name                   text NOT NULL,
  address                text,
  phone                  text,
  lat                    double precision,
  lng                    double precision,
  maps_url               text,
  opening_hours          text,
  avg_prep_minutes       int NOT NULL DEFAULT 7 CHECK (avg_prep_minutes BETWEEN 1 AND 180),
  late_pickup_minutes    int NOT NULL DEFAULT 5 CHECK (late_pickup_minutes BETWEEN 1 AND 180),
  require_claim_code     boolean NOT NULL DEFAULT false,
  max_devices_per_order  int NOT NULL DEFAULT 2 CHECK (max_devices_per_order BETWEEN 1 AND 5),
  is_active              boolean NOT NULL DEFAULT true,
  created_at             timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX branches_brand_idx ON branches(brand_id);

CREATE TABLE memberships (
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  brand_id   uuid NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  role       member_role NOT NULL,
  branch_id  uuid REFERENCES branches(id) ON DELETE SET NULL,  -- optional: restrict a cashier to one branch
  is_active  boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, brand_id)
);
CREATE INDEX memberships_brand_idx ON memberships(brand_id);

CREATE TABLE orders (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id           uuid NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  branch_id          uuid NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  order_number       text NOT NULL,
  status             order_status NOT NULL DEFAULT 'preparing',
  note               text,
  claim_secret       text NOT NULL,          -- embedded in the per-order QR, never shown in lists to customers
  claim_code         text NOT NULL,          -- 4-digit code for stores that require it with the static QR
  estimated_ready_at timestamptz,
  reminder_count     int NOT NULL DEFAULT 0,
  last_notified_at   timestamptz,
  created_by         uuid REFERENCES users(id) ON DELETE SET NULL,
  ready_by           uuid REFERENCES users(id) ON DELETE SET NULL,
  picked_up_by       uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  ready_at           timestamptz,
  picked_up_at       timestamptz,
  cancelled_at       timestamptz,
  is_demo            boolean NOT NULL DEFAULT false
);
-- An order number can only be active once per branch at a time (re-usable after pickup/cancel).
CREATE UNIQUE INDEX orders_active_number_uq ON orders(branch_id, lower(order_number))
  WHERE status IN ('preparing', 'ready');
CREATE INDEX orders_brand_created_idx ON orders(brand_id, created_at DESC);
CREATE INDEX orders_branch_status_idx ON orders(branch_id, status);

CREATE TABLE order_events (
  id            bigserial PRIMARY KEY,
  order_id      uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  brand_id      uuid NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  type          text NOT NULL,
  actor_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  data          jsonb NOT NULL DEFAULT '{}',
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX order_events_order_idx ON order_events(order_id);

-- A customer phone/browser linked to one order. The bearer token is stored hashed only.
CREATE TABLE order_devices (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id          uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  brand_id          uuid NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  token_hash        bytea UNIQUE NOT NULL,
  platform          device_platform NOT NULL,
  locale            text NOT NULL DEFAULT 'ar',
  push_provider     push_provider,
  push_token        text,
  push_subscription jsonb,
  user_agent        text,
  claimed_at        timestamptz NOT NULL DEFAULT now(),
  last_seen_at      timestamptz NOT NULL DEFAULT now(),
  revoked_at        timestamptz
);
CREATE INDEX order_devices_order_idx ON order_devices(order_id) WHERE revoked_at IS NULL;

-- Transactional outbox for push notifications (retries, de-duplication, delivery tracking).
CREATE TABLE notifications (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id        uuid NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  order_id        uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  device_id       uuid NOT NULL REFERENCES order_devices(id) ON DELETE CASCADE,
  kind            notification_kind NOT NULL,
  dedupe_key      text UNIQUE NOT NULL,
  provider        push_provider NOT NULL,
  status          notification_status NOT NULL DEFAULT 'pending',
  attempts        int NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  last_error      text,
  provider_msg_id text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  sent_at         timestamptz,
  delivered_at    timestamptz
);
CREATE INDEX notifications_pending_idx ON notifications(next_attempt_at) WHERE status = 'pending';
CREATE INDEX notifications_brand_idx ON notifications(brand_id, created_at);

CREATE TABLE ratings (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id          uuid UNIQUE NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  brand_id          uuid NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  branch_id         uuid NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  stars             smallint NOT NULL CHECK (stars BETWEEN 1 AND 5),
  comment           text,
  google_clicked_at timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ratings_brand_idx ON ratings(brand_id, created_at);

CREATE TABLE menu_categories (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id   uuid NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  name       text NOT NULL,
  name_en    text,
  sort       int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE menu_items (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id       uuid NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  category_id    uuid REFERENCES menu_categories(id) ON DELETE SET NULL,
  name           text NOT NULL,
  name_en        text,
  description    text,
  description_en text,
  price          numeric(10,2),
  image_url      text,
  is_available   boolean NOT NULL DEFAULT true,
  sort           int NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX menu_items_brand_idx ON menu_items(brand_id);

CREATE TABLE offers (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id       uuid NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  title          text NOT NULL,
  title_en       text,
  description    text,
  description_en text,
  image_url      text,
  badge          text,
  starts_at      timestamptz,
  ends_at        timestamptz,
  is_active      boolean NOT NULL DEFAULT true,
  sort           int NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX offers_brand_idx ON offers(brand_id);
