(()=>{
  const SOURCE='sinergia';
  const $=id=>document.getElementById(id);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c]));
  const money=v=>Number(v||0).toLocaleString('es-AR',{style:'currency',currency:'ARS',maximumFractionDigits:0});
  function client(){try{if(window.parent&&window.parent!==window&&window.parent.BlackPortal?.getSupabase)return window.parent.BlackPortal.getSupabase();}catch(_){ }return window.BlackPortal?.getSupabase?.()||null}
  function cleanHeader(v){return String(v||'').replace(/^\uFEFF/,'').trim()}
  function norm(v){return String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/\s+/g,' ').trim()}
  function hash32(str){let h=2166136261;for(let i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,16777619)}return (h>>>0).toString(16).padStart(8,'0')}
  function stableKey(row){return `${SOURCE}:${hash32([norm(row.Descripcion),row.IdRubro,row.IdSubRubro,row.IdSubSubRubro].join('|'))}`}

  function parseCsv(text){
    const first=(text.split(/\r?\n/,1)[0]||'');
    const delim=(first.match(/;/g)||[]).length>(first.match(/,/g)||[]).length?';':',';
    const rows=[];let row=[],field='',quoted=false;
    for(let i=0;i<text.length;i++){
      const ch=text[i];
      if(ch==='"'){if(quoted&&text[i+1]==='"'){field+='"';i++;}else quoted=!quoted;continue;}
      if(ch===delim&&!quoted){row.push(field);field='';continue;}
      if((ch==='\n'||ch==='\r')&&!quoted){if(ch==='\r'&&text[i+1]==='\n')i++;row.push(field);field='';if(row.some(x=>String(x).trim()!==''))rows.push(row);row=[];continue;}
      field+=ch;
    }
    if(field||row.length){row.push(field);if(row.some(x=>String(x).trim()!==''))rows.push(row)}
    if(rows.length<2)return [];
    const headers=rows[0].map(cleanHeader);
    return rows.slice(1).map(cols=>Object.fromEntries(headers.map((h,i)=>[h,String(cols[i]??'').trim()])));
  }

  function number(v){const s=String(v??'').trim().replace(/\./g,'').replace(',','.').replace(/[^\d.-]/g,'');const n=Number(s);return Number.isFinite(n)?n:null}

  function classify(desc){
    const d=norm(desc),features=[];
    const lensLike=/ORGANICO|POLICARBONATO|ALTO INDICE|BIFOCAL|MULTIFOCAL|OCUPACIONAL|KODAK|CRIZAL|BLUE|FOTOCROM|LENTE|CRISTAL/.test(d);
    let optical_case=null;
    if(/MULTIFOCAL|PROGRESIV/.test(d))optical_case='multifocal';
    else if(/BIFOCAL/.test(d))optical_case='bifocal';
    else if(/OCUPACIONAL|OFFICE|WORKSPACE/.test(d))optical_case='occupational';
    else if(lensLike&&!/^ANTEOJO /.test(d))optical_case='monofocal';

    let supply_mode=null;
    if(/LABORATORIO/.test(d))supply_mode='laboratory';
    else if(/R\.\s*E\b|RANGO EXTENDIDO/.test(d))supply_mode='range_extended';
    else if(/STOCK|RANGO CENTRAL/.test(d))supply_mode='stock';

    let material=null;
    if(/POLICARBONATO/.test(d)){material='1.59 policarbonato';features.push('polycarbonate')}
    const idx=d.match(/\b1\.(49|50|53|56|59|60|61|67|70|74)\b/);
    if(idx&&!material)material=idx[0];
    if(/ALTO INDICE/.test(d))features.push('high_index');

    const isSuper=/SUPER BLUE/.test(d);
    const isBlue4k=/BLACK BLUE 4K/.test(d);
    const isBlue=/FILTRO (LUZ )?(AZUL|BLUE)|BLUE UV/.test(d);
    const isPhoto=/FOTOCROM/.test(d);
    const isAr=/C\/AR\b|ANTIRREF|ANTIRRELEX|NO REFLEX|CRIZAL/.test(d);
    if(isSuper)features.push('super_blue');
    else if(isBlue4k)features.push('black_blue_4k');
    else if(isBlue)features.push('blue_filter');
    if(isPhoto)features.push('photochromic');
    if(isAr)features.push('antireflective');

    let treatment='none';
    if(isSuper)treatment='super_blue';
    else if(isBlue4k)treatment='black_blue_4k';
    else if(isPhoto&&isBlue)treatment='photochromic_blue';
    else if(isPhoto)treatment='photochromic';
    else if(isBlue)treatment='blue_filter';
    else if(isAr)treatment='antireflective';

    let design=null;
    const designs=['AILENS','EXCLUSIVE','FREE','NEW','ONE','PRO','PRECISE','SOFTWEAR','UNIQUE','SV DIGITAL','ESPACE PLUS'];
    for(const x of designs)if(d.includes(x)){design=x;break}
    return {lensLike,optical_case,supply_mode,material,treatment,features,design};
  }

  function normalizedRow(raw){
    const desc=raw.Descripcion||raw.descripcion||'',c=classify(desc),price=number(raw.PrecioVentaConIva);
    return {
      source_system:SOURCE,source_key:stableKey(raw),name:desc.trim(),family:c.lensLike?'lens':'catalog',design:c.design,
      material:c.material,treatment:c.treatment,optical_case:c.optical_case,supply_mode:c.supply_mode,description:desc.trim(),
      currency:'ARS',base_price:price,is_active:true,
      metadata:{source:{system:SOURCE,id_rubro:raw.IdRubro||null,id_subrubro:raw.IdSubRubro||null,id_subsubrubro:raw.IdSubSubRubro||null,price_includes_vat:true},features:c.features,classification_version:2},
      _review:price===null||(c.lensLike&&!c.optical_case),_raw:raw
    };
  }

  function changed(a,b){
    const fields=['name','family','design','material','treatment','optical_case','supply_mode','base_price'];
    return fields.some(k=>String(a?.[k]??'')!==String(b?.[k]??''));
  }

  async function preview(file){
    const text=await file.text(),raw=parseCsv(text);
    if(!raw.length)throw new Error('El CSV está vacío o no pudo interpretarse.');
    const headers=Object.keys(raw[0]);
    const required=['Descripcion','IdSubRubro','IdSubSubRubro','IdRubro','PrecioVentaConIva'];
    const missing=required.filter(x=>!headers.includes(x));
    if(missing.length)throw new Error(`Faltan columnas: ${missing.join(', ')}`);

    const rows=raw.map(normalizedRow).filter(x=>x.name);
    const seen=new Set();
    rows.forEach(r=>{if(seen.has(r.source_key)){r._review=true;r._duplicate=true}else seen.add(r.source_key)});

    const sb=client();if(!sb)throw new Error('Supabase no disponible.');
    const {data,error}=await sb.from('black_ai_products').select('id,source_key,name,family,design,material,treatment,optical_case,supply_mode,base_price,metadata').eq('source_system',SOURCE);
    if(error)throw error;
    const byKey=new Map((data||[]).map(x=>[x.source_key,x]));
    rows.forEach(r=>{const old=byKey.get(r.source_key);r._existing=old||null;r._status=r._review?'review':!old?'new':changed(r,old)?'modified':'unchanged'});
    return rows;
  }

  function stats(rows){return {total:rows.length,new:rows.filter(x=>x._status==='new').length,modified:rows.filter(x=>x._status==='modified').length,unchanged:rows.filter(x=>x._status==='unchanged').length,review:rows.filter(x=>x._status==='review').length}}
  function statusLabel(v){return ({new:'Nuevo',modified:'Modificado',unchanged:'Sin cambios',review:'Revisar'}[v]||v)}

  function renderPreview(rows){
    const s=stats(rows),safe=s.new+s.modified;
    return `<div class="catalog-import-stats"><div><span>Total</span><strong>${s.total}</strong></div><div><span>Nuevos</span><strong>${s.new}</strong></div><div><span>Modificados</span><strong>${s.modified}</strong></div><div><span>Sin cambios</span><strong>${s.unchanged}</strong></div><div><span>Revisar</span><strong>${s.review}</strong></div></div>
    <div class="catalog-import-note"><b>Previsualización:</b> todavía no se modificó el catálogo. Al aplicar se procesarán ${safe} artículos. Los ${s.review} marcados para revisar quedarán fuera de la actualización.</div>
    <div class="catalog-import-note">Super Blue se conserva como tratamiento propio (<b>super_blue</b>), separado del filtro azul estándar. Sus beneficios comerciales se explican desde Conocimiento.</div>
    <div class="catalog-import-table-wrap"><table class="catalog-import-table"><thead><tr><th>Estado</th><th>Descripción</th><th>Precio</th><th>Caso</th><th>Modalidad</th><th>Tratamiento</th></tr></thead><tbody>${rows.slice(0,120).map(r=>`<tr><td><span class="catalog-status ${r._status}">${statusLabel(r._status)}</span></td><td>${esc(r.name)}${r._duplicate?' <small>(duplicado en archivo)</small>':''}</td><td>${r.base_price==null?'—':money(r.base_price)}</td><td>${esc(r.optical_case||'—')}</td><td>${esc(r.supply_mode||'—')}</td><td>${esc(r.treatment||'—')}</td></tr>`).join('')}</tbody></table>${rows.length>120?`<div class="catalog-import-more">Mostrando 120 de ${rows.length} artículos.</div>`:''}</div>`;
  }

  async function applyImport(file,rows,modal){
    const sb=client();if(!sb)throw new Error('Supabase no disponible.');
    const user=(await sb.auth.getSession()).data.session?.user?.id||null,s=stats(rows),now=new Date().toISOString();
    const actionable=rows.filter(r=>r._status==='new'||r._status==='modified');
    if(!actionable.length)throw new Error('No hay artículos nuevos o modificados para aplicar.');

    const ok=confirm(`Se van a aplicar ${actionable.length} cambios al catálogo. ${s.review} artículos para revisar NO se importarán. ¿Continuar?`);
    if(!ok)return false;

    const {data:batch,error:batchError}=await sb.from('black_ai_import_batches').insert({source_name:file.name,source_type:'csv',status:'approved',summary:{source_system:SOURCE,...s,actionable:actionable.length},created_by:user}).select('id').single();
    if(batchError)throw batchError;

    for(let i=0;i<actionable.length;i+=80){
      const chunk=actionable.slice(i,i+80).map(r=>({
        source_system:r.source_system,source_key:r.source_key,name:r.name,family:r.family,design:r.design,material:r.material,treatment:r.treatment,
        optical_case:r.optical_case,supply_mode:r.supply_mode,description:r.description,currency:r.currency,base_price:r.base_price,is_active:r.is_active,
        metadata:{...(r._existing?.metadata||{}),...r.metadata},last_import_batch_id:batch.id,imported_at:now,updated_at:now,updated_by:user
      }));
      const {error}=await sb.from('black_ai_products').upsert(chunk,{onConflict:'source_system,source_key'});if(error)throw error;
    }

    const importRows=rows.map((r,i)=>({batch_id:batch.id,row_number:i+2,raw_data:r._raw,normalized_data:{source_key:r.source_key,name:r.name,base_price:r.base_price,optical_case:r.optical_case,supply_mode:r.supply_mode,material:r.material,treatment:r.treatment,features:r.metadata.features},row_type:'product',status:r._status==='review'?'pending':r._status==='unchanged'?'approved':'imported',error_message:r._status==='review'?(r._duplicate?'Artículo duplicado dentro del CSV':'Clasificación o precio requiere revisión'):null}));
    for(let i=0;i<importRows.length;i+=100){const {error}=await sb.from('black_ai_import_rows').insert(importRows.slice(i,i+100));if(error)throw error;}

    const {error:finishError}=await sb.from('black_ai_import_batches').update({status:'completed',summary:{source_system:SOURCE,...s,imported:actionable.length,skipped_review:s.review,completed_at:now}}).eq('id',batch.id);if(finishError)throw finishError;
    modal.querySelector('.catalog-import-body').innerHTML=`<div class="catalog-import-success"><strong>Importación completada</strong><span>${actionable.length} artículos creados o actualizados · ${s.unchanged} sin cambios · ${s.review} pendientes de revisión.</span></div>`;
    modal.querySelector('[data-import-apply]')?.remove();
    return true;
  }

  function open(){
    const wrap=document.createElement('div');wrap.className='knowledge-modal-backdrop';
    wrap.innerHTML=`<div class="knowledge-modal catalog-import-modal" role="dialog" aria-modal="true"><div class="catalog-import-head"><div><h3>Importar catálogo</h3><p>Subí la exportación CSV de SINERGIA. Primero se previsualizan los cambios y recién después, con confirmación, se actualiza el catálogo.</p></div><button class="catalog-close" type="button">×</button></div><div class="catalog-import-body"><label class="catalog-drop"><input type="file" accept=".csv,text/csv"><strong>Seleccionar CSV de SINERGIA</strong><span>Esperamos: Descripcion, IdSubRubro, IdSubSubRubro, IdRubro y PrecioVentaConIva.</span></label></div><div class="knowledge-form-actions"><button class="btn-secondary" type="button" data-import-cancel>Cancelar</button></div></div>`;
    document.body.appendChild(wrap);const modal=wrap.querySelector('.catalog-import-modal');
    const close=()=>wrap.remove();wrap.querySelector('.catalog-close')?.addEventListener('click',close);wrap.querySelector('[data-import-cancel]')?.addEventListener('click',close);wrap.addEventListener('click',e=>{if(e.target===wrap)close()});
    const input=wrap.querySelector('input[type=file]');
    input?.addEventListener('change',async()=>{
      const file=input.files?.[0];if(!file)return;const body=wrap.querySelector('.catalog-import-body');
      body.innerHTML='<div class="catalog-import-loading">Analizando archivo y comparando con el catálogo actual…</div>';
      try{
        const rows=await preview(file);body.innerHTML=renderPreview(rows);const s=stats(rows),safe=s.new+s.modified,actions=wrap.querySelector('.knowledge-form-actions');
        if(safe>0){actions.insertAdjacentHTML('beforeend',`<button class="btn-primary" type="button" data-import-apply>Aplicar ${safe} cambios</button>`);actions.querySelector('[data-import-apply]')?.addEventListener('click',async e=>{const btn=e.currentTarget;btn.disabled=true;btn.textContent='Importando…';try{const applied=await applyImport(file,rows,modal);if(!applied){btn.disabled=false;btn.textContent=`Aplicar ${safe} cambios`}}catch(err){btn.disabled=false;btn.textContent=`Aplicar ${safe} cambios`;alert(`No se pudo importar: ${err?.message||err}`)}})}
      }catch(err){body.innerHTML=`<div class="catalog-import-error"><strong>No se pudo leer el archivo</strong><span>${esc(err?.message||err)}</span></div>`}
    });
  }
  window.BlackAiCatalogImport={open};
})();