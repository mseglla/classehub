export default function FamilyPinChangeModal({
  currentFamilyName,
  currentFamilyPin,
  setCurrentFamilyPin,
  newFamilyPin,
  setNewFamilyPin,
  repeatFamilyPin,
  setRepeatFamilyPin,
  pinChangeStatus,
  pinChangeLoading,
  onSubmit,
  onClose,
}) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <article className="modal family-pin-change-modal" onClick={(event) => event.stopPropagation()}>
        <button type="button" className="modal-close" onClick={onClose}>
          Tancar
        </button>

        <p className="eyebrow">Accés familiar</p>
        <h2>Canviar PIN</h2>

        <p className="modal-intro">
          Família de <strong>{currentFamilyName}</strong>. El nou PIN ha de tenir 4 números.
        </p>

        <form className="family-pin-change-form" onSubmit={onSubmit}>
          <label>
            PIN actual
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={currentFamilyPin}
              onChange={(event) => setCurrentFamilyPin(event.target.value.replace(/\D/g, "").slice(0, 4))}
              placeholder="PIN actual"
            />
          </label>

          <label>
            Nou PIN
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={newFamilyPin}
              onChange={(event) => setNewFamilyPin(event.target.value.replace(/\D/g, "").slice(0, 4))}
              placeholder="1234"
            />
          </label>

          <label>
            Repeteix el nou PIN
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={repeatFamilyPin}
              onChange={(event) => setRepeatFamilyPin(event.target.value.replace(/\D/g, "").slice(0, 4))}
              placeholder="1234"
            />
          </label>

          {pinChangeStatus && (
            <p className="family-pin-change-status">{pinChangeStatus}</p>
          )}

          <button type="submit" disabled={pinChangeLoading}>
            {pinChangeLoading ? "Guardant..." : "Guardar nou PIN"}
          </button>
        </form>
      </article>
    </div>
  );
}
