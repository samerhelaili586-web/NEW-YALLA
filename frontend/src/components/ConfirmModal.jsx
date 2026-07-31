import Modal from "./Modal";

export default function ConfirmModal({
  open,
  onClose,
  onConfirm,
  title = "Confirmation",
  message = "Êtes-vous sûr de vouloir effectuer cette action ?",
  confirmText = "Confirmer",
  cancelText = "Annuler",
  danger = true,
  loading = false,
}) {
  if (!open) return null;

  return (
    <Modal open={open} onClose={onClose} title={title} width={420}>
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <p style={{ margin: 0, fontSize: "0.92rem", color: "var(--ink)", lineHeight: 1.5 }}>
          {message}
        </p>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.6rem", marginTop: "0.5rem" }}>
          <button
            type="button"
            className="btn-ghost"
            onClick={onClose}
            disabled={loading}
          >
            {cancelText}
          </button>
          <button
            type="button"
            className={danger ? "btn-danger" : "btn-primary"}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? "Chargement…" : confirmText}
          </button>
        </div>
      </div>
    </Modal>
  );
}
