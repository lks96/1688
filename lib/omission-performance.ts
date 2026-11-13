export type OmissionOutcome={issue:string;time:string;hit:boolean;specialRank:number|null};
export function median(values:number[]):number|null{if(!values.length)return null;const sorted=[...values].sort((a,b)=>a-b),mid=Math.floor(sorted.length/2);return sorted.length%2?sorted[mid]:(sorted[mid-1]+sorted[mid])/2;}
export function summarizeOmissionPerformance(input:OmissionOutcome[]){
 const rows=[...input].sort((a,b)=>a.time.localeCompare(b.time));
 if(new Set(rows.map(r=>r.issue)).size!==rows.length)throw new Error('命中统计包含重复期号');
 let wins=0,losses=0,maxWins=0,maxLosses=0,lastHit=-1;
 const intervals:number[]=[],hitIndexes:number[]=[];
 for(let i=0;i<rows.length;i++){
  const row=rows[i];
  if(row.hit){wins++;losses=0;maxWins=Math.max(maxWins,wins);if(lastHit>=0)intervals.push(i-lastHit);lastHit=i;hitIndexes.push(i);}
  else{losses++;wins=0;maxLosses=Math.max(maxLosses,losses);}
 }
 const rankStatistics=summarizeRanks(rows.flatMap(r=>r.specialRank===null?[]:[r.specialRank]));
 const hits=hitIndexes.length;
 return {draws:rows.length,hits,hitRate:rows.length?hits/rows.length:0,maxMisses:maxLosses,maxHits:maxWins,currentMisses:losses,currentHits:wins,
   medianHitInterval:median(intervals),medianMissesBetweenHits:median(intervals.map(v=>v-1)),completedIntervals:intervals.length,
   lastHit:lastHit>=0?{issue:rows[lastHit].issue,time:rows[lastHit].time}:null,
   ...rankStatistics};
}
export type OmissionPerformance=ReturnType<typeof summarizeOmissionPerformance>;

function summarizeRanks(values:number[]){
 if(values.some(rank=>!Number.isInteger(rank)||rank<1||rank>49))throw new Error('排序必须为1至49');
 const ranked=values;
 const ranks=Array.from({length:49},(_,i)=>{const rank=i+1,count=ranked.filter(r=>r===rank).length;return {rank,count,rate:ranked.length?count/ranked.length:0};});
 const ranges=Array.from({length:5},(_,i)=>{
  const start=i*10+1,end=Math.min(start+9,49),count=ranks.filter(r=>r.rank>=start&&r.rank<=end).reduce((s,r)=>s+r.count,0);
  return {start,end,label:`第${start}—${end}名`,count,rate:ranked.length?count/ranked.length:0,baseline:(end-start+1)/49};
 });
 const coverage=[5,10,15,20,30,40,49].map(top=>({top,count:ranks.slice(0,top).reduce((s,r)=>s+r.count,0),rate:ranked.length?ranks.slice(0,top).reduce((s,r)=>s+r.count,0)/ranked.length:0,baseline:top/49}));
 return {rankedDraws:ranked.length,ranks,ranges,coverage,bestRanges:ranked.length?ranges.filter(r=>r.count===Math.max(...ranges.map(v=>v.count))):[],bestRanks:ranked.length?ranks.filter(r=>r.count===Math.max(...ranks.map(v=>v.count))):[]};
}
export function summarizeSevenNumberPerformance(rows:{issue:string;time:string;allHitCount:number;allNumberRanks:number[]}[]){
 const summary=summarizeOmissionPerformance(rows.map(r=>({...r,hit:r.allHitCount>0,specialRank:null})));
 const rankStatistics=summarizeRanks(rows.flatMap(r=>r.allNumberRanks));
 const totalHits=rows.reduce((sum,r)=>sum+r.allHitCount,0);
 let noHitProbability=1;for(let i=0;i<7;i++)noHitProbability*=(39-i)/(49-i);
 return {...summary,...rankStatistics,totalHits,meanHits:rows.length?totalHits/rows.length:0,hitBaseline:1-noHitProbability,
 hitDistribution:Array.from({length:8},(_,hits)=>({hits,count:rows.filter(r=>r.allHitCount===hits).length}))};
}
export type SevenNumberPerformance=ReturnType<typeof summarizeSevenNumberPerformance>;
