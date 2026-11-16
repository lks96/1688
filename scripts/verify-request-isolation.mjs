import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import ts from 'typescript';
import {pathToFileURL} from 'node:url';
const originalFetch=globalThis.fetch;
const seed=JSON.parse(fs.readFileSync('lib/seed.json','utf8'));
const modelUrl=pathToFileURL(process.cwd()+'/lib/model.ts').href;
async function probe(source){
 const pending=[];globalThis.fetch=()=>new Promise((resolve,reject)=>pending.push(reject));
 const code=source.replace("import seed from './seed.json';",`const seed=${JSON.stringify(seed)};`).replace("from './model'",`from '${modelUrl}'`).replace("import {env} from 'cloudflare:workers';",'const env={BUCKET:{get:async()=>null,put:async()=>{}}};');
 const compiled=ts.transpileModule(code,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
 const data=await import('data:text/javascript;base64,'+Buffer.from(compiled).toString('base64'));
 const first=data.getDashboard(true);
 while(!pending.length)await new Promise(resolve=>setTimeout(resolve,0));
 const next=data.getDashboard(true);
 const outcome=await Promise.race([next.then(state=>({ok:!!state.analysis.latest.issue})),new Promise(resolve=>setTimeout(()=>resolve({blocked:true}),100))]);
 pending.forEach(reject=>reject(new Error('Simulated originating request cancellation')));
 await first;await next;return outcome;
}
try{
 const previous=execFileSync('git',['show','HEAD:lib/data.ts'],{encoding:'utf8'});
 if(previous.includes('if(inflight)return inflight;'))assert.deepEqual(await probe(previous),{blocked:true});
 assert.deepEqual(await probe(fs.readFileSync('lib/data.ts','utf8')),{ok:true});
 console.log('PASS: cancelled/slow request no longer traps a following request; usable snapshot returned');
}finally{globalThis.fetch=originalFetch;}
