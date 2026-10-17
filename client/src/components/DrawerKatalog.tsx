import { useEffect, useId, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useFokusDialog } from "../lib/fokus-dialog";
import "../pages/CustomersPage.css";
export default function DrawerKatalog({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: ReactNode }) {
  const panel = useFokusDialog(open), id = useId();
  useEffect(() => { if (!open) return; const shell = document.querySelector<HTMLElement>(".admin-shell"), inert = shell?.inert, overflow = document.body.style.overflow;
    if (shell) shell.inert = true; document.body.style.overflow = "hidden";
    const escape = (e: KeyboardEvent) => { if (e.key === "Escape" && !e.defaultPrevented) { e.preventDefault(); onClose(); } }; window.addEventListener("keydown", escape);
    return () => { if (shell) shell.inert = inert ?? false; document.body.style.overflow = overflow; window.removeEventListener("keydown", escape); };
  }, [open, onClose]);
  if (!open) return null;
  return createPortal(<><div className="cp-backdrop" onClick={onClose}/><aside className="cp-drawer" role="dialog" aria-modal="true" aria-labelledby={id} ref={panel} tabIndex={-1}><header><h2 id={id}>{title}</h2><button aria-label="Tutup drawer" onClick={onClose}><X size={20}/></button></header><div className="cp-body">{children}</div></aside></>, document.body);
}
