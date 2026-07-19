begin;

-- Centralize class and family authorization so RLS does not depend on
-- frontend filters. These functions only return a boolean and never expose
-- permission or family data.
create or replace function public.ch_user_can_manage_class(p_class_id bigint)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.ch_admin_class_permissions permission
    where permission.user_id = (select auth.uid())
      and permission.class_id = p_class_id
  );
$function$;

create or replace function public.ch_user_can_manage_family(p_family_id bigint)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.ch_families family
    join public.ch_admin_class_permissions permission
      on permission.class_id = family.class_id
    where family.id = p_family_id
      and permission.user_id = (select auth.uid())
  );
$function$;

revoke all on function public.ch_user_can_manage_class(bigint) from public;
revoke all on function public.ch_user_can_manage_family(bigint) from public;
grant execute on function public.ch_user_can_manage_class(bigint) to authenticated;
grant execute on function public.ch_user_can_manage_family(bigint) to authenticated;

create index if not exists ch_admin_class_permissions_user_class_idx
  on public.ch_admin_class_permissions (user_id, class_id);

-- Classes: authenticated users can only load classes explicitly assigned to
-- them. Anonymous public access remains unchanged for now.
drop policy if exists "Authenticated read ch_classes"
  on public.ch_classes;
drop policy if exists "Authenticated read permitted ch_classes"
  on public.ch_classes;

create policy "Authenticated read permitted ch_classes"
  on public.ch_classes
  for select
  to authenticated
  using (public.ch_user_can_manage_class(id));

-- Families: enforce class permissions for every administrative operation.
drop policy if exists "Authenticated delete ch_families"
  on public.ch_families;
drop policy if exists "Authenticated delete permitted ch_families"
  on public.ch_families;
drop policy if exists "Authenticated insert ch_families"
  on public.ch_families;
drop policy if exists "Authenticated insert permitted ch_families"
  on public.ch_families;
drop policy if exists "Authenticated read ch_families"
  on public.ch_families;
drop policy if exists "Authenticated read permitted ch_families"
  on public.ch_families;
drop policy if exists "Authenticated update ch_families"
  on public.ch_families;
drop policy if exists "Authenticated update permitted ch_families"
  on public.ch_families;

create policy "Authenticated delete permitted ch_families"
  on public.ch_families
  for delete
  to authenticated
  using (public.ch_user_can_manage_class(class_id));

create policy "Authenticated insert permitted ch_families"
  on public.ch_families
  for insert
  to authenticated
  with check (public.ch_user_can_manage_class(class_id));

create policy "Authenticated read permitted ch_families"
  on public.ch_families
  for select
  to authenticated
  using (public.ch_user_can_manage_class(class_id));

create policy "Authenticated update permitted ch_families"
  on public.ch_families
  for update
  to authenticated
  using (public.ch_user_can_manage_class(class_id))
  with check (public.ch_user_can_manage_class(class_id));

-- Contacts inherit authorization from their family and class.
drop policy if exists "Authenticated users can delete family contacts"
  on public.ch_family_contacts;
drop policy if exists "Authenticated users can delete permitted family contacts"
  on public.ch_family_contacts;
drop policy if exists "Authenticated users can insert family contacts"
  on public.ch_family_contacts;
drop policy if exists "Authenticated users can insert permitted family contacts"
  on public.ch_family_contacts;
drop policy if exists "Authenticated users can read family contacts"
  on public.ch_family_contacts;
drop policy if exists "Authenticated users can read permitted family contacts"
  on public.ch_family_contacts;
drop policy if exists "Authenticated users can update family contacts"
  on public.ch_family_contacts;
drop policy if exists "Authenticated users can update permitted family contacts"
  on public.ch_family_contacts;

create policy "Authenticated users can delete permitted family contacts"
  on public.ch_family_contacts
  for delete
  to authenticated
  using (public.ch_user_can_manage_family(family_id));

create policy "Authenticated users can insert permitted family contacts"
  on public.ch_family_contacts
  for insert
  to authenticated
  with check (public.ch_user_can_manage_family(family_id));

create policy "Authenticated users can read permitted family contacts"
  on public.ch_family_contacts
  for select
  to authenticated
  using (public.ch_user_can_manage_family(family_id));

create policy "Authenticated users can update permitted family contacts"
  on public.ch_family_contacts
  for update
  to authenticated
  using (public.ch_user_can_manage_family(family_id))
  with check (public.ch_user_can_manage_family(family_id));

commit;
