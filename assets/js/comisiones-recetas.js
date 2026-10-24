(()=>{'use strict';
const clean=x=>String(x??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9 ]/g,' ').replace(/\s+/g,' ').trim();
const column=x=>clean(x).replace(/ /g,'');
const get=(r,...names)=>{for(const n of names){let k=Object.keys(r||{}).find(x=>column(x)===column(n));if(k)return r[k]}return null};
const ref=x=>String(x??'').trim().replace(/\.0$/,'');
const doctorKey=x=>clean(x).split(' ').filter(Boolean).sort().join('|');
function resolve({candidates=[],saleId='',saleLines=[]}={}){
 const all=candidates.map((r,i)=>({index:i,recipe:ref(get(r,'Nro.Receta','Nro Receta','Numero Receta')),sale:ref(get(r,'NroVenta','Nro Venta','Numero Venta')),doctor:clean(get(r,'Medico','Médico')),date:String(get(r,'Fecha Receta','Fecha de Receta','Fecha')??'').trim()}));
 const sale=ref(saleId),linked=all.filter(r=>r.sale===sale&&r.sale);
 const ids=new Set(saleLines.map(r=>ref(get(r,'Nro.Receta','Nro Receta','Numero Receta'))).filter(Boolean));
 const byRecipe=all.filter(r=>r.recipe&&ids.has(r.recipe));
 const unlinked=all.filter(r=>!r.sale),otherSales=all.filter(r=>r.sale&&r.sale!==sale);
 const selected=linked.length?linked:byRecipe.length?byRecipe:unlinked;
 const source=linked.length?'venta':byRecipe.length?'numero_receta':unlinked.length?'paciente_vendedor':'sin_vinculo';
 const doctors=[...new Map(selected.filter(r=>r.doctor).map(r=>[doctorKey(r.doctor),r.doctor])).values()];
 const known=selected.filter(r=>r.doctor).length;
 const decision=!selected.length?'no_match':known>0&&known<selected.length?'mixed':known===0?'without_doctor':doctors.length>1?'several_doctors':'one_doctor';
 const doctor=decision==='one_doctor'?doctors[0]:decision==='several_doctors'?'MÉDICO NO ATRIBUIDO (MISMA TASA)':decision==='mixed'?'MÉDICO POR DETERMINAR':'';
 let warning='';
 if(decision==='one_doctor'&&selected.length>1)warning='Varias recetas del mismo médico; no alteran el porcentaje';
 if(decision==='several_doctors')warning='Médicos diferentes con la misma tasa: no se atribuye un médico individual';
 if(decision==='mixed')warning='Recetas con y sin médico: el porcentaje requiere revisión';
 if(decision==='without_doctor')warning='Receta registrada sin médico informado';
 if(!selected.length&&otherSales.length)warning='Las recetas encontradas corresponden a otras ventas';
 return {selected,source,decision,doctor,hasDoctor:known>0,warning};
}
window.BlackCommissionRecipeMatcher={resolve,doctorKey};
})();