begin;

-- Return the complete public-app dataset only after validating that the PIN
-- belongs to an active family in the requested active class. Underlying table
-- policies can be closed after the frontend has migrated to this RPC.
create or replace function public.get_public_class_data_with_pin(
  p_class_id bigint,
  p_access_pin text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_family_id bigint;
begin
  select family.id
  into v_family_id
  from public.ch_families family
  join public.ch_classes class_row
    on class_row.id = family.class_id
  where class_row.id = p_class_id
    and class_row.is_active is true
    and family.is_active is not false
    and trim(family.access_pin) = trim(p_access_pin)
  limit 1;

  if v_family_id is null then
    raise exception 'Invalid family PIN';
  end if;

  return jsonb_build_object(
    'active_family', (
      select jsonb_build_object(
        'id', family.id,
        'class_id', family.class_id,
        'student_name', family.student_name,
        'child_birth_date', family.child_birth_date,
        'grade_label', family.grade_label,
        'is_active', family.is_active
      )
      from public.ch_families family
      where family.id = v_family_id
    ),
    'families', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', family.id,
          'class_id', family.class_id,
          'student_name', family.student_name,
          'child_birth_date', family.child_birth_date,
          'grade_label', family.grade_label,
          'is_active', family.is_active
        )
        order by family.student_name
      )
      from public.ch_families family
      where family.class_id = p_class_id
        and family.is_active is not false
    ), '[]'::jsonb),
    'events', coalesce((
      select jsonb_agg(to_jsonb(event) order by event.start_date, event.id)
      from public.ch_events event
      where event.class_id = p_class_id
         or (
           event.class_id is null
           and event.event_type = 'escola'
         )
    ), '[]'::jsonb),
    'checklist_items', coalesce((
      select jsonb_agg(
        to_jsonb(item)
        order by item.event_id, item.sort_order, item.id
      )
      from public.ch_checklist_items item
      join public.ch_events event
        on event.id = item.event_id
      where event.class_id = p_class_id
         or (
           event.class_id is null
           and event.event_type = 'escola'
         )
    ), '[]'::jsonb),
    'checklist_status', coalesce((
      select jsonb_agg(to_jsonb(status) order by status.checklist_item_id)
      from public.ch_checklist_item_status status
      where status.family_id = v_family_id
        and status.is_done is true
    ), '[]'::jsonb),
    'polls', coalesce((
      select jsonb_agg(
        to_jsonb(poll) || jsonb_build_object(
          'ch_poll_options', coalesce((
            select jsonb_agg(to_jsonb(option) order by option.sort_order, option.id)
            from public.ch_poll_options option
            where option.poll_id = poll.id
          ), '[]'::jsonb)
        )
        order by poll.close_date, poll.id
      )
      from public.ch_polls poll
      where poll.class_id = p_class_id
        and poll.is_active is true
    ), '[]'::jsonb),
    'poll_votes', coalesce((
      select jsonb_agg(to_jsonb(vote) order by vote.poll_id, vote.id)
      from public.ch_poll_votes vote
      join public.ch_polls poll
        on poll.id = vote.poll_id
      where poll.class_id = p_class_id
    ), '[]'::jsonb),
    'organizations', coalesce((
      select jsonb_agg(
        to_jsonb(organization)
        order by organization.event_date, organization.id
      )
      from public.ch_organizations organization
      where organization.class_id = p_class_id
        and organization.is_active is true
    ), '[]'::jsonb),
    'organization_participants', coalesce((
      select jsonb_agg(
        to_jsonb(participant)
        order by participant.organization_id, participant.id
      )
      from public.ch_organization_participants participant
      join public.ch_organizations organization
        on organization.id = participant.organization_id
      where organization.class_id = p_class_id
        and organization.is_active is true
    ), '[]'::jsonb),
    'organization_responses', coalesce((
      select jsonb_agg(
        to_jsonb(response)
        order by response.organization_id, response.id
      )
      from public.ch_organization_responses response
      join public.ch_organizations organization
        on organization.id = response.organization_id
      where organization.class_id = p_class_id
        and organization.is_active is true
    ), '[]'::jsonb),
    'organization_registrations', coalesce((
      select jsonb_agg(
        to_jsonb(registration)
        order by registration.organization_id, registration.id
      )
      from public.ch_organization_registrations registration
      join public.ch_organizations organization
        on organization.id = registration.organization_id
      where organization.class_id = p_class_id
        and organization.is_active is true
    ), '[]'::jsonb)
  );
end;
$function$;

revoke all on function public.get_public_class_data_with_pin(bigint, text)
  from public;
grant execute on function public.get_public_class_data_with_pin(bigint, text)
  to anon;
grant execute on function public.get_public_class_data_with_pin(bigint, text)
  to authenticated;

commit;
