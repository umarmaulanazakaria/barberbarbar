import {readFile,writeFile} from 'node:fs/promises';
const scenarios=JSON.parse(await readFile('e2e/CENARIOS.json','utf8')),reg=JSON.parse(await readFile('e2e/HASIL-REGRESI.json','utf8')).results;
const browser=JSON.parse(await readFile('e2e/HASIL-BROWSER.json','utf8')).results;
const rows=[];
for(const [i,s]of scenarios.entries()){
 let type='E',suite='',status='DEFERRED',note='Perangkat Android/AVD belum tersedia; lihat README-PENGUJIAN.md. Bukan PASS dari build/export.',project='3/4/5',steps='Ikuti skenario fisik pada README-PENGUJIAN.md';
 const set=(t,id,n='')=>{type=t;suite=id;status=reg.find(r=>r.id===id)?.status??'DEFERRED';note=n;steps=`Jalankan suite ${id}, fixture lokal terarah; skenario: ${s.skenario}`;};
 const b=(id,n='')=>{type='D';suite=id;status=browser.find(r=>r.id===id)?.status??'DEFERRED';note=n;project='3 Web + SDK4/5';steps=`Jalankan client/scripts/test-e2e-browser.mjs; checkpoint ${id}`;};
 const text=s.skenario.toLowerCase();
 switch(s.bagian){
 case 7:
  if(/registrasi|pengaitan|approval|login menggunakan|password salah|duplicate|token invalid|edit profil/.test(text))set('C','test-fondasi-pelanggan','HTTP aktual; tidak membuktikan UI Android.');
  if(/logout|pergantian akun/.test(text))set('B','customer-integration','Sesi/HTTP aktual dengan SecureStore adapter, bukan native storage.');
  if(/session expired/.test(text))set('G','test-realtime','JWT expired dan koneksi aktif SDK, bukan gesture/native UI.');
  if(/token sekali|30 menit|token tidak valid|token kedaluwarsa/.test(text))set('G','test-reset-password-pelanggan');
  if(/ubah password|perubahan email|nomor telepon dengan verifikasi/.test(text)){type='C';note='Gap produk/API: current-password change dan perubahan identitas tidak tersedia; PATCH me strict nama/alamat. Reset token terpisah sudah diuji. Perlu PRD/keputusan F14.';}
  if(/email aktual|smtp|provider email|credential|mengarang|hardcode|instalasi/.test(text)){type='F';note='Delivery email belum diimplementasikan; tidak ada SMTP/provider baru. Fondasi reset bukan forgot-password E2E.';}
  break;
 case 8:set('C',/non_member|snapshot|dp|10%/.test(text)?'test-booking-f4':'test-membership-f3','API actual; Web approve dan customer realtime juga dibuktikan WEB-MEMBER, UI Android belum.');break;
 case 9:
  if(/membuka project|pilihan layanan tetap|pindah langkah|keyboard|scroll daftar|login jika/.test(text))break;
  if(/layanan dan barber publik/.test(text))set('C','test-api-publik','Endpoint tanpa JWT; hanya data aktif dan field publik. UI Android belum.');
  else if(/pencarian nama|case-insensitive|hasil kosong|loading|error\/retry|memilih barber id|barber siapa saja|menutup modal|reschedule menggunakan/.test(text))set('B','customer-dropdown','Komponen TSX aktual dengan adapter hook/host; bukan device UI. Payload ID/null juga customer-integration.');
  else if(/muncul pada project 3/.test(text))b('WEB-BOOKING');
  else if(/muncul pada project 4|socket|menerima status/.test(text))set('B','staff-integration','Layanan/API/SDK actual; bukan layar Android.');
  else if(/customer self|barber specific|capacity|concurrent|pending booking/.test(text))set('G','test-booking-f4');
  else if(/senin/.test(text))set('C','reschedule-boundary','Tujuh hari WIB diuji HTTP dengan fixture; juga tiga boundary reschedule.');
  else set('C','test-booking-f4','Validasi HTTP/payload; interaksi layar Android belum diuji.');break;
 case 10:
  if(/snap\/redirect|kembali dari webbrowser|foreground\/refetch setelah checkout/.test(text)){type='F';note='Checkout native Customer App belum dapat dijalankan tanpa Android; Sandbox config/GetStatus valid bukan bukti checkout.';}
  else set(/signature|mismatch|duplicate|out-of-order|race|tampering/.test(text)?'G':'C','test-realtime','Regresi Midtrans lengkap dipanggil suite ini; provider MOCK, bukan Sandbox E2E. deny/cancel/failure/expire diuji eksplisit.');break;
 case 11:
  if(/consent pending tidak memiliki timeout/.test(text)){type='B';note='Tidak ada deadline proposal pada source; uji dedicated timeout proposal belum dijalankan, tidak ditandai PASS.';}
  else if(/check-in lebih|checked_in tidak boleh/.test(text))set('G','test-scheduler-booking','Scanner/process runtime test; DP provider MOCK.');
  else if(/walk-in/.test(text))set('C','staff-integration','API Mobile actual + guardDB/assignment; bukan tap Android.');
  else set('C','test-realtime','Lifecycle HTTP/SDK actual dan sinyal; bukti DP MOCK. Web interaksi WEB-LIFECYCLE, Android belum.');break;
 case 12:
  if(/pelunasan online midtrans/.test(text)){type='F';note='Sandbox E2E dari Customer App DEFERRED tanpa Android; kontrak online/provider MOCK PASS terpisah.';}
  else if(/melalui kasir web|tambah layanan|tambah qty|kurangi qty|hapus layanan/.test(text))b(/kasir/.test(text)?'WEB-INVOICE':'WEB-ITEMS','Provider DP pada browser suite MOCK.');
  else if(/timeline.*ketiga aplikasi/.test(text))set('B','test-realtime','SDK/REST ketiga client; UI Android tidak diklaim.');
  else set('C','test-payment-f6','Ledger/invoice/bridge HTTP; provider sink fixture dan MOCK F7 terpisah.');break;
 case 13:set('G','test-scheduler-booking','Clock fixture/DB, runtime restart/durable deadline; bukan helper preview scheduler-off.');break;
 case 14:
  if(/^(status lokal|status provider|bukti transaksi\/refund|apakah)/.test(text)){type='F';suite='HASIL-PROVIDER.json';note='Get Status resmi read-only: settlement, refunds kosong; lokal sumber hilang. Tidak retry/refund/rekonstruksi.';}
  else if(/barber dropdown/.test(text))set('B','customer-dropdown','Reused controlled component; reschedule tap Android belum.');
  else if(/minimal 1 jam/.test(text))set('G','reschedule-boundary','BUG-01: <1jam dan past 200 sebelum fix, 409 sesudah; tepat1jam200.');
  else if(/ubah service\/qty|total naik/.test(text)){type='C';note='Perubahan layanan reschedule dapat diterima backend, UI Customer tidak menyediakan edit item reschedule. Dedicated kenaikan reschedule belum dibuktikan; F14.';}
  else set('C','test-realtime','Regresi Midtrans/refund MOCK: cancel early/late, reschedule paid turun/refunddifference, retry/idempotency. Tidak berarti refund historis berhasil.');break;
 case 15:set(/duplicate|out-of-order|expired|berbeda|operator/.test(text)?'G':'B','test-realtime','Socket SDK actual + controller/REST dan native adapters; browser WEB-BOOKING/LIFECYCLE/INVOICE. UI Android DEFERRED.');break;
 case 16:
  if(s.kelompok.includes('PROJECT 3')){const id=/login/i.test(text)?'WEB-LOGIN':/dashboard/i.test(text)?'WEB-LOGIN':/konfirmasi|booking/i.test(text)?'WEB-BOOKING':/check-in/i.test(text)?'WEB-LIFECYCLE':/membership/i.test(text)?'WEB-MEMBER':/refund/i.test(text)?'WEB-REFUND':/responsif/i.test(text)?'WEB-RESPONSIVE':'WEB-INVOICE';b(id,'Edge headless existing; bukan seluruh browser/perangkat.');}
  break;
 case 17:
  if(/dependency|advisory|patch compatible|breaking-change|eksploit|f14|runtime|development/.test(text)){type='G';suite='HASIL-DEPENDENCY.json';note='Audit npm full/omitDev dilaporkan terpisah. Advisory tersisa perlu triage F14; tidak berarti bebas risiko.';}
  else set('G',/sensitive data logging/.test(text)?'log-safety':/rate limiting|input validation/.test(text)?'test-fondasi-pelanggan':'test-realtime','Security HTTP/SDK actual; signature/provider suite MOCK. Secret tidak dicetak/masuk ZIP. Log middleware memakai sentinel sintetis.');break;
 }
 if(/jangan|laporkan|cantumkan|siapkan|selesaikan automated|minta persetujuan|software\/package|dampak terhadap|versi\.$|alasan penggunaan|perintah pemasangan/.test(text)){type='A';status='NOT APPLICABLE';note='Instruksi pelaksanaan, bukan assertion fitur; dipenuhi melalui audit/README/persetujuan, tidak dihitung sebagai fitur PASS.';}
 const actual=status==='PASS'?`Expected terpenuhi pada jenis ${type}; bukti ${suite}. ${note}`:status==='FAIL'?`Suite ${suite} gagal; lihat hasil terlampir.`:note;
 rows.push({id:`REQ-${s.bagian}-${String(i+1).padStart(3,'0')}`,fitur:s.skenario,project,prasyarat:type==='E'||type==='F'?'Android/ExpoGo dan konfigurasi provider sesuai skenario':'DB localhost; fixture UUID; backup terverifikasi; suite serial',langkah:steps,expected:s.skenario,actual,jenis:type,status,bukti:suite||'README-PENGUJIAN.md',catatan:note});
}
const extra=[['BUG-01','Guard reschedule tepat1jam/<1jam/past','G','reschedule-boundary'],['BUG-02','Alasan penolakan tampil detail customer','B','customer-detail'],['BUG-03','Log error tidak mencetak body/request/credential mentah','G','log-safety']];
for(const [id,fitur,jenis,suite]of extra)rows.push({id,fitur,project:'3/5',prasyarat:'Fixture terisolasi',langkah:`Jalankan ${suite}`,expected:'Regresi awal gagal, setelah fix expected terpenuhi',actual:'Reproduksi dan perbaikan dijelaskan audit; lihat artifact',jenis,status:reg.find(r=>r.id===suite)?.status??'DEFERRED',bukti:suite,catatan:'Native UI tetap DEFERRED untuk BUG-02'});
await writeFile('e2e/MATRIKS-E2E.json',JSON.stringify(rows,null,2));
const safe=x=>String(x??'').replaceAll('|','/').replaceAll('\n',' ');
const headers=['ID','Fitur','Project','Prasyarat','Langkah','Expected','Actual','Jenis','Status','Bukti/catatan'];
const lines=['# Matriks pengujian end-to-end','', 'Jenis: A unit/source audit; B integration/controller adapter; C HTTP/API E2E; D browser UI; E Android device UI; F provider Sandbox E2E; G security/concurrency. PASS berlaku hanya pada jenis bukti di baris tersebut. MOCK bukan Sandbox nyata; adapter bukan native UI.','', '|'+headers.join('|')+'|','|'+headers.map(()=>'---').join('|')+'|',...rows.map(r=>'|'+[r.id,r.fitur,r.project,r.prasyarat,r.langkah,r.expected,r.actual,r.jenis,r.status,r.bukti].map(safe).join('|')+'|')];
await writeFile('e2e/MATRIKS-E2E.md',lines.join('\n')+'\n');console.log(JSON.stringify({rows:rows.length,status:rows.reduce((d,r)=>(d[r.status]=(d[r.status]??0)+1,d),{})}));
