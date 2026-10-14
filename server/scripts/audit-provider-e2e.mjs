import 'dotenv/config';
import { mkdir,writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const hasil={tanggal:new Date().toISOString(),jenis:'Midtrans Sandbox Get Status read-only; bukan checkout Customer App',status:'DEFERRED'};
let db;
try{
 assert.equal(process.env.MIDTRANS_IS_PRODUCTION,'false');assert.ok(['localhost','127.0.0.1','[::1]'].includes(new URL(process.env.DATABASE_URL??'').hostname));
 hasil.konfigurasi=Object.fromEntries(['MIDTRANS_MERCHANT_ID','MIDTRANS_SERVER_KEY','MIDTRANS_CLIENT_KEY'].map(k=>[k,!!process.env[k]?.trim()]));assert.ok(Object.values(hasil.konfigurasi).every(Boolean));
 ({default:db}=await import('../dist/lib/prisma.js'));const {gerbangMidtrans,verifikasiSignatureMidtrans}=await import('../dist/lib/midtrans.js');
 const order='BBF7-DP-157-a9a8c1a770be4a92',transaction='10cb3319-9196-463d-8484-715d01485c9f',key='F7-REFUND-48';
 const lokal=await db.transaksiPembayaranBooking.findFirst({where:{referensiProvider:order},select:{id:true,status:true,nominal:true}});
 const refundLokal=await db.permohonanRefundBooking.findFirst({where:{id:48,transaksiAsal:{referensiProvider:order}},select:{status:true,nominal:true}});
 hasil.lokal={transaksiAda:!!lokal,refundAda:!!refundLokal,statusRefund:refundLokal?.status??null};
 const data=await gerbangMidtrans.status(order);
 const identitas=data.order_id===order&&data.transaction_id===transaction&&data.merchant_id===process.env.MIDTRANS_MERCHANT_ID.trim()&&Number(data.gross_amount)===5000&&data.currency==='IDR';
 const signature=typeof data.signature_key==='string'&&verifikasiSignatureMidtrans(data);assert.ok(identitas&&signature);
 const refund=(data.refunds??[]).filter(r=>r.refund_key===key);
 hasil.provider={order_id:order,transaction_id:transaction,status_code:data.status_code,transaction_status:data.transaction_status,payment_type:data.payment_type,nominalAsal:5000,identitasCocok:identitas,signatureValid:signature,refund_key:key,entriRefund:refund.length,nominalRefund:refund.map(r=>Number(r.refund_amount)),bankConfirmed:refund.map(r=>!!r.bank_confirmed_at)};
 hasil.status=refund.some(r=>Number(r.refund_amount)===2000&&r.bank_confirmed_at&&r.refund_method==='online')?'PASS_PROVIDER_FINAL':'DEFERRED';
 hasil.catatan=hasil.status==='PASS_PROVIDER_FINAL'?'Bukti provider final ada; tidak merekonstruksi record lokal yang sudah hilang.':'Tidak ada bukti final Rp2.000 yang cocok; tidak menyimpulkan sukses/gagal atau retry aman dari settlement saja.';
 hasil.refundAtauRetryDikirim=false;hasil.databaseDiubah=false;
}catch(e){hasil.catatan='Get Status/validasi belum berhasil; tidak ada mutasi/refund/retry.';hasil.kategoriKesalahan=e.name;}
finally{if(db)await db.$disconnect();await mkdir('e2e',{recursive:true});await writeFile('e2e/HASIL-PROVIDER.json',JSON.stringify(hasil,null,2));console.log(JSON.stringify(hasil));}
