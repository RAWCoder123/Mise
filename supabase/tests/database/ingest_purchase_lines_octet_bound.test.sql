-- MISE-005G: ingest_purchase_lines must reject oversized p_lines via
-- octet_length(...::text), matching delivery's 256 KiB ceiling.
begin;
select plan(4);

select ok(
  exists (
    select 1
    from pg_proc
    where proname = 'ingest_purchase_lines'
      and pronamespace = 'public'::regnamespace
  ),
  'public.ingest_purchase_lines exists'
);

select ok(
  pg_get_functiondef('public.ingest_purchase_lines(uuid, text, text, jsonb, uuid, uuid)'::regprocedure)
    ~ 'octet_length\(p_lines::text\) > 262144',
  'ingest_purchase_lines guards p_lines with octet_length(...::text) <= 256 KiB'
);

select ok(
  pg_get_functiondef('public.ingest_purchase_lines(uuid, text, text, jsonb, uuid, uuid)'::regprocedure)
    ~ 'Purchase line payload exceeds the allowed size',
  'oversized ingest payloads raise a dedicated size error'
);

select ok(
  pg_get_functiondef('public.ingest_purchase_lines(uuid, text, text, jsonb, uuid, uuid)'::regprocedure)
    !~ 'pg_column_size\(p_lines\)',
  'ingest size guard must not use restore-unsafe pg_column_size'
);

select * from finish();
rollback;
