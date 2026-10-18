// Windows launcher regression: owned fixture only; never stop the user's servers.
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const server=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const repo=path.resolve(server,'..'), launcher=path.join(repo,'scripts/jalankan-barberbarbar.ps1');
const folder=await mkdtemp(path.join(os.tmpdir(),'bb launcher fixture '));
const entry=path.join(folder,'server.js');
const children=[];
const ps=(args,cwd=server)=>{
 const r=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass',...args],{cwd,windowsHide:true,encoding:'utf8',timeout:60000,maxBuffer:2e6});
 assert.equal(r.status,0,(r.stdout??'')+(r.stderr??''));return r.stdout.trim();
};
try {
 await writeFile(entry,`const fs=require('fs'),http=require('http');const s=http.createServer((q,r)=>r.end('{"pesan":"Barbershop Management API berjalan"}'));s.listen(0,'127.0.0.1',()=>fs.writeFileSync(process.env.BB_READY,JSON.stringify({pid:process.pid,port:s.address().port})));`);
 async function start(name,args){
  const ready=path.join(folder,name+'.json');
  const p=spawn(process.execPath,args,{cwd:folder,env:{...process.env,BB_READY:ready},windowsHide:true,stdio:'ignore'});children.push(p);
  for(let i=0;i<100;i++){try{return JSON.parse(await readFile(ready,'utf8'));}catch{}await new Promise(r=>setTimeout(r,100));}
  throw Error('FIXTURE_NOT_READY');
 }
 const relative=await start('relative',['--watch-path='+entry,'--watch-preserve-output','./server.js']);
 const absolute=await start('absolute',[entry]);
 console.log(ps(['-File',path.join(server,'scripts/uji-startup-launcher.ps1'),'-Repo',repo,'-Fixture',entry,'-PidRelatif',String(relative.pid),'-PidAbsolut',String(absolute.pid),'-PortFixture',String(relative.port)]));
 if(process.argv.includes('--live')) {
 for(const[cwd,name]of[[path.resolve(repo,'..'),'Stage 2'],[repo,'Project 3'],[folder,'terminal lain dengan spasi']]){
  const out=ps(['-File',launcher,'-Periksa','-TanpaNgrok'],cwd);
  assert.match(out,/\[AKTIF\] backend PID \d+/);console.log('PASS live Periksa dari '+name);
 }
 assert.match(ps(['-File',launcher,'-Periksa'],repo),/\[AKTIF\] backend PID \d+/);
 console.log('PASS Periksa default; proxy/tunnel opsional tidak dianggap bukti pembayaran siap');
 }
 const dev=await readFile(path.join(server,'scripts/dev.mjs'),'utf8');
 assert.ok(dev.includes('path.join(direktoriServer, "dist", "server.js")'));
 assert.ok(!dev.includes('"dist/server.js"'));
 console.log('PASS watcher baru memakai entrypoint dan watch-path absolut');
} finally {
 // Only processes created by this script, including its fixture watch child.
 for(const child of children){
  await new Promise(r=>setImmediate(r));
  if(child.exitCode!==null)continue;
  const clean=`$p=Get-CimInstance Win32_Process -Filter 'ProcessId=${child.pid}'; if($p -and $p.CommandLine.Contains('${folder.replaceAll("'","''")}')) { & taskkill.exe /PID ${child.pid} /T /F | Out-Null }`;
  spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(clean,'utf16le').toString('base64')],{windowsHide:true,stdio:'ignore'});
  await new Promise(r=>{if(child.exitCode!==null)return r();child.once('exit',r);});
 }
 assert.equal(path.dirname(folder),os.tmpdir());
 assert.ok(path.basename(folder).startsWith('bb launcher fixture '));
 await rm(folder,{recursive:true,force:true});
}
