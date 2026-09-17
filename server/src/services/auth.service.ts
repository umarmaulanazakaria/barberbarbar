import "dotenv/config";

import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

import basisData from "../lib/prisma.js";

const jwtSecret = process.env.JWT_SECRET;

if (!jwtSecret) {
  throw new Error("JWT_SECRET belum diatur");
}

export const loginPengguna = async (dataPengguna: {
  email: string;
  password: string;
}) => {
  const penggunaDitemukan = await basisData.pengguna.findUnique({
    where: {
      email: dataPengguna.email,
    },
    include: {
      barber: true,
    },
  });

  if (!penggunaDitemukan) {
    return null;
  }

  if (
    penggunaDitemukan.role === "STAFF" &&
    (!penggunaDitemukan.barber || !penggunaDitemukan.barber.aktif)
  ) {
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

export const ambilPenggunaBerdasarkanId = async (id: number) => {
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
