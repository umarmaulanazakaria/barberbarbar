import basisData from "./lib/prisma.js";

async function cekKoneksi() {
    await basisData.$connect();
    console.log("Koneksi ke basis data berhasil!");
    await basisData.$disconnect();
}

cekKoneksi()