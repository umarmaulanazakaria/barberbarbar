import type { KandidatProfil } from "../lib/profil-pelanggan";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { Check, Plus, Search, X } from "lucide-react";
import { api, pesanError } from "../lib/api";
import { rupiah } from "../lib/format";
import { hpWalkInValid, normalisasiHpWalkIn, kirimWalkIn, periksaWalkIn, type PermintaanWalkIn, type HasilWalkIn } from "../lib/walkin-dashboard";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { useFokusDialog } from "../lib/fokus-dialog";
import type { Barber, Layanan, Pelanggan } from "../types";
import { Button, ErrorState, Input, LoadingState, Select } from "./ui";
import ConfirmDialog from "./ConfirmDialog";
import "./TambahWalkInDrawer.css";

type PilihanProfil = KandidatProfil & { pelangganId: number; status: string; membership?: Pelanggan["membership"] };
function bacaTertunda(kunci: string): PermintaanWalkIn | null {
  try {
    const d: unknown = JSON.parse(sessionStorage.getItem(kunci) ?? "null");
    if (!d || typeof d !== "object") return null;
    const p = d as Record<string, unknown>, c = p.pelanggan as Record<string, unknown> | undefined;
    if (typeof p.kunciIdempotensi !== "string" || !/^[0-9a-f-]{36}$/i.test(p.kunciIdempotensi) ||
      !Array.isArray(p.items) || !p.items.length || !p.items.every(i => i && Number.isSafeInteger(i.layananId) && i.qty === 1 && Number.isSafeInteger(i.hargaDiharapkan)) ||
      !Number.isSafeInteger(p.totalDiharapkan) || !(p.barberId === null || Number.isSafeInteger(p.barberId)) ||
      !c || !(c.jenis === "ANONIM" || c.jenis === "LAMA" && Number.isSafeInteger(c.id) || c.jenis === "BARU" && typeof c.nama === "string" && (c.nomorTelepon === undefined || typeof c.nomorTelepon === "string"))) return null;
    return d as PermintaanWalkIn;
  } catch { return null; }
}
export default function TambahWalkInDrawer({ onClose }: { onClose: () => void }) {
  const { user } = useAuth(), klien = useQueryClient(), toast = useToast();
  const kunciDraft = `barber-walkin-tertunda:${user?.id ?? 0}`;
  const [awal] = useState(() => bacaTertunda(kunciDraft));
  const [draftLama, aturDraftLama] = useState(() => !!awal && sessionStorage.getItem(`${kunciDraft}:format`) !== "2");
  const [mode, aturMode] = useState<"LAMA" | "BARU" | "ANONIM">(awal?.pelanggan.jenis ?? "LAMA");
  const [customerId, aturCustomerId] = useState(awal?.pelanggan.jenis === "LAMA" ? awal.pelanggan.id : 0);
  const [nama, aturNama] = useState(awal?.pelanggan.jenis === "BARU" ? awal.pelanggan.nama : ""), [hp, aturHp] = useState(awal?.pelanggan.jenis === "BARU" ? awal.pelanggan.nomorTelepon ?? "" : "");
  const [duplikat, aturDuplikat] = useState<KandidatProfil[]>([]), [terpisah, aturTerpisah] = useState(false), [pulihkan, aturPulihkan] = useState<KandidatProfil | null>(null);
  const [cari, aturCari] = useState(""), [pilihan, aturPilihan] = useState<number[]>(awal?.items.map(i => i.layananId) ?? []);
  const [barberId, aturBarber] = useState(awal?.barberId ?? 0), [pending, aturPending] = useState<PermintaanWalkIn | null>(awal);
  const [sibuk, aturSibuk] = useState(false), [belumPasti, aturBelumPasti] = useState(!!awal), [gagal, aturGagal] = useState("");
  const [konfirmasi, aturKonfirmasi] = useState(false), penjaga = useRef(false), panel = useFokusDialog(true);
  const pelanggan = useQuery({ queryKey: ["customers", "walkin-options"], queryFn: async () => (await api.get<PilihanProfil[]>("/management/customers/options")).data });
  const layanan = useQuery({ queryKey: ["services"], queryFn: async () => (await api.get<Layanan[]>("/layanan")).data });
  const barber = useQuery({ queryKey: ["barbers"], queryFn: async () => (await api.get<Barber[]>("/barbers")).data });
  const customer = pelanggan.data?.find(p => p.id === customerId && p.status === "AKTIF");
  const kata = cari.trim().toLocaleLowerCase("id-ID"), digit = normalisasiHpWalkIn(cari);
  const hasilCari = pelanggan.data?.filter(p => (!kata || p.nama.toLocaleLowerCase("id-ID").includes(kata) ||
    (p.nomorTelepon ?? "").includes(kata) || digit.length >= 3 && normalisasiHpWalkIn(p.nomorTelepon ?? "").includes(digit))) ?? [];
  const dipilih = (layanan.data ?? []).filter(l => pilihan.includes(l.id));
  const subtotal = dipilih.reduce((n, l) => n + (pending?.items.find(i => i.layananId === l.id)?.hargaDiharapkan ?? l.harga), 0);
  const persen = mode === "LAMA" && customer?.membership?.isActive ? customer.membership.discountPercent : 0;
  const diskon = Math.floor(subtotal * persen / 100), total = pending?.totalDiharapkan ?? subtotal - diskon;
  const valid = (mode === "ANONIM" || (mode === "LAMA" ? !!customer && (!!customer.nomorTelepon || user?.role === "ADMIN" && !!hp.trim() && hpWalkInValid(hp)) : user?.role === "ADMIN" && !!nama.trim() && !!hp.trim() && hpWalkInValid(hp))) && pilihan.length > 0 &&
    dipilih.length === pilihan.length && dipilih.every(l => l.aktif) && layanan.isSuccess && (!barberId || !!barber.data?.some(b => b.id === barberId && b.aktif));
  const layananHilang = layanan.isSuccess && pilihan.some(id => !layanan.data.some(l => l.id === id && l.aktif));
  const berubah = !!customerId || !!nama || !!hp || !!pilihan.length || !!barberId || !!pending;
  const tutup = useCallback(() => { if (sibuk) return; if (berubah) aturKonfirmasi(true); else onClose(); }, [sibuk, berubah, onClose]);
  useEffect(() => {
    const shell = document.querySelector<HTMLElement>(".admin-shell"), semula = shell?.inert, overflow = document.body.style.overflow;
    if (shell) shell.inert = true; document.body.style.overflow = "hidden";
    const escape = (e: KeyboardEvent) => { if (e.key === "Escape" && !e.defaultPrevented && !konfirmasi && !pulihkan) { e.preventDefault(); tutup(); } };
    window.addEventListener("keydown", escape);
    return () => { if (shell) shell.inert = semula ?? false; document.body.style.overflow = overflow; window.removeEventListener("keydown", escape); };
  }, [tutup, konfirmasi, pulihkan]);
  const selesai = (hasil: HasilWalkIn) => {
    sessionStorage.removeItem(kunciDraft); aturPending(null);
    for (const key of ["orders", "dashboard", "customers"]) void klien.invalidateQueries({ queryKey: [key] });
    toast.success(hasil.diulang ? `Pesanan ${hasil.data.nomorPesanan} sudah tercatat. Data diperbarui sesuai status terbaru.` : `Pesanan ${hasil.data.nomorPesanan} masuk antrean Menunggu. Tersedia di tab Walk-in.`); onClose();
  };
  const simpan = async () => {
    if (penjaga.current || draftLama || !pending && !valid) return;
    penjaga.current = true; aturSibuk(true); aturGagal("");
    const body: PermintaanWalkIn = pending ?? { pelanggan: mode === "ANONIM" ? { jenis: "ANONIM" } : mode === "LAMA" ? { jenis: "LAMA", id: customerId, ...(!customer?.nomorTelepon ? { nomorTelepon: normalisasiHpWalkIn(hp), konfirmasiDuplikat: terpisah } : {}) } :
      { jenis: "BARU", nama: nama.trim(), nomorTelepon: normalisasiHpWalkIn(hp), konfirmasiDuplikat: terpisah },
      items: dipilih.map(l => ({ layananId: l.id, qty: 1, hargaDiharapkan: l.harga })), barberId: barberId || null, totalDiharapkan: total, kunciIdempotensi: crypto.randomUUID() };
    aturPending(body);
    try { sessionStorage.setItem(kunciDraft, JSON.stringify(body)); sessionStorage.setItem(`${kunciDraft}:format`, "2"); }
    catch {
      if (!pending) aturPending(null); aturGagal("Browser tidak dapat menyimpan kunci pemulihan. Izinkan penyimpanan sesi sebelum mengirim pesanan. Permintaan tertunda sebelumnya tetap perlu diperiksa.");
      penjaga.current = false; aturSibuk(false); return;
    }
    try { selesai(await kirimWalkIn(body)); }
    catch (e) {
      const pastiGagal = axios.isAxiosError(e) && !!e.response && e.response.status < 500 && ![401, 403, 408, 429].includes(e.response.status) && e.response.data?.kode !== "IDEMPOTENSI_BERBEDA";
      if (pastiGagal) { if (axios.isAxiosError(e) && Array.isArray(e.response?.data?.kandidat)) aturDuplikat(e.response.data.kandidat); aturPending(null); sessionStorage.removeItem(kunciDraft); aturBelumPasti(false); aturGagal(pesanError(e));
        void klien.invalidateQueries({ queryKey: ["services"] }); void klien.invalidateQueries({ queryKey: ["customers"] }); void klien.invalidateQueries({ queryKey: ["barbers"] });
      } else { aturBelumPasti(true); aturGagal("Hasil penyimpanan belum dapat dipastikan. Periksa status atau kirim ulang permintaan yang sama. Jangan membuat pesanan lain untuk menggantikannya."); }
    } finally { penjaga.current = false; aturSibuk(false); }
  };
  const pulihkanProfil = async () => {
    if (!pulihkan || sibuk) return; aturSibuk(true); aturGagal("");
    try { await api.post(`/management/customers/${pulihkan.id}/restore`, { konfirmasi: true }); await pelanggan.refetch(); aturCustomerId(pulihkan.id); aturMode("LAMA"); aturPulihkan(null); aturDuplikat([]); }
    catch(e) { aturGagal(pesanError(e)); aturPulihkan(null); } finally { aturSibuk(false); }
  };
  const periksa = async () => {
    if (!pending || penjaga.current) return;
    penjaga.current = true; aturSibuk(true);
    try { selesai(await periksaWalkIn(pending.kunciIdempotensi)); }
    catch (e) { if (draftLama && axios.isAxiosError(e) && e.response?.status === 404) { sessionStorage.removeItem(kunciDraft); aturDraftLama(false); aturPending(null); aturCustomerId(0); aturBelumPasti(false); aturGagal("Permintaan lama belum tercatat. Pilih kembali profil dan periksa data sebelum membuat pesanan."); return; } aturGagal("Belum ada konfirmasi hasil. Data dan kunci permintaan tetap dipertahankan; Anda dapat memeriksa lagi atau mengirim ulang permintaan yang sama."); }
    finally { penjaga.current = false; aturSibuk(false); }
  };
  return createPortal(<><button className="wi-overlay" aria-label="Tutup drawer Tambah Walk-in" disabled={sibuk} onClick={tutup} />
    <aside className="wi-drawer" role="dialog" aria-modal="true" aria-labelledby="judul-tambah-walkin" ref={panel} tabIndex={-1} inert={konfirmasi || pulihkan ? true : undefined}>
      <header className="wi-header"><div><p>PESANAN BARU / WALK-IN</p><h2 id="judul-tambah-walkin">Tambah Walk-in</h2></div><button type="button" aria-label="Tutup Tambah Walk-in" disabled={sibuk} onClick={tutup}><X size={19} /></button><span>Buat pesanan pelanggan yang datang langsung. Semua pesanan baru masuk antrean Menunggu.</span></header>
      <form id="form-walkin" className="wi-body" onSubmit={e => { e.preventDefault(); if (!belumPasti) void simpan(); }}>
        {draftLama && <p className="wi-help">Periksa status permintaan lama terlebih dahulu. Pengiriman ulang format lama dinonaktifkan untuk melindungi hubungan pelanggan.</p>}
        {gagal && <div className="wi-error" role="alert"><p>{gagal}</p>{belumPasti && !draftLama && <Button variant="secondary" type="button" disabled={sibuk} onClick={() => void simpan()}>Kirim ulang permintaan yang sama</Button>}</div>}
        <fieldset disabled={sibuk || !!pending}><section className="wi-section"><h3><span>01</span>Pelanggan</h3><div className="wi-segment" role="tablist" aria-label="Mode pelanggan">{(["LAMA", "BARU", "ANONIM"] as const).map(m => <button key={m} type="button" role="tab" aria-selected={mode === m} disabled={m === "BARU" && user?.role !== "ADMIN"} onClick={() => { aturMode(m); aturDuplikat([]); aturTerpisah(false); }}>{m === "LAMA" ? "Pelanggan Lama" : m === "BARU" ? "Pelanggan Baru" : "Pelanggan Anonim"}</button>)}</div>
          {mode === "LAMA" ? <div className="wi-customer"><label htmlFor="wi-cari">Cari pelanggan</label><div className="wi-search"><Search size={16} /><Input id="wi-cari" value={cari} onChange={e => aturCari(e.target.value)} placeholder="Ketik nama atau nomor HP..." autoComplete="off" /></div>
            {pelanggan.isPending ? <LoadingState text="Memuat pelanggan…" /> : pelanggan.isError ? <ErrorState text="Pelanggan belum dapat dimuat." onRetry={() => void pelanggan.refetch()} /> : !hasilCari.length ? <p className="wi-empty">Pelanggan tidak ditemukan. Gunakan tab Pelanggan Baru untuk membuat pelanggan.</p> : <div className="wi-customer-list" role="radiogroup" aria-label="Pilih pelanggan">{hasilCari.map(p => <label key={p.id} className={customerId === p.id ? "selected" : ""}><input type="radio" name="pelangganWalkIn" value={p.id} checked={customerId === p.id} disabled={p.status !== "AKTIF"} onChange={() => { aturCustomerId(p.id); aturHp(""); aturDuplikat([]); }} /><span><strong>{p.nama}</strong><small className="wi-phone">{p.nomorTelepon || "Tanpa nomor HP"}{p.diarsipkanPada ? " - Diarsipkan" : p.status === "DIBLOKIR" ? " - Diblokir" : ""}</small></span>{p.diarsipkanPada && user?.role === "ADMIN" && <button type="button" onClick={e => { e.preventDefault(); aturPulihkan(p); }}>Pulihkan</button>}{customerId === p.id && <Check size={16} aria-hidden="true" />}</label>)}</div>}</div> : mode === "ANONIM" ? <p className="wi-help">Pesanan menggunakan label Pelanggan Anonim tanpa membuat atau menyimpan profil pelanggan.</p> : <div className="wi-new"><label htmlFor="wi-nama">Nama lengkap <b>*</b></label><Input id="wi-nama" autoComplete="off" maxLength={100} value={nama} onChange={e => aturNama(e.target.value)} placeholder="Nama pelanggan" required /><label htmlFor="wi-hp">Nomor HP *</label><Input id="wi-hp" className="wi-phone" type="tel" inputMode="tel" autoComplete="off" maxLength={30} value={hp} onChange={e => { aturHp(e.target.value); aturTerpisah(false); aturDuplikat([]); }} placeholder="Contoh: 08xxxxxxxxxx" aria-invalid={!hpWalkInValid(hp)} />{!hpWalkInValid(hp) && <p className="wi-validation">Masukkan nomor HP Indonesia yang valid.</p>}</div>}

          {mode === "LAMA" && customer && !customer.nomorTelepon && <div className="wi-new"><label htmlFor="wi-lengkapi-hp">Nomor HP wajib dilengkapi</label>{user?.role === "ADMIN" ? <Input id="wi-lengkapi-hp" type="tel" required maxLength={30} value={hp} onChange={e => { aturHp(e.target.value); aturTerpisah(false); aturDuplikat([]); }}/> : <p>Minta Admin melengkapi nomor HP profil sebelum membuat pesanan.</p>}</div>}
          {!!duplikat.length && <div className="wi-error"><strong>Kontak cocok dengan profil existing</strong>{duplikat.map(p => <div key={p.id}><span>{p.nama} · {p.nomorTelepon} {p.diarsipkanPada && "· Diarsipkan"}</span>{p.diarsipkanPada ? <Button variant="secondary" type="button" onClick={() => aturPulihkan(p)}>Pulihkan</Button> : <Button variant="secondary" type="button" onClick={() => { aturMode("LAMA"); aturCustomerId(p.id); aturDuplikat([]); aturHp(""); }}>Gunakan profil ini</Button>}</div>)}<label><input type="checkbox" checked={terpisah} onChange={e => aturTerpisah(e.target.checked)}/> Saya mengonfirmasi profil terpisah dengan kontak yang sama.</label></div>}
        </section><section className="wi-section"><h3><span>02</span>Pilih Layanan <b>*</b></h3>{layananHilang && <div className="wi-validation" role="alert">Ada layanan pilihan yang tidak tersedia. <button type="button" onClick={() => aturPilihan(ids => ids.filter(id => layanan.data?.some(l => l.id === id && l.aktif)))}>Hapus layanan yang tidak tersedia</button></div>}{layanan.isPending ? <LoadingState text="Memuat layanan…" /> : layanan.isError ? <ErrorState text="Katalog layanan belum dapat dimuat." onRetry={() => void layanan.refetch()} /> : <div className="wi-services">{layanan.data.filter(l => l.aktif).map(l => <label key={l.id} className={pilihan.includes(l.id) ? "selected" : ""}><input type="checkbox" checked={pilihan.includes(l.id)} onChange={e => aturPilihan(ids => e.target.checked ? [...ids, l.id] : ids.filter(id => id !== l.id))} /><span><strong>{l.nama}</strong><small>{l.durasiMenit} menit</small></span><strong>{rupiah(l.harga)}</strong></label>)}{!layanan.data.some(l => l.aktif) && <p className="wi-empty">Belum ada layanan aktif.</p>}</div>}</section>
          <section className="wi-section"><h3><span>03</span>Pilih Barber <small>(opsional)</small></h3><label htmlFor="wi-barber">Barber yang melayani</label><Select id="wi-barber" value={barberId} onChange={e => aturBarber(Number(e.target.value))}><option value={0}>Tentukan nanti — masuk antrean</option>{barber.data?.filter(b => b.aktif).map(b => <option key={b.id} value={b.id}>{b.nama}</option>)}</Select>{barber.isError && <p className="wi-validation">Daftar barber belum tersedia. Coba lagi sebelum memilih barber.</p>}<p className="wi-help">Barber wajib ditentukan sebelum pelayanan dimulai. Memilih barber sekarang tidak langsung memulai pelayanan.</p></section>
          <section className="wi-section"><h3><span>04</span>Ringkasan Pesanan</h3><p className="wi-help">Harga diperbarui otomatis sesuai pilihan layanan.</p><div className="wi-summary">{!dipilih.length ? <p>Pilih minimal satu layanan.</p> : dipilih.map(l => <div key={l.id}><span>{l.nama}</span><strong>{rupiah(pending?.items.find(i => i.layananId === l.id)?.hargaDiharapkan ?? l.harga)}</strong></div>)}{diskon > 0 && <div><span>Diskon membership {persen}%</span><strong>−{rupiah(diskon)}</strong></div>}<div className="wi-total"><strong>Total Pesanan</strong><strong>{rupiah(total)}</strong></div></div><span className="wi-waiting">Status awal: Menunggu</span><p className="wi-help">Pembayaran belum diwajibkan. Pelanggan dapat membayar melalui kasir sesuai alur sistem.</p></section>
        </fieldset>
      </form><footer className="wi-footer"><div><span>TOTAL PESANAN</span><strong>{rupiah(total)}</strong></div><div><Button variant="secondary" type="button" disabled={sibuk} onClick={tutup}>Batal</Button>{belumPasti ? <Button type="button" disabled={sibuk} onClick={() => void periksa()}>{sibuk ? "Memeriksa…" : "Periksa status"}</Button> : <Button form="form-walkin" type="submit" disabled={!valid || sibuk || !!duplikat.length && !terpisah}><Plus size={16} />{sibuk ? "Menyimpan…" : "Buat Pesanan"}</Button>}</div></footer>
    </aside><ConfirmDialog open={konfirmasi} title={belumPasti ? "Tutup sementara?" : "Buang perubahan Walk-in?"} description={belumPasti ? "Hasil request belum pasti. Permintaan tetap disimpan di tab browser ini untuk diperiksa saat drawer dibuka kembali." : "Data yang belum disimpan akan dibuang."} confirmLabel={belumPasti ? "Tutup sementara" : "Buang perubahan"} cancelLabel="Lanjutkan mengisi" onCancel={() => aturKonfirmasi(false)} onConfirm={() => { aturKonfirmasi(false); onClose(); }} />
    <ConfirmDialog open={!!pulihkan} title="Pulihkan profil pelanggan?" description={`Pulihkan ${pulihkan?.nama ?? ""}? Tindakan ini dicatat dalam audit dan tidak mengubah riwayat transaksi.`} loading={sibuk} onCancel={() => !sibuk && aturPulihkan(null)} onConfirm={() => void pulihkanProfil()}/>
  </>, document.body);
}
