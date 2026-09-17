import { AlertTriangle } from "lucide-react";
import { createPortal } from "react-dom";
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
  if (!open) return null;

  return createPortal(
    <div
      className="modal-backdrop-enter fixed inset-0 z-[350] grid place-items-center bg-slate-950/55 p-4 backdrop-blur-[2px]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !loading) onCancel();
      }}
    >
      <Card className="modal-panel-enter w-full max-w-md overflow-hidden shadow-2xl">
        <div className="p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <div className="grid size-10 shrink-0 place-items-center rounded-full bg-amber-50 text-amber-600">
              <AlertTriangle size={20} />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900">{title}</h3>
              <p className="mt-1.5 text-sm leading-6 text-slate-500">
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
