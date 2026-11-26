-- Purchase-line corrections must preserve the superseded line's identity.
--
-- Hosted supersede_purchase_line inherits supplier, document reference, line
-- index, line type, and revision = target.revision + 1 from the target. Soft
-- CHECKs on current main only require a same-restaurant FK, non-self link, and
-- revision > 0 when supersedes_line_id is present.
--
-- Direct service_role inserts that satisfy those soft CHECKs can therefore
-- stamp supersedes_line_id onto a line from a different supplier, document,
-- line index, or line type inside the same restaurant, or with a non-
-- contiguous revision. Netting then treats the forged successor as having
-- corrected the target and excludes the real purchase history from current
-- nets.
--
-- This migration fails closed at the database boundary for every insert path.
-- Soft revision/self-link CHECKs and the restaurant FK stay in place. Does not
-- rewrite ingest_purchase_lines, append_purchase_line, or
-- supersede_purchase_line. History is never rewritten.
--
-- supplier_scope is a generated stored column computed after BEFORE triggers,
-- so the guard reconstructs coalesce(supplier_id, nil UUID) explicitly.
-- Cross-row identity cannot be expressed as a table CHECK, so enforcement is
-- the BEFORE INSERT trigger only (same shape as the credits_line_id target tip).
--
-- Preserves authentication, owner/admin/manager role gates, tenant isolation,
-- RLS, grants/revokes, and append-only behavior. Nothing is relaxed.

create or replace function private.enforce_purchase_line_supersede_target_evidence()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target public.purchase_lines%rowtype;
  new_scope uuid;
begin
  if new.supersedes_line_id is null then
    return new;
  end if;

  new_scope := coalesce(
    new.supplier_id,
    '00000000-0000-0000-0000-000000000000'::uuid
  );

  select * into target
  from public.purchase_lines original
  where original.restaurant_id = new.restaurant_id
    and original.id = new.supersedes_line_id;

  if not found then
    raise exception
      'Purchase line correction target was not found'
      using errcode = 'P0002';
  end if;

  if target.supplier_scope is distinct from new_scope then
    raise exception
      'Purchase line correction must preserve supplier identity'
      using errcode = '22023';
  end if;

  if target.source_document_reference is distinct from new.source_document_reference then
    raise exception
      'Purchase line correction must preserve document identity'
      using errcode = '22023';
  end if;

  if target.line_index is distinct from new.line_index then
    raise exception
      'Purchase line correction must preserve line index'
      using errcode = '22023';
  end if;

  if target.line_type is distinct from new.line_type then
    raise exception
      'Purchase line correction must preserve line type'
      using errcode = '22023';
  end if;

  if new.revision is distinct from (target.revision + 1) then
    raise exception
      'Purchase line correction revision must follow the superseded line'
      using errcode = '22023';
  end if;

  return new;
end;
$$;

drop trigger if exists purchase_lines_supersede_target_evidence
  on public.purchase_lines;
create trigger purchase_lines_supersede_target_evidence
before insert on public.purchase_lines
for each row execute function private.enforce_purchase_line_supersede_target_evidence();

revoke all on function private.enforce_purchase_line_supersede_target_evidence()
  from public, anon, authenticated, service_role;

comment on function private.enforce_purchase_line_supersede_target_evidence() is
  'Fail closed: supersedes_line_id must name the same supplier/document/line index/line type with contiguous revision.';
