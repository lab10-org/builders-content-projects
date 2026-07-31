-- Seeds the one account the e2e suite needs to already exist.
--
-- `e2e/auth.spec.ts` has two cases about an *existing* user: signing in with
-- the wrong password, and registering an address that is already taken. Without
-- this file both preconditions had to be created by hand, so `supabase db
-- reset` silently broke the suite — Case 3 failed outright and Case 2 passed
-- for the wrong reason, testing "unknown email" instead of "wrong password".
--
-- `config.toml` already points `db.seed.sql_paths` at this file, so it runs on
-- every reset. Nothing here is app data: the app's own tables are seeded by
-- their migrations, and this account exists only for the browser tests.

-- pgcrypto lives in `extensions`, which is not on the default search path for
-- every role that can run a seed.
set search_path to public, extensions;

-- Written straight into `auth.users` rather than through the API, because a
-- seed runs against the database with no service listening yet. `crypt` with a
-- bcrypt salt is the same hashing GoTrue itself applies, so the password below
-- really does authenticate.
insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
select
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  'smoke-2026073001@example.com',
  crypt('e2e-seeded-pass', gen_salt('bf')),
  -- Confirmed on creation, so the account keeps working the day
  -- `enable_confirmations` is turned on and there is no inbox to click.
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{}'::jsonb,
  now(),
  now()
-- Guarded on the email rather than a fixed id: the account may already have
-- been created by hand, and a seed that fails on a re-run is a seed nobody runs.
where not exists (
  select 1 from auth.users where email = 'smoke-2026073001@example.com'
);

-- GoTrue looks the account up through `auth.identities`; a user row on its own
-- is found by neither sign-in nor the duplicate-registration check.
insert into auth.identities (
  id,
  user_id,
  provider_id,
  identity_data,
  provider,
  last_sign_in_at,
  created_at,
  updated_at
)
select
  gen_random_uuid(),
  users.id,
  users.id::text,
  jsonb_build_object(
    'sub', users.id::text,
    'email', users.email,
    'email_verified', true,
    'phone_verified', false
  ),
  'email',
  now(),
  now(),
  now()
from auth.users as users
where users.email = 'smoke-2026073001@example.com'
  and not exists (
    select 1
    from auth.identities as identities
    where identities.user_id = users.id and identities.provider = 'email'
  );
