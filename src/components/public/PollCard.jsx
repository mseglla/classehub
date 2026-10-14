import InlineProgressSummary from "./InlineProgressSummary";

export default function PollCard({
  poll,
  families,
  votes,
  activeFamily,
  onOpenVote,
  onOpenResults,
}) {
  const pollVotes = votes.filter((vote) => vote.poll_id === poll.id);
  const votedFamilies = new Set(pollVotes.map((vote) => vote.family_id));

  const activeFamilyVote = activeFamily
    ? pollVotes.find((vote) => vote.family_id === activeFamily.id)
    : null;

  return (
    <div className="poll-card">
      <div>
        <p className="tag">Votació</p>
        <h3>{poll.question}</h3>

        <InlineProgressSummary
          answeredCount={votedFamilies.size}
          totalCount={families.length}
          label="famílies han votat"
        />
      </div>

      {activeFamily && (
        <div
          className={`span-all linked-family-box ${
            activeFamilyVote ? "" : "linked-family-box-pending"
          }`}
        >
          <span>{activeFamilyVote ? "✅ Ja has votat" : "Encara no has votat"}</span>
        </div>
      )}

      <div className="pending-action-buttons registration-card-actions">
        <button onClick={() => onOpenVote(poll)}>
          {activeFamilyVote ? "Canviar vot" : "Votar"}
        </button>

        <button
          className="secondary-pending-button"
          onClick={() => onOpenResults(poll)}
        >
          Veure resultats
        </button>
      </div>
    </div>
  );
}
