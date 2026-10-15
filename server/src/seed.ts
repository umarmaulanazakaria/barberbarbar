import "dotenv/config";

import bcrypt from "bcrypt";

import basisData from "./lib/prisma.js";

const jalankan = async () => {
  const koneksi = new URL(process.env.DATABASE_URL ?? "");
  const kataSandiAdmin = process.env.DEMO_ADMIN_PASSWORD ?? "";
  const kataSandiStaff = process.env.DEMO_STAFF_PASSWORD ?? "";
  if (process.env.IZINKAN_SEED_DEMO !== "true" ||
      !["localhost", "127.0.0.1", "[::1]"].includes(koneksi.hostname) ||
      !/^bb_demo_[a-z0-9_]+$/.test(koneksi.pathname.slice(1)) ||
      [kataSandiAdmin, kataSandiStaff].some(s => Buffer.byteLength(s) < 12 || Buffer.byteLength(s) > 72)) {
    throw new Error("Seed hanya untuk database lokal bb_demo_* dengan izin dan dua password privat 12–72 byte.");
  }
  const adminHash = await bcrypt.hash(kataSandiAdmin, 12);

  await basisData.pengguna.upsert({
    where: {
      email: "admin@demo.example.invalid",
    },

    update: {},

    create: {
      name: "Operator Demo",
      email: "admin@demo.example.invalid",
      passwordHash: adminHash,
      role: "ADMIN",
    },
  });

  const barberData = [
    ["Barber Demo 01", "080000001201"],
    ["Barber Demo 02", "080000001202"],
    ["Barber Demo 03", "080000001203"],
    ["Barber Demo 04", "080000001204"],
  ] as const;

  for (const [nama, nomorTelepon] of barberData) {
    await basisData.barber.upsert({
      where: {
        nomorTelepon,
      },

      update: {
        nama,
        aktif: true,
      },

      create: {
        nama,
        nomorTelepon,
        aktif: true,
      },
    });
  }

  const doniStaff = await basisData.barber.findUnique({
    where: {
      nomorTelepon: "080000001201",
    },
  });

  if (doniStaff) {
    const staffHash = await bcrypt.hash(kataSandiStaff, 12);

    await basisData.pengguna.upsert({
      where: {
        email: "staff@demo.example.invalid",
      },

      update: {},

      create: {
        name: doniStaff.nama,
        email: "staff@demo.example.invalid",
        passwordHash: staffHash,
        role: "STAFF",
        barberId: doniStaff.id,
      },
    });
  }

  const layananData = [
    ["Haircut", 30, 35000],
    ["Hair Wash", 15, 20000],
    ["Haircut + Wash", 45, 50000],
    ["Beard Trim", 20, 25000],
    ["Hair Styling", 20, 30000],
  ] as const;

  for (const [nama, durasiMenit, harga] of layananData) {
    const ada = await basisData.layanan.findFirst({
      where: {
        nama,
      },
    });

    if (ada) {
      await basisData.layanan.update({
        where: {
          id: ada.id,
        },

        data: {
          durasiMenit,
          harga,
          aktif: true,
        },
      });
    } else {
      await basisData.layanan.create({
        data: {
          nama,
          durasiMenit,
          harga,
        },
      });
    }
  }

  const pelangganData = [
    ["Customer Demo 01", "080000000100", "Jakarta"],

    ["Customer Demo 02", "080000000101", "Tangerang"],

    ["Customer Demo 03", "080000000102", "Jakarta"],

    ["Customer Demo 04", "080000000103", "Depok"],

    ["Customer Demo 05", "080000000104", "Bekasi"],

    ["Customer Demo 06", "080000000105", "Jakarta"],
  ] as const;

  for (const [nama, nomorTelepon, alamat] of pelangganData) {
    await basisData.pelanggan.upsert({
      where: {
        nomorTelepon,
      },

      update: {
        nama,
        alamat,
      },

      create: {
        nama,
        nomorTelepon,
        alamat,
      },
    });
  }

  const andi = await basisData.pelanggan.findUnique({
    where: {
      nomorTelepon: "080000000100",
    },
  });

  if (andi) {
    await basisData.membership.upsert({
      where: {
        pelangganId: andi.id,
      },

      update: {
        memberCode: "MEM-001",
        discountPercent: 10,
        isActive: true,
      },

      create: {
        pelangganId: andi.id,
        memberCode: "MEM-001",
        discountPercent: 10,
      },
    });
  }

  const admin = await basisData.pengguna.findUnique({
    where: {
      email: "admin@demo.example.invalid",
    },
  });

  const doni = await basisData.barber.findUnique({
    where: {
      nomorTelepon: "080000001201",
    },
  });

  const ricky = await basisData.barber.findUnique({
    where: {
      nomorTelepon: "080000001202",
    },
  });

  const haircut = await basisData.layanan.findFirst({
    where: {
      nama: "Haircut",
    },
  });

  const wash = await basisData.layanan.findFirst({
    where: {
      nama: "Hair Wash",
    },
  });

  const dinda = await basisData.pelanggan.findUnique({
    where: {
      nomorTelepon: "080000000101",
    },
  });

  const budi = await basisData.pelanggan.findUnique({
    where: {
      nomorTelepon: "080000000102",
    },
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

    for (const example of examples) {
      const ada = await basisData.pesanan.findUnique({
        where: {
          nomorPesanan: example.nomorPesanan,
        },
      });

      if (!ada) {
        await basisData.pesanan.create({
          data: {
            nomorPesanan: example.nomorPesanan,

            pelangganId: example.pelangganId,

            barberId: example.barberId,

            status: example.status,

            statusPembayaran: example.statusPembayaran,

            subtotal: example.service.harga,

            discountPercent: example.pelangganId === andi.id ? 10 : 0,

            diskon:
              example.pelangganId === andi.id
                ? Math.floor(example.service.harga * 0.1)
                : 0,

            total: example.total,

            items: {
              create: {
                layananId: example.service.id,

                namaLayanan: example.service.nama,

                durasiMenit: example.service.durasiMenit,

                harga: example.service.harga,

                qty: 1,

                subtotal: example.service.harga,
              },
            },

            riwayatStatus: {
              create: {
                status: example.status,

                penggunaId: admin.id,
              },
            },
          },
        });
      }
    }

    let paid = await basisData.pesanan.findUnique({
      where: {
        nomorPesanan: "DEMO-1004",
      },
    });

    if (!paid) {
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
            create: {
              status: "COMPLETED",

              penggunaId: admin.id,
            },
          },
        },
      });
    }

    const invoice = await basisData.pembayaran.findUnique({
      where: {
        pesananId: paid.id,
      },
    });

    if (!invoice) {
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
  }

  console.log("Seed demo selesai; credential tidak ditampilkan. Akun existing tidak diubah.");
};

jalankan().catch(() => {
  console.error("Seed demo gagal; detail koneksi dan credential tidak ditampilkan.");
  process.exitCode = 1;
}).finally(async () => {
  await basisData.$disconnect();
});
