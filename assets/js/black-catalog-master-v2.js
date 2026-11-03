/* Black Catalog AI — Prompt Maestro v2, plantilla estable. */
(function(){
'use strict';
const e=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const names=['Redondo','Ovalado','Cuadrado','Triángulo','Corazón','Rombo'],images={damas:['54GztdW','oN3TTuz','3IEuDF7','VQKQQHs','UUrmBLt','wkPKBpn'],caballeros:['LJbL4dQ','z70nefh','k5uhcwn','cmF7507','PLwrYs6','A3gRjIF']};
const choices={cat:[0,1,3,4],rect:[0,1,5],round:[2,3,5],aviator:[1,3,4],brow:[1,2,4],oval:[0,1,2,3,4,5],geometric:[0,1,4]};
function shape(s){s=String(s||'').toLowerCase();if(/cat.eye|ojo de gato/.test(s))return'cat';if(/browline|mariposa|butterfly/.test(s))return'brow';if(/aviador|aviator/.test(s))return'aviator';if(/geom[eé]tric|angular/.test(s))return'geometric';if(/rectangular|cuadrad/.test(s))return'rect';if(/redond|circular|round/.test(s))return'round';if(/oval/.test(s))return'oval';return'unknown'}
const line=()=>'<div style="height:1px;background:linear-gradient(90deg,transparent,#CFCFCF,transparent);margin:0 0 32px"></div>';
function faces(d){
 const k=shape(d.shape||d.style);
 const g=['femenino','masculino'].includes(d.gender)?d.gender:'unisex';
 const selected=choices[k]||[];
 const refs=g==='femenino'?names.map((n,i)=>({n,i,set:'damas'})):g==='masculino'?names.map((n,i)=>({n,i,set:'caballeros'})):[0,1,2].map(i=>({n:names[i],i,set:'damas'})).concat([3,4,5].map(i=>({n:names[i],i,set:'caballeros'})));
 const cards=refs.map(({n,i,set})=>{
  const yes=k!=='unknown'&&selected.includes(i);
  const image='https://i.imgur.com/'+images[set][i]+'.jpeg';
  return '<div style="min-width:0;text-align:center">'+
   '<div style="position:relative;overflow:hidden;aspect-ratio:1/1;border:2px solid '+(yes?'#179E52':'#E9E9E9')+';border-radius:12px;background:#fff;box-sizing:border-box">'+
    '<img src="'+image+'" alt="Rostro '+e(n)+' - '+(set==='damas'?'mujer':'hombre')+'" style="display:block;width:100%;height:100%;object-fit:contain;'+(yes?'':'filter:grayscale(100%);opacity:.25;')+'">'+
    (yes?'<span style="position:absolute;right:10px;top:10px;display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:50%;background:#179E52;color:#fff;font:700 15px Montserrat,Arial,sans-serif">&#10003;</span>':'')+
   '</div>'+
   '<p style="font:700 10px/1.4 Montserrat,Arial,sans-serif;letter-spacing:1.2px;text-transform:uppercase;margin:11px 0 0;color:'+(yes?'#121212':'#B5B5B5')+'">'+(yes?'&#10003; ':'')+e(n)+'</p></div>';
 }).join('');
 return '<section style="margin:0 0 38px">'+
 '<div style="text-align:center;margin:0 0 25px"><p style="font:700 10px Montserrat,Arial,sans-serif;letter-spacing:3px;color:#9B9189;margin:0 0 10px">BLACK ÓPTICA · STYLE GUIDE</p>'+
 '<h2 style="font:700 25px/1.25 Montserrat,Arial,sans-serif;text-align:center;letter-spacing:1px;text-transform:uppercase;color:#121212;margin:0 0 9px">Guía de rostros</h2>'+
 '<p style="color:#777;font:400 13px/1.65 Montserrat,Arial,sans-serif;margin:0">Los rostros destacados son los que mejor armonizan con este diseño.</p></div>'+
 (k==='unknown'?'<p style="text-align:center;color:#777;font:400 13px Montserrat,Arial,sans-serif">Forma del armazón pendiente de confirmar: no se asignaron recomendaciones.</p>':'')+
 '<div class="bo-rostros-grid" style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:22px 14px;margin:0 0 24px">'+cards+'</div>'+
 '<div style="background:#F7F5F2;border-left:3px solid #D4C4B5;border-radius:0 10px 10px 0;padding:17px 20px;font:400 12px/1.8 Montserrat,Arial,sans-serif;color:#514D49"><strong style="color:#121212">TU ESTILO NO TIENE REGLAS.</strong> Esta guía es orientativa: la comodidad, las proporciones y cómo te sentís con el armazón también importan.</div></section>';
}
function measures(m={}){const items=[['lens','Ancho lente'],['bridge','Puente'],['height','Alto lente'],['temple','Patilla'],['total','Ancho total']];return '<p style="text-align:center;font:700 9px Montserrat,Arial,sans-serif;letter-spacing:6px;color:#aaa;margin:0 0 20px">MEDIDAS DEL ARMAZÓN</p><div style="text-align:center;margin:0 0 20px"><div style="display:inline-block;max-width:100%;box-sizing:border-box;border:1px solid #e0e0e0;border-radius:8px;padding:24px 32px;background:#fafafa"><img src="https://i.imgur.com/L2Fxkue.png" alt="Diagrama de referencia de medidas" style="max-width:100%;width:480px;display:block"></div></div><div class="bo-medidas-wrap" style="display:flex;flex-wrap:wrap;gap:8px;margin:0 0 36px">'+items.map(([key,label],i)=>{const n=Number(m[key]),valid=Number.isFinite(n)&&n>0&&n<250;return '<div style="flex:1 1 88px;text-align:center;padding:14px 8px;background:'+(i===4?'#111':'#fafafa')+';border:1px solid #e8e8e8;border-radius:3px"><p style="font:700 22px Montserrat,Arial,sans-serif;color:'+(i===4?'#D4C4B5':'#111')+';margin:0 0 3px">'+(valid?e(n)+'<span style="font-size:11px"> mm</span>':'—')+'</p><p style="font:700 9px Montserrat,Arial,sans-serif;color:#aaa;margin:0">'+label+'</p></div>'}).join('')+'</div>'}
function benefits(d){const sun=d.category==='sun',confirmed=(d.confirmed||[]).join(' ').toLowerCase(),uv=/uv400|protecci[oó]n uv certificada/.test(confirmed);const card=(img,title,desc,big)=>'<div class="bo-benefit" style="flex:1 1 150px;padding:19px 14px;border:1px solid #e8e8e8;border-radius:18px;background:#fafafa;text-align:center">'+(img?'<img src="'+img+'" alt="'+e(title)+'" style="width:'+(big?168:72)+'px;height:'+(big?168:72)+'px;max-width:100%;object-fit:contain;display:block;margin:0 auto 8px">':'<p style="font:700 27px Montserrat,Arial,sans-serif;margin:20px 0">UV<span style="color:#D4C4B5">400</span></p>')+'<p style="font:700 12px Montserrat,Arial,sans-serif;color:#111;margin:0 0 4px">'+e(title)+'</p><p style="font:300 11px/1.6 Montserrat,Arial,sans-serif;color:#777;margin:0">'+e(desc)+'</p></div>';return '<div class="bo-banner-outer" style="padding:1px;border-radius:22px;background:#E5E5E5;margin:0 0 36px"><div style="background:#fff;padding:30px 22px;text-align:center;border-radius:22px"><p style="font:700 10px Montserrat,Arial,sans-serif;letter-spacing:2.5px;color:#666;margin:0 0 22px">BENEFICIOS BLACK ÓPTICA</p><div class="bo-flex-wrap" style="display:flex;flex-wrap:wrap;gap:12px">'+(sun?card('','Protección solar',uv?'UV400 confirmado':'Verificar especificaciones UV'):card('https://i.imgur.com/WQNc664.png','Cristales con graduación','Consultar graduación y condiciones'))+card('https://i.imgur.com/DIrwHLX.png','Líquido limpia cristales','Profesional, de uso óptico')+card('https://i.imgur.com/lrwYVGB.jpeg','Black Protect','40% de beneficio de reposición durante un año, sujeto a condiciones',true)+'</div><p style="font:400 11px Montserrat,Arial,sans-serif;color:#777;margin:14px 0 0">Confirmá al comprar los beneficios incluidos y las condiciones vigentes.</p></div></div>'}
function clips(d){const t=String(d.category||'')+' '+String(d.name||'');if(!/clip.?on|2\s*en\s*1|5\s*en\s*1/i.test(t))return'';const five=/5\s*en\s*1/i.test(t),labels=five?['Aplique 1','Aplique 2','Aplique 3','Aplique 4','Aplique 5']:['Sin aplique','Con aplique imantado'];return '<section style="margin:0 0 32px"><h3 style="text-align:center;font:700 15px Montserrat,Arial,sans-serif;letter-spacing:3px;color:#D4C4B5">SISTEMA '+(five?'5 EN 1':'2 EN 1')+'</h3><div style="display:flex;flex-wrap:wrap;gap:10px">'+labels.map(x=>'<div style="flex:1 1 110px;padding:18px;border:1px solid #e8e8e8;text-align:center;font:700 12px Montserrat,Arial,sans-serif">'+e(x)+'</div>').join('')+'</div><p style="font:300 12px Montserrat,Arial,sans-serif;color:#777;text-align:center">Verificá los apliques incluidos antes de publicar.</p></section>'}

function editorialFacts(d){
 const confirmed=Array.isArray(d.confirmed)?d.confirmed:[];
 const manuallyVerified=Array.isArray(d.verifiedFeatures)?d.verifiedFeatures.map(x=>String(x).toLowerCase()):[];
 return confirmed.map(x=>String(x||'').trim()).filter(Boolean).filter(x=>{
  const lower=x.toLowerCase();
  if(/^(?:material|fabricad[oa]|hech[oa]\s+de|composici[oó]n)\b/.test(lower)&&!d.materialVerified&&!manuallyVerified.includes(lower))return false;
  if(/(?:uv400|protecci[oó]n uv|polarizad[oa]|antirreflej|fotocrom[aá]tic)/i.test(lower)&&!manuallyVerified.includes(lower))return false;
  if(/\b(?:calibre|mm|medidas?)\b/i.test(lower)&&!manuallyVerified.includes(lower))return false;
  return true;
 }).slice(0,7);
}
function editorialText(d,facts){
 const find=pattern=>facts.find(x=>pattern.test(x.toLowerCase()));
 const shapeFact=find(/^(?:frente|forma|dise[nñ]o)\b/);
 const colorFact=find(/^(?:color|tono|acabado|terminaci[oó]n)\b/);
 const templeFact=find(/^(?:patillas?|varillas?)\b/);
 const bridgeFact=find(/^puente\b/);
 const strip=(value,pattern)=>String(value||'').replace(pattern,'').trim().replace(/[.;]+$/,'');
 const shapeValue=strip(shapeFact,/^(?:frente|forma|dise[nñ]o)\s*:?\s*/i);
 const colorValue=strip(colorFact,/^(?:color|tono|acabado|terminaci[oó]n)\s*:?\s*/i);
 const templeValue=strip(templeFact,/^(?:patillas?|varillas?)\s*:?\s*/i);
 const bridgeValue=strip(bridgeFact,/^puente\s*:?\s*/i);
 const lines=[];
 if(shapeValue&&colorValue)lines.push('El diseño combina un frente '+shapeValue.toLowerCase()+' con un acabado '+colorValue.toLowerCase()+'.');
 else if(shapeValue)lines.push('Su frente '+shapeValue.toLowerCase()+' define la silueta del modelo.');
 else if(colorValue)lines.push('El acabado '+colorValue.toLowerCase()+' es uno de los detalles que distinguen este armazón.');
 if(templeValue)lines.push('De perfil, las patillas muestran '+templeValue.toLowerCase()+'.');
 if(bridgeValue)lines.push('El puente presenta un diseño '+bridgeValue.toLowerCase()+'.');
 const body=lines.length?lines.slice(0,3).join(' '):'Descubrí el diseño de este armazón desde distintos ángulos y explorá sus detalles en las fotografías.';
 const closing=d.category==='optical'?'¿Querés adaptarlo a tu receta? Te ayudamos a elegir los cristales y comprobar el ajuste.':d.category==='sun'?'Consultanos por la protección solar y las especificaciones confirmadas de este modelo.':'Vení a conocer sus medidas, comprobar el ajuste y encontrar tu opción ideal.';
 return {body,closing};
}
function editorialSection(d){
 const facts=editorialFacts(d),story=editorialText(d,facts);
 const rows=facts.length?facts.map((f,i)=>'<div class="bo-fact" style="display:flex;align-items:flex-start;gap:13px;padding:14px 0;border-bottom:'+(i===facts.length-1?'0':'1px solid #E3E3E3')+'"><span style="font:600 10px/1.8 Montserrat,Arial,sans-serif;color:#898989;min-width:22px">'+String(i+1).padStart(2,'0')+'</span><span style="font:500 13px/1.7 Montserrat,Arial,sans-serif;color:#303030">'+e(f.charAt(0).toUpperCase()+f.slice(1))+'</span></div>').join(''):'<p style="font:400 13px/1.8 Montserrat,Arial,sans-serif;color:#626262;margin:14px 0 0">Estamos confirmando las características específicas de este modelo.</p>';
 return '<section class="bo-editorial-grid" style="display:grid;grid-template-columns:minmax(0,.95fr) minmax(0,1.05fr);gap:14px;margin:0 0 42px;align-items:stretch">'+
 '<div class="bo-panel bo-panel-light" style="background:#F5F5F5;border:1px solid #E8E8E8;border-radius:24px;padding:clamp(24px,4vw,38px);box-sizing:border-box;min-width:0">'+
 '<div style="display:flex;justify-content:space-between;align-items:center;gap:12px;margin:0 0 23px"><span style="font:700 10px/1.5 Montserrat,Arial,sans-serif;letter-spacing:2px;color:#737373;text-transform:uppercase">Los detalles</span><span style="border:1px solid #D5D5D5;border-radius:100px;padding:6px 10px;font:600 10px Montserrat,Arial,sans-serif;color:#686868">01 / 02</span></div>'+
 '<h2 style="font:700 clamp(22px,3vw,29px)/1.2 Montserrat,Arial,sans-serif;letter-spacing:-1px;color:#121212;margin:0 0 14px">Cada detalle<br>cuenta.</h2>'+
 '<p style="font:400 12px/1.7 Montserrat,Arial,sans-serif;color:#666;margin:0 0 12px">Lo que distingue a este armazón.</p>'+
 '<div>'+rows+'</div></div>'+
 '<div class="bo-panel bo-panel-dark" style="position:relative;overflow:hidden;background:#121212;border:1px solid #242424;border-radius:24px;padding:clamp(24px,4vw,38px);box-sizing:border-box;min-width:0;display:flex;flex-direction:column;justify-content:space-between">'+
 '<div style="position:absolute;right:-60px;top:-80px;width:230px;height:230px;border:1px solid rgba(255,255,255,.10);border-radius:50%;pointer-events:none"></div>'+
 '<div style="position:absolute;right:-30px;top:-48px;width:170px;height:170px;border:1px solid rgba(255,255,255,.09);border-radius:50%;pointer-events:none"></div>'+
 '<div style="position:relative"><div style="display:flex;justify-content:space-between;align-items:center;gap:12px;margin:0 0 28px"><span style="font:700 10px/1.5 Montserrat,Arial,sans-serif;letter-spacing:2px;color:#BDBDBD;text-transform:uppercase">Visto de cerca</span><span style="border:1px solid #555;border-radius:100px;padding:6px 10px;font:600 10px Montserrat,Arial,sans-serif;color:#CCC">02 / 02</span></div>'+
 '<h2 style="font:700 clamp(26px,3.7vw,38px)/1.12 Montserrat,Arial,sans-serif;letter-spacing:-1.3px;color:#FFFFFF;margin:0 0 24px">Diseño con<br><span style="color:#B9B9B9">personalidad.</span></h2>'+
 '<p style="font:400 14px/1.9 Montserrat,Arial,sans-serif;color:#E5E5E5;margin:0 0 30px;max-width:360px">'+e(story.body)+'</p></div>'+
 '<div style="position:relative;border-top:1px solid #474747;padding-top:19px"><p style="font:500 12px/1.8 Montserrat,Arial,sans-serif;color:#CFCFCF;margin:0">'+e(story.closing)+'</p></div></div></section>';
}
function render(d,brands=[]){
 const b=brands.find(x=>x.id===d.brandId),brand=b?.name||d.brand||'Black Óptica',kind=d.category==='sun'?'Lentes de sol':d.category==='optical'?'Armazón recetado':'Anteojos',name=d.name||'Modelo pendiente',color=d.color||'',k=shape(d.shape||d.style),facts=(d.confirmed||[]).map(String).filter(Boolean).slice(0,12),logo=b?.logo&&/^https:\/\//.test(b.logo)?b.logo:'';
 const fixed=d.category==='sun'?'En Black Óptica te ayudamos a elegir anteojos de sol según diseño, ajuste y especificaciones de protección verificadas.':'En Black Óptica te asesoramos para combinar este armazón con cristales adecuados a tu receta y necesidades de uso.';
 const intro=e(d.intro||'Conocé este modelo de cerca: su forma, su color y los detalles que lo hacen único.');
 return '<style>@import url(https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700&display=swap);.bo-panel{transition:transform .25s ease,box-shadow .25s ease}.bo-panel:hover{transform:translateY(-3px);box-shadow:0 15px 30px rgba(0,0,0,.09)}.bo-benefit{transition:transform .2s ease,border-color .2s ease}.bo-benefit:hover{transform:translateY(-2px);border-color:#AFAFAF!important}@media(max-width:500px){.bo-flex-wrap{flex-direction:column!important}.bo-rostros-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important}.bo-medidas-wrap{flex-wrap:wrap!important}.bo-editorial-grid{grid-template-columns:1fr!important}.bo-panel{padding:24px!important}}@media(prefers-reduced-motion:reduce){.bo-panel,.bo-benefit{transition:none!important}}</style><div style="font-family:Montserrat,Arial,sans-serif;color:#111;background:#fff;max-width:740px;margin:0 auto;padding:36px 20px;box-sizing:border-box">'+
 (logo?'<div style="text-align:center;margin:0 0 16px"><img src="'+e(logo)+'" alt="'+e(brand)+'" style="height:34px;object-fit:contain"></div>':'')+
 '<p style="text-align:center;font:700 10px Montserrat,Arial,sans-serif;letter-spacing:7px;text-transform:uppercase;color:#D4C4B5;margin:0 0 12px">'+e(brand)+' &middot; '+e(kind)+'</p><h1 style="text-align:center;font:700 28px Montserrat,Arial,sans-serif;letter-spacing:1px;text-transform:uppercase;margin:0 0 8px">'+e(name)+(color?' &mdash; '+e(color):'')+'</h1><p style="text-align:center;font:300 11px Montserrat,Arial,sans-serif;color:#aaa;letter-spacing:4px;margin:0 0 20px">'+e(d.sku||'')+(d.sku?' &mdash; ':'')+e(k==='unknown'?'':k)+'</p><div style="display:flex;flex-wrap:wrap;justify-content:center;gap:8px;margin:0 0 28px"><span style="border:1px solid #111;padding:6px 13px;border-radius:100px;font:700 10px Montserrat,Arial,sans-serif">'+e(kind)+'</span><span style="background:#111;color:#FFF;padding:6px 13px;border-radius:100px;font:700 10px Montserrat,Arial,sans-serif">'+e(brand)+'</span></div>'+
 line()+clips(d)+measures(d.measurements)+line()+faces(d)+line()+
 '<p style="text-align:center;font:400 15px/1.9 Montserrat,Arial,sans-serif;color:#444;max-width:590px;margin:0 auto 32px">'+intro+'</p>'+editorialSection(d)+benefits(d)+line()+
 '<div style="text-align:center"><p style="font:700 16px Montserrat,Arial,sans-serif;margin:0 0 8px">Vení a probarlo en nuestras sucursales o consultanos por WhatsApp.</p><p style="font:300 12px/1.7 Montserrat,Arial,sans-serif;color:#777;margin:0">Asesoramiento personalizado · Consultanos por retiro, disponibilidad y opciones de envío</p></div></div>';
}
window.BlackCatalogMasterV2={render,version:'2.4'};
})();