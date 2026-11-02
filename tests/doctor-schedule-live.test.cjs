'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'..','assets/js/crm-oftalmologos.js'),'utf8');
const logic=source.slice(source.indexOf('function getScheduleClock'),source.indexOf('function renderSchedule()'));
const live=source.slice(source.indexOf('function refreshLiveSchedule()'),source.indexOf('(async function bootCrmOftalmologos()'));
function setup(){
 const ctx={Intl,Date,console,localStorage:{setItem(){}},setInterval(fn,ms){ctx.interval=ms},
 document:{visibilityState:'visible',addEventListener(){}},window:{addEventListener(){}},
 normName:s=>String(s||'').toLowerCase(),showToast(){throw Error('Unexpected toast')}};
 vm.createContext(ctx);
 vm.runInContext("const DIAS=['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];let selectedDay='Martes';let scheduleFilters={institutions:[],query:'',time:'all'};let doctors=[];",ctx);
 vm.runInContext(logic+live,ctx);
 vm.runInContext("let fixed={day:'Lunes',minutes:13*60,time:'13:00'};const realClock=getScheduleClock;getScheduleClock=()=>fixed;renderDaySelector=()=>{};renderSchedule=()=>{};",ctx);
 return {ctx,run:s=>vm.runInContext(s,ctx)};
}
test('Córdoba clock crosses midnight independently of device timezone',()=>{
 const {run}=setup();
 assert.equal(run("realClock(new Date('2026-11-03T02:59:00Z')).day"),'Lunes');
 assert.equal(run("realClock(new Date('2026-11-03T02:59:00Z')).time"),'23:59');
 assert.equal(run("realClock(new Date('2026-11-03T03:00:00Z')).day"),'Martes');
});
test('now includes active and future slots, excludes ended and unknown; other modes retained',()=>{
 const {run}=setup();
 for(const [start,end,expected] of [['09:00','12:59',false],['09:00','13:00',false],['12:00','13:01',true],['13:00','14:00',true],['15:00','17:00',true],['','',false]])
  assert.equal(run("scheduleTurnMatchesTime("+JSON.stringify({desde:start,hasta:end})+",'now')"),expected);
 assert.equal(run("scheduleTurnMatchesTime({desde:'09:00',hasta:'12:00'},'morning')"),true);
 assert.equal(run("scheduleTurnMatchesTime({desde:'15:00',hasta:'17:00'},'afternoon')"),true);
 assert.equal(run("scheduleTurnMatchesTime({availability_text:'Consultar'},'all')"),true);
});
test('one tap selects today; active ending soon first, future by start; clinic/search and visit data preserved',()=>{
 const {run}=setup();
 run("doctors="+JSON.stringify([
 ['future2','15:00','18:00'],['ended','09:00','12:00'],['active2','09:00','15:00'],['future1','14:00','16:00'],['active1','12:00','13:30'],['unknown','','']
 ].map(([id,desde,hasta])=>({id,nombre:id,_supabaseId:id,instituciones:[{nombre:'Clínica',turnos:[{dia:'Lunes',desde,hasta}]}]})))+";setScheduleTime('now')");
 assert.equal(run("selectedDay"),'Lunes');
 assert.equal(run("getFilteredDoctorsForDay(selectedDay).map(d=>d.id).join(',')"),'active1,active2,future1,future2');
 assert.equal(run("getFilteredDoctorsForDay('Martes').length"),0);
 run("scheduleFilters.query='future';scheduleFilters.institutions=['clínica']");
 assert.equal(run("getFilteredDoctorsForDay(selectedDay).map(d=>d.id).join(',')"),'future1,future2');
 assert.equal(run("getFilteredDoctorsForDay(selectedDay)[0]._supabaseId"),'future1');
 run("scheduleFilters.institutions=['otra']");
 assert.equal(run("getFilteredDoctorsForDay(selectedDay).length"),0);
 run("selectDay('Martes')");
 assert.equal(run("scheduleFilters.time"),'all');
});
test('live refresh follows new day, respects hidden tabs and leaves other modes alone',()=>{
 const {ctx,run}=setup();
 assert.equal(ctx.interval,30000);
 run("setScheduleTime('now');fixed={day:'Martes',minutes:1,time:'00:01'};refreshLiveSchedule()");
 assert.equal(run("selectedDay"),'Martes');
 run("scheduleFilters.time='morning';selectedDay='Lunes';refreshLiveSchedule()");
 assert.equal(run("selectedDay"),'Lunes');
 run("scheduleFilters.time='now';document.visibilityState='hidden';refreshLiveSchedule()");
 assert.equal(run("selectedDay"),'Lunes');
});
