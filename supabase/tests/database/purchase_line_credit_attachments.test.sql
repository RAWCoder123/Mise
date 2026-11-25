create extension if not exists pgtap with schema extensions;

begin;

-- Plan derived by counting assertion call sites in this file:
--   grep -cE '^select (is|isnt|throws_ok)\(' supabase/tests/database/purchase_line_credit_attachments.test.sql
select plan(14);

create or replace function pg_temp.error_of(statement text)
returns text language plpgsql as $$
begin execute statement; return null;
exception when others then return sqlerrm;
end;
$$;

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('7a111111-1111-4111-8111-111111111111', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'credit-manager@mise.test', crypt('password', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
  ('7a222222-2222-4222-8222-222222222222', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'credit-staff@mise.test', crypt('password', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
  ('7b111111-1111-4111-8111-111111111111', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'credit-other@mise.test', crypt('password', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now());

insert into public.restaurants (id, name, cuisine_type, timezone) values
  ('7a000000-0000-4000-8000-000000000001', 'Credit Kitchen', 'Cafe', 'UTC'),
  ('7b000000-0000-4000-8000-000000000001', 'Other Credit Kitchen', 'Cafe', 'UTC');
insert into public.restaurant_memberships (restaurant_id, user_id, role, status) values
  ('7a000000-0000-4000-8000-000000000001', '7a111111-1111-4111-8111-111111111111', 'manager', 'active'),
  ('7a000000-0000-4000-8000-000000000001', '7a222222-2222-4222-8222-222222222222', 'staff', 'active'),
  ('7b000000-0000-4000-8000-000000000001', '7b111111-1111-4111-8111-111111111111', 'owner', 'active');
insert into public.suppliers (id, restaurant_id, display_name, normalized_name) values
  ('7a000000-0000-4000-8000-000000000101', '7a000000-0000-4000-8000-000000000001', 'Metro Produce', 'metro produce'),
  ('7a000000-0000-4000-8000-000000000102', '7a000000-0000-4000-8000-000000000001', 'Sysco', 'sysco'),
  ('7b000000-0000-4000-8000-000000000101', '7b000000-0000-4000-8000-000000000001', 'Other Produce', 'other produce');

select set_config('request.jwt.claim.sub', '7a111111-1111-4111-8111-111111111111', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select public.ingest_purchase_lines(
  '7a000000-0000-4000-8000-000000000001',
  'invoice',
  'INV-CREDIT-ATTACH-1',
  jsonb_build_array(
    jsonb_build_object(
      'lineIndex', 0,
      'lineType', 'purchase',
      'rawItemDescription', 'CHICKEN THIGHS, BONELESS - 40 LB CASE',
      'quantity', 2,
      'unitOfMeasure', 'case',
      'unitPrice', 86.5,
      'extendedPrice', 173,
      'currency', 'USD',
      'transactionDate', '2026-09-01',
      'parseConfidence', 'confirmed'
    )
  ),
  '7a000000-0000-4000-8000-000000000101',
  null
);

select public.ingest_purchase_lines(
  '7a000000-0000-4000-8000-000000000001',
  'credit_memo',
  'CM-CREDIT-ATTACH-1',
  jsonb_build_array(
    jsonb_build_object(
      'lineIndex', 0,
      'lineType', 'credit',
      'rawItemDescription', 'CHICKEN THIGHS, BONELESS - 40 LB CASE',
      'quantity', 1,
      'unitOfMeasure', 'case',
      'unitPrice', 86.5,
      'extendedPrice', 86.5,
      'currency', 'USD',
      'transactionDate', '2026-09-08',
      'parseConfidence', 'confirmed'
    )
  ),
  '7a000000-0000-4000-8000-000000000101',
  null
);

select public.ingest_purchase_lines(
  '7a000000-0000-4000-8000-000000000001',
  'invoice',
  'INV-CREDIT-ATTACH-SYSCO',
  jsonb_build_array(
    jsonb_build_object(
      'lineIndex', 0,
      'lineType', 'purchase',
      'rawItemDescription', 'CHICKEN THIGHS, BONELESS - 40 LB CASE',
      'quantity', 1,
      'unitOfMeasure', 'case',
      'unitPrice', 90,
      'extendedPrice', 90,
      'currency', 'USD',
      'transactionDate', '2026-09-02',
      'parseConfidence', 'confirmed'
    )
  ),
  '7a000000-0000-4000-8000-000000000102',
  null
);

select is(
  (select credits_line_id is null from public.purchase_lines
    where source_document_reference = 'CM-CREDIT-ATTACH-1' and line_index = 0),
  true,
  'ingested credit remains document-unlinked until a manager attaches'
);

select is(
  (public.attach_purchase_line_credit(
    '7a000000-0000-4000-8000-000000000001',
    (select id from public.purchase_lines
      where source_document_reference = 'CM-CREDIT-ATTACH-1' and line_index = 0),
    (select id from public.purchase_lines
      where source_document_reference = 'INV-CREDIT-ATTACH-1' and line_index = 0)
  )).status,
  'verified',
  'manager can attach an unlinked credit to a same-supplier purchase line'
);

select is(
  (select count(*) from public.purchase_line_credit_attachments
    where restaurant_id = '7a000000-0000-4000-8000-000000000001'
      and status = 'verified'),
  1::bigint,
  'one verified attachment exists after first attach'
);

select is(
  (public.attach_purchase_line_credit(
    '7a000000-0000-4000-8000-000000000001',
    (select id from public.purchase_lines
      where source_document_reference = 'CM-CREDIT-ATTACH-1' and line_index = 0),
    (select id from public.purchase_lines
      where source_document_reference = 'INV-CREDIT-ATTACH-1' and line_index = 0)
  )).id,
  (select id from public.purchase_line_credit_attachments
    where restaurant_id = '7a000000-0000-4000-8000-000000000001'
      and status = 'verified'
    limit 1),
  'identical attach is idempotent'
);

select is(
  (select credits_line_id from public.purchase_lines
    where source_document_reference = 'CM-CREDIT-ATTACH-1' and line_index = 0),
  null,
  'manager attachment never rewrites ledger credits_line_id'
);

select is(
  pg_temp.error_of(format(
    $sql$
      select public.attach_purchase_line_credit(
        '7a000000-0000-4000-8000-000000000001',
        %L::uuid,
        %L::uuid
      )
    $sql$,
    (select id from public.purchase_lines
      where source_document_reference = 'CM-CREDIT-ATTACH-1' and line_index = 0),
    (select id from public.purchase_lines
      where source_document_reference = 'INV-CREDIT-ATTACH-SYSCO' and line_index = 0)
  )),
  'Credited purchase line is not available for this supplier',
  'cross-supplier attachment fails closed'
);

select is(
  (public.revoke_purchase_line_credit_attachment(
    '7a000000-0000-4000-8000-000000000001',
    (select id from public.purchase_line_credit_attachments
      where restaurant_id = '7a000000-0000-4000-8000-000000000001'
        and status = 'verified'
      limit 1)
  )).status,
  'revoked',
  'manager can revoke a verified credit attachment'
);

select set_config('request.jwt.claim.sub', '7a222222-2222-4222-8222-222222222222', true);
select is(
  pg_temp.error_of(format(
    $sql$
      select public.attach_purchase_line_credit(
        '7a000000-0000-4000-8000-000000000001',
        %L::uuid,
        %L::uuid
      )
    $sql$,
    (select id from public.purchase_lines
      where source_document_reference = 'CM-CREDIT-ATTACH-1' and line_index = 0),
    (select id from public.purchase_lines
      where source_document_reference = 'INV-CREDIT-ATTACH-1' and line_index = 0)
  )),
  'Not authorized for this restaurant',
  'staff cannot attach credits'
);

select set_config('request.jwt.claim.sub', '7a111111-1111-4111-8111-111111111111', true);

select public.ingest_purchase_lines(
  '7a000000-0000-4000-8000-000000000001',
  'credit_memo',
  'CM-CREDIT-ATTACH-DOC',
  jsonb_build_array(
    jsonb_build_object(
      'lineIndex', 0,
      'lineType', 'credit',
      'rawItemDescription', 'CHICKEN THIGHS, BONELESS - 40 LB CASE',
      'creditsLineId', (select id from public.purchase_lines
        where source_document_reference = 'INV-CREDIT-ATTACH-1' and line_index = 0),
      'quantity', 1,
      'unitOfMeasure', 'case',
      'unitPrice', 86.5,
      'extendedPrice', 86.5,
      'currency', 'USD',
      'transactionDate', '2026-09-09',
      'parseConfidence', 'confirmed'
    )
  ),
  '7a000000-0000-4000-8000-000000000101',
  null
);

select is(
  pg_temp.error_of(format(
    $sql$
      select public.attach_purchase_line_credit(
        '7a000000-0000-4000-8000-000000000001',
        %L::uuid,
        %L::uuid
      )
    $sql$,
    (select id from public.purchase_lines
      where source_document_reference = 'CM-CREDIT-ATTACH-DOC' and line_index = 0),
    (select id from public.purchase_lines
      where source_document_reference = 'INV-CREDIT-ATTACH-1' and line_index = 0)
  )),
  'Credit already names its offset on the source document',
  'document-stated credits cannot receive a post-hoc attachment'
);

select is(
  pg_temp.error_of(format(
    $sql$
      select public.attach_purchase_line_credit(
        '7a000000-0000-4000-8000-000000000001',
        %L::uuid,
        %L::uuid
      )
    $sql$,
    (select id from public.purchase_lines
      where source_document_reference = 'INV-CREDIT-ATTACH-1' and line_index = 0),
    (select id from public.purchase_lines
      where source_document_reference = 'CM-CREDIT-ATTACH-1' and line_index = 0)
  )),
  'Only a credit line may receive a manager attachment',
  'purchase lines cannot be treated as credits for attachment'
);

select set_config('request.jwt.claim.sub', '7b111111-1111-4111-8111-111111111111', true);
select is(
  pg_temp.error_of(format(
    $sql$
      select public.attach_purchase_line_credit(
        '7a000000-0000-4000-8000-000000000001',
        %L::uuid,
        %L::uuid
      )
    $sql$,
    (select id from public.purchase_lines
      where source_document_reference = 'CM-CREDIT-ATTACH-1' and line_index = 0),
    (select id from public.purchase_lines
      where source_document_reference = 'INV-CREDIT-ATTACH-1' and line_index = 0)
  )),
  'Not authorized for this restaurant',
  'cross-tenant actors cannot attach credits'
);

select set_config('request.jwt.claim.sub', '7a111111-1111-4111-8111-111111111111', true);
select is(
  (select count(*)::int from public.purchase_line_credit_attachments
    where restaurant_id = '7a000000-0000-4000-8000-000000000001'),
  (select count(*)::int from public.purchase_line_credit_attachments
    where restaurant_id = '7a000000-0000-4000-8000-000000000001'
      and credit_line_id in (
        select id from public.purchase_lines
        where restaurant_id = '7a000000-0000-4000-8000-000000000001'
      )),
  'attachments stay inside the same restaurant as their credit lines'
);

select is(
  (select has_table_privilege('authenticated', 'public.purchase_line_credit_attachments', 'INSERT')),
  false,
  'authenticated clients have no insert privilege on credit attachments'
);

select is(
  (select has_table_privilege('authenticated', 'public.purchase_line_credit_attachments', 'UPDATE')),
  false,
  'authenticated clients have no update privilege on credit attachments'
);

select * from finish();
rollback;
