import { AlertTriangle } from "lucide-react";
import { createPortal } from "react-dom";
import { useEffect, useId, useRef } from "react";
import { Button, Card } from "./ui";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "primary" | "success";
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "danger",
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const panel = useRef<HTMLDivElement>(null);
  const judulId = useId(), deskripsiId = useId();
  useEffect(() => {
    if (!open) return;
    const sebelumnya = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    panel.current?.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus();
    return () => { if (sebelumnya?.isConnected) sebelumnya.focus(); };
  }, [open]);
  if (!open) return null;

  return createPortal(
    <div
      ref={panel}
      className="modal-backdrop-enter fixed inset-0 z-[350] grid place-items-center bg-slate-950/55 p-4 backdrop-blur-[2px]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !loading) onCancel();
      }}
    >
      <Card role="dialog" aria-modal="true" aria-labelledby={judulId} aria-describedby={deskripsiId}
        onKeyDown={event => {
          if (event.key === "Escape") { event.preventDefault(); if (!loading) onCancel(); }
          if (event.key !== "Tab") return;
          const tombol = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>("button:not(:disabled)"));
          if (!tombol.length) { event.preventDefault(); return; }
          const pertama = tombol[0]!, terakhir = tombol[tombol.length - 1]!;
          if (event.shiftKey && document.activeElement === pertama) { event.preventDefault(); terakhir.focus(); }
          else if (!event.shiftKey && document.activeElement === terakhir) { event.preventDefault(); pertama.focus(); }
        }} className="modal-panel-enter w-full max-w-md overflow-hidden shadow-2xl">
        <div className="p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <div className="grid size-10 shrink-0 place-items-center rounded-full bg-amber-50 text-amber-600">
              <AlertTriangle size={20} />
            </div>
            <div>
              <h3 id={judulId} className="text-base font-black text-slate-900">{title}</h3>
              <p id={deskripsiId} className="mt-1.5 text-sm leading-6 text-slate-500">
                {description}
              </p>
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-2">
            <Button variant="secondary" onClick={onCancel} disabled={loading}>
              {cancelLabel}
            </Button>
            <Button
              variant={
                variant === "primary"
                  ? "primary"
                  : variant === "success"
                    ? "success"
                    : "danger"
              }
              onClick={onConfirm}
              disabled={loading}
            >
              {loading ? "Processing..." : confirmLabel}
            </Button>
          </div>
        </div>
      </Card>
    </div>,
    document.body,
  );
}
