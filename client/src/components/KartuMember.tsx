import { useEffect, useState } from "react";
import axios from "axios";
import { api, pesanError } from "../lib/api";
import { dataKartuMember, dokumenCetakKartu, gambarKartuMember, pdfKartuMember, sumberGambarKartu, type SumberKartuMember } from "../lib/kartu-member";
import { Button } from "./ui";
import "./KartuMember.css";

export default function KartuMember({ id, member, onPerbarui }: { id: number; member: SumberKartuMember; onPerbarui: () => void }) {
  const [preview, aturPreview] = useState(""), [galat, aturGalat] = useState(""), [sibuk, aturSibuk] = useState(false);
  const boleh = member.status === "AKTIF" && member.bolehCetakKartu;
  useEffect(() => {
    let aktif = true; aturPreview(""); aturGalat("");
    if (member.status === "AKTIF" && member.bolehCetakKartu) {
      void Promise.resolve().then(() => gambarKartuMember(dataKartuMember(member))).then(svg => { if (aktif) aturPreview(sumberGambarKartu(svg)); }).catch(() => { if (aktif) aturGalat("Tampilan kartu belum dapat dimuat. Periksa kembali koneksi atau buka ulang Detail."); });
    }
    return () => { aktif = false; };
  }, [member.nomorMember, member.nama, member.berlakuSampai, member.status, member.bolehCetakKartu]);
  const keluarkan = async (jenis: "CETAK" | "PDF") => {
    if (sibuk || !boleh) return;
    // Dibuka langsung dari klik untuk menghindari popup diblokir setelah request async.
    const jendela = jenis === "CETAK" ? window.open("", "_blank", "width=600,height=440") : null;
    if (jenis === "CETAK" && !jendela) { aturGalat("Izinkan popup untuk membuka dialog Cetak Kartu Member."); return; }
    if (jendela) { jendela.opener = null; jendela.document.title = "Menyiapkan kartu Member"; jendela.document.body.textContent = "Memeriksa status dan tanggal Membership terbaru..."; }
    aturSibuk(true); aturGalat("");
    try {
      // Selalu baca ulang agar cetak ulang memakai masa aktif terbaru dan bukan data drawer lama.
      const terbaru = (await api.get<SumberKartuMember>(`/management/memberships/${id}`)).data;
      onPerbarui(); const kartu = dataKartuMember(terbaru), svg = await gambarKartuMember(kartu);
      aturPreview(sumberGambarKartu(svg));
      if (jenis === "CETAK" && jendela) {
        if (jendela.closed) throw Error("Jendela cetak telah ditutup. Tekan Cetak Kartu Member kembali.");
        jendela.document.open(); jendela.document.write(dokumenCetakKartu(svg, kartu.nomorMember)); jendela.document.close();
        const gambar = jendela.document.querySelector("img"); if (gambar) await gambar.decode();
        if (jendela.closed) return;
        jendela.focus(); jendela.print();
      } else {
        const pdf = await pdfKartuMember(svg), url = URL.createObjectURL(pdf), tautan = document.createElement("a");
        tautan.href = url; tautan.download = `Kartu-Member-${kartu.nomorMember.replace(/[^a-zA-Z0-9_-]/g, "_")}.pdf`;
        document.body.append(tautan); tautan.click(); tautan.remove(); setTimeout(() => URL.revokeObjectURL(url), 30000);
      }
    } catch (e) { if (jendela && !jendela.closed) jendela.close(); aturGalat(e instanceof Error && !axios.isAxiosError(e) ? e.message : pesanError(e)); }
    finally { aturSibuk(false); }
  };
  return <section className="member-kartu-section" aria-label="Kartu Membership">
    <h3>Kartu Member</h3>
    {preview && boleh && <div className="member-kartu-preview"><img src={preview} alt={`Kartu Member ${member.nomorMember}`} /></div>}
    <div className="member-kartu-actions"><Button type="button" disabled={!boleh || sibuk} onClick={() => void keluarkan("CETAK")}>Cetak Kartu Member</Button><Button type="button" variant="secondary" disabled={!boleh || sibuk} onClick={() => void keluarkan("PDF")}>Unduh PDF Kartu</Button></div>
    <p className="member-kartu-catatan">{boleh ? "Ukuran KTP 85,60 × 53,98 mm. Cetak pada skala 100%, tanpa margin, header, atau footer browser. PDF memakai ukuran halaman kartu yang sama." : "Kartu tersedia setelah pembayaran terverifikasi dan Membership aktif. Membership pending, belum aktif, atau kedaluwarsa tidak dapat dicetak."}</p>
    {sibuk && <p role="status">Menyiapkan kartu dengan data terbaru...</p>}{galat && <p className="cp-warning" role="alert">{galat}</p>}
  </section>;
}
