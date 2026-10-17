import { useEffect, useId, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { Button, Input } from "./ui";
import "./PilihProfilMembership.css";
type Profil = { id: number; nama: string; nomorTelepon: string | null; membership: { id: number; memberCode: string } | null };
export default function PilihProfilMembership({ value, onChange, onMember, disabled = false }: { value: number; onChange: (id: number) => void; onMember: (id: number) => void; disabled?: boolean }) {
  const id = useId();
  const [cari, aturCari] = useState(""), [kata, aturKata] = useState(""), [terbuka, aturTerbuka] = useState(false), [aktif, aturAktif] = useState(-1);
  const hasil = useQuery({ queryKey: ["customers", "membership-options", kata], queryFn: async ({ signal }) => (await api.get<Profil[]>("/management/customers/options", { params: { cari: kata, batas: 20 }, signal })).data, enabled: terbuka && !disabled });
  const terpilih = useQuery({ queryKey: ["customers", "membership-selection", value], queryFn: async ({ signal }) => (await api.get<Profil[]>("/management/customers/options", { params: { id: value, batas: 1 }, signal })).data[0] ?? null, enabled: value > 0 });
  useEffect(() => { const t = setTimeout(() => { aturKata(cari.trim()); aturAktif(-1); }, 250); return () => clearTimeout(t); }, [cari]);
  useEffect(() => { if (terpilih.data?.membership) onMember(terpilih.data.membership.id); }, [terpilih.data, onMember]);
  const data = cari.trim() === kata ? hasil.data ?? [] : [];
  useEffect(() => { if (aktif >= 0) document.getElementById(`${id}-${aktif}`)?.scrollIntoView({ block: "nearest" }); }, [aktif, id]);
  const pilih = (p: Profil) => { if (disabled) return; aturTerbuka(false); aturAktif(-1); if (p.membership) onMember(p.membership.id); else onChange(p.id); };
  return <div className="profil-combobox" onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget)) aturTerbuka(false); }}>
    <label htmlFor={id}>Profil pelanggan</label>
    {value > 0 && <div className="profil-pilihan">{terpilih.isPending ? <span>Memuat pilihan...</span> : terpilih.data ? <div><strong>{terpilih.data.nama}</strong><span>{terpilih.data.nomorTelepon}</span>{terpilih.data.membership && <Button type="button" disabled={disabled} variant="secondary" onClick={() => onMember(terpilih.data!.membership!.id)}>Buka Perpanjangan {terpilih.data.membership.memberCode}</Button>}</div> : <span role="alert">Profil tidak tersedia. Pilih pelanggan aktif kembali.</span>}<Button type="button" disabled={disabled} variant="ghost" onClick={() => { onChange(0); aturCari(""); aturTerbuka(true); setTimeout(() => document.getElementById(id)?.focus(), 0); }}>Ganti</Button></div>}
    {!value && <><Input id={id} role="combobox" aria-autocomplete="list" aria-expanded={terbuka} aria-controls={`${id}-hasil`} aria-activedescendant={aktif >= 0 ? `${id}-${aktif}` : undefined} autoComplete="off" maxLength={100} disabled={disabled} placeholder="Ketik nama atau nomor HP pelanggan..." value={cari} onFocus={() => aturTerbuka(true)} onChange={e => { aturCari(e.target.value); aturTerbuka(true); aturAktif(-1); }} onKeyDown={e => {
      if (e.key === "Escape" && terbuka) { e.preventDefault(); e.stopPropagation(); aturTerbuka(false); }
      if (["ArrowDown", "ArrowUp"].includes(e.key)) { e.preventDefault(); aturTerbuka(true); aturAktif(n => data.length ? n < 0 ? e.key === "ArrowDown" ? 0 : data.length - 1 : (n + (e.key === "ArrowDown" ? 1 : -1) + data.length) % data.length : -1); }
      if (e.key === "Home" && terbuka) { e.preventDefault(); aturAktif(0); }
      if (e.key === "End" && terbuka) { e.preventDefault(); aturAktif(data.length - 1); }
      if (e.key === "Enter") { e.preventDefault(); if (aktif >= 0 && data[aktif]) pilih(data[aktif]); }
    }}/>{terbuka && <div className="profil-hasil" role="listbox" id={`${id}-hasil`} aria-label="Hasil pencarian pelanggan" aria-busy={hasil.isFetching || cari.trim() !== kata}>
      {hasil.isError ? <div role="alert">Pencarian belum tersedia. <button type="button" onClick={() => void hasil.refetch()}>Coba lagi</button></div> : cari.trim() !== kata || hasil.isPending ? <p role="status">Mencari pelanggan...</p> : !data.length ? <p>Tidak ada pelanggan aktif dengan nomor HP yang sesuai. Gunakan Pelanggan Baru bila belum terdaftar.</p> : data.map((p, n) => <button key={p.id} id={`${id}-${n}`} type="button" role="option" aria-selected={aktif === n} className={aktif === n ? "aktif" : ""} onMouseDown={e => e.preventDefault()} onClick={() => pilih(p)}><strong>{p.nama}</strong><span>{p.nomorTelepon}</span>{p.membership && <small>{p.membership.memberCode} · Buka perpanjangan</small>}</button>)}
      {data.length === 20 && <p>Menampilkan maksimal 20 hasil. Persempit nama atau nomor HP.</p>}
    </div>}</>}
  </div>;
}
