import "dotenv/config";
import midtrans from "midtrans-client";
import {randomUUID} from "node:crypto";
const names=["MIDTRANS_MERCHANT_ID","MIDTRANS_SERVER_KEY","MIDTRANS_CLIENT_KEY","MIDTRANS_IS_PRODUCTION"];
console.log(JSON.stringify({pemeriksaan:"environment",terisi:Object.fromEntries(names.map(n=>[n,Boolean(process.env[n]?.trim())])),sandbox:process.env.MIDTRANS_IS_PRODUCTION==="false",
 serverKeyFormatSandbox:process.env.MIDTRANS_SERVER_KEY?.startsWith("SB-Mid-server-")===true,
 clientKeyFormatSandbox:process.env.MIDTRANS_CLIENT_KEY?.startsWith("SB-Mid-client-")===true,
 proxy:Object.fromEntries(["HTTP_PROXY","HTTPS_PROXY","ALL_PROXY","NO_PROXY","NODE_USE_ENV_PROXY"].map(n=>[n,Boolean(process.env[n])]))}));
if(names.some(n=>!process.env[n]?.trim())||process.env.MIDTRANS_IS_PRODUCTION!=="false")process.exit(1);
const options={isProduction:false,serverKey:process.env.MIDTRANS_SERVER_KEY.trim(),clientKey:process.env.MIDTRANS_CLIENT_KEY.trim()};
const headersAman=headers=>Object.fromEntries(["server","content-type","date","via","x-request-id","cf-ray"].filter(n=>headers?.[n]).map(n=>[n,String(headers[n]).slice(0,160)]));
const ringkas=(status,headers,data)=>({status,headers:headersAman(headers),tipeBody:Array.isArray(data)?"array":typeof data,
 fieldBody:typeof data==="object"&&data!==null?Object.keys(data).filter(k=>["status_code","status_message","error_messages","token","redirect_url","message","error","errors"].includes(k)):[],
 snapDiperoleh:typeof data?.token==="string"&&typeof data?.redirect_url==="string",
 kategoriPesan:typeof data==="object"&&data!==null?Object.fromEntries(["merchant","credential","parameter","maintenance"].map(k=>[k,new RegExp({merchant:"merchant|account|activation",credential:"unauthor|server.key|client.key|authenticat",parameter:"parameter|gross_amount|order_id|expiry|transaction_details",maintenance:"maintenance|unavailable|internal.server"}[k],"i").test(JSON.stringify(data.error_messages??data.status_message??data.message??""))])):null});
const endpoint="https://app.sandbox.midtrans.com/snap/v1/transactions";
const parameter=()=>({transaction_details:{order_id:`BB-DIAG-${randomUUID().slice(0,16)}`,gross_amount:10000}});
const sdk=new midtrans.Snap(options);sdk.httpClient.http_client.defaults.timeout=15000;
sdk.httpClient.http_client.interceptors.response.use(r=>{console.log(JSON.stringify({pemeriksaan:"SDK HTTP response",...ringkas(r.status,r.headers,r.data)}));return r;},err=>{
 console.log(JSON.stringify({pemeriksaan:"SDK HTTP error",...ringkas(err.response?.status??null,err.response?.headers,err.response?.data),kodeJaringan:/^[A-Z0-9_]+$/.test(err.code??"")?err.code:null}));throw err;
});
try{await sdk.createTransaction(parameter());}catch(err){console.log(JSON.stringify({pemeriksaan:"SDK stack tersanitasi",nama:err.name,frames:String(err.stack??"").split("\n").filter(l=>/^\s+at /.test(l)).slice(0,6)}));}
for(const[variant,extra]of[
 ["expiry minute",{expiry:{unit:"minute",duration:60}}],
 ["page_expiry minute",{page_expiry:{unit:"minute",duration:60}}],
 ["expiry dan page_expiry minute",{expiry:{unit:"minute",duration:60},page_expiry:{unit:"minute",duration:60}}],
 ["expiry dan page_expiry minutes",{expiry:{unit:"minutes",duration:60},page_expiry:{unit:"minutes",duration:60}}]
]){
 console.log(JSON.stringify({pemeriksaan:"variant parameter",variant}));
 try{await sdk.createTransaction({...parameter(),...extra});}catch{console.log(JSON.stringify({pemeriksaan:"variant gagal",variant}));}
}
const auth=`Basic ${Buffer.from(options.serverKey+":").toString("base64")}`;
for(const [label,url,method,body]of[
 ["Native Snap minimal",endpoint,"POST",parameter()],
 ["Native GetStatus nonexisting",`https://api.sandbox.midtrans.com/v2/BB-DIAG-${randomUUID().slice(0,16)}/status`,"GET",undefined]
]){
 try{const r=await fetch(url,{method,headers:{Accept:"application/json","Content-Type":"application/json",Authorization:auth},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(15000)});
  const text=await r.text();let data;try{data=JSON.parse(text);}catch{data=text;}
  console.log(JSON.stringify({pemeriksaan:label,...ringkas(r.status,Object.fromEntries(r.headers),data)}));
 }catch(err){console.log(JSON.stringify({pemeriksaan:label,nama:err.name,kodeJaringan:err.cause?.code??null}));}
}
console.log("Tidak ada token/URL Snap, credential, Authorization atau body mentah yang dicetak. Diagnosis tidak memproses pembayaran/settlement.");
