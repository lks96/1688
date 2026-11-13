import assert from 'node:assert/strict';
import fs from 'node:fs';
import {analyze,cleanDraws,calendarOffset,ZODIACS} from '../lib/model.ts';
import {buildOmissions} from '../lib/omissions.ts';
import {scoreOmissionStrategy} from '../lib/omission-strategy.ts';
const raw=JSON.parse(fs.readFileSync('lib/seed.json','utf8'));
const full=analyze(raw),prediction=full.omissionStrategy;
assert.equal(prediction.ranking.length,49);
assert.equal(new Set(prediction.ranking.map(r=>r.number)).size,49);
assert.equal(prediction.candidates.length,10);
assert.equal(new Set(prediction.zodiacCandidates.map(r=>r.zodiac)).size,3);
assert.equal(prediction.source,'special');
for(const row of prediction.ranking){
 assert.ok(row.score>=0&&row.score<=100);
 assert.equal(row.factors.length,6);
}
// Same seventh numbers, wholly different first six: strategy stays identical.
const mutate=r=>{
 const seventh=Number(r.openCode.split(',')[6]);
 const six=Array.from({length:49},(_,i)=>49-i).filter(n=>n!==seventh).slice(0,6);
 const ns=[...six,seventh],offset=calendarOffset(r.openTime.slice(0,10));
 return {...r,openCode:ns.join(','),zodiac:ns.map(n=>ZODIACS[(offset-n+121)%12]).join(',')};
};
assert.deepEqual(analyze(raw.map(mutate)).omissionStrategy,prediction);
assert.deepEqual(analyze([...raw].reverse().concat(raw.slice(0,20))).omissionStrategy,prediction);
// Known history: 49 has four full contributions plus 2/3 of the zodiac contribution.
const fixture=[1,12,23].map((n,i)=>{
 const ns=[...Array.from({length:49},(_,i)=>i+1).filter(v=>v!==n).slice(0,6),n];
 return {expect:'202600'+(i+1),openTime:'2026-10-0'+(i+1)+' 21:35:00',openCode:ns.join(','),zodiac:ns.map(v=>ZODIACS[(6-v+121)%12]).join(',')};
});
const stats=buildOmissions(cleanDraws(fixture).rows),tiny=scoreOmissionStrategy(stats,'2026-10-04',6);
assert.ok(Math.abs(tiny.ranking.find(r=>r.number===49).score-100*7/9)<1e-10);
assert.equal(tiny.ranking.find(r=>r.number===23).score,0);
for(const z of tiny.zodiacRanking){
 const pool=tiny.ranking.filter(r=>r.zodiac===z.zodiac);
 assert.equal(z.score,pool.reduce((s,r)=>s+r.score,0)/pool.length);
}
assert.throws(()=>scoreOmissionStrategy(stats,'2026-10-03',6),/目标日期之前/);
// Across lunar New Year, target-date mapping is applied independently of last draw.
const mapped=scoreOmissionStrategy(stats,'2026-10-04',7);
assert.equal(mapped.ranking.find(r=>r.number===1).zodiac,'羊');
assert.equal(mapped.ranking.find(r=>r.number===1).factors.find(f=>f.id==='zodiac').label,'羊');
// Each historical target excludes all of its own and later results. Changing
// those results and source order cannot affect candidates, scores or metadata.
const targets=['2026-01-02','2026-02-17','2026-06-01',...full.variants.rotation.performance.slice(0,5).map(r=>r.time.slice(0,10))];
let isolationChecks=0;
for(const date of targets){
 const cutoff=date+' 00:00:00';
 const prefix=raw.filter(r=>r.openTime.slice(0,10)<date);
 const known=analyze(prefix,cutoff).omissionStrategy;
 const changed=raw.map(r=>r.openTime.slice(0,10)<date?r:mutate({...r,openCode:'1,2,3,4,5,6,7'}));
 assert.deepEqual(analyze(changed,cutoff).omissionStrategy,known);
 assert.equal(known.forecastFor,date);
 assert.ok(known.trainingThroughTime.slice(0,10)<date);
 isolationChecks++;
}
console.log(JSON.stringify({passed:true,numbers:49,dimensions:6,isolationChecks,forecastFor:prediction.forecastFor,numberCandidates:prediction.candidates.map(r=>r.number),zodiacCandidates:prediction.zodiacCandidates.map(r=>r.zodiac)}));
