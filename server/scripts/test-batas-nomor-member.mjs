import assert from "node:assert/strict";
import { batasiNomorMemberPublik, batasiPercobaanPelanggan } from "../dist/middleware/batas-percobaan-pelanggan.middleware.js";

const member = batasiNomorMemberPublik(1), ip = batasiPercobaanPelanggan(2);
let lolos = 0, ditolak = 0;
const res = { setHeader() {}, status(kode) { assert.equal(kode, 429); return this; }, json() { ditolak++; } };
const req = (nomorMember, alamat = "ip-a") => ({ body: { nomorMember }, ip: alamat });
for (let i = 0; i < 8; i++) member(req(undefined), res, () => lolos++);
assert.equal(lolos, 8); assert.equal(ditolak, 0);
member(req(" legacy-123 "), res, () => lolos++);
member(req("LEGACY-123", "ip-b"), res, () => lolos++);
assert.equal(lolos, 9); assert.equal(ditolak, 1);
member(req("18104657"), res, () => lolos++);
assert.equal(lolos, 10);
for (let i = 0; i < 3; i++) ip(req(undefined), res, () => {});
assert.equal(ditolak, 2);
console.log("PASS: Reguler tidak memakai kuota Member; kode ternormalisasi lintas IP tetap dibatasi, kode berbeda terpisah, limiter IP tetap aktif.");
