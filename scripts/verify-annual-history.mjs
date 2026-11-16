import assert from 'node:assert/strict';
import fs from 'node:fs';
import {replayAnnualHistory,annualPlanComparison,ANNUAL_BET_WARMUP} from '../lib/annual-history.ts';
import {prepareLongHistory} from '../lib/long-history.ts';
import {backtestFrequentRankNumbers} from '../lib/omission-backtest.ts';
const seed=JSON.parse(fs.readFileSync('lib/long-history-seed.json','utf8')),cutoff='2026-11-17 00:00:00';
const result=replayAnnualHistory(seed,cutoff),clean=prepareLongHistory(seed,cutoff);
for(const year of result.years){
 const alone=replayAnnualHistory({[year.year]:seed[year.year]},cutoff).years.find(y=>y.year===year.year);
 assert.deepEqual(year,alone,'Other years must not affect this year');
 const actual=clean.rows.filter(r=>r.time.startsWith(year.year));
 for(const scope of ['special','all']){
  assert(year.scopes[scope].every(r=>r.time.startsWith(year.year)&&r.trainingThroughTime.startsWith(year.year)));
  for(const plan of ['alternate-fixed','miss-streak-step','every-period-fixed']){
   const ledger=backtestFrequentRankNumbers(year.scopes[scope],plan,ANNUAL_BET_WARMUP),first=ledger.rows.at(-1);
   if(actual.length>100){assert.equal(first.issue,actual[100].issue);assert.equal(first.stakeCents,10000);}
   const warming=backtestFrequentRankNumbers(year.scopes[scope].slice(0,98),plan,ANNUAL_BET_WARMUP);
   assert.equal(warming.rows.length,0);assert.equal(warming.next.bought,false);
   const ready=backtestFrequentRankNumbers(year.scopes[scope].slice(0,99),plan,ANNUAL_BET_WARMUP);
   assert.equal(ready.rows.length,0);assert.equal(ready.next.stakeCents,10000);
   const comparison=annualPlanComparison(result.years,scope,plan);
   assert.equal(comparison.profitCents,comparison.annual.reduce((sum,r)=>sum+r.profitCents,0));
  }
 }
}
const modified=structuredClone(seed);modified['2021']=modified['2021'].map(r=>({...r,openCode:r.openCode.split(',').reverse().join(',')}));
const changed=replayAnnualHistory(modified,cutoff);
assert.deepEqual(changed.years.filter(y=>y.year!=='2021'),result.years.filter(y=>y.year!=='2021'));
const nextYear=replayAnnualHistory(seed,'2027-01-01 12:00:00').years.at(-1);
assert.equal(nextYear.year,'2027');assert.equal(nextYear.draws,0);assert.equal(nextYear.forecasts,null);
for(const scope of ['special','all'])for(const plan of ['alternate-fixed','miss-streak-step','every-period-fixed']){
 const next=backtestFrequentRankNumbers(nextYear.scopes[scope],plan,ANNUAL_BET_WARMUP);
 assert.equal(next.summary.stakeCents,0);assert.equal(next.next.bought,false);
}
console.log('PASS: all six years isolated, previous-year mutation, first 100 effective draws stake zero, first bet at draw 101, six plan aggregation, new-year cold start');
console.log(JSON.stringify(['special','all'].flatMap(scope=>['alternate-fixed','miss-streak-step','every-period-fixed'].map(plan=>{const c=annualPlanComparison(result.years,scope,plan);return {scope,plan,profit:c.profitCents/100,maxStake:c.maxStakeCents/100};})).sort((a,b)=>b.profit-a.profit)));
