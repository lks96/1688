import assert from 'node:assert/strict';
import fs from 'node:fs';
import {analyze,cleanDraws,calendarOffset,ZODIACS} from '../lib/model.ts';
import {buildOmissions,createOmissionTracker} from '../lib/omissions.ts';
import {scoreOmissionStrategy} from '../lib/omission-strategy.ts';
import {backtestOmissionTop10} from '../lib/omission-backtest.ts';
const raw=JSON.parse(fs.readFileSync('lib/seed.json','utf8')),rows=cleanDraws(raw).rows,a=analyze(raw);
let prefixChecks=0,mutations=0;
for(const scope of ['special','all']){
 const mode=a.omissionModes[scope],byIssue=new Map(mode.backtest.rows.map(r=>[r.issue,r])),tracker=createOmissionTracker(scope);
 assert.equal(mode.strategy.source,scope);
 assert.deepEqual(mode.strategy,scoreOmissionStrategy(a.omissions,a.forecastFor,calendarOffset(a.forecastFor),scope));
 for(let i=0;i<rows.length;i++){
  const target=rows[i],date=target.time.slice(0,10);
  if(i&&date>='2026-01-01'){
   const expected=scoreOmissionStrategy(buildOmissions(rows.slice(0,i)),date,calendarOffset(date),scope),r=byIssue.get(target.issue);
   assert.deepEqual(r.ranking,expected.ranking.map(v=>v.number));assert.deepEqual(r.scores,expected.candidates.map(v=>v.score));
   assert.equal(r.allHitCount,r.numbers.filter(n=>target.numbers.includes(n)).length);
   assert.deepEqual(r.allNumberRanks,target.numbers.map(n=>r.ranking.indexOf(n)+1));
   assert.equal(r.trainingThroughIssue,rows[i-1].issue);prefixChecks++;
  }
  tracker.observe(target);
 }
 const snapshot=tracker.snapshot();
 for(const group of a.omissions.scopes[scope])for(const item of group.items)assert.equal(snapshot.scopes[scope].find(g=>g.id===group.id).items.find(r=>r.key===item.key).current,item.current);
 for(const index of [0,47,48,150,mode.backtest.rows.length-1]){
  const target=[...mode.backtest.rows].reverse()[index],changed=rows.map(r=>{
   if(r.time<target.time)return r;
   const numbers=[49,48,47,46,45,44,43],offset=calendarOffset(r.time.slice(0,10));
   return {...r,numbers,animals:numbers.map(n=>ZODIACS[(offset-n+121)%12])};
  });
  const altered=backtestOmissionTop10(changed,calendarOffset,scope).rows.find(r=>r.issue===target.issue);
  assert.deepEqual(altered.ranking,target.ranking);assert.deepEqual(altered.scores,target.scores);mutations++;
 }
 const s=mode.backtest.allPerformance;
 assert.equal(s.rankedDraws,mode.backtest.rows.length*7);assert.equal(s.ranks.reduce((sum,r)=>sum+r.count,0),s.rankedDraws);
 assert.equal(s.totalHits,mode.backtest.rows.reduce((sum,r)=>sum+r.allHitCount,0));
 assert.equal(s.hits,mode.backtest.rows.filter(r=>r.allHitCount>0).length);
 assert.equal(s.hitDistribution.reduce((sum,r)=>sum+r.count,0),s.draws);
 assert.ok(Math.abs(s.ranges.reduce((sum,r)=>sum+r.rate,0)-1)<1e-12);
 assert.ok(s.hitBaseline>10/49&&s.hitBaseline<1);
 assert.equal(mode.backtest.summary.profitCents,mode.backtest.rows.reduce((sum,r)=>sum+r.profitCents,0));
}
assert.deepEqual(a.omissionModes.special.strategy,a.omissionStrategy);
assert.deepEqual(a.omissionModes.special.backtest,a.omissionBacktest);
assert.notDeepEqual(a.omissionModes.special.strategy.ranking,a.omissionModes.all.strategy.ranking);
console.log(JSON.stringify({passed:true,prefixChecks,mutations,modes:Object.fromEntries(Object.entries(a.omissionModes).map(([k,v])=>[k,{source:v.strategy.source,draws:v.backtest.summary.draws,anySevenHitRate:v.backtest.allPerformance.hitRate,meanHits:v.backtest.allPerformance.meanHits,rankedNumbers:v.backtest.allPerformance.rankedDraws}]))}));
