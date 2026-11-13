import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import ts from 'typescript';
import {summarizeOmission,buildOmissions} from '../lib/omissions.ts';
import {cleanDraws,analyze,ZODIACS} from '../lib/model.ts';
assert.deepEqual(summarizeOmission([true,false,false,true,false]),{current:1,censored:false,longest:2,longestCensored:false,last:3,appearances:2,recent30:2});
assert.equal(summarizeOmission([false,false,false]).censored,true);
assert.equal(summarizeOmission([false,false,false]).current,3);
assert.equal(summarizeOmission([true,true]).current,0);
assert.equal(summarizeOmission([false,false,true]).longestCensored,true);
const fixture=[
 {issue:'a',time:'2026-10-21 21:35:00',numbers:[1,3,11,13,21,23,49],animals:['马','马','猴','猴','狗','狗','马'],offset:6},
 {issue:'b',time:'2026-10-22 21:35:00',numbers:[2,4,12,14,22,24,10],animals:['蛇','兔','羊','蛇','鸡','羊','鸡'],offset:6},
 {issue:'c',time:'2026-10-23 21:35:00',numbers:[5,7,15,17,25,27,31],animals:['虎','鼠','龙','虎','马','龙','鼠'],offset:6},
];
const f=buildOmissions(fixture);
const item=(scope,id,key)=>f.scopes[scope].find(g=>g.id===id).items.find(r=>r.key===key);
assert.equal(item('special','parity','even').current,1);
assert.equal(item('special','number','n49').current,2);
assert.equal(item('special','number','n49').lastIssue,'a');
assert.equal(item('special','head','h0').current,3); // 10 is 1-head, not 0-head
assert.equal(item('special','zodiac','马').current,2);
assert.equal(item('all','zodiac','马').current,0);
assert.deepEqual(item('special','tail','t0').numbers,[10,20,30,40]);
// Independent reverse scan for every group and scope on real history.
const raw=JSON.parse(fs.readFileSync('lib/seed.json','utf8'));
const {rows}=cleanDraws(raw),stats=buildOmissions(rows);
let checked=0;
for(const [scope,groups] of Object.entries(stats.scopes))for(const g of groups)for(const it of g.items){
 const flags=[...rows].reverse().map(r=>{
  const ns=scope==='special'?r.numbers.slice(6):r.numbers;
  const zs=scope==='special'?r.animals.slice(6):r.animals;
  return g.id==='zodiac'?zs.includes(it.label):ns.some(n=>it.numbers.includes(n));
 });
 const idx=flags.indexOf(true);
 assert.equal(it.current,idx<0?rows.length:idx);
 assert.equal(it.lastIssue,idx<0?null:rows[rows.length-1-idx].issue);
 assert.equal(it.recent30,flags.slice(0,30).filter(Boolean).length);
 assert.equal(it.longest,Math.max(...flags.map(Number).join('').split('1').map(s=>s.length)));
 checked++;
}
assert.deepEqual(analyze(raw).omissions,stats);
const previousSource=execFileSync('git',['show','HEAD:lib/model.ts'],{encoding:'utf8'});
const previousJs=ts.transpileModule(previousSource.replace(/(['"])\.\/([^'"]+)\1/g,(_,q,path)=>JSON.stringify(new URL('../lib/'+path,import.meta.url).href)),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const previous=await import('data:text/javascript;base64,'+Buffer.from(previousJs).toString('base64'));
assert.deepEqual(analyze(raw).variants.rotation,previous.analyze(raw).variants.rotation);
assert.deepEqual(analyze([...raw].reverse().concat(raw.slice(0,10))).omissions,stats);
console.log(JSON.stringify({passed:true,checked,draws:stats.draws,latest:stats.latestIssue}));
