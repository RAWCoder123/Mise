begin;

select plan(9);

select is(
  has_function_privilege(
    'anon',
    'public.get_supplier_email_delivery_review(uuid,uuid)',
    'EXECUTE'
  ),
  false,
  'anonymous callers cannot read supplier email delivery review state'
);

select is(
  has_function_privilege(
    'authenticated',
    'public.get_supplier_email_delivery_review(uuid,uuid)',
    'EXECUTE'
  ),
  true,
  'authenticated callers can reach the role-checked delivery review read path'
);

select is(
  has_function_privilege(
    'service_role',
    'public.get_supplier_email_delivery_review(uuid,uuid)',
    'EXECUTE'
  ),
  false,
  'service role cannot forge delivery review reads through the authenticated boundary'
);

select is(
  has_function_privilege(
    'anon',
    'public.resolve_supplier_email_delivery(uuid,uuid,text,text,text)',
    'EXECUTE'
  ),
  false,
  'anonymous callers cannot resolve ambiguous supplier email deliveries'
);

select is(
  has_function_privilege(
    'authenticated',
    'public.resolve_supplier_email_delivery(uuid,uuid,text,text,text)',
    'EXECUTE'
  ),
  true,
  'authenticated callers can reach the manager-gated delivery resolution boundary'
);

select is(
  has_function_privilege(
    'service_role',
    'public.resolve_supplier_email_delivery(uuid,uuid,text,text,text)',
    'EXECUTE'
  ),
  false,
  'service role cannot forge manager delivery resolutions'
);

select ok(
  pg_get_functiondef(
    'public.resolve_supplier_email_delivery(uuid,uuid,text,text,text)'::regprocedure
  ) ~ 'confirmed_sent_after_review'
  and pg_get_functiondef(
    'public.resolve_supplier_email_delivery(uuid,uuid,text,text,text)'::regprocedure
  ) ~ 'authorized_retry_after_review',
  'delivery resolution requires explicit confirmation tokens'
);

select ok(
  pg_get_functiondef(
    'public.resolve_supplier_email_delivery(uuid,uuid,text,text,text)'::regprocedure
  ) ~ 'array\[''owner'', ''admin'', ''manager''\]',
  'delivery resolution remains manager-gated'
);

select ok(
  pg_get_functiondef(
    'private.clear_supplier_email_delivery_resolution_on_reclaim()'::regprocedure
  ) ~ 'resolution := null',
  'reclaiming a failed delivery clears prior review resolution markers'
);

select * from finish();
rollback;
