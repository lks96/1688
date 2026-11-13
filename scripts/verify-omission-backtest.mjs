import assert from 'node:assert/strict';
import fs from 'node:fs';
import {cleanDraws,calendarOffset,ZODIACS,analyze} from '../lib/model.ts';
import {buildOmissions} from '../lib/omissions.ts';
import {scoreOmissionStrategy} from '../lib/omission-strategy.ts';
import {backtestOmissionTop10,settleOmissionTop10} from '../lib/omission-backtest.ts';
const bet={issue:'1',time:'2026-01-01 21:35:00',trainingThroughIssue:'0',trainingThroughTime:'2025-12-31 21:35:00',numbers:[1,2,3,4,5,6,7,8,9,10],scores:[],specialNumber:7};
const hand=settleOmissionTop10([bet,{...bet,issue:'2',time:'2026-01-02 21:35:00',specialNumber:11}]);
assert.equal(hand.summary.stakeCents,20000);
assert.equal(hand.summary.returnCents,47000);
assert.equal(hand.summary.profitCents,27000);
assert.equal(hand.rows[1].profitCents,37000);
assert.equal(hand.rows[0].profitCents,-10000);
assert.equal(hand.rows[0].cumulativeProfitCents,27000);
assert.throws(()=>settleOmissionTop10([{...bet,numbers:[1,1,2,3,4,5,6,7,8,9]}]),/不同/);
assert.throws(()=>settleOmissionTop10([{...bet,trainingThroughTime:bet.time}]),/当期或未来/);
const raw=JSON.parse(fs.readFileSync('lib/seed.json','utf8')),{rows}=cleanDraws(raw);
const b=backtestOmissionTop10(rows,calendarOffset),byIssue=new Map(b.rows.map(r=>[r.issue,r]));
// Every incremental prediction must match a physical prefix-only recomputation.
let prefixes=0;
for(let i=1;i<rows.length;i++){
 const target=rows[i];if(!target.time.startsWith('2026'))continue;
 const expected=scoreOmissionStrategy(buildOmissions(rows.slice(0,i)),target.time.slice(0,10),calendarOffset(target.time.slice(0,10)));
 const actual=byIssue.get(target.issue);
 assert.deepEqual(actual.numbers,expected.candidates.map(r=>r.number));
 assert.deepEqual(actual.scores,expected.candidates.map(r=>r.score));
 assert.deepEqual(actual.ranking,expected.ranking.map(r=>r.number));
 assert.deepEqual(actual.regularNumbers,target.numbers.slice(0,6));
 assert.equal(actual.specialRank,actual.ranking.indexOf(target.numbers[6])+1);
 assert.equal(actual.trainingThroughIssue,rows[i-1].issue);
 prefixes++;
}
// Changing target and all later seventh numbers must not alter target forecast.
let mutations=0;
const indexes=[0,1,47,48,150,b.rows.length-2,b.rows.length-1];
const chronological=[...b.rows].reverse();
for(const index of indexes){
 const target=chronological[index],changed=rows.map(row=>{
  if(row.time<target.time)return row;
  const ns=[49,48,47,46,45,44,43],offset=calendarOffset(row.time.slice(0,10));
  return {...row,numbers:ns,animals:ns.map(n=>ZODIACS[(offset-n+121)%12])};
 });
 const counterpart=backtestOmissionTop10(changed,calendarOffset).rows.find(r=>r.issue===target.issue);
 assert.deepEqual(counterpart.numbers,target.numbers);assert.deepEqual(counterpart.scores,target.scores);assert.deepEqual(counterpart.ranking,target.ranking);mutations++;
}
let profit=0,hits=0;
for(const row of chronological){
 assert.equal(row.stakeCents,10000);assert.equal(row.hit,row.numbers.includes(row.specialNumber));
 const returned=row.hit?47000:0;assert.equal(row.returnCents,returned);
 profit+=returned-10000;assert.equal(row.cumulativeProfitCents,profit);hits+=Number(row.hit);
}
assert.equal(b.summary.profitCents,profit);assert.equal(b.summary.stakeCents,10000*b.summary.draws);
assert.equal(b.summary.returnCents,47000*hits);assert.equal(b.summary.hits,hits);
assert.deepEqual(analyze(raw).omissionBacktest,b);
assert.deepEqual(analyze([...raw].reverse().concat(raw.slice(0,20))).omissionBacktest,b);
assert.ok(!('regular' in analyze(raw).omissions.scopes));

console.log(JSON.stringify({passed:true,prefixes,mutations,summary:b.summary}));
