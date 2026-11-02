'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const source=fs.readFileSync(require('node:path').join(__dirname,'..','assets/js/crm-oftalmologos-visitas.js'),'utf8');
function setup(rpc,items='*') {
 let renders=0; const messages=[];
 const ctx={console,Intl,Date,Map,Set,setInterval(){},escAttr:s=>String(s).replace(/"/g,'&quot;'),
 document:{addEventListener(){},visibilityState:'visible'},renderSchedule(){renders++},
 showToast:s=>messages.push(s),
 window:{__blackPortalSession:{user:{id:'u',app_metadata:{}}},
 BlackPortal:{getSupabase:()=>({rpc}),isSuperAdmin:()=>false,
 accessSnapshot:{active:true,permissions:{'crm-oftalmologos':{level:'custom',items}}}}}};
 vm.createContext(ctx);vm.runInContext(source,ctx);
 return {api:ctx.window.BlackDoctorVisits,messages,get renders(){return renders}};
}
test('calendar days use Córdoba, including midnight, leap day and all color boundaries',()=>{
 const {api}=setup();
 assert.equal(api.dayKey('2026-11-03T02:59:59Z'),'2026-11-02');
 assert.equal(api.dayKey('2026-11-03T03:00:00Z'),'2026-11-03');
 for(const [date,days,tone] of [['2026-11-02',0,'recent'],['2026-10-26',7,'recent'],
 ['2026-10-25',8,'due'],['2026-10-19',14,'due'],['2026-10-18',15,'late'],
 ['2026-10-03',30,'late'],['2026-10-02',31,'overdue']]) {
  const s=api.status({visited_at:date+'T15:00:00Z'},'2026-11-02T15:00:00Z');
  assert.equal(s.days,days);assert.equal(s.tone,tone);
 }
 assert.equal(api.status({visited_at:'2024-02-28T15:00:00Z'},'2024-03-01T15:00:00Z').days,2);
 assert.equal(api.status(null).label,'Nunca visitado');
 assert.equal(api.status({visited_at:'invalid'}).days,null);
});
test('load, payment attribution, never visited and repeated clicks',async()=>{
 let writes=0,resolveWrite;
 const {api}=setup(async(name)=>{
  if(name==='crm_doctor_last_visits') return {data:[{doctor_id:'paid',visited_at:'2026-10-02T15:00:00Z',source:'payment'}]};
  writes++;return new Promise(resolve=>resolveWrite=resolve);
 });
 assert.match(api.card({_supabaseId:'d',nombre:'Doctor'}),/Consultando visitas/);
 await api.refresh();
 assert.match(api.card({_supabaseId:'d',nombre:'Doctor'}),/Nunca visitado/);
 assert.match(api.card({_supabaseId:'paid',nombre:'Doctor'}),/02\/10\/2026 · Pago de comisión/);
 const first=api.record('d'); const second=api.record('d');await second;
 assert.equal(writes,1);
 assert.match(api.card({_supabaseId:'d',nombre:'Doctor'}),/Guardando/);
 resolveWrite({data:[{doctor_id:'d',visited_at:new Date().toISOString()}]});await first;
 assert.match(api.card({_supabaseId:'d',nombre:'Doctor'}),/Visitado hoy/);
 await api.record('d');assert.equal(writes,1);
});
test('failed writes do not claim a visit; failed reads do not claim never visited',async()=>{
 let failRead=false;
 const {api,messages}=setup(async name=>name==='crm_doctor_last_visits'
 ? failRead?{error:'offline'}:{data:[]} : {error:'offline'});
 await api.refresh();await api.record('d');
 assert.match(api.card({_supabaseId:'d',nombre:'Doctor'}),/Nunca visitado/);
 assert.match(messages[0],/No se pudo guardar/);
 failRead=true;await api.refresh();
 assert.doesNotMatch(api.card({_supabaseId:'d',nombre:'Doctor'}),/Nunca visitado/);
 assert.match(api.card({_supabaseId:'d',nombre:'Doctor'}),/No se pudo consultar/);
});
test('read only profiles cannot record; manual writes beat a stale in-flight read',async()=>{
 let writes=0;
 const readOnly=setup(async()=>{writes++;return {data:[]}},['view']);
 await readOnly.api.refresh();await readOnly.api.record('d');
 assert.equal(writes,1);assert.doesNotMatch(readOnly.api.card({_supabaseId:'d',nombre:'Doctor'}),/data-visit-doctor/);
 let readCount=0,resolveRead;
 const {api}=setup(async name=>{
  if(name==='crm_record_doctor_visit')return {data:[{doctor_id:'d',visited_at:new Date().toISOString()}]};
  if(++readCount===1)return {data:[]};
  return new Promise(resolve=>resolveRead=resolve);
 });
 await api.refresh();const stale=api.refresh();await api.record('d');
 resolveRead({data:[]});await stale;
 assert.match(api.card({_supabaseId:'d',nombre:'Doctor'}),/Visitado hoy/);
});
