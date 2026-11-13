import assert from 'node:assert/strict';
import fs from 'node:fs';
import {analyze,cleanDraws,forecastFromHistory,METHODS,MODEL_VERSION,calendarOffset,ZODIACS} from '../lib/model.ts';
const raw=JSON.parse(fs.readFileSync(new URL('../lib/seed.json',import.meta.url),'utf8'));
const cutoff='2026-10-16 23:59:59';
const a=analyze(raw,cutoff);
assert.deepEqual(METHODS.map(m=>m.id),['rotation']);
assert.deepEqual(Object.keys(a.variants),['rotation']);
assert.equal(a.modelVersion,MODEL_VERSION);
assert.equal(a.latest.issue,'2026289');
assert.equal(a.backtestRange.draws,289);
const byIssue=new Map(cleanDraws(raw,cutoff).rows.map(row=>[row.issue,row]));
for(const {id} of METHODS){
 const v=a.variants[id];
 assert.equal(v.performance.length,289);
 assert.equal(v.performance.at(-1).issue,'2026001');
 assert.equal(new Set(v.candidates.map(row=>row.zodiac)).size,3);
 assert.ok(Math.abs(v.performance.reduce((s,row)=>s+row.hits,0)/289-v.metric.meanHits)<1e-12);
 for(const row of v.performance){
  const actual=byIssue.get(row.issue);
  const hits=id==='rotation'?row.candidates.filter(z=>actual.animals.includes(z)).length:Number(row.candidates.includes(actual.animals[6]));
  assert.equal(row.hits,hits);
 }
 assert.deepEqual(analyze([...raw,...raw],cutoff).variants[id],v);
}
for(const date of ['2026-01-01','2026-02-16','2026-02-17','2026-06-01','2026-10-16']){
 const before=raw.filter(row=>row.openTime.slice(0,10)<date);
 const forecast=forecastFromHistory(before,date,cutoff);
 for(const {id} of METHODS)assert.deepEqual(forecast.methods[id].candidates,a.variants[id].performance.find(row=>row.time.startsWith(date)).candidates);
}
console.log('PASS: only dynamic rotation remains; scoring, duplicates and chronological cutoffs verified');
