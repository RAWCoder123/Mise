-- Credit-memo purchase_lines must be credits.
--
-- Hosted ingest_purchase_lines allowlists source = 'credit_memo' and
-- append_purchase_line independently requires a stated purchase/credit
-- direction. Neither couples the two. On current main, every insert path
-- (including direct service_role inserts that satisfy the existing source and
-- line_type CHECKs) can stamp source = 'credit_memo' with line_type =
-- 'purchase'.
--
-- That forges a purchase into a credit-memo document's idempotency space and
-- makes signed_quantity / signed_extended_price positive while claiming the
-- durable document evidence came from a credit memo. Netting, unmatched-
-- credit findings, and spend summaries then treat that forged purchase as
-- ordinary invoice-like spend from a credit-memo document.
--
-- Invoice, order_confirmation, and manual_entry documents may still carry
-- credit lines — those are real document shapes. This tip only requires the
-- one-way coupling: credit_memo => credit.
--
-- This migration fails closed at the database boundary for every insert path.
-- Soft source / line_type allowlists stay in place. Does not rewrite
-- ingest_purchase_lines, append_purchase_line, or supersede_purchase_line.
-- History is never rewritten.
--
-- NOT VALID CHECKs skip validating any pre-existing rows so history is never
-- rewritten; new inserts are still enforced by the BEFORE INSERT trigger.
--
-- Preserves authentication, owner/admin/manager role gates, tenant isolation,
-- RLS, grants/revokes, and append-only behavior. Nothing is relaxed.

create or replace function private.enforce_purchase_line_credit_memo_line_type_evidence()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.source = 'credit_memo' and new.line_type is distinct from 'credit' then
    raise exception
      'Credit memo documents may only contain credit lines'
      using errcode = '22023';
  end if;

  return new;
end;
$$;

drop trigger if exists purchase_lines_credit_memo_line_type_evidence
  on public.purchase_lines;
create trigger purchase_lines_credit_memo_line_type_evidence
before insert on public.purchase_lines
for each row execute function private.enforce_purchase_line_credit_memo_line_type_evidence();

revoke all on function private.enforce_purchase_line_credit_memo_line_type_evidence()
  from public, anon, authenticated, service_role;

comment on function private.enforce_purchase_line_credit_memo_line_type_evidence() is
  'Fail closed: purchase_lines.source = credit_memo requires line_type = credit.';

alter table public.purchase_lines
  drop constraint if exists purchase_lines_credit_memo_line_type_check;
alter table public.purchase_lines
  add constraint purchase_lines_credit_memo_line_type_check check (
    source is distinct from 'credit_memo' or line_type = 'credit'
  ) not valid;
