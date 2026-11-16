import assert from 'node:assert/strict';
import fs from 'node:fs';
import {prepareLongHistory,replayLongHistory} from '../lib/long-history.ts';
import {backtestFrequentRankNumbers} from '../lib/omission-backtest.ts';
const source=JSON.parse(fs.readFileSync('lib/long-history-seed.json','utf8'));
const cutoff='2026-11-17 00:00:00',full=replayLongHistory(source,cutoff);
assert.equal(full.audit.from.slice(0,10),'2021-01-01');
assert(full.audit.excluded.some(r=>r.issue==='2022132'));
assert(full.audit.excluded.some(r=>r.issue==='2023004'));
for(const scope of ['special','all']){
 const counts=Array(49).fill(0);
 for(const row of full.scopes[scope]){
  const expected=counts.map((count,i)=>({rank:i+1,count})).sort((a,b)=>b.count-a.count||a.rank-b.rank).slice(0,10).map(r=>r.rank);
  assert.deepEqual(row.frequencyRanks,expected);assert(row.trainingThroughTime<row.time);
  for(const number of scope==='all'?[...row.regularNumbers,row.specialNumber]:[row.specialNumber])counts[row.ranking.indexOf(number)]++;
 }
 const prefix=replayLongHistory(source,'2022-06-30 23:59:59').scopes[scope];
 assert.deepEqual(prefix,full.scopes[scope].slice(0,prefix.length));
 const modified=structuredClone(source),target=modified['2023'].find(r=>r.openTime.startsWith('2023-06-01'));
 target.openCode=target.openCode.split(',').reverse().join(',');
 const changed=replayLongHistory(modified,cutoff).scopes[scope];
 const at=full.scopes[scope].findIndex(r=>r.issue===target.expect);
 assert.deepEqual(changed[at].frequencyRanks,full.scopes[scope][at].frequencyRanks);
 assert.deepEqual(changed[at].ranking,full.scopes[scope][at].ranking);
 for(const plan of ['alternate-fixed','miss-streak-step','every-period-fixed']){
  const ledger=backtestFrequentRankNumbers(full.scopes[scope],plan),chron=[...ledger.rows].reverse();
  assert.equal(chron[0].issue,full.scopes[scope][100].issue);assert.equal(chron[0].stakeCents,10000);
  assert.equal(ledger.summary.profitCents,ledger.rows.reduce((s,r)=>s+r.profitCents,0));
  assert.equal(ledger.summary.stakeCents,ledger.rows.reduce((s,r)=>s+r.stakeCents,0));
  assert.equal(ledger.summary.maxStakeCents,Math.max(...ledger.rows.map(r=>r.stakeCents)));
  assert.equal(ledger.rows.find(r=>r.issue===ledger.summary.maxStakeIssue).stakeCents,ledger.summary.maxStakeCents);
  if(plan==='every-period-fixed')assert(chron.every(r=>r.stakeCents===10000));
  if(plan==='alternate-fixed')assert(chron.every((r,i)=>r.stakeCents===(i%2===0?10000:0)));
 }
}
console.log('PASS: 2021+ history audit, both scopes dynamic frequency, prefix replay, target mutation, warmup, six plan settlements');
