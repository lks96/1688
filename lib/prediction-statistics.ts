export type HitRecord={issue:string;time:string;hits:number};
export function buildPredictionStatistics(input:HitRecord[]){
  const rows=[...input].sort((a,b)=>a.time.localeCompare(b.time));
  if(new Set(rows.map(r=>r.issue)).size!==rows.length)throw new Error('命中统计包含重复期号');
  if(rows.some(r=>!Number.isInteger(r.hits)||r.hits<0||r.hits>3))throw new Error('命中数必须为0至3');
  const event=(minimum:number,exact=false)=>{
    let missing=0,longestMissing=0,count=0,last:HitRecord|null=null;
    for(const row of rows){if(exact?row.hits===minimum:row.hits>=minimum){count++;last=row;missing=0;}else{missing++;longestMissing=Math.max(longestMissing,missing);}}
    return {count,rate:rows.length?count/rows.length:0,missing,censored:!last,longestMissing,last,recent30:rows.slice(-30).filter(r=>exact?r.hits===minimum:r.hits>=minimum).length};
  };
  let consecutiveHits=0,longestZero=0,zero=0;
  for(const row of rows){zero=row.hits===0?zero+1:0;longestZero=Math.max(longestZero,zero);consecutiveHits=row.hits>0?consecutiveHits+1:0;}
  const recent=rows.slice(-30);
  return {draws:rows.length,from:rows[0]?.time.slice(0,10)??'',to:rows.at(-1)?.time.slice(0,10)??'',allThree:event(3),exactTwo:event(2,true),atLeastTwo:event(2),consecutiveHits,longestZero,
    recentMean:recent.length?recent.reduce((s,r)=>s+r.hits,0)/recent.length:0,recentDraws:recent.length,
    distribution:Array.from({length:4},(_,hits)=>({label:`命中${hits}个`,hits,count:rows.filter(r=>r.hits===hits).length})),
    series:rows.map(row=>({...row,date:row.time.slice(5,10)})),allHitRecords:rows.filter(r=>r.hits===3).reverse().slice(0,10)};
}
