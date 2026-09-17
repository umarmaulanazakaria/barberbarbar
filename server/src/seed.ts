import "dotenv/config";
import bcrypt from "bcrypt";
import basisData from "./lib/prisma.js";

const jalankan = async () => {
  const adminHash = await bcrypt.hash("admin123", 10);
  const staffHash = await bcrypt.hash("staff123", 10);
  await basisData.pengguna.upsert({
    where: { email: "admin@barber.com" },
    update: { role: "ADMIN", name: "Admin Barber", passwordHash: adminHash },
    create: {
      name: "Admin Barber",
      email: "admin@barber.com",
      passwordHash: adminHash,
      role: "ADMIN",
    },
  });
  await basisData.pengguna.upsert({
    where: { email: "staff@barber.com" },
    update: { role: "STAFF", name: "Staff Barber", passwordHash: staffHash },
    create: {
      name: "Staff Barber",
      email: "staff@barber.com",
      passwordHash: staffHash,
      role: "STAFF",
    },
  });

  const barberData = [
    ["Doni", "081210000001"],
    ["Ricky", "081210000002"],
    ["Arman", "081210000003"],
    ["Rizky", "081210000004"],
  ] as const;
  for (const [nama, nomorTelepon] of barberData)
    await basisData.barber.upsert({
      where: { nomorTelepon },
      update: { nama, aktif: true },
      create: { nama, nomorTelepon, aktif: true },
    });

  const layananData = [
    ["Haircut", 30, 35000],
    ["Hair Wash", 15, 20000],
    ["Haircut + Wash", 45, 50000],
    ["Beard Trim", 20, 25000],
    ["Hair Styling", 20, 30000],
  ] as const;
  for (const [nama, durasiMenit, harga] of layananData) {
    const ada = await basisData.layanan.findFirst({ where: { nama } });
    if (ada)
      await basisData.layanan.update({
        where: { id: ada.id },
        data: { durasiMenit, harga, aktif: true },
      });
    else await basisData.layanan.create({ data: { nama, durasiMenit, harga } });
  }

  const pelangganData = [
    ["Andi Pratama", "081234567800", "Jakarta"],
    ["Dinda Putri", "081234567801", "Tangerang"],
    ["Budi Santoso", "081234567802", "Jakarta"],
    ["Mega Putri", "081234567803", "Depok"],
    ["Fajar Nugroho", "081234567804", "Bekasi"],
    ["Yahya", "081234567805", "Jakarta"],
  ] as const;
  for (const [nama, nomorTelepon, alamat] of pelangganData)
    await basisData.pelanggan.upsert({
      where: { nomorTelepon },
      update: { nama, alamat },
      create: { nama, nomorTelepon, alamat },
    });

  const andi = await basisData.pelanggan.findUnique({
    where: { nomorTelepon: "081234567800" },
  });
  if (andi)
    await basisData.membership.upsert({
      where: { pelangganId: andi.id },
      update: { memberCode: "MEM-001", discountPercent: 10, isActive: true },
      create: {
        pelangganId: andi.id,
        memberCode: "MEM-001",
        discountPercent: 10,
      },
    });

  const admin = await basisData.pengguna.findUnique({
    where: { email: "admin@barber.com" },
  });
  const doni = await basisData.barber.findUnique({
    where: { nomorTelepon: "081210000001" },
  });
  const ricky = await basisData.barber.findUnique({
    where: { nomorTelepon: "081210000002" },
  });
  const haircut = await basisData.layanan.findFirst({
    where: { nama: "Haircut" },
  });
  const wash = await basisData.layanan.findFirst({
    where: { nama: "Hair Wash" },
  });
  const dinda = await basisData.pelanggan.findUnique({
    where: { nomorTelepon: "081234567801" },
  });
  const budi = await basisData.pelanggan.findUnique({
    where: { nomorTelepon: "081234567802" },
  });

  if (admin && doni && ricky && haircut && wash && andi && dinda && budi) {
    const examples = [
      {
        nomorPesanan: "DEMO-1001",
        pelangganId: dinda.id,
        barberId: ricky.id,
        status: "WAITING" as const,
        statusPembayaran: "UNPAID" as const,
        service: haircut,
        total: haircut.harga,
      },
      {
        nomorPesanan: "DEMO-1002",
        pelangganId: budi.id,
        barberId: doni.id,
        status: "IN_SERVICE" as const,
        statusPembayaran: "UNPAID" as const,
        service: wash,
        total: wash.harga,
      },
      {
        nomorPesanan: "DEMO-1003",
        pelangganId: andi.id,
        barberId: doni.id,
        status: "COMPLETED" as const,
        statusPembayaran: "UNPAID" as const,
        service: haircut,
        total: Math.floor(haircut.harga * 0.9),
      },
    ];
    for (const e of examples) {
      const ada = await basisData.pesanan.findUnique({
        where: { nomorPesanan: e.nomorPesanan },
      });
      if (!ada)
        await basisData.pesanan.create({
          data: {
            nomorPesanan: e.nomorPesanan,
            pelangganId: e.pelangganId,
            barberId: e.barberId,
            status: e.status,
            statusPembayaran: e.statusPembayaran,
            subtotal: e.service.harga,
            discountPercent: e.pelangganId === andi.id ? 10 : 0,
            diskon:
              e.pelangganId === andi.id ? Math.floor(e.service.harga * 0.1) : 0,
            total: e.total,
            items: {
              create: {
                layananId: e.service.id,
                namaLayanan: e.service.nama,
                durasiMenit: e.service.durasiMenit,
                harga: e.service.harga,
                qty: 1,
                subtotal: e.service.harga,
              },
            },
            riwayatStatus: {
              create: { status: e.status, penggunaId: admin.id },
            },
          },
        });
    }
    let paid = await basisData.pesanan.findUnique({
      where: { nomorPesanan: "DEMO-1004" },
    });
    if (!paid)
      paid = await basisData.pesanan.create({
        data: {
          nomorPesanan: "DEMO-1004",
          pelangganId: dinda.id,
          barberId: ricky.id,
          status: "COMPLETED",
          statusPembayaran: "PAID",
          subtotal: haircut.harga,
          total: haircut.harga,
          items: {
            create: {
              layananId: haircut.id,
              namaLayanan: haircut.nama,
              durasiMenit: haircut.durasiMenit,
              harga: haircut.harga,
              qty: 1,
              subtotal: haircut.harga,
            },
          },
          riwayatStatus: {
            create: { status: "COMPLETED", penggunaId: admin.id },
          },
        },
      });
    const invoice = await basisData.pembayaran.findUnique({
      where: { pesananId: paid.id },
    });
    if (!invoice)
      await basisData.pembayaran.create({
        data: {
          pesananId: paid.id,
          nomorInvoice: "INV-DEMO-1004",
          metode: "QRIS",
          jumlahDiterima: paid.total,
          kembalian: 0,
        },
      });
  }

  console.log("Seed selesai. Login ADMIN: admin@barber.com / admin123");
};

jalankan().finally(async () => {
  await basisData.$disconnect();
});
