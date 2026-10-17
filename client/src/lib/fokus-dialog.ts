import { useEffect, useRef } from "react";

// Menjaga keyboard pada dialog teratas tanpa mengubah alur submit/permintaan.
export function useFokusDialog(terbuka: boolean) {
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!terbuka) return;
    const sebelumnya = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    (panel.current?.querySelector<HTMLElement>('input:not(:disabled),select:not(:disabled),textarea:not(:disabled)') ?? panel.current?.querySelector<HTMLElement>('button:not(:disabled)'))?.focus();
    const tahan = (event: KeyboardEvent) => {
      if (event.key !== "Tab" || !panel.current) return;
      const atas = Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"][aria-modal="true"]')).filter(e => e.getClientRects().length).at(-1);
      if (atas !== panel.current || !(event.target instanceof Node) || !panel.current.contains(event.target)) return;
      const daftar = Array.from(panel.current.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]')).filter(e => e.getClientRects().length);
      const awal = daftar[0], akhir = daftar.at(-1);
      if (event.shiftKey && document.activeElement === awal) { event.preventDefault(); akhir?.focus(); }
      else if (!event.shiftKey && document.activeElement === akhir) { event.preventDefault(); awal?.focus(); }
    };
    document.addEventListener("keydown", tahan);
    return () => { document.removeEventListener("keydown", tahan); queueMicrotask(() => { const atas = Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"][aria-modal="true"]')).filter(e => e.getClientRects().length).at(-1); if (sebelumnya?.isConnected && (!atas || atas.contains(sebelumnya))) sebelumnya.focus(); }); };
  }, [terbuka]);
  return panel;
}
