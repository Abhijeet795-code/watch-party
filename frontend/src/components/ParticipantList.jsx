const ROLE_LABEL = {
  host: "Host",
  moderator: "Moderator",
  participant: "Participant",
};

export default function ParticipantList({ participants, selfId, isHost, onAssignRole, onRemove, onTransferHost }) {
  return (
    <div className="panel">
      <h2 className="panel__title">Participants ({participants.length})</h2>
      <ul className="participant-list">
        {participants.map((p) => (
          <li key={p.userId} className="participant-row">
            <div className="participant-row__info">
              <span className={`role-dot role-dot--${p.role}`} />
              <span className="participant-row__name">
                {p.username}
                {p.userId === selfId && <span className="you-tag"> (you)</span>}
              </span>
              <span className="participant-row__role">{ROLE_LABEL[p.role]}</span>
            </div>

            {isHost && p.userId !== selfId && (
              <div className="participant-row__actions">
                {p.role !== "moderator" && (
                  <button className="chip-btn" onClick={() => onAssignRole(p.userId, "moderator")}>
                    Make mod
                  </button>
                )}
                {p.role !== "participant" && (
                  <button className="chip-btn" onClick={() => onAssignRole(p.userId, "participant")}>
                    Make viewer
                  </button>
                )}
                <button className="chip-btn" onClick={() => onTransferHost(p.userId)}>
                  Make host
                </button>
                <button className="chip-btn chip-btn--danger" onClick={() => onRemove(p.userId)}>
                  Remove
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
