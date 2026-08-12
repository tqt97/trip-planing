import { sanitizeAlbumItem, averageExpensePerPerson, buildRadarPoints, filterRadarPlaces, importState, resolveRadarRadiusKm, sanitizeChecklist, sanitizeExpense, sanitizeTimelineItem, sanitizePlace, sanitizeTripSettings, totalExpenses, filterAndSortPlaces, haversineMeters } from '../src/core.js';
let seed=0xC0FFEE;
function rnd(){seed=(seed*1664525+1013904223)>>>0;return seed/2**32}
function weirdString(){const chars=['a',' ','<','>','&','\u0000','🔥','Đ','"',"'"];let out='';const n=Math.floor(rnd()*800);for(let i=0;i<n;i++)out+=chars[Math.floor(rnd()*chars.length)];return out}
for(let i=0;i<2000;i++){
  const p=sanitizePlace({name:weirdString(),address:weirdString(),note:weirdString(),lat:(rnd()-.5)*1000,lng:(rnd()-.5)*1000,distanceMeters:(rnd()-.2)*1e7,category:weirdString(),priority:weirdString()});
  if(p.name.length>120||p.address.length>300||p.note.length>500)throw new Error(`Monkey bounds failure at ${i}`);
  filterAndSortPlaces([p],{radiusKm:rnd()*100,query:weirdString(),category:'all',sort:'distance'});
  const home={lat:11.94,lng:108.44};
  haversineMeters(p,home);
  const radarRadius=resolveRadarRadiusKm([p],rnd()>0.5?5:9999,home);
  filterRadarPlaces([p],home,{category:'all',radiusKm:rnd()>0.5?5:9999});
  const radar=buildRadarPoints(home,[p],radarRadius);
  if(radar.some((point)=>!Number.isFinite(point.x)||!Number.isFinite(point.y)||point.radialRatio<0||point.radialRatio>1))throw new Error(`Monkey radar invariant failure at ${i}`);
  const expense=sanitizeExpense({payer:weirdString(),category:weirdString(),amountVnd:(rnd()-.15)*1e9,participants:[weirdString(),weirdString()],note:weirdString()});
  if(expense.payer.length>80||expense.note.length>300||expense.participants.length>50)throw new Error(`Monkey expense bounds failure at ${i}`);
  const total=totalExpenses([expense]);if(!Number.isFinite(total)||total<0)throw new Error(`Monkey expense total failure at ${i}`);
  const settings=sanitizeTripSettings({peopleCount:(rnd()-.2)*100});const avg=averageExpensePerPerson([expense],settings.peopleCount);if(!Number.isFinite(avg)||avg<0)throw new Error(`Monkey split failure at ${i}`);
  const check=sanitizeChecklist({title:weirdString(),note:weirdString(),category:weirdString(),visibility:rnd()>.5?'public':'private',done:rnd()>.5});if(check.title.length>180||check.note.length>500)throw new Error(`Monkey checklist bounds failure at ${i}`);
  const timeline=sanitizeTimelineItem({date:'2026-08-15',time:`${String(Math.floor(rnd()*24)).padStart(2,'0')}:30`,title:weirdString(),note:weirdString()});if(timeline.title.length>180||timeline.note.length>500)throw new Error(`Monkey timeline bounds failure at ${i}`);
  const album=sanitizeAlbumItem({title:weirdString(),status:rnd()>.66?'visited':rnd()>.33?'want':'reference',note:weirdString(),noteUrl:rnd()>.5?'https://example.com/ref':'javascript:bad'});if(album.title.length>160||album.note.length>600||album.noteUrl.startsWith('javascript:'))throw new Error(`Monkey album invariant failure at ${i}`);
}
const huge={home:{address:'x'.repeat(5000),lat:999,lng:-999},places:Array.from({length:1500},(_,i)=>({id:String(i),name:'n'.repeat(1000),address:'a'.repeat(1000)})),expenses:Array.from({length:6000},(_,i)=>({id:String(i),payer:'p'.repeat(500),amountVnd:i+1,note:'n'.repeat(1000)})),checklists:Array.from({length:6000},(_,i)=>({id:String(i),title:'c'.repeat(500),visibility:i%2?'public':'private'})),album:Array.from({length:2500},(_,i)=>({id:String(i),title:'a'.repeat(300),note:'n'.repeat(900)})),timeline:Array.from({length:1500},(_,i)=>({id:String(i),date:'2026-08-15',time:'08:00',title:'t'.repeat(300)})),tripSettings:{peopleCount:999}};
const imported=importState(JSON.stringify(huge));
if(imported.places.length!==1000||imported.expenses.length!==5000||imported.checklists.length!==5000||imported.album.length!==2000||imported.timeline.length!==1000||imported.tripSettings.peopleCount!==50)throw new Error('Monkey import bound failure');
console.log('monkey: 2,000 randomized place/radar/expense/checklist/album/timeline/settlement mutations + oversized import survived invariants');
