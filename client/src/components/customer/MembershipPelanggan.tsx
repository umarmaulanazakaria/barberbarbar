import { useEffect, useRef, useState } from "react";

type StatusMembership = "NON_MEMBER" | "PENDING_APPROVAL" | "ACTIVE" | "INACTIVE";
type DataMembership = {
  status: StatusMembership;
  dapatMengajukan: boolean;
  diskonPersen: number;
  membership: { memberCode: string } | null;
};

// Komponen siap integrasi Project 5. Token CUSTOMER diberikan oleh host app;
// tidak membaca atau menulis token operator/localStorage Project 3.
export default function MembershipPelanggan({ tokenCustomer, alamatApi = "/api" }: {
  tokenCustomer: string;
  alamatApi?: string;
}) {
  const [data, setData] = useState<DataMembership | null>(null);
  const [pesan, setPesan] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const [putaran, setPutaran] = useState(0);
  const kontrol = useRef<AbortController | null>(null);
  const url = `${alamatApi.replace(/\/$/, "")}/customer/membership`;

  useEffect(() => {
    const pengendali = new AbortController();
    kontrol.current = pengendali;
    setData(null); setPesan(""); setSibuk(false);
    if (!tokenCustomer) { setPesan("Silakan login untuk melihat membership."); return () => pengendali.abort(); }
    void fetch(url, { headers: { Authorization: `Bearer ${tokenCustomer}` }, signal: pengendali.signal })
      .then(async respon => {
        if (!respon.ok) throw new Error("Status membership belum dapat dimuat.");
        return await respon.json() as DataMembership;
      }).then(hasil => { if (!pengendali.signal.aborted) setData(hasil); })
      .catch(() => { if (!pengendali.signal.aborted) setPesan("Status membership belum dapat dimuat. Coba muat ulang."); });
    return () => pengendali.abort();
  }, [tokenCustomer, url, putaran]);

  const ajukan = async () => {
    const pengendali = kontrol.current;
    if (!pengendali || pengendali.signal.aborted || sibuk || !data?.dapatMengajukan) return;
    setSibuk(true); setPesan("");
    try {
      const respon = await fetch(`${url}/requests`, { method: "POST", signal: pengendali.signal,
        headers: { Authorization: `Bearer ${tokenCustomer}`, "Content-Type": "application/json" }, body: "{}" });
      if (!respon.ok && respon.status !== 409) throw new Error("Pengajuan belum dapat diproses.");
      const status = await fetch(url, { headers: { Authorization: `Bearer ${tokenCustomer}` }, signal: pengendali.signal });
      if (!status.ok) throw new Error("Status belum dapat dimuat.");
      const hasil = await status.json() as DataMembership;
      if (!pengendali.signal.aborted) {
        setData(hasil); setPesan(respon.ok ? "Pengajuan dikirim. Silakan tunggu keputusan ADMIN." : "Status membership sudah diperbarui.");
      }
    } catch {
      if (!pengendali.signal.aborted) setPesan("Pengajuan belum dapat diproses. Silakan coba lagi.");
    } finally { if (!pengendali.signal.aborted) setSibuk(false); }
  };
  const label = { NON_MEMBER: "Belum menjadi member", PENDING_APPROVAL: "Menunggu persetujuan ADMIN",
    ACTIVE: "Membership aktif", INACTIVE: "Membership nonaktif — hubungi ADMIN" };
  return <section aria-label="Membership" style={{ padding: 20, border: "1px solid #ddd", borderRadius: 16, maxWidth: 480 }}>
    <h2>Membership</h2>
    <p>{data ? label[data.status] : tokenCustomer ? "Memuat status membership…" : "Silakan login."}</p>
    {data?.status === "ACTIVE" && <p>{data.membership?.memberCode} · Diskon {data.diskonPersen}%</p>}
    {data?.dapatMengajukan && <>
      <p>Ajukan membership untuk diskon 10%. Identitas menggunakan akun Anda; tidak perlu formulir tambahan.</p>
      <button type="button" onClick={() => void ajukan()} disabled={sibuk} style={{ minHeight: 44, padding: "10px 16px" }}>
        {sibuk ? "Mengirim…" : "Ajukan Membership"}
      </button>
    </>}
    <p>Anda tetap dapat menggunakan aplikasi tanpa menjadi member.</p>
    {tokenCustomer && <button type="button" disabled={sibuk} onClick={() => setPutaran(nilai => nilai + 1)}
      style={{ minHeight: 44, padding: "10px 16px" }}>Perbarui status</button>}
    <p role="status" aria-live="polite">{pesan}</p>
  </section>;
}
