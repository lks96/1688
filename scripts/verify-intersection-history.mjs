import assert from 'node:assert/strict';
import fs from 'node:fs';
import {intersectTop10,settleIntersectionHistory,buildIntersectionHistory} from '../lib/intersection-history.ts';
import {replayLongHistory} from '../lib/long-history.ts';
import {replayAnnualHistory} from '../lib/annual-history.ts';
const pools=numbers=>({longNumbers:[...numbers,...Array.from({length:10-numbers.length},(_,i)=>10+i)],annualNumbers:[...numbers,...Array.from({length:10-numbers.length},(_,i)=>30+i)]});
const make=(i,numbers,specialNumber=49)=>({issue:String(i),time:String(i).padStart(3,'0'),trainingThroughTime:'000',trainingThroughIssue:'0',...pools(numbers),candidates:numbers.map(n=>({number:n,longRank:n,annualRank:n+1})),specialNumber,regularNumbers:[]});
const manual=settleIntersectionHistory([make(1,[1,2]),make(2,[]),make(3,[1,2,3],2),make(4,[4]),make(5,[]),make(6,[5,6])]);
assert.deepEqual([...manual.rows].reverse().map(r=>[r.stakePerNumberCents,r.stakeCents,r.returnCents,r.nextUnitCents]),[[1000,2000,0,2000],[0,0,0,2000],[2000,6000,94000,1000],[1000,1000,0,2000],[0,0,0,2000],[2000,4000,0,3000]]);
assert.equal(manual.summary.profitCents,81000);assert.equal(manual.summary.maxStakeCents,6000);assert.equal(manual.summary.emptyDraws,2);assert.equal(manual.nextUnitCents,3000);
assert.throws(()=>settleIntersectionHistory([{...make(1,[1,2]),candidates:[{number:1,longRank:1,annualRank:1}]}]),/交集号码/);
const base={ranking:Array.from({length:49},(_,i)=>i+1),frequencyRanks:[1,2,3,4,5,6,7,8,9,10]};
const shifted={...base,ranking:[8,9,10,...Array.from({length:7},(_,i)=>11+i),...base.ranking.filter(n=>n<8||n>17)]};
assert.deepEqual(intersectTop10(base,shifted).candidates,[{number:8,longRank:8,annualRank:1},{number:9,longRank:9,annualRank:2},{number:10,longRank:10,annualRank:3}]);
const seed=JSON.parse(fs.readFileSync('lib/long-history-seed.json','utf8')),cutoff='2026-11-17 00:00:00';
const fullLong=replayLongHistory(seed,cutoff),fullAnnual=replayAnnualHistory(seed,cutoff),full=buildIntersectionHistory(fullLong,fullAnnual);
for(const scope of ['special','all']){
 const annualMap=new Map(fullAnnual.years.flatMap(y=>y.scopes[scope].map((r,i)=>[r.issue,{r,i}]))),longMap=new Map(fullLong.scopes[scope].map((r,i)=>[r.issue,{r,i}]));
 const ledger=full.scopes[scope];
 for(const row of ledger.rows){
  const a=annualMap.get(row.issue),l=longMap.get(row.issue);assert(a.i>=99&&l.i>=100);
  assert.deepEqual(row.candidates,intersectTop10(l.r,a.r).candidates);
 }
 assert.equal(ledger.summary.profitCents,ledger.rows.reduce((n,r)=>n+r.profitCents,0));
 assert.equal(ledger.forecast.stakeCents,ledger.forecast.candidates.length*ledger.forecast.stakePerNumberCents);
 assert.deepEqual(ledger.forecast.candidates.map(c=>c.number),ledger.forecast.longNumbers.filter(n=>ledger.forecast.annualNumbers.includes(n)));
}
const earlier='2023-06-30 23:59:59',prefix=buildIntersectionHistory(replayLongHistory(seed,earlier),replayAnnualHistory(seed,earlier));
for(const scope of ['special','all']){
 const expected=full.scopes[scope].rows.filter(r=>r.time<=earlier);assert.deepEqual(prefix.scopes[scope].rows,expected);
 const following=[...full.scopes[scope].rows].reverse().find(r=>r.time>earlier);
 assert.deepEqual(prefix.scopes[scope].forecast.candidates,following.candidates);
 assert.equal(prefix.scopes[scope].forecast.stakeCents,following.stakeCents);
}
const mutated=structuredClone(seed),target=mutated['2023'].find(r=>r.openTime.startsWith('2023-06-01'));
target.openCode=target.openCode.split(',').reverse().join(',');
const changed=buildIntersectionHistory(replayLongHistory(mutated,cutoff),replayAnnualHistory(mutated,cutoff));
for(const scope of ['special','all']){
 const original=full.scopes[scope].rows.find(r=>r.issue===target.expect),actual=changed.scopes[scope].rows.find(r=>r.issue===target.expect);
 assert.deepEqual(actual.candidates,original.candidates);assert.equal(actual.stakePerNumberCents,original.stakePerNumberCents);
}
console.log('PASS: number-level intersection, variable count, step/reset/no-intersection stake retention, shared warmups, prefix/next forecast consistency, no target leakage, two-scope settlement');
console.log(JSON.stringify(Object.entries(full.scopes).map(([scope,r])=>({scope,summary:r.summary,next:r.forecast}))));
