import InlineProgressSummary from "./InlineProgressSummary";
import { daysUntil, shortDate } from "../../utils/dateHelpers";

export default function RegistrationOrganizationCard({
  organization,
  families,
  participants,
  registrations,
  responses,
  activeFamily,
  onOpen,
  onOpenResults,
}) {
  const participantFamilyIds = new Set(
    participants
      .filter((item) => item.organization_id === organization.id)
      .map((item) => item.family_id)
  );

  const availableFamilies = families.filter((family) =>
    participantFamilyIds.has(family.id)
  );

  const orgRegistrations = registrations.filter(
    (item) => item.organization_id === organization.id
  );

  const orgResponses = responses.filter(
    (item) => item.organization_id === organization.id
  );

  const responseByFamily = new Map(
    orgResponses.map((item) => [item.family_id, item.response])
  );

  const notAttendingFamiliesCount = availableFamilies.filter(
    (family) => responseByFamily.get(family.id) === "no"
  ).length;

  const answeredFamiliesCount = responseByFamily.size;

  const activeFamilyRegistration = activeFamily
    ? orgRegistrations.find((registration) => registration.family_id === activeFamily.id)
    : null;

  const activeFamilyResponse = activeFamily
    ? responseByFamily.get(activeFamily.id)
    : null;

  const activeFamilyHasAnswered = Boolean(activeFamilyResponse);

  const activeFamilyStatusLabel =
    activeFamilyResponse === "no"
      ? "Has indicat que no pots venir"
      : activeFamilyRegistration
        ? "✅ Ja t'has inscrit"
        : "Encara no has respost";

  return (
    <div className="attendance-card registration-public-card">
      <div className="attendance-header">
        <p className="tag">Inscripció</p>
        <h3>{organization.title}</h3>
        {organization.event_date && (
          <small className="org-date">
            {shortDate(organization.event_date)} · {daysUntil(organization.event_date)}
          </small>
        )}
      </div>

      <div className="attendance-summary registration-card-summary">
        <InlineProgressSummary
          answeredCount={answeredFamiliesCount}
          totalCount={availableFamilies.length}
          label="famílies han respost"
          detailText={`${orgRegistrations.length} vindran · ${notAttendingFamiliesCount} no vindran`}
        />

        {activeFamily && (
          <div
            className={`span-all linked-family-box ${
              activeFamilyHasAnswered ? "" : "linked-family-box-pending"
            }`}
          >
            <span>{activeFamilyStatusLabel}</span>
          </div>
        )}

        <div className="pending-action-buttons registration-card-actions">
          <button onClick={() => onOpen(organization)}>
            {activeFamilyRegistration ? "Modificar resposta" : "Respondre"}
          </button>

          <button
            className="secondary-pending-button"
            onClick={() => onOpenResults(organization)}
          >
            Veure respostes
          </button>
        </div>
      </div>
    </div>
  );
}
