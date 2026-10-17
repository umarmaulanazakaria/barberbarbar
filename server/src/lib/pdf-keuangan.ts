// PDF tekstual tanpa dependency baru. Offset xref dihitung dari byte, bukan panjang karakter.
export function pdfKeuangan(baris: string[]): Buffer {
  const lebar = 76;
  const teks = baris.flatMap(b => {
    const kata = b.replace(/[\r\n\t]/g, " ").split(/\s+/), hasil: string[] = [];
    let aktif = "";
    for (const k of kata) { if ((aktif + " " + k).length > lebar) { hasil.push(aktif); aktif = ""; } aktif += (aktif ? " " : "") + k; }
    hasil.push(aktif); return hasil;
  });
  const halaman: string[][] = [];
  for (let i = 0; i < teks.length; i += 48) halaman.push(teks.slice(i, i + 48));
  if (!halaman.length) halaman.push([""]);
  const objek: string[] = ["<< /Type /Catalog /Pages 2 0 R >>", "", "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>"];
  const referensi: string[] = [];
  const aman = (t: string) => t.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^\x20-\x7e]/g, "?").replace(/([\\()])/g, "\\$1");
  for (const [i, h] of halaman.entries()) {
    const id = 4 + i * 2, stream = `BT /F1 11 Tf 48 790 Td 15 TL ${h.map(t => `(${aman(t)}) Tj T*`).join("\n")} ET`;
    referensi.push(`${id} 0 R`);
    objek.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${id + 1} 0 R >>`,
      `<< /Length ${Buffer.byteLength(stream, "ascii")} >>\nstream\n${stream}\nendstream`);
  }
  objek[1] = `<< /Type /Pages /Count ${halaman.length} /Kids [${referensi.join(" ")}] >>`;
  let hasil = "%PDF-1.4\n", offset = [0];
  for (const [i, o] of objek.entries()) { offset.push(Buffer.byteLength(hasil, "ascii")); hasil += `${i + 1} 0 obj\n${o}\nendobj\n`; }
  const xref = Buffer.byteLength(hasil, "ascii");
  hasil += `xref\n0 ${objek.length + 1}\n0000000000 65535 f \n${offset.slice(1).map(v => `${String(v).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size ${objek.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(hasil, "ascii");
}
