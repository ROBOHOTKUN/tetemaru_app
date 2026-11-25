// Compare calendar dates as day numbers, including days when local clocks change.
const dayNumber = date => Date.parse(date+'T00:00:00Z') / 86400000;

export function waveAffinity(startScore,startDay,studyDays,today){
  const start=dayNumber(startDay),end=dayNumber(today);
  let score=Math.max(0,Math.min(100,Math.round(startScore)));
  let last=start;
  const days=[...new Set(studyDays)].map(dayNumber)
    .filter(day=>day>=start&&day<=end).sort((a,b)=>a-b);
  function afterAbsence(day){
    const skipped=Math.max(0,day-last-1);
    return Math.max(0,score-2*skipped);
  }
  for(const day of days){
    score=Math.min(100,afterAbsence(day)+5);
    last=day;
  }
  return afterAbsence(end);
}
