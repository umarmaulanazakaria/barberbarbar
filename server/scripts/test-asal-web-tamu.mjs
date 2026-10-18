import assert from 'node:assert/strict';
import {asalWebTamu} from '../dist/lib/asal-web-tamu.js';
const awal={NODE_ENV:process.env.NODE_ENV,GUEST_WEB_ORIGINS:process.env.GUEST_WEB_ORIGINS};
const adapter={wifi:[{family:'IPv4',internal:false,address:'192.168.42.7'},{family:'IPv4',internal:false,address:'10.20.30.40'},{family:'IPv4',internal:false,address:'172.16.1.2'},{family:'IPv4',internal:false,address:'172.32.1.2'},{family:'IPv4',internal:false,address:'8.8.8.8'},{family:'IPv4',internal:true,address:'127.0.0.1'}]};
try{
 delete process.env.GUEST_WEB_ORIGINS;process.env.NODE_ENV='development';const dev=asalWebTamu(adapter);
 for(const ip of ['192.168.42.7','10.20.30.40','172.16.1.2'])assert.ok(dev.includes('http://'+ip+':5175'));
 for(const ip of ['172.32.1.2','8.8.8.8','192.168.42.8'])assert.ok(!dev.includes('http://'+ip+':5175'));
 assert.ok(!dev.includes('http://192.168.42.7:3000'));assert.ok(!dev.includes('*'));
 process.env.NODE_ENV='production';assert.deepEqual(asalWebTamu(adapter),['http://localhost:5175','http://127.0.0.1:5175']);
 process.env.GUEST_WEB_ORIGINS='https://customer.example.invalid';assert.deepEqual(asalWebTamu(adapter),['https://customer.example.invalid']);
 console.log('PASS Origin: hanya IP privat adapter lokal/port5175 di development; Production tetap allowlist eksplisit');
}finally{for(const[k,v]of Object.entries(awal))if(v===undefined)delete process.env[k];else process.env[k]=v;}
