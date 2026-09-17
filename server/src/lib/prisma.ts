import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";
const stringKoneksi = process.env.DATABASE_URL;
if (!stringKoneksi) throw new Error("DATABASE_URL belum diatur");
const adapterPostgresSQL = new PrismaPg({ connectionString: stringKoneksi });
const basisData = new PrismaClient({ adapter: adapterPostgresSQL });
export default basisData;
