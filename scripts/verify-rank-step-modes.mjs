import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import ts from 'typescript';
import {pathToFileURL} from 'node:url';
import {RANK_STEP_MODES,backtestFrequentRankNumbers} from '../lib/omission-backtest.ts';
import {rankStepLedger,summarizePresence} from '../lib/rank-step.ts';
import {replayLongHistory} from '../lib/long-history.ts';
import {replayAnnualHistory,annualPlanComparison} from '../lib/annual-history.ts';
const fixture=Array.from({length:15},(_,i)=>({issue:String(i),time:String(i).padStart(3,'0'),numbers:[],scores:[],trainingThroughIssue:'',trainingThroughTime:'',ranking:Array.from({length:49},(_,n)=>n+1),frequencyRanks:Array.from({length:10},(_,n)=>n+1),regularNumbers:[1,20,21,22,23,24],specialNumber:i===10?1:49}));
for(const {count,missThreshold:t} of RANK_STEP_MODES){
 const result=backtestFrequentRankNumbers(fixture,'miss-streak-step',0,count),rows=[...result.rows].reverse();
 assert(rows.every(r=>r.candidates.length===count));assert.equal(rows[0].stakeCents,count*1000);
 for(let i=1;i<t;i++)assert.equal(rows[i].stakeCents,0);
 assert.equal(rows[t].stakeCents,count*1000);assert.equal(rows[t+1].stakeCents,count*2000);
 assert.equal(rows[10].returnCents,(10-t+1)*1000*47);assert.equal(rows[11].stakeCents,count*1000);assert.equal(rows[12].stakeCents,0);
 const before=backtestFrequentRankNumbers(fixture.slice(0,t),'miss-streak-step',0,count);
 assert.equal(before.next.stakeCents,rows[t].stakeCents);
 const swapped=structuredClone(fixture);swapped[t].frequencyRanks=[11,12,13,14,15,16,17,18,19,20];
 const dynamic=backtestFrequentRankNumbers(swapped,'miss-streak-step',0,count).rows.find(r=>r.issue===String(t));
 assert.deepEqual(dynamic.candidates.map(c=>c.number),swapped[t].frequencyRanks.slice(0,count));
 const special=rankStepLedger(fixture,'special',count,0),all=rankStepLedger(fixture,'all',count,0);
 assert.equal(special.presence.maxPresent,1);assert.equal(all.presence.maxPresent,15);
 assert.equal(all.presence.averageGap,0);assert.equal(all.presence.currentAbsent,0);
 assert.equal(special.summary.profitCents,all.summary.profitCents);
}
assert.deepEqual(summarizePresence([true,false,false,true,true,false]),{periods:6,currentAbsent:1,maxAbsent:2,maxPresent:2,averageGap:1,medianGap:1,completedIntervals:2});
assert.equal(summarizePresence([false,false]).medianGap,null);
const seed=JSON.parse(fs.readFileSync('lib/long-history-seed.json','utf8')),cutoff='2026-11-17 00:00:00';
const long=replayLongHistory(seed,cutoff),annual=replayAnnualHistory(seed,cutoff);
// Compare against the pre-change implementation: original ten-number policies must keep their settlements.
let source=execFileSync('git',['show','HEAD:lib/omission-backtest.ts'],{encoding:'utf8'});
for(const name of ['omission-performance','omissions','omission-strategy'])source=source.replaceAll(`'./${name}.ts'`,`'${pathToFileURL(process.cwd()+'/lib/'+name+'.ts').href}'`);
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const previous=await import('data:text/javascript;base64,'+Buffer.from(compiled).toString('base64'));
for(const scope of ['special','all']){
 for(const plan of ['alternate-fixed','miss-streak-step','every-period-fixed'])assert.deepEqual(backtestFrequentRankNumbers(long.scopes[scope],plan).summary,previous.backtestFrequentRankNumbers(long.scopes[scope],plan).summary);
 for(const {count} of RANK_STEP_MODES){
  const ledger=rankStepLedger(long.scopes[scope],scope,count);
  assert.equal(ledger.next.stakeCents,ledger.next.stakePerNumberCents*count);
  for(const row of ledger.rows)assert.deepEqual(row.candidates.map(c=>c.rank),row.frequencyRanks.slice(0,count));
  const comparison=annualPlanComparison(annual.years,scope,'miss-streak-step',count);
  assert.equal(comparison.profitCents,comparison.annual.reduce((n,y)=>n+y.profitCents,0));
  for(const year of annual.years){
   const perYear=rankStepLedger(year.scopes[scope],scope,count,99);
   if(year.draws>100)assert.equal(perYear.rows.at(-1).stakeCents,count*1000);
   assert(perYear.rows.every(r=>r.time.startsWith(year.year)));
  }
 }
}
console.log('PASS: 4/6/10 selection, thresholds 6/4/3, step/reset/next stakes, dynamic ranks, scope-specific five statistics, annual resets, original ten-number results preserved');
