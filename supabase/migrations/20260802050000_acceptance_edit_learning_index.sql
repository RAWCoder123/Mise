-- Index accepted recommendations that retain Mise's original suggestion so
-- acceptance-edit learning can scan original_recommended_quantity vs accepted
-- recommended_quantity efficiently. Samples already flow through
-- recommendationHistory in the operational planning snapshot.

create index if not exists purchase_recommendations_restaurant_acceptance_edit_created_at_idx
  on public.purchase_recommendations (restaurant_id, created_at desc)
  where status in ('approved', 'ordered')
    and original_recommended_quantity is not null;

comment on index public.purchase_recommendations_restaurant_acceptance_edit_created_at_idx is
  'Speeds bounded acceptance-edit learning reads of approved/ordered recommendations that preserve original_recommended_quantity.';
