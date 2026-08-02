-- Index dismissed recommendations that retain a dismiss_reason so
-- dismissal-reason clustering can scan recent manager feedback efficiently.
-- Samples already flow through recommendationHistory in the operational planning
-- snapshot (select * includes dismiss_reason).

create index if not exists purchase_recommendations_restaurant_dismissal_learning_created_at_idx
  on public.purchase_recommendations (restaurant_id, created_at desc)
  where status = 'dismissed'
    and dismiss_reason is not null;

comment on index public.purchase_recommendations_restaurant_dismissal_learning_created_at_idx is
  'Speeds bounded dismissal-reason clustering reads of dismissed recommendations that retain dismiss_reason.';
