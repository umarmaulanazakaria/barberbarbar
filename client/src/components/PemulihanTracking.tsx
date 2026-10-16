import {useState} from "react";
import {useAuth} from "../context/AuthContext";
import {api,pesanError} from "../lib/api";
import {Button,Card,Input} from "./ui";
export default function PemulihanTracking({id,tamu}:{id:number;tamu:boolean}){
 const{user}=useAuth(),[buka,aturBuka]=useState(false),[verifikasi,aturVerifikasi]=useState(false),[alasan,aturAlasan]=useState(""),[kode,aturKode]=useState(""),[error,aturError]=useState(""),[sibuk,aturSibuk]=useState(false);
 if(user?.role!=="ADMIN"||!tamu)return null;
 return <Card className="space-y-3 p-4"><h2 className="font-bold">Pemulihan kode tracking</h2><p className="text-sm text-slate-500">Verifikasi identitas dengan bukti kunjungan/pembayaran. Nama atau nomor HP saja tidak cukup. Penerbitan pengganti mencabut kode, sesi, dan akses lama booking ini.</p>
 {!buka?<Button variant="secondary" onClick={()=>aturBuka(true)}>Pulihkan kode tracking</Button>:<><label className="flex gap-2 text-sm"><input type="checkbox" checked={verifikasi} onChange={e=>aturVerifikasi(e.target.checked)}/>Identitas pemilik telah saya verifikasi dengan bukti yang sesuai</label><Input aria-label="Alasan pemulihan kode" value={alasan} maxLength={300} onChange={e=>aturAlasan(e.target.value)} placeholder="Alasan dan metode verifikasi (tanpa kode rahasia)"/>
 <Button disabled={!verifikasi||alasan.trim().length<20||sibuk||!!kode} onClick={async()=>{aturSibuk(true);aturError("");try{const r=await api.post<{kode:string}>(`/bookings/${id}/tracking/reissue`,{identitasDiverifikasi:true,alasan});aturKode(r.data.kode)}catch(e){aturError(pesanError(e))}finally{aturSibuk(false)}}}>Terbitkan kode pengganti</Button></>}
 {kode&&<><p className="break-all rounded bg-slate-50 p-3 font-mono" data-testid="kode-pengganti">{kode}</p><p className="text-xs text-slate-500">Berikan hanya kepada pemilik yang sudah diverifikasi.</p><Button variant="secondary" onClick={()=>void navigator.clipboard.writeText(kode).catch(()=>aturError("Pilih kode untuk menyalinnya secara manual."))}>Salin kode pengganti</Button><Button variant="secondary" onClick={()=>{aturKode("");aturBuka(false);aturVerifikasi(false);aturAlasan("")}}>Tutup kode</Button></>}{error&&<p role="alert" className="text-sm text-red-600">{error}</p>}</Card>;
}
