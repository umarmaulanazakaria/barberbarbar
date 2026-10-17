import { useEffect, useId, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useFokusDialog } from "../lib/fokus-dialog";
import "../pages/CustomersPage.css";
export default function DrawerKatalog({ open, title, onClose, children, utama = false }: { open: boolean; title: string; onClose: () => void; children: ReactNode; utama?: boolean }) {
  const panel = useFokusDialog(open), id = useId();
  useEffect(() => { if (!open) return; const shell = document.querySelector<HTMLElement>(".admin-shell"), inert = shell?.inert, overflow = document.body.style.overflow;
    if (shell) shell.inert = true; document.body.style.overflow = "hidden";
    const sebelumnya = utama ? Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"][aria-modal="true"]')).filter(e => e !== panel.current) : [];
    const status = sebelumnya.map(el => el.inert); sebelumnya.forEach(el => { el.inert = true; });
    const escape = (e: KeyboardEvent) => { if (e.key === "Escape" && !e.defaultPrevented) { const atas = Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"][aria-modal="true"]')).filter(el => !el.inert && el.getClientRects().length).at(-1); if (atas !== panel.current) return; if (!utama && document.querySelector(".keuangan-utama")) return; e.preventDefault(); if (utama) e.stopImmediatePropagation(); onClose(); } }; window.addEventListener("keydown", escape, utama);
    return () => { if (shell) shell.inert = inert ?? false; document.body.style.overflow = overflow; sebelumnya.forEach((el, i) => { if (el.isConnected) el.inert = status[i] ?? false; }); window.removeEventListener("keydown", escape, utama); };
  }, [open, onClose, utama]);
  if (!open) return null;
  return createPortal(<div className={utama ? "keuangan-utama" : undefined}><div className="cp-backdrop" onClick={onClose}/><aside className="cp-drawer" role="dialog" aria-modal="true" aria-labelledby={id} ref={panel} tabIndex={-1}><header><h2 id={id}>{title}</h2><button aria-label="Tutup drawer" onClick={onClose}><X size={20}/></button></header><div className="cp-body">{children}</div></aside></div>, document.body);
}
