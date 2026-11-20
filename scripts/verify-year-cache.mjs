import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import {pathToFileURL} from 'node:url';
const source=fs.readFileSync('lib/data.ts','utf8');
const seed=JSON.parse(fs.readFileSync('lib/seed.json','utf8'));
const modelUrl=pathToFileURL(process.cwd()+'/lib/model.ts').href;
const oldFetch=globalThis.fetch,oldNow=Date.now,oldWarn=console.warn;
let counter=0;
async function load(raw=seed,stored=null){
 const code=source.replace("import seed from './seed.json';",`const seed=${JSON.stringify(raw)};`).replace("from './model'",`from '${modelUrl}'`).replace("import {env} from 'cloudflare:workers';",`const env={BUCKET:{get:async()=>(${JSON.stringify(stored)}===null?null:{json:async()=>(${JSON.stringify(stored)})}),put:async()=>{}}};`);
 const compiled=ts.transpileModule(code,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
 return import('data:text/javascript;base64,'+Buffer.from(compiled+`\n// case ${counter++}`).toString('base64'));
}
let calls=[],warnings=[];
function installFetch(failedYear=null,error=new DOMException('Timeout','TimeoutError')){
 calls=[];globalThis.fetch=async url=>{const year=Number(url.split('/').at(-1));calls.push(year);if(year===failedYear)throw error;return Response.json({code:200,data:seed.filter(r=>r.openTime.startsWith(year+'-'))});};
}
try{
 Date.now=()=>new Date('2026-11-20T10:00:00Z').getTime();console.warn=(...args)=>warnings.push(args.join(' '));
 const data=await load();
 assert.equal(data.hasCompleteYear(seed,2025),true);assert.equal(data.hasCompleteYear(seed,2026),false);
 const incomplete=seed.filter(r=>!r.openTime.startsWith('2025-05-01'));
 assert.equal(data.hasCompleteYear(incomplete,2025),false);
 const leap=Array.from({length:366},(_,i)=>({...seed[0],openTime:new Date(Date.UTC(2024,0,1+i)).toISOString().slice(0,10)+' 21:35:00'}));
 assert.equal(data.hasCompleteYear(leap,2024),true);assert.equal(data.hasCompleteYear(leap.filter(r=>!r.openTime.startsWith('2024-02-29')),2024),false);
 installFetch(2025);const baseline=data.initialState().analysis;const healthy=await data.getDashboard(true);
 assert.deepEqual(calls,[2026]);assert.equal(healthy.source,'live');assert.equal(healthy.error,null);
 assert.deepEqual(healthy.analysis.candidates,baseline.candidates);assert.deepEqual(healthy.analysis.performance,baseline.performance);
 // Incomplete prior years must still be repaired; never quietly suppress their failure.
 installFetch(2025);const broken=await load(incomplete);const partial=await broken.getDashboard(true);
 assert.deepEqual(calls,[2025,2026]);assert.equal(partial.source,'partial');assert.match(partial.error,/2025年同步失败（请求超时），使用已保存记录/);
 installFetch();const missing=await load(incomplete);const restored=await missing.getDashboard(true);
 assert.deepEqual(calls,[2025,2026]);assert.equal(restored.error,null);assert.equal(restored.analysis.audit.usableRows,seed.length);
 // Restore a persisted old warning, then clear it after the live current-year sync.
 installFetch(2025);const persisted=await load(seed,{raw:seed,state:{...healthy,error:'2025年数据暂时无法获取',source:'partial'}});
 const cleared=await persisted.getDashboard(true);assert.deepEqual(calls,[2026]);assert.equal(cleared.error,null);assert.equal(cleared.source,'live');
 // Current-year failure remains visible and keeps the previously usable snapshot.
 installFetch(2026);const offline=await load();const fallback=await offline.getDashboard(true);
 assert.equal(fallback.source,'snapshot');assert.match(fallback.error,/2026年同步失败（请求超时）/);assert.ok(fallback.analysis.latest.issue);
 assert.ok(warnings.some(w=>w.includes('year sync failed')&&w.includes('请求超时')));
 installFetch(2026,new Error('2026年接口返回503'));const unavailable=await load();assert.match((await unavailable.getDashboard(true)).error,/接口返回503/);
 console.log(JSON.stringify({passed:true,completedYearCache:true,missingYearRepair:true,leapDayCheck:true,staleWarningCleared:true,currentYearFailureVisible:true,algorithmUnchanged:true}));
}finally{globalThis.fetch=oldFetch;Date.now=oldNow;console.warn=oldWarn;}
