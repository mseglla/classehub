begin;

-- School notices are visible to every authenticated class manager, but only
-- users with an admin permission can create, change or delete them.
create or replace function public.ch_user_has_any_class_permission()
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
  );
$function$;

create or replace function public.ch_user_is_school_admin()
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
      and permission.role = 'admin'
  );
$function$;

create or replace function public.ch_user_can_read_event(p_event_id bigint)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.ch_events event
    where event.id = p_event_id
      and (
        (
          event.class_id is not null
          and public.ch_user_can_manage_class(event.class_id)
        )
        or (
          event.class_id is null
          and event.event_type = 'escola'
          and public.ch_user_has_any_class_permission()
        )
      )
  );
$function$;

create or replace function public.ch_user_can_manage_event(p_event_id bigint)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.ch_events event
    where event.id = p_event_id
      and (
        (
          event.class_id is not null
          and public.ch_user_can_manage_class(event.class_id)
        )
        or (
          event.class_id is null
          and event.event_type = 'escola'
          and public.ch_user_is_school_admin()
        )
      )
  );
$function$;

revoke all on function public.ch_user_has_any_class_permission() from public;
revoke all on function public.ch_user_is_school_admin() from public;
revoke all on function public.ch_user_can_read_event(bigint) from public;
revoke all on function public.ch_user_can_manage_event(bigint) from public;
grant execute on function public.ch_user_has_any_class_permission() to authenticated;
grant execute on function public.ch_user_is_school_admin() to authenticated;
grant execute on function public.ch_user_can_read_event(bigint) to authenticated;
grant execute on function public.ch_user_can_manage_event(bigint) to authenticated;

-- Events: delegates manage their class events. School events remain readable
-- to delegates but can only be managed by an admin.
drop policy if exists "Authenticated delete ch_events"
  on public.ch_events;
drop policy if exists "Authenticated delete permitted ch_events"
  on public.ch_events;
drop policy if exists "Authenticated insert ch_events"
  on public.ch_events;
drop policy if exists "Authenticated insert permitted ch_events"
  on public.ch_events;
drop policy if exists "Authenticated read ch_events"
  on public.ch_events;
drop policy if exists "Authenticated read permitted ch_events"
  on public.ch_events;
drop policy if exists "Authenticated update ch_events"
  on public.ch_events;
drop policy if exists "Authenticated update permitted ch_events"
  on public.ch_events;

create policy "Authenticated delete permitted ch_events"
  on public.ch_events
  for delete
  to authenticated
  using (
    (
      class_id is not null
      and public.ch_user_can_manage_class(class_id)
    )
    or (
      class_id is null
      and event_type = 'escola'
      and public.ch_user_is_school_admin()
    )
  );

create policy "Authenticated insert permitted ch_events"
  on public.ch_events
  for insert
  to authenticated
  with check (
    (
      event_type = 'classe'
      and class_id is not null
      and public.ch_user_can_manage_class(class_id)
    )
    or (
      event_type = 'escola'
      and class_id is null
      and public.ch_user_is_school_admin()
    )
  );

create policy "Authenticated read permitted ch_events"
  on public.ch_events
  for select
  to authenticated
  using (
    (
      class_id is not null
      and public.ch_user_can_manage_class(class_id)
    )
    or (
      class_id is null
      and event_type = 'escola'
      and public.ch_user_has_any_class_permission()
    )
  );

create policy "Authenticated update permitted ch_events"
  on public.ch_events
  for update
  to authenticated
  using (
    (
      class_id is not null
      and public.ch_user_can_manage_class(class_id)
    )
    or (
      class_id is null
      and event_type = 'escola'
      and public.ch_user_is_school_admin()
    )
  )
  with check (
    (
      event_type = 'classe'
      and class_id is not null
      and public.ch_user_can_manage_class(class_id)
    )
    or (
      event_type = 'escola'
      and class_id is null
      and public.ch_user_is_school_admin()
    )
  );

-- Checklist items inherit read and management permissions from their event.
drop policy if exists "Authenticated users can manage checklist items"
  on public.ch_checklist_items;
drop policy if exists "Authenticated delete permitted ch_checklist_items"
  on public.ch_checklist_items;
drop policy if exists "Authenticated insert permitted ch_checklist_items"
  on public.ch_checklist_items;
drop policy if exists "Authenticated read ch_checklist_items"
  on public.ch_checklist_items;
drop policy if exists "Authenticated read permitted ch_checklist_items"
  on public.ch_checklist_items;
drop policy if exists "Authenticated update permitted ch_checklist_items"
  on public.ch_checklist_items;

create policy "Authenticated delete permitted ch_checklist_items"
  on public.ch_checklist_items
  for delete
  to authenticated
  using (public.ch_user_can_manage_event(event_id));

create policy "Authenticated insert permitted ch_checklist_items"
  on public.ch_checklist_items
  for insert
  to authenticated
  with check (public.ch_user_can_manage_event(event_id));

create policy "Authenticated read permitted ch_checklist_items"
  on public.ch_checklist_items
  for select
  to authenticated
  using (public.ch_user_can_read_event(event_id));

create policy "Authenticated update permitted ch_checklist_items"
  on public.ch_checklist_items
  for update
  to authenticated
  using (public.ch_user_can_manage_event(event_id))
  with check (public.ch_user_can_manage_event(event_id));

create index if not exists ch_checklist_items_event_id_idx
  on public.ch_checklist_items (event_id);

commit;
