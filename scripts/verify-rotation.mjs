import assert from 'node:assert/strict';
import fs from 'node:fs';
import {analyze,forecastFromHistory,selectRotation} from '../lib/model.ts';

const raw=JSON.parse(fs.readFileSync(new URL('../lib/seed.json',import.meta.url),'utf8'));
const a=analyze(raw,'2026-10-17 18:10:00');
const v=a.variants.rotation;
const key=s=>[...s].sort().join(',');
const verify=(groups)=>{
  for(let i=0;i<groups.length;i++){
    const s=groups[i];assert.equal(new Set(s).size,3);
    if(i)assert.ok(s.filter(z=>groups[i-1].includes(z)).length<=1,`less than 2 replacements at ${i}`);
    if(i>1)assert.ok(!s.some(z=>groups[i-1].includes(z)&&groups[i-2].includes(z)),`3 consecutive selections at ${i}`);
    assert.ok(!groups.slice(Math.max(0,i-7),i).some(previous=>key(previous)===key(s)),`repeated group within 7 draws at ${i}`);
  }
};
const groups=[...v.performance].reverse().map(r=>r.candidates);
groups.push(v.candidates.map(r=>r.zodiac));verify(groups);
assert.equal(v.setChangeRate,1);
assert.ok(!v.sameAsPrevious);
assert.ok(a.rotationPolicy.added.length>=2);
assert.ok(a.rotationPolicy.removed.length>=2);
assert.ok(v.ranking.every(r=>Number.isFinite(r.strategyScore)&&r.strategyScore>=0&&r.strategyScore<=100));
assert.ok(v.candidates.every(r=>r.selected));
assert.equal(v.ranking.filter(r=>r.selected).length,3);
assert.deepEqual(analyze([...raw].reverse(),'2026-10-17 18:10:00').variants.rotation,v,'input order changed predictions');
assert.deepEqual(analyze([...raw,...raw],'2026-10-17 19:00:00').variants.rotation,v,'duplicate fetch or refresh changed predictions');
// Every 2026 forecast is regenerated with all subsequent outcomes absent.
for(const row of v.performance){
  const before=raw.filter(r=>r.openTime<row.time);
  const prefix=forecastFromHistory(before,row.time.slice(0,10),'2026-10-17 18:10:00');
  assert.deepEqual(prefix.methods.rotation.candidates,row.candidates,`future leakage at ${row.issue}`);
}
// Exercise feasibility and determinism under persistent tied and dominant signals.
for(const p of [Array(12).fill(.5),[.99,...Array(11).fill(.01)]]){
  const history=[];
  for(let i=0;i<400;i++){
    const first=selectRotation(p,history),again=selectRotation(p,history);
    assert.deepEqual(first,again);history.push(first.selected);
  }
  verify(history);
}
const hitTotal=v.performance.reduce((sum,r)=>sum+r.hits,0);
assert.ok(Math.abs(hitTotal/v.performance.length-v.metric.meanHits)<1e-12);
const report={version:a.modelVersion,latest:a.latest.issue,range:a.backtestRange,forecastFor:a.forecastFor,
  current:v.candidates.map(r=>({zodiac:r.zodiac,strategyScore:r.strategyScore})),previous:a.rotationPolicy.previous,
  added:a.rotationPolicy.added,removed:a.rotationPolicy.removed,meanHits:v.metric.meanHits,
  randomMeanHits:a.reference.meanHits,setChangeRate:v.setChangeRate,
  recent:v.performance.slice(0,7),checks:['all chronological prefixes reconstructed without later outcomes','all groups satisfy 2 replacements, 2 consecutive maximum, 7 period uniqueness','input order, duplicate and refresh stability','800 tied or dominant signal forecasts','dynamic rotation outputs retained']};
fs.writeFileSync(new URL('../research/rotation-validation.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
