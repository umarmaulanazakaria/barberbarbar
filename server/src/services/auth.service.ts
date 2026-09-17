import "dotenv/config";

import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

import basisData from "../lib/prisma.js";

const jwtSecret = process.env.JWT_SECRET;

if (!jwtSecret) {
  throw new Error("JWT_SECRET belum diatur");
}

export const buatPenggunaBaru = async (dataPengguna: {
  name: string;
  email: string;
  password: string;
}) => {
  const penggunaDenganEmailYangSama =
    await basisData.pengguna.findUnique({
      where: {
        email: dataPengguna.email,
      },
    });

  if (penggunaDenganEmailYangSama) {
    return null;
  }

  const passwordHash = await bcrypt.hash(
    dataPengguna.password,
    10,
  );

  const penggunaBaru = await basisData.pengguna.create({
    data: {
      name: dataPengguna.name,
      email: dataPengguna.email,
      passwordHash,
    },
  });

  return penggunaBaru;
};

export const loginPengguna = async (dataPengguna: {
  email: string;
  password: string;
}) => {
  const penggunaDitemukan =
    await basisData.pengguna.findUnique({
      where: {
        email: dataPengguna.email,
      },
    });

  if (!penggunaDitemukan) {
    return null;
  }

  const passwordCocok = await bcrypt.compare(
    dataPengguna.password,
    penggunaDitemukan.passwordHash,
  );

  if (!passwordCocok) {
    return null;
  }

  const token = jwt.sign(
    {
      id: penggunaDitemukan.id,
      role: penggunaDitemukan.role,
    },
    jwtSecret,
    {
      expiresIn: "1d",
    },
  );

  return {
    pengguna: penggunaDitemukan,
    token,
  };
};

export const ambilPenggunaBerdasarkanId = async (
  id: number,
) => {
  return basisData.pengguna.findUnique({
    where: {
      id,
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
    },
  });
};