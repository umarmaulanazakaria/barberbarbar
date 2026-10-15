import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const {tanganiKesalahan}=await import('../dist/middleware/error.middleware.js');
const marker='E2E_SENSITIVE_SENTINEL',captured=[],asli=console.error,results=[];
console.error=(...args)=>captured.push(args);
try{
 const malformed=Object.assign(new SyntaxError('Invalid JSON '+marker),{body:`{"password":"${marker}"`});
 const sdk=Object.assign(new Error(marker),{name:marker,config:{headers:{Authorization:marker}},response:{data:{token:marker}}});
 for(const [id,error,expected]of[['JSON_BODY',malformed,400],['SDK_ERROR',sdk,500]]){
  let code,body;const res={status(n){code=n;return this;},json(b){body=b;return this;}};
  tanganiKesalahan(error,{},res,()=>{});assert.equal(code,expected);assert.ok(!JSON.stringify(body).includes(marker));
  const aman=!JSON.stringify(captured).includes(marker);results.push({id,expected,actual:code,logAman:aman,status:aman?'PASS':'FAIL'});
 }
 assert.ok(results.every(r=>r.logAman),'Log umum tidak boleh memuat body/password/token/header/error mentah');
}finally{
 console.error=asli;await mkdir((process.env.BB_AUDIT_OUTPUT_DIR??'e2e'),{recursive:true});await writeFile((process.env.BB_AUDIT_OUTPUT_DIR??'e2e')+'/HASIL-LOG.json',JSON.stringify({jenis:'Unit middleware actual; sentinel synthetic tidak pernah dicetak',results},null,2));console.log(JSON.stringify(results));
}
