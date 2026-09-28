-- MISE-005BD: gmail_credentials.provider_subject CHECK must reject non-ASCII /
-- control / spaced subjects under COLLATE "C" so restore cannot accept subject
-- bytes the Edge callback ASCII gate would refuse (and vice versa).
begin;
select plan(8);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'private.gmail_credentials'::regclass
      and conname = 'gmail_credentials_provider_subject_check'
  ),
  'gmail_credentials_provider_subject_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'private.gmail_credentials'::regclass
      and conname = 'gmail_credentials_provider_subject_check'
  ),
  'provider_subject collate "C" ~ ''\^\[A-Za-z0-9_-\]\{1,255\}\$''',
  'gmail_credentials.provider_subject CHECK uses COLLATE C ASCII shape'
);

select is(
  (
    select pg_get_constraintdef(oid) not ilike '%length(provider_subject)%'
    from pg_constraint
    where conrelid = 'private.gmail_credentials'::regclass
      and conname = 'gmail_credentials_provider_subject_check'
  ),
  true,
  'gmail_credentials.provider_subject CHECK is not length-only'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII controls.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  ('123456789012345678901' collate "C" ~ '^[A-Za-z0-9_-]{1,255}$'),
  true,
  'numeric Google sub matches under COLLATE C'
);

select is(
  ('mise-003b-relinked-subject' collate "C" ~ '^[A-Za-z0-9_-]{1,255}$'),
  true,
  'fixture ASCII subject matches under COLLATE C'
);

select is(
  ('subject with space' collate "C" ~ '^[A-Za-z0-9_-]{1,255}$'),
  false,
  'spaced provider_subject is rejected under COLLATE C'
);

select is(
  (E'subject\twith-tab' collate "C" ~ '^[A-Za-z0-9_-]{1,255}$'),
  false,
  'ASCII tab provider_subject is rejected under COLLATE C'
);

select is(
  ('sujeto-ñ' collate "C" ~ '^[A-Za-z0-9_-]{1,255}$'),
  false,
  'non-ASCII provider_subject is rejected under COLLATE C'
);

select * from finish();
rollback;
