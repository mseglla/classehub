begin;

create or replace function public.ch_user_can_manage_organization(
  p_organization_id bigint
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.ch_organizations organization
    where organization.id = p_organization_id
      and public.ch_user_can_manage_class(organization.class_id)
  );
$function$;

create or replace function public.ch_user_can_manage_poll(p_poll_id bigint)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.ch_polls poll
    where poll.id = p_poll_id
      and public.ch_user_can_manage_class(poll.class_id)
  );
$function$;

revoke all on function public.ch_user_can_manage_organization(bigint)
  from public;
revoke all on function public.ch_user_can_manage_poll(bigint)
  from public;
grant execute on function public.ch_user_can_manage_organization(bigint)
  to authenticated;
grant execute on function public.ch_user_can_manage_poll(bigint)
  to authenticated;

-- Organizations belong directly to one class.
drop policy if exists "Authenticated delete ch_organizations"
  on public.ch_organizations;
drop policy if exists "Authenticated delete permitted ch_organizations"
  on public.ch_organizations;
drop policy if exists "Authenticated insert ch_organizations"
  on public.ch_organizations;
drop policy if exists "Authenticated insert permitted ch_organizations"
  on public.ch_organizations;
drop policy if exists "Authenticated read ch_organizations"
  on public.ch_organizations;
drop policy if exists "Authenticated read permitted ch_organizations"
  on public.ch_organizations;
drop policy if exists "Authenticated update ch_organizations"
  on public.ch_organizations;
drop policy if exists "Authenticated update permitted ch_organizations"
  on public.ch_organizations;

create policy "Authenticated delete permitted ch_organizations"
  on public.ch_organizations
  for delete
  to authenticated
  using (public.ch_user_can_manage_class(class_id));

create policy "Authenticated insert permitted ch_organizations"
  on public.ch_organizations
  for insert
  to authenticated
  with check (public.ch_user_can_manage_class(class_id));

create policy "Authenticated read permitted ch_organizations"
  on public.ch_organizations
  for select
  to authenticated
  using (public.ch_user_can_manage_class(class_id));

create policy "Authenticated update permitted ch_organizations"
  on public.ch_organizations
  for update
  to authenticated
  using (public.ch_user_can_manage_class(class_id))
  with check (public.ch_user_can_manage_class(class_id));

-- Participant rows inherit permissions from their organization.
drop policy if exists "Authenticated delete ch_organization_participants"
  on public.ch_organization_participants;
drop policy if exists "Authenticated delete permitted ch_organization_participants"
  on public.ch_organization_participants;
drop policy if exists "Authenticated insert ch_organization_participants"
  on public.ch_organization_participants;
drop policy if exists "Authenticated insert permitted ch_organization_participants"
  on public.ch_organization_participants;
drop policy if exists "Authenticated read ch_organization_participants"
  on public.ch_organization_participants;
drop policy if exists "Authenticated read permitted ch_organization_participants"
  on public.ch_organization_participants;

create policy "Authenticated delete permitted ch_organization_participants"
  on public.ch_organization_participants
  for delete
  to authenticated
  using (public.ch_user_can_manage_organization(organization_id));

create policy "Authenticated insert permitted ch_organization_participants"
  on public.ch_organization_participants
  for insert
  to authenticated
  with check (public.ch_user_can_manage_organization(organization_id));

create policy "Authenticated read permitted ch_organization_participants"
  on public.ch_organization_participants
  for select
  to authenticated
  using (public.ch_user_can_manage_organization(organization_id));

-- Response, registration, contribution and target rows are read by the admin
-- UI and inherit the class of their organization. Public policies are left
-- unchanged in this migration.
drop policy if exists "Authenticated read ch_organization_responses"
  on public.ch_organization_responses;
drop policy if exists "Authenticated read permitted ch_organization_responses"
  on public.ch_organization_responses;
create policy "Authenticated read permitted ch_organization_responses"
  on public.ch_organization_responses
  for select
  to authenticated
  using (public.ch_user_can_manage_organization(organization_id));

drop policy if exists "Authenticated read ch_organization_registrations"
  on public.ch_organization_registrations;
drop policy if exists "Authenticated read permitted ch_organization_registrations"
  on public.ch_organization_registrations;
create policy "Authenticated read permitted ch_organization_registrations"
  on public.ch_organization_registrations
  for select
  to authenticated
  using (public.ch_user_can_manage_organization(organization_id));

drop policy if exists "Authenticated read ch_organization_contributions"
  on public.ch_organization_contributions;
drop policy if exists "Authenticated read permitted ch_organization_contributions"
  on public.ch_organization_contributions;
create policy "Authenticated read permitted ch_organization_contributions"
  on public.ch_organization_contributions
  for select
  to authenticated
  using (public.ch_user_can_manage_organization(organization_id));

drop policy if exists "Authenticated read ch_organization_targets"
  on public.ch_organization_targets;
drop policy if exists "Authenticated read permitted ch_organization_targets"
  on public.ch_organization_targets;
create policy "Authenticated read permitted ch_organization_targets"
  on public.ch_organization_targets
  for select
  to authenticated
  using (public.ch_user_can_manage_organization(organization_id));

-- Polls belong directly to a class.
drop policy if exists "Authenticated users can manage polls"
  on public.ch_polls;
drop policy if exists "Authenticated delete permitted ch_polls"
  on public.ch_polls;
drop policy if exists "Authenticated insert permitted ch_polls"
  on public.ch_polls;
drop policy if exists "Authenticated read ch_polls"
  on public.ch_polls;
drop policy if exists "Authenticated read permitted ch_polls"
  on public.ch_polls;
drop policy if exists "Authenticated update permitted ch_polls"
  on public.ch_polls;

create policy "Authenticated delete permitted ch_polls"
  on public.ch_polls
  for delete
  to authenticated
  using (public.ch_user_can_manage_class(class_id));

create policy "Authenticated insert permitted ch_polls"
  on public.ch_polls
  for insert
  to authenticated
  with check (public.ch_user_can_manage_class(class_id));

create policy "Authenticated read permitted ch_polls"
  on public.ch_polls
  for select
  to authenticated
  using (public.ch_user_can_manage_class(class_id));

create policy "Authenticated update permitted ch_polls"
  on public.ch_polls
  for update
  to authenticated
  using (public.ch_user_can_manage_class(class_id))
  with check (public.ch_user_can_manage_class(class_id));

-- Poll options inherit permissions from their poll.
drop policy if exists "Authenticated users can manage poll options"
  on public.ch_poll_options;
drop policy if exists "Authenticated delete permitted ch_poll_options"
  on public.ch_poll_options;
drop policy if exists "Authenticated insert permitted ch_poll_options"
  on public.ch_poll_options;
drop policy if exists "Authenticated read ch_poll_options"
  on public.ch_poll_options;
drop policy if exists "Authenticated read permitted ch_poll_options"
  on public.ch_poll_options;
drop policy if exists "Authenticated update permitted ch_poll_options"
  on public.ch_poll_options;

create policy "Authenticated delete permitted ch_poll_options"
  on public.ch_poll_options
  for delete
  to authenticated
  using (public.ch_user_can_manage_poll(poll_id));

create policy "Authenticated insert permitted ch_poll_options"
  on public.ch_poll_options
  for insert
  to authenticated
  with check (public.ch_user_can_manage_poll(poll_id));

create policy "Authenticated read permitted ch_poll_options"
  on public.ch_poll_options
  for select
  to authenticated
  using (public.ch_user_can_manage_poll(poll_id));

create policy "Authenticated update permitted ch_poll_options"
  on public.ch_poll_options
  for update
  to authenticated
  using (public.ch_user_can_manage_poll(poll_id))
  with check (public.ch_user_can_manage_poll(poll_id));

-- Families vote through the PIN-protected RPC. Authenticated admins only need
-- to read votes and delete them when deleting a poll.
drop policy if exists "Authenticated users can manage poll votes"
  on public.ch_poll_votes;
drop policy if exists "Authenticated delete permitted ch_poll_votes"
  on public.ch_poll_votes;
drop policy if exists "Authenticated read ch_poll_votes"
  on public.ch_poll_votes;
drop policy if exists "Authenticated read permitted ch_poll_votes"
  on public.ch_poll_votes;

create policy "Authenticated delete permitted ch_poll_votes"
  on public.ch_poll_votes
  for delete
  to authenticated
  using (public.ch_user_can_manage_poll(poll_id));

create policy "Authenticated read permitted ch_poll_votes"
  on public.ch_poll_votes
  for select
  to authenticated
  using (public.ch_user_can_manage_poll(poll_id));

create index if not exists ch_organization_participants_organization_id_idx
  on public.ch_organization_participants (organization_id);
create index if not exists ch_organization_responses_organization_id_idx
  on public.ch_organization_responses (organization_id);
create index if not exists ch_organization_registrations_organization_id_idx
  on public.ch_organization_registrations (organization_id);
create index if not exists ch_organization_contributions_organization_id_idx
  on public.ch_organization_contributions (organization_id);
create index if not exists ch_organization_targets_organization_id_idx
  on public.ch_organization_targets (organization_id);
create index if not exists ch_poll_options_poll_id_idx
  on public.ch_poll_options (poll_id);
create index if not exists ch_poll_votes_poll_id_idx
  on public.ch_poll_votes (poll_id);

commit;
