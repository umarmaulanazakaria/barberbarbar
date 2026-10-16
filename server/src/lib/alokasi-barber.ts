export type SlotBarber={mulaiPada:Date;selesaiPada:Date;barberId:number|null};
const bentrok=(a:SlotBarber,b:SlotBarber)=>a.mulaiPada<b.selesaiPada&&a.selesaiPada>b.mulaiPada;
// Validasi adanya alokasi barber utuh, tanpa menetapkan pilihan barber customer.
// Kapasitas agregat saja dapat salah jika celah barber bergantian selama satu layanan.
export function alokasiBarberUtuh(semua:SlotBarber[],calon:SlotBarber,aktif:number[]) {
  const komponen=[calon],sisa=[...semua];
  for(let ulang=true;ulang;){ulang=false;for(let i=sisa.length-1;i>=0;i--){const slot=sisa[i]!;if(komponen.some(b=>bentrok(b,slot))){komponen.push(slot);sisa.splice(i,1);ulang=true;}}}
  const kalender=new Map(aktif.map(id=>[id,[] as SlotBarber[]])),bebas:SlotBarber[]=[];
  for(const b of komponen){if(b.barberId===null){bebas.push(b);continue;}const k=kalender.get(b.barberId);if(!k||k.some(s=>bentrok(s,b)))return false;k.push(b);}
  let langkah=0;
  const cari=(belum:SlotBarber[]):boolean=>{
    if(!belum.length)return true;if(++langkah>10000)return false;
    let pilihan:number[]=[],indeks=-1;
    for(let i=0;i<belum.length;i++){const kandidat=aktif.filter(id=>!kalender.get(id)!.some(s=>bentrok(s,belum[i]!)));if(!kandidat.length)return false;
      if(indeks<0||kandidat.length<pilihan.length){pilihan=kandidat;indeks=i;}}
    const b=belum[indeks]!,lanjut=belum.filter((_,i)=>i!==indeks),sudah=new Set<string>();
    for(const id of pilihan){const k=kalender.get(id)!,pola=k.map(s=>`${s.mulaiPada.getTime()}-${s.selesaiPada.getTime()}`).sort().join(',');if(sudah.has(pola))continue;sudah.add(pola);k.push(b);if(cari(lanjut))return true;k.pop();}
    return false;
  };
  return cari(bebas);
}
