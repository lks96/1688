import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {analyze,chinaNow,calendarOffset,cleanDraws,forecastFromHistory,METHODS,MODEL_VERSION,ZODIACS} from '../lib/model.ts';

const cutoff=chinaNow();
const args=process.argv.slice(2);
const since=args.find(arg=>arg.startsWith('--since='))?.slice(8);
const seed=fs.readFileSync(new URL('../lib/seed.json',import.meta.url));
const raw=[...JSON.parse(seed),...args.filter(arg=>!arg.startsWith('--')).flatMap(file=>JSON.parse(fs.readFileSync(file,'utf8')).filter(row=>row.openTime?.startsWith('2026-')))];
const full=analyze(raw,cutoff);
const {rows}=cleanDraws(raw,cutoff);
const targets=rows.filter(r=>r.time.startsWith('2026')&&(!since||r.time.slice(0,10)>=since));
const byMethod=Object.fromEntries(METHODS.map(({id})=>[id,new Map(full.variants[id].performance.map(r=>[r.issue,r]))]));
let candidateChecks=0,scoreVectorChecks=0,changedHitCounts=0;
const equalScores=(a,b,label)=>{
  assert.equal(a.length,12,label);
  a.forEach((v,i)=>assert.ok(Math.abs(v-b[i])<1e-12,`${label}: score ${i} differs`));
  scoreVectorChecks++;
};

for(const target of targets){
  const targetDate=target.time.slice(0,10);
  // No target outcome, or any later outcome, exists in this input at all.
  const before=raw.filter(r=>r.openTime.slice(0,10)<targetDate);
  const isolated=forecastFromHistory(before,targetDate,cutoff);
  assert.ok(isolated.trainingThroughTime.slice(0,10)<targetDate);

  // Replace the target AND every later result with different valid records.
  // Deliberately change their inferred zodiac offset too: it must not be read.
  const poisoned=raw.map((r,i)=>{
    if(r.openTime.slice(0,10)<targetDate)return r;
    const offset=(calendarOffset(r.openTime.slice(0,10))+1)%12;
    const numbers=Array.from({length:7},(_,j)=>(i*7+j*5)%49+1);
    return {...r,openCode:numbers.join(','),zodiac:numbers.map(n=>ZODIACS[(offset-n+121)%12]).join(',')};
  });
  const changed=analyze(poisoned,cutoff);
  for(const {id} of METHODS){
    const original=byMethod[id].get(target.issue);
    const altered=changed.variants[id].performance.find(r=>r.issue===target.issue);
    assert.deepEqual(isolated.methods[id].candidates,original.candidates,`${id} ${target.issue}: deleting current/future outcomes changed candidates`);
    assert.deepEqual(altered.candidates,original.candidates,`${id} ${target.issue}: replacing current/future outcomes changed candidates`);
    candidateChecks+=2;
    equalScores(isolated.methods[id].predictionScores,original.predictionScores,`${id} ${target.issue} removed`);
    equalScores(altered.predictionScores,original.predictionScores,`${id} ${target.issue} replaced`);
    assert.equal(original.trainingThroughIssue,isolated.trainingThroughIssue);
    assert.equal(original.trainingThroughTime,isolated.trainingThroughTime);
    assert.equal(original.trainingDraws,isolated.trainingDraws);
    assert.ok(original.trainingThroughTime<original.time);
    if(original.hits!==altered.hits)changedHitCounts++;
  }
}
assert.ok(changedHitCounts>0,'Outcome replacements did not exercise the scoring path');

// Positive control: changing OBSERVED history must affect model scores.
const last=targets.at(-1),date=last.time.slice(0,10);
const before=raw.filter(r=>r.openTime.slice(0,10)<date);
const recentTime=before.map(r=>r.openTime).sort().at(-1);
const alteredHistory=before.map(r=>{
  if(r.openTime!==recentTime)return r;
  const numbers=[1,13,25,37,2,14,26],offset=calendarOffset(r.openTime.slice(0,10));
  return {...r,openCode:numbers.join(','),zodiac:numbers.map(n=>ZODIACS[(offset-n+121)%12]).join(',')};
});
const unaltered=forecastFromHistory(before,date,cutoff),altered=forecastFromHistory(alteredHistory,date,cutoff);
assert.ok(METHODS.some(({id})=>unaltered.methods[id].predictionScores.some((p,z)=>Math.abs(p-altered.methods[id].predictionScores[z])>1e-10)),'Models did not respond to observed history');
assert.throws(()=>forecastFromHistory(raw,date,cutoff),/当期或之后/);
assert.equal(full.research.independentValidation,false);
assert.equal(full.research.preDrawArchive,false);

// Calendar boundaries are fixed in advance, not inferred from draw outcomes.
assert.equal(calendarOffset('2026-02-16'),5);
assert.equal(calendarOffset('2026-02-17'),6);
assert.ok(rows.every(r=>r.offset===calendarOffset(r.time.slice(0,10))));
const report={
  modelVersion:MODEL_VERSION,seedSha256:createHash('sha256').update(seed).digest('hex'),
  modelSha256:createHash('sha256').update(fs.readFileSync(new URL('../lib/model.ts',import.meta.url))).digest('hex'),
  range:{from:targets[0].time.slice(0,10),to:targets.at(-1).time.slice(0,10),draws:targets.length},analysisRange:full.backtestRange,methods:METHODS.map(m=>m.id),candidateChecks,scoreVectorChecks,
  allPassed:true,changedHitCounts,
  independentValidation:false,preDrawArchive:false,
  limitations:['Historical inputs contain final published records, not archived point-in-time source responses.','Algorithm design has reused 2026 history; these are exploratory simulations, not an untouched holdout or predictions recorded before the draw.'],
  checks:['Every target rebuilt with its outcome and all later outcomes physically removed','Every target rebuilt with its outcome and all later outcomes replaced, including inferred mapping','All active methods preserve candidates AND all 12 scores','Training cutoffs precede targets','Observed-history perturbation changes scores','Forecast entry point rejects current/future inputs','Lunar-calendar rollover and mapping checked'],
};
fs.writeFileSync(new URL(since?'../research/causality-new-results.json':'../research/causality-audit.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
