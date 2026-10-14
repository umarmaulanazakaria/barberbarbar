import {spawn} from 'node:child_process';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
const npm=path.join(path.dirname(process.execPath),'node_modules/npm/bin/npm-cli.js'),results=[];
for(const [project,cwd]of[['backend',process.cwd()],['web',path.resolve('../client')],['staff',path.resolve('../../barberbarbar-mobile')],['customer',path.resolve('../../barberbarbar-customer')]]){
 const pkg=JSON.parse(await readFile(path.join(cwd,'package.json'),'utf8')),row={project,paketLangsung:pkg.dependencies,paketDevelopment:pkg.devDependencies};
 for(const omit of [false,true]){
  let out='';const p=spawn(process.execPath,[npm,'audit','--json',...(omit?['--omit=dev']:[])],{cwd,windowsHide:true,stdio:['ignore','pipe','pipe']});p.stdout.on('data',b=>out+=b);p.stderr.on('data',()=>{});await new Promise(r=>p.on('close',r));
  try{const data=JSON.parse(out);row[omit?'omitDev':'lengkap']={jumlah:data.metadata?.vulnerabilities,akar:Object.entries(data.vulnerabilities??{}).filter(([,v])=>v.via.some(x=>typeof x==='object')).map(([name,v])=>({name,severity:v.severity,direct:v.isDirect,range:v.range,fixAvailable:v.fixAvailable,via:v.via.filter(x=>typeof x==='object').map(x=>({title:x.title,url:x.url,range:x.range})),effects:v.effects}))};}
  catch{row[omit?'omitDev':'lengkap']={error:'Audit registry belum tersedia; tidak menyimpulkan paket aman'};}
 }
 results.push(row);console.log(JSON.stringify({project,full:row.lengkap.jumlah,omitDev:row.omitDev.jumlah}));
}
await mkdir('e2e',{recursive:true});await writeFile('e2e/HASIL-DEPENDENCY.json',JSON.stringify({tanggal:new Date().toISOString(),catatan:'omitDev adalah klasifikasi npm; tooling Expo dapat tercantum sebagai dependencies produksi, bukan bukti seluruh advisory dapat dicapai bundle mobile',results},null,2));
