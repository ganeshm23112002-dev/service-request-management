import { useEffect, useRef, useState } from "react";
import "./confirmDialog.scss";

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Delete request",
  onCancel,
  onConfirm,
}) {
  const dialogRef = useRef(null);
  const cancelRef = useRef(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    const previousFocus = document.activeElement;
    cancelRef.current?.focus();
    const handleKeyDown = (event) => {
      if (event.key === "Escape" && !submitting) onCancel();
      if (event.key === "Tab") {
        event.preventDefault();
        const buttons = dialogRef.current?.querySelectorAll("button:not(:disabled)") || [];
        const first = buttons[0];
        const last = buttons[buttons.length - 1];
        if (document.activeElement === first && event.shiftKey) last?.focus();
        else if (document.activeElement === last && !event.shiftKey) first?.focus();
        else first?.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previousFocus?.focus?.();
    };
  }, [open, onCancel, submitting]);

  if (!open) return null;

  const confirm = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await onConfirm();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="confirm-dialog__backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !submitting) onCancel();
      }}
    >
      <section
        ref={dialogRef}
        className="confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-message"
      >
        <span className="confirm-dialog__icon" aria-hidden="true">!</span>
        <h2 id="confirm-dialog-title">{title}</h2>
        <p id="confirm-dialog-message">{message}</p>
        <div className="confirm-dialog__actions">
          <button
            ref={cancelRef}
            className="confirm-dialog__cancel"
            type="button"
            onClick={onCancel}
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            className="confirm-dialog__confirm"
            type="button"
            onClick={confirm}
            disabled={submitting}
          >
            {submitting && <span className="confirm-dialog__spinner" aria-hidden="true" />}
            {submitting ? "Deleting…" : confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}
