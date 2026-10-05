// Black OS · Marketing — módulo manual persistente v1
(()=>{
  const C=window.BlackMarketingCore;
  if(!C){console.error('BlackMarketingCore no disponible');return;}
  const $=(s,root=document)=>root.querySelector(s), $$=(s,root=document)=>[...root.querySelectorAll(s)];
  const BRANCH_LABELS={'general-paz':'General Paz','zona-norte':'Cerro de las Rosas'};
  // Fechas editoriales de referencia para planificar contenido. No crean publicaciones automáticamente.
  // Feriados 2026: calendario nacional + días turísticos vigentes. Se suman hitos comerciales/culturales útiles para una óptica.
  const KEY_DATES_2026=[
    {date:'2026-01-01',kind:'holiday',title:'Año Nuevo',description:'Feriado nacional. Útil para saludo de marca, horarios especiales y reapertura.'},
    {date:'2026-02-14',kind:'commercial',title:'San Valentín',description:'Oportunidad comercial liviana: regalos, estilo, anteojos de sol y contenido de parejas sin forzar promoción.'},
    {date:'2026-02-16',kind:'holiday',title:'Carnaval',description:'Feriado nacional. Comunicar horarios y, si aplica, contenido estacional o de viaje.'},
    {date:'2026-02-17',kind:'holiday',title:'Carnaval',description:'Segundo día de Carnaval. Reforzar horarios y continuidad de atención.'},
    {date:'2026-03-08',kind:'institutional',title:'Día Internacional de la Mujer',description:'Contenido institucional y de comunidad. Priorizar un mensaje respetuoso antes que una promoción agresiva.'},
    {date:'2026-03-23',kind:'holiday',title:'Día no laborable turístico',description:'Fin de semana largo. Anticipar horarios, campañas locales y necesidades de lentes de sol o viaje.'},
    {date:'2026-03-24',kind:'institutional',title:'Día Nacional de la Memoria',description:'Feriado nacional. Mantener comunicación institucional sobria; evitar campañas promocionales invasivas.'},
    {date:'2026-04-02',kind:'institutional',title:'Malvinas / Jueves Santo',description:'Día del Veterano y de los Caídos en Malvinas y Jueves Santo. Comunicar horarios con tono institucional.'},
    {date:'2026-04-03',kind:'holiday',title:'Viernes Santo',description:'Feriado nacional. Señalar horarios y disponibilidad de atención.'},
    {date:'2026-04-07',kind:'health',title:'Día Mundial de la Salud',description:'Buen momento para contenido educativo sobre controles visuales, prevención y salud ocular.'},
    {date:'2026-05-01',kind:'holiday',title:'Día del Trabajador',description:'Feriado nacional. Comunicar horarios y, si se desea, reconocer al equipo de Black Óptica.'},
    {date:'2026-05-25',kind:'institutional',title:'Revolución de Mayo',description:'Feriado nacional. Pieza institucional simple y aviso de horarios.'},
    {date:'2026-06-15',kind:'holiday',title:'Güemes — feriado trasladado',description:'Feriado nacional trasladado por el 17 de junio. Comunicar horarios y fin de semana largo.'},
    {date:'2026-06-20',kind:'institutional',title:'Día de la Bandera',description:'Feriado nacional por Manuel Belgrano. Comunicación institucional y de horarios.'},
    {date:'2026-06-21',kind:'commercial',title:'Día del Padre',description:'Fecha comercial fuerte: regalos, clip-on, anteojos de sol y campañas con selección de modelos.'},
    {date:'2026-06-27',kind:'optical',title:'Día de los Anteojos de Sol',description:'Hito temático ideal para polarizados, protección UV, clip-on y demostraciones de producto.'},
    {date:'2026-07-09',kind:'institutional',title:'Día de la Independencia',description:'Feriado nacional. Comunicación institucional y horarios.'},
    {date:'2026-07-06',kind:'cordoba',title:'Aniversario de la Fundación de Córdoba',description:'Fecha local útil para reforzar identidad cordobesa, comunidad y presencia de las dos sucursales.'},
    {date:'2026-07-10',kind:'holiday',title:'Día no laborable turístico',description:'Fin de semana largo. Reforzar horarios y contenido de viaje/protección solar.'},
    {date:'2026-07-20',kind:'commercial',title:'Día del Amigo',description:'Fecha de alto interés en Argentina. Contenido social, UGC, regalos o dinámica entre amigos.'},
    {date:'2026-08-16',kind:'commercial',title:'Día de las Infancias',description:'Contenido familiar y preventivo: controles visuales infantiles, vuelta a clases y cuidado ocular.'},
    {date:'2026-08-17',kind:'holiday',title:'San Martín',description:'Feriado nacional. Comunicar horarios y continuidad de atención.'},
    {date:'2026-09-21',kind:'commercial',title:'Primavera / Día del Estudiante',description:'Oportunidad visual y juvenil: sol, color, tendencias, clip-on y contenido lifestyle.'},
    {date:'2026-09-30',kind:'cordoba',title:'San Jerónimo · patrono de Córdoba',description:'Fecha local opcional para contenido institucional o de comunidad; validar siempre horarios/alcance municipal antes de comunicar cierres.'},
    {date:'2026-10-08',kind:'optical',title:'Día Mundial de la Visión',description:'Una de las fechas más importantes para Black Óptica: educación, chequeos, prevención y autoridad profesional.'},
    {date:'2026-10-12',kind:'institutional',title:'Diversidad Cultural',description:'Feriado nacional. Comunicación institucional y horarios.'},
    {date:'2026-10-18',kind:'commercial',title:'Día de la Madre',description:'Fecha comercial prioritaria: regalos, estilo, campañas por segmento y contenido emocional de marca.'},
    {date:'2026-10-31',kind:'commercial',title:'Halloween',description:'Fecha opcional para contenido creativo, disruptivo o estético sin necesidad de descuento.'},
    {date:'2026-11-23',kind:'holiday',title:'Soberanía Nacional — trasladado',description:'Feriado trasladado por el 20 de noviembre. Comunicar horarios y fin de semana largo.'},
    {date:'2026-11-27',kind:'commercial',title:'Black Friday',description:'Fecha comercial de alta competencia. Si se participa, definir oferta real, stock, margen, pauta y duración con anticipación.'},
    {date:'2026-12-07',kind:'holiday',title:'Día no laborable turístico',description:'Fin de semana largo previo a fiestas. Buena ventana para regalos, sol y campañas de cierre de año.'},
    {date:'2026-12-08',kind:'holiday',title:'Inmaculada Concepción',description:'Feriado nacional. Comunicar horarios y aprovechar el inicio fuerte de compras de fin de año.'},
    {date:'2026-12-24',kind:'commercial',title:'Nochebuena',description:'Última ventana de regalos. Priorizar horarios de atención, entregas y productos disponibles en el día.'},
    {date:'2026-12-25',kind:'holiday',title:'Navidad',description:'Feriado nacional. Saludo de marca; no hace falta una pieza comercial agresiva.'},
    {date:'2026-12-31',kind:'commercial',title:'Fin de Año',description:'Cierre institucional: logros, comunidad, equipo, balance y horarios especiales.'}
  ];
  const state={client:null,session:null,ready:false,options:[],contents:[],stories:[],frames:[],campaigns:[],adSets:[],ads:[],budgets:[],results:[],suggestions:[],references:[],imports:[],calendarMode:'month',calendarAnchor:new Date(),activeTab:'home',currentImport:null,setupError:null};

  const tables={
    options:'marketing_options',contents:'marketing_contents',stories:'marketing_story_sequences',frames:'marketing_story_frames',
    campaigns:'marketing_campaigns',adSets:'marketing_ad_sets',ads:'marketing_ads',budgets:'marketing_budget_pools',results:'marketing_results',
    suggestions:'marketing_suggestions',references:'marketing_reference_notes',imports:'marketing_import_batches'
  };

  function client(){
    try{if(window.parent&&window.parent!==window&&window.parent.BlackPortal?.getSupabase)return window.parent.BlackPortal.getSupabase()}catch(_){ }
    return window.BlackPortal?.getSupabase?.()||null;
  }
  const option=(kind,id)=>state.options.find(x=>x.kind===kind&&x.id===id)||null;
  const optionLabel=(kind,id)=>option(kind,id)?.label||id||'—';
  const optionColor=(kind,id)=>option(kind,id)?.color||'#77736e';
  const byKind=kind=>state.options.filter(x=>x.kind===kind&&x.is_active!==false).sort((a,b)=>(a.sort_order||0)-(b.sort_order||0)||a.label.localeCompare(b.label));
  const branchLabel=id=>BRANCH_LABELS[id]||id||'Todas';
  const fmtDate=value=>{if(!value)return 'Sin fecha';const d=C.parseISODate(value);return d?new Intl.DateTimeFormat('es-AR',{day:'2-digit',month:'short',year:'numeric'}).format(d):value};
  const esc=C.escapeHtml;
  const nowISO=()=>new Date().toISOString();
  const setSync=t=>{const el=$('#mk-sync');if(el)el.textContent=t};
  const toast=message=>{setSync(message);clearTimeout(toast.t);toast.t=setTimeout(()=>setSync(state.ready?'Sincronizado':'Revisar configuración'),2600)};
  const stableId=(prefix='MK')=>`${prefix}-${new Date().toISOString().replace(/[-:TZ.]/g,'').slice(0,14)}-${Math.random().toString(36).slice(2,6).toUpperCase()}`;
  const keyDateLeadDays=x=>{
    if(/Black Friday|Día de la Madre|Día del Padre/i.test(x.title))return 28;
    if(x.kind==='commercial'||x.kind==='optical')return 21;
    if(x.kind==='health')return 14;
    if(x.kind==='holiday'||x.kind==='cordoba')return 7;
    return 5;
  };
  const keyDatePriority=x=>{
    if(/Black Friday|Día de la Madre|Día del Padre|Día Mundial de la Visión/i.test(x.title))return 'high';
    if(x.kind==='commercial'||x.kind==='optical'||x.kind==='health')return 'medium';
    return 'normal';
  };
  const keyDatePrepISO=x=>C.toISODate(C.addDays(C.parseISODate(x.date),-keyDateLeadDays(x)));
  const daysBetween=(a,b)=>Math.round((C.parseISODate(b)-C.parseISODate(a))/86400000);
  const keyDatePlan=x=>{
    const base=['Definir objetivo de la pieza','Definir responsable y formato','Grabar/diseñar con anticipación','Programar publicación y revisar CTA'];
    if(x.kind==='commercial')return ['Definir oferta, stock y margen real','Elegir productos/modelos protagonistas','Preparar pieza orgánica y decidir si llevará pauta',...base.slice(1)];
    if(x.kind==='optical'||x.kind==='health')return ['Definir enfoque educativo y dato clínico validado','Preparar demostración o explicación profesional','Evitar promesas médicas no sustentadas',...base.slice(1)];
    if(x.kind==='holiday')return ['Confirmar horarios de ambas sucursales','Preparar historia/placa de horarios','Programar comunicación antes del cierre'];
    if(x.kind==='institutional'||x.kind==='cordoba')return ['Definir tono institucional adecuado','Confirmar si corresponde comunicar horarios','Preparar pieza simple, sobria y coherente con Black'];
    return base;
  };
  const hasScheduledContentForDate=x=>state.contents.some(c=>!c.archived_at&&c.publish_date&&c.publish_date>=keyDatePrepISO(x)&&c.publish_date<=x.date);

  async function fetchTable(name,query='*',order=null){
    let q=state.client.from(name).select(query);
    if(order)q=q.order(order,{ascending:true});
    const {data,error}=await q;
    if(error)throw error;
    return data||[];
  }

  async function boot(){
    state.client=client();
    if(!state.client){showSetup('Supabase no está disponible.');return;}
    try{
      const {data:{session},error}=await state.client.auth.getSession();
      if(error||!session){location.replace('index.html');return;}
      state.session=session;
      await loadAll();
      state.ready=true;setSync('Sincronizado');bindStatic();renderAll();
    }catch(error){
      console.error(error);showSetup(humanError(error));bindStatic();
    }
  }

  function humanError(error){
    const m=String(error?.message||error||'Error desconocido');
    if(/marketing_.*does not exist|schema cache|PGRST205|42P01/i.test(m))return 'Las tablas de Marketing todavía no existen.';
    if(/permission|row-level|42501/i.test(m))return 'La sesión no tiene permisos para leer Marketing.';
    return m;
  }
  function showSetup(detail){state.setupError=detail;$('#mk-setup')?.classList.remove('hidden');setSync('Configuración pendiente');}

  async function loadAll(){
    const [options,contents,stories,frames,campaigns,adSets,ads,budgets,results,suggestions,references,imports]=await Promise.all([
      fetchTable(tables.options),fetchTable(tables.contents),fetchTable(tables.stories),fetchTable(tables.frames),fetchTable(tables.campaigns),
      fetchTable(tables.adSets),fetchTable(tables.ads),fetchTable(tables.budgets),fetchTable(tables.results),fetchTable(tables.suggestions),
      fetchTable(tables.references),fetchTable(tables.imports)
    ]);
    Object.assign(state,{options,contents,stories,frames,campaigns,adSets,ads,budgets,results,suggestions,references,imports});
  }

  function bindStatic(){
    $$('.mk-tabs button').forEach(btn=>btn.onclick=()=>activateTab(btn.dataset.tab));
    $$('[data-go]').forEach(btn=>btn.onclick=()=>activateTab(btn.dataset.go));
    $$('[data-new-content]').forEach(btn=>btn.onclick=()=>openContent());
    $('#mk-new-content')?.addEventListener('click',()=>openContent());
    $('#mk-import-open')?.addEventListener('click',()=>activateTab('settings'));
    $('#mk-import-canonical')?.addEventListener('click',previewCanonicalImport);
    $('#mk-import-file')?.addEventListener('change',handleImportFile);
    $('#mk-new-story')?.addEventListener('click',()=>openStory());
    $('#mk-new-campaign')?.addEventListener('click',()=>openCampaign());
    $('#mk-new-result')?.addEventListener('click',()=>openResult());
    $('#mk-new-option')?.addEventListener('click',()=>openOption());
    $('#mk-refresh-suggestions')?.addEventListener('click',refreshSuggestions);
    $('#mk-option-kind')?.addEventListener('change',renderOptions);
    $('#mk-modal-close')?.addEventListener('click',closeModal);
    $('#mk-modal-backdrop')?.addEventListener('click',e=>{if(e.target===e.currentTarget)closeModal()});
    document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal()});
    ['mk-search','mk-filter-type','mk-filter-theme','mk-filter-format','mk-filter-status','mk-filter-branch','mk-filter-responsible','mk-filter-objective','mk-filter-channel','mk-filter-ad','mk-sort'].forEach(id=>{
      const el=$('#'+id);if(!el)return;el.addEventListener(id==='mk-search'?'input':'change',()=>renderDataViews());
    });
    $('#mk-clear-filters')?.addEventListener('click',()=>{['mk-search','mk-filter-type','mk-filter-theme','mk-filter-format','mk-filter-status','mk-filter-branch','mk-filter-responsible','mk-filter-objective','mk-filter-channel','mk-filter-ad'].forEach(id=>{const el=$('#'+id);if(el)el.value=''});renderDataViews()});
    $('#mk-calendar-month')?.addEventListener('click',()=>{state.calendarMode='month';renderCalendar()});
    $('#mk-calendar-week')?.addEventListener('click',()=>{state.calendarMode='week';renderCalendar()});
    $('#mk-cal-prev')?.addEventListener('click',()=>{state.calendarAnchor=state.calendarMode==='month'?C.addMonths(state.calendarAnchor,-1):C.addDays(state.calendarAnchor,-7);renderCalendar()});
    $('#mk-cal-next')?.addEventListener('click',()=>{state.calendarAnchor=state.calendarMode==='month'?C.addMonths(state.calendarAnchor,1):C.addDays(state.calendarAnchor,7);renderCalendar()});
    $('#mk-cal-today')?.addEventListener('click',()=>{state.calendarAnchor=new Date();renderCalendar()});
  }

  function activateTab(tab){
    state.activeTab=tab;
    $$('.mk-tabs button').forEach(x=>x.classList.toggle('active',x.dataset.tab===tab));
    $$('.mk-tab').forEach(x=>x.classList.toggle('active',x.id===`mk-tab-${tab}`));
    $('#mk-toolbar')?.classList.toggle('hidden',!['home','calendar','ideas','production'].includes(tab));
    if(tab==='calendar')renderCalendar();
    if(tab==='settings'){renderOptions();renderImportHistory();renderReferenceNotes();}
  }

  function renderAll(){
    fillFilters();renderDashboard();renderDataViews();renderStories();renderAds();renderResults();renderOptions();renderLegend();renderImportHistory();renderReferenceNotes();
  }
  function fillSelect(id,items,placeholder){
    const el=$('#'+id);if(!el)return;const current=el.value;
    el.innerHTML=`<option value="">${esc(placeholder)}</option>`+items.map(x=>`<option value="${esc(x.id)}">${esc(x.label)}</option>`).join('');
    if([...el.options].some(o=>o.value===current))el.value=current;
  }
  function fillFilters(){
    fillSelect('mk-filter-type',byKind('content_type'),'Todos los tipos');fillSelect('mk-filter-theme',byKind('theme'),'Todas las temáticas');fillSelect('mk-filter-format',byKind('format'),'Todos los formatos');fillSelect('mk-filter-status',byKind('production_status'),'Todos los estados');fillSelect('mk-filter-ad',byKind('ad_decision'),'Toda pauta');
    const reps=[...new Set(state.contents.map(x=>x.responsible).filter(Boolean))].sort().map(x=>({id:x,label:x}));fillSelect('mk-filter-responsible',reps,'Todos los responsables');
    const objs=[...new Set(state.contents.map(x=>x.objective).filter(Boolean))].sort().map(x=>({id:x,label:x}));fillSelect('mk-filter-objective',objs,'Todos los objetivos');
    const chans=[...new Set(state.contents.map(x=>x.channel).filter(Boolean))].sort().map(x=>({id:x,label:x}));fillSelect('mk-filter-channel',chans,'Todos los canales');
  }

  function filteredContents({includeArchived=false}={}){
    const q=($('#mk-search')?.value||'').trim().toLowerCase();
    const filters={content_type_id:$('#mk-filter-type')?.value,theme_id:$('#mk-filter-theme')?.value,format_id:$('#mk-filter-format')?.value,status_id:$('#mk-filter-status')?.value,branch_id:$('#mk-filter-branch')?.value,responsible:$('#mk-filter-responsible')?.value,objective:$('#mk-filter-objective')?.value,channel:$('#mk-filter-channel')?.value,ad_decision_id:$('#mk-filter-ad')?.value};
    let rows=state.contents.filter(x=>includeArchived||!x.archived_at).filter(x=>Object.entries(filters).every(([k,v])=>!v||String(x[k]||'')===String(v)));
    if(q)rows=rows.filter(x=>[x.stable_id,x.title,x.brief,x.product_label,x.promotion_label,x.responsible,x.objective].some(v=>String(v||'').toLowerCase().includes(q)));
    const sort=$('#mk-sort')?.value||'date_asc';
    rows.sort((a,b)=>{
      if(sort==='title_asc')return String(a.title).localeCompare(String(b.title),'es');
      if(sort==='updated_desc')return String(b.updated_at||'').localeCompare(String(a.updated_at||''));
      const av=a.publish_date||'9999-99-99',bv=b.publish_date||'9999-99-99';return sort==='date_desc'?bv.localeCompare(av):av.localeCompare(bv);
    });
    return rows;
  }

  function badges(x){return `<div class="mk-meta"><span class="mk-badge status">${esc(optionLabel('production_status',x.status_id))}</span><span class="mk-badge ad ${esc(x.ad_decision_id||'')}">${esc(optionLabel('ad_decision',x.ad_decision_id))}</span>${x.needs_review?'<span class="mk-badge">Revisar</span>':''}</div>`}
  function contentCard(x,compact=false){
    const color=optionColor('content_type',x.content_type_id);return `<article class="mk-content-card" draggable="true" data-content-id="${x.id}" style="--type-color:${esc(color)}"><span class="mk-kicker">${esc(x.stable_id)} · ${esc(fmtDate(x.publish_date))}</span><h3>${esc(x.title)}</h3>${compact?'':`<p>${esc(x.hook||x.brief||'Sin brief')}</p>`}${badges(x)}<div class="mk-item-sub">${esc(branchLabel(x.branch_id))} · ${esc(optionLabel('content_type',x.content_type_id))}</div></article>`}

  function renderDataViews(){renderIdeas();renderProduction();renderCalendar();}
  function renderIdeas(){
    const el=$('#mk-ideas');if(!el)return;const rows=filteredContents({includeArchived:true}).filter(x=>!x.publish_date||x.status_id==='idea'||x.archived_at);
    el.innerHTML=rows.length?rows.map(contentCard).join(''):'<div class="mk-empty">No hay ideas que coincidan con los filtros.</div>';bindContentCards(el);
  }
  function renderProduction(){
    const el=$('#mk-kanban');if(!el)return;const rows=filteredContents();const statuses=byKind('production_status');
    el.innerHTML=statuses.map(s=>{const items=rows.filter(x=>x.status_id===s.id);return `<section class="mk-column" data-drop-status="${s.id}"><div class="mk-column-head"><strong>${esc(s.label)}</strong><span>${items.length}</span></div><div class="mk-column-body">${items.map(x=>contentCard(x,true)).join('')||'<div class="mk-empty">Sin piezas</div>'}</div></section>`}).join('');
    bindContentCards(el);$$('[data-drop-status]',el).forEach(col=>{col.ondragover=e=>e.preventDefault();col.ondrop=async e=>{e.preventDefault();const id=e.dataTransfer.getData('text/content-id');if(id)await patchContent(id,{status_id:col.dataset.dropStatus})}});
  }
  function bindContentCards(root=document){
    $$('[data-content-id]',root).forEach(card=>{card.onclick=()=>openContent(state.contents.find(x=>x.id===card.dataset.contentId));card.ondragstart=e=>e.dataTransfer.setData('text/content-id',card.dataset.contentId)});
  }

  function openKeyDate(date){
    const x=KEY_DATES_2026.find(d=>d.date===date);if(!x)return;
    const lead=keyDateLeadDays(x),prep=keyDatePrepISO(x),plan=keyDatePlan(x),priority=keyDatePriority(x);
    openModal(x.title,`<div class="mk-keydate-detail"><div class="mk-keydate-headline"><span class="mk-keydate-kind ${esc(x.kind)}">${esc(x.kind==='holiday'?'Feriado / no laborable':x.kind==='optical'?'Óptica y salud visual':x.kind==='health'?'Salud':x.kind==='cordoba'?'Córdoba':x.kind==='institutional'?'Institucional':'Fecha comercial')}</span><span class="mk-keydate-priority ${priority}">${priority==='high'?'Prioridad alta':priority==='medium'?'Prioridad media':'Referencia'}</span></div><p>${esc(x.description)}</p><div class="mk-keydate-timing"><strong>Empezar a preparar: ${esc(fmtDate(prep))}</strong><span>${lead} días de anticipación recomendada</span></div><div class="mk-keydate-plan"><strong>Plan sugerido</strong><ol>${plan.map(step=>`<li>${esc(step)}</li>`).join('')}</ol></div><div class="mk-help">Es una referencia editorial: Black OS te recuerda cuándo empezar a trabajarla, pero no crea ni publica nada automáticamente.</div><div class="mk-form-actions"><div></div><div class="mk-form-actions-right"><button class="mk-btn secondary" type="button" data-close-modal>Cerrar</button><button class="mk-btn primary" type="button" id="mk-keydate-create">Crear contenido para esta fecha</button></div></div></div>`,'FECHA CLAVE');
    $('[data-close-modal]').onclick=closeModal;
    $('#mk-keydate-create').onclick=()=>{closeModal();openContent({publish_date:x.date,status_id:'scheduled',brief:`Fecha clave: ${x.title}. ${x.description}\nPreparación recomendada desde: ${fmtDate(prep)}.\nPlan: ${plan.join(' · ')}`})};
  }

  function renderCalendar(){
    const el=$('#mk-calendar');if(!el||!state.ready)return;const month=state.calendarMode==='month';$('#mk-calendar-month')?.classList.toggle('active',month);$('#mk-calendar-week')?.classList.toggle('active',!month);
    const dates=month?C.monthGrid(state.calendarAnchor):C.weekGrid(state.calendarAnchor);const today=C.isoToday();
    $('#mk-cal-title').textContent=month?new Intl.DateTimeFormat('es-AR',{month:'long',year:'numeric'}).format(state.calendarAnchor):`${fmtDate(C.toISODate(dates[0]))} – ${fmtDate(C.toISODate(dates[6]))}`;
    el.className=`mk-calendar ${month?'month':'week'}`;const heads=['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'].map(x=>`<div class="mk-cal-head">${x}</div>`).join('');
    const rows=filteredContents();
    el.innerHTML=heads+dates.map(d=>{const iso=C.toISODate(d);const items=rows.filter(x=>x.publish_date===iso);const keyDates=KEY_DATES_2026.filter(x=>x.date===iso);const prepDates=KEY_DATES_2026.filter(x=>keyDatePrepISO(x)===iso&&x.date>=today);const outside=month&&d.getMonth()!==state.calendarAnchor.getMonth();return `<div class="mk-day ${outside?'outside':''} ${iso===today?'today':''} ${(keyDates.length||prepDates.length)?'has-keydate':''}" data-date="${iso}"><div class="mk-day-top"><button class="mk-day-num mk-link" data-create-date="${iso}"><span class="mk-day-weekday">${new Intl.DateTimeFormat('es-AR',{weekday:'short'}).format(d)}</span><span>${d.getDate()}</span> +</button>${(keyDates.length||prepDates.length)?`<span class="mk-keydate-count" title="Hitos de planificación">${keyDates.length+prepDates.length}</span>`:''}</div>${prepDates.map(k=>`<button type="button" class="mk-prep-card ${esc(keyDatePriority(k))}" data-key-date="${esc(k.date)}"><strong>Preparar · ${esc(k.title)}</strong><small>Faltan ${keyDateLeadDays(k)} días</small></button>`).join('')}${keyDates.map(k=>`<button type="button" class="mk-keydate-card ${esc(k.kind)}" data-key-date="${esc(k.date)}"><strong>${esc(k.title)}</strong><small>${esc(k.description)}</small></button>`).join('')}${items.map(x=>`<div class="mk-cal-card" draggable="true" data-content-id="${x.id}" style="--type-color:${esc(optionColor('content_type',x.content_type_id))}"><strong>${esc(x.title)}</strong><small>${esc(x.stable_id)} · ${esc(optionLabel('production_status',x.status_id))}</small></div>`).join('')}</div>`}).join('');
    bindContentCards(el);
    $('[data-create-date]',el).forEach(x=>x.onclick=e=>{e.stopPropagation();openContent({publish_date:x.dataset.createDate,status_id:'scheduled'})});
    $('[data-key-date]',el).forEach(x=>x.onclick=e=>{e.stopPropagation();openKeyDate(x.dataset.keyDate)});
    $('.mk-day',el).forEach(day=>{day.ondragover=e=>e.preventDefault();day.ondrop=async e=>{e.preventDefault();const id=e.dataTransfer.getData('text/content-id');if(id)await patchContent(id,{publish_date:day.dataset.date,status_id:state.contents.find(x=>x.id===id)?.status_id==='idea'?'scheduled':state.contents.find(x=>x.id===id)?.status_id})}});
  }

  function renderDashboard(){
    const active=state.contents.filter(x=>!x.archived_at),today=C.isoToday(),upcoming=active.filter(x=>x.publish_date&&x.publish_date>=today&&!['published','analyzed'].includes(x.status_id)).sort((a,b)=>a.publish_date.localeCompare(b.publish_date)),overdue=active.filter(x=>x.publish_date&&x.publish_date<today&&!['published','analyzed'].includes(x.status_id));
    const activeCampaigns=state.campaigns.filter(x=>['testing','active'].includes(x.status_id));
    const planned=state.budgets.filter(x=>!x.is_template).reduce((s,x)=>s+Number(x.planned_amount||0),0),spent=state.budgets.filter(x=>!x.is_template).reduce((s,x)=>s+Number(x.actual_spend||0),0);
    const kpis=[['Próximos',upcoming.length,'Contenido con fecha'],['Atrasados',overdue.length,'Requieren decisión'],['Campañas',activeCampaigns.length,'En prueba o activas'],['Pauta',planned?C.formatMoney(Math.max(planned-spent,0)):'—','Saldo registrado']];
    $('#mk-kpis').innerHTML=kpis.map(x=>`<article class="mk-kpi"><span>${x[0]}</span><strong>${x[1]}</strong><small>${x[2]}</small></article>`).join('');
    const ue=$('#mk-upcoming');ue.innerHTML=upcoming.slice(0,8).map(x=>`<div class="mk-item clickable" data-content-id="${x.id}"><div class="mk-item-top"><span class="mk-item-title">${esc(x.title)}</span><span class="mk-chip">${esc(fmtDate(x.publish_date))}</span></div>${badges(x)}</div>`).join('')||'<div class="mk-empty">Sin contenidos próximos.</div>';bindContentCards(ue);
    const alerts=[];
    overdue.slice(0,4).forEach(x=>alerts.push(`<div class="mk-item clickable" data-content-id="${x.id}"><strong class="mk-danger-text">Atrasado · ${esc(x.stable_id)}</strong><span class="mk-item-sub">${esc(x.title)} · ${esc(fmtDate(x.publish_date))}</span></div>`));
    const keyDateAlerts=KEY_DATES_2026.filter(x=>x.date>=today&&daysBetween(today,x.date)<=30&&!hasScheduledContentForDate(x)).sort((a,b)=>a.date.localeCompare(b.date)).slice(0,3);
    keyDateAlerts.forEach(x=>{const days=daysBetween(today,x.date),priority=keyDatePriority(x);alerts.push(`<div class="mk-item mk-keydate-alert ${priority}" data-key-date-alert="${esc(x.date)}"><div class="mk-item-top"><strong>${esc(x.title)}</strong><span class="mk-chip">${days===0?'Hoy':`En ${days} días`}</span></div><span class="mk-item-sub">Sin contenido programado entre ${esc(fmtDate(keyDatePrepISO(x)))} y la fecha clave. Preparación recomendada: ${keyDateLeadDays(x)} días.</span></div>`)});
    state.stories.filter(x=>x.valid_until&&x.valid_until.slice(0,10)<today&&!x.archived_at).slice(0,2).forEach(x=>alerts.push(`<div class="mk-item"><strong class="mk-danger-text">Historia vencida</strong><span class="mk-item-sub">${esc(x.title)}</span></div>`));
    $('#mk-alerts').innerHTML=alerts.join('')||'<div class="mk-empty">No hay alertas operativas.</div>';
    bindContentCards($('#mk-alerts'));
    $('[data-key-date-alert]',$('#mk-alerts')).forEach(x=>x.onclick=()=>openKeyDate(x.dataset.keyDateAlert));
    renderBudgetSummary();renderSuggestionsHome();
  }
  function renderBudgetSummary(){
    const templates=state.budgets.filter(x=>x.is_template),actual=state.budgets.filter(x=>!x.is_template);let html='';
    if(actual.length){const p=actual.reduce((s,x)=>s+Number(x.planned_amount||0),0),a=actual.reduce((s,x)=>s+Number(x.actual_spend||0),0);html=`<div class="mk-kpi"><span>Período cargado</span><strong>${C.formatMoney(p)}</strong><small>Gasto ${C.formatMoney(a)} · saldo ${C.formatMoney(p-a)}</small></div>`}
    else if(templates.length){const total=templates.find(x=>x.scope==='total')||templates[0];html=`<div class="mk-kpi"><span>Escenario de referencia</span><strong>${C.formatMoney(total.planned_amount)}</strong><small>Plantilla editable; no es gasto real.</small></div>`}
    else html='<div class="mk-empty">Todavía no hay presupuesto registrado.</div>';$('#mk-budget-summary').innerHTML=html;
  }

  async function patchContent(id,patch){
    if(!id)return;patch.updated_by=state.session?.user?.id||null;const {data,error}=await state.client.from(tables.contents).update(patch).eq('id',id).select().single();if(error){alert(error.message);return}const i=state.contents.findIndex(x=>x.id===id);if(i>=0)state.contents[i]=data;renderAll();toast('Contenido actualizado');
  }

  function selectOptions(kind,value,includeBlank=true){return `${includeBlank?'<option value="">Sin especificar</option>':''}${byKind(kind).map(x=>`<option value="${esc(x.id)}" ${x.id===value?'selected':''}>${esc(x.label)}</option>`).join('')}`}
  function branchOptions(value){return `<option value="">Todas / sin especificar</option><option value="general-paz" ${value==='general-paz'?'selected':''}>General Paz</option><option value="zona-norte" ${value==='zona-norte'?'selected':''}>Cerro de las Rosas</option>`}

  async function openContent(item={}){
    const existing=!!item?.id;const x={stable_id:stableId('CONT'),status_id:'idea',ad_decision_id:'organic',ad_status_id:'not_activated',format_id:'reel_video',...item};
    const readiness=C.contentReadiness(x);openModal(existing?'Editar contenido':'Nueva idea',`<form id="mk-content-form"><div class="mk-form-grid">
      <div class="mk-field"><label>ID estable</label><input name="stable_id" value="${esc(x.stable_id||'')}" ${existing?'readonly':''} required><small>No cambia al reprogramar ni duplicar.</small></div>
      <div class="mk-field"><label>Título</label><input name="title" value="${esc(x.title||'')}" required></div>
      <div class="mk-field"><label>Tipo</label><select name="content_type_id">${selectOptions('content_type',x.content_type_id)}</select></div>
      <div class="mk-field"><label>Temática</label><select name="theme_id">${selectOptions('theme',x.theme_id)}</select></div>
      <div class="mk-field"><label>Formato</label><select name="format_id">${selectOptions('format',x.format_id,false)}</select></div>
      <div class="mk-field"><label>Sucursal</label><select name="branch_id">${branchOptions(x.branch_id)}</select></div>
      <div class="mk-field"><label>Objetivo</label><input name="objective" value="${esc(x.objective||'')}" placeholder="Ej: consultas calificadas"><small>Qué resultado busca la pieza.</small></div>
      <div class="mk-field"><label>Responsable</label><input name="responsible" value="${esc(x.responsible||'')}"></div>
      <div class="mk-field"><label>Canal / ubicación</label><input name="channel" value="${esc(x.channel||'')}" placeholder="Reels / feed / Stories"><small>Dónde aparece la pieza; no es el destino.</small></div>
      <div class="mk-field"><label>Destino</label><input name="destination" value="${esc(x.destination||'')}" placeholder="WhatsApp / perfil / tienda"><small>Qué se abre o qué acción sigue.</small></div>
      <div class="mk-field"><label>Producto</label><input name="product_label" value="${esc(x.product_label||'')}"></div>
      <div class="mk-field"><label>Promoción</label><input name="promotion_label" value="${esc(x.promotion_label||'')}"></div>
      <div class="mk-field"><label>Público / zona</label><input name="audience_zone" value="${esc(x.audience_zone||'')}"></div>
      <div class="mk-field"><label>Fecha calendario</label><input name="publish_date" type="date" value="${esc(x.publish_date||'')}"><small>Programar acá no publica nada.</small></div>
      <div class="mk-field"><label>Fecha grabación</label><input name="recording_date" type="date" value="${esc(x.recording_date||'')}"></div>
      <div class="mk-field"><label>Fecha revisión</label><input name="review_date" type="date" value="${esc(x.review_date||'')}"></div>
      <div class="mk-field"><label>Estado</label><select name="status_id">${selectOptions('production_status',x.status_id,false)}</select></div>
      <div class="mk-field"><label>Decisión de pauta</label><select name="ad_decision_id">${selectOptions('ad_decision',x.ad_decision_id,false)}</select></div>
      <div class="mk-field"><label>Estado publicitario</label><select name="ad_status_id">${selectOptions('ad_status',x.ad_status_id,false)}</select></div>
      <div class="mk-field"><label>Idea original / versión de</label><select name="parent_id"><option value="">Sin vínculo</option>${state.contents.filter(c=>c.id!==x.id).map(c=>`<option value="${c.id}" ${c.id===x.parent_id?'selected':''}>${esc(c.stable_id)} · ${esc(c.title)}</option>`).join('')}</select></div>
      <div class="mk-field full"><label>Brief</label><textarea name="brief">${esc(x.brief||'')}</textarea></div>
      <div class="mk-field full"><label>Gancho</label><textarea name="hook">${esc(x.hook||'')}</textarea></div>
      <div class="mk-field full"><label>Desarrollo</label><textarea name="development">${esc(x.development||'')}</textarea></div>
      <div class="mk-field full"><label>Guion</label><textarea name="script">${esc(x.script||'')}</textarea></div>
      <div class="mk-field full"><label>Material / planos</label><textarea name="material">${esc(x.material||'')}</textarea></div>
      <div class="mk-field full"><label>CTA</label><textarea name="cta">${esc(x.cta||'')}</textarea></div>
      <div class="mk-field full"><label>Observaciones</label><textarea name="notes">${esc(x.notes||'')}</textarea></div>
    </div><div class="mk-help">${readiness.ready?'La ficha tiene los datos mínimos para su estado actual.':`Falta para avanzar: ${esc(readiness.missing.join(', '))}.`}</div>
    <div id="mk-audit-preview"></div>
    <div class="mk-form-actions"><div>${existing?`<button type="button" class="mk-btn ${x.archived_at?'secondary':'danger'}" id="mk-content-archive">${x.archived_at?'Recuperar':'Archivar'}</button> <button type="button" class="mk-btn ghost" id="mk-content-duplicate">Duplicar</button>`:''}</div><div class="mk-form-actions-right"><button class="mk-btn secondary" type="button" data-close-modal>Cancelar</button><button class="mk-btn primary" type="submit">Guardar</button></div></div></form>`);
    $('[data-close-modal]')?.addEventListener('click',closeModal);
    $('#mk-content-form').onsubmit=async e=>{e.preventDefault();const fd=new FormData(e.currentTarget),payload=Object.fromEntries(fd.entries());['parent_id','branch_id','product_label','promotion_label','audience_zone','recording_date','review_date','publish_date','objective','responsible','channel','destination'].forEach(k=>{if(payload[k]==='')payload[k]=null});payload.updated_by=state.session.user.id;if(!existing)payload.created_by=state.session.user.id;setSync('Guardando…');let result;if(existing)result=await state.client.from(tables.contents).update(payload).eq('id',x.id).select().single();else result=await state.client.from(tables.contents).insert(payload).select().single();if(result.error){alert(result.error.message);return}if(existing){const i=state.contents.findIndex(c=>c.id===x.id);state.contents[i]=result.data}else state.contents.push(result.data);closeModal();fillFilters();renderAll();toast('Guardado')};
    if(existing){$('#mk-content-archive').onclick=async()=>patchContent(x.id,{archived_at:x.archived_at?null:nowISO()});$('#mk-content-duplicate').onclick=async()=>{const clone={...x};['id','created_at','updated_at','created_by','updated_by'].forEach(k=>delete clone[k]);clone.stable_id=`${x.stable_id}-COPY-${Date.now().toString().slice(-5)}`;clone.title=`${x.title} · copia`;clone.parent_id=x.parent_id||x.id;clone.status_id='idea';clone.publish_date=null;clone.archived_at=null;const {data,error}=await state.client.from(tables.contents).insert(clone).select().single();if(error){alert(error.message);return}state.contents.push(data);closeModal();renderAll();openContent(data)};loadAudit('marketing_contents',x.id)}
  }

  async function loadAudit(table,rowId){
    const el=$('#mk-audit-preview');if(!el)return;const {data,error}=await state.client.from('marketing_audit_log').select('*').eq('table_name',table).eq('row_id',rowId).order('changed_at',{ascending:false}).limit(8);if(error)return;el.innerHTML=`<details class="mk-reference-list"><summary>Historial (${data.length})</summary><div class="mk-list compact">${data.map(a=>`<div class="mk-item"><strong>${esc(a.action)}</strong><span class="mk-item-sub">${esc(new Date(a.changed_at).toLocaleString('es-AR'))}</span></div>`).join('')}</div></details>`;
  }

  function openModal(title,html,kicker='MARKETING'){const back=$('#mk-modal-backdrop');$('#mk-modal-title').textContent=title;$('#mk-modal-kicker').textContent=kicker;$('#mk-modal-body').innerHTML=html;back.classList.remove('hidden')}
  function closeModal(){$('#mk-modal-backdrop')?.classList.add('hidden');$('#mk-modal-body').innerHTML=''}

  function renderStories(){
    const el=$('#mk-stories');if(!el)return;const today=C.isoToday(),rows=state.stories.filter(x=>!x.archived_at).sort((a,b)=>String(a.valid_from||'9999').localeCompare(String(b.valid_from||'9999')));el.innerHTML=rows.length?rows.map(x=>{const count=state.frames.filter(f=>f.sequence_id===x.id).length,expired=x.valid_until&&x.valid_until.slice(0,10)<today;return `<div class="mk-item clickable" data-story-id="${x.id}"><div class="mk-item-top"><strong class="mk-item-title">${esc(x.title)}</strong><span class="mk-chip">${count} fotogramas</span></div><span class="mk-item-sub">${esc(optionLabel('production_status',x.status_id))} · ${esc(optionLabel('highlight',x.highlight_id))}${expired?' · Vencida':''}</span></div>`}).join(''):'<div class="mk-empty">Todavía no hay secuencias.</div>';$$('[data-story-id]',el).forEach(x=>x.onclick=()=>openStory(state.stories.find(s=>s.id===x.dataset.storyId)));$('#mk-highlights').innerHTML=byKind('highlight').map(x=>`<span class="mk-chip"><span class="mk-chip-dot" style="--chip:${esc(x.color)}"></span>${esc(x.label)}</span>`).join('');
  }

  function openStory(story={}){
    const existing=!!story.id,x={stable_id:stableId('HIST'),status_id:'idea',channel:'stories',...story};let draftFrames=existing?state.frames.filter(f=>f.sequence_id===x.id).sort((a,b)=>a.sort_order-b.sort_order).map(f=>({...f})):[{sort_order:10,text_content:'',material:'',cta:'',destination:''}];
    const render=()=>{openModal(existing?'Editar secuencia':'Nueva secuencia',`<form id="mk-story-form"><div class="mk-form-grid"><div class="mk-field"><label>ID estable</label><input name="stable_id" value="${esc(x.stable_id)}" ${existing?'readonly':''} required></div><div class="mk-field"><label>Título</label><input name="title" value="${esc(x.title||'')}" required></div><div class="mk-field"><label>Sucursal</label><select name="branch_id">${branchOptions(x.branch_id)}</select></div><div class="mk-field"><label>Destacado</label><select name="highlight_id">${selectOptions('highlight',x.highlight_id)}</select></div><div class="mk-field"><label>Objetivo</label><input name="objective" value="${esc(x.objective||'')}"></div><div class="mk-field"><label>Destino</label><input name="destination" value="${esc(x.destination||'')}"></div><div class="mk-field"><label>CTA</label><input name="cta" value="${esc(x.cta||'')}"></div><div class="mk-field"><label>Estado</label><select name="status_id">${selectOptions('production_status',x.status_id,false)}</select></div><div class="mk-field"><label>Vigente desde</label><input name="valid_from" type="datetime-local" value="${esc((x.valid_from||'').slice(0,16))}"></div><div class="mk-field"><label>Vigente hasta</label><input name="valid_until" type="datetime-local" value="${esc((x.valid_until||'').slice(0,16))}"></div><div class="mk-field full"><label>Vincular Reel / contenido</label><select name="content_id"><option value="">Sin vínculo</option>${state.contents.filter(c=>!c.archived_at).map(c=>`<option value="${c.id}" ${c.id===x.content_id?'selected':''}>${esc(c.stable_id)} · ${esc(c.title)}</option>`).join('')}</select></div><div class="mk-field full"><label>Notas</label><textarea name="notes">${esc(x.notes||'')}</textarea></div></div><div class="mk-story-frames" id="mk-frame-list">${draftFrames.map((f,i)=>`<div class="mk-frame" data-frame="${i}"><div class="mk-frame-order"><button type="button" data-up="${i}">↑</button><button type="button" data-down="${i}">↓</button></div><div><textarea data-frame-text="${i}" placeholder="Texto del fotograma">${esc(f.text_content||'')}</textarea><input data-frame-material="${i}" value="${esc(f.material||'')}" placeholder="Material / plano"><input data-frame-cta="${i}" value="${esc(f.cta||'')}" placeholder="CTA"><input data-frame-destination="${i}" value="${esc(f.destination||'')}" placeholder="Destino"></div><button class="mk-btn danger small" type="button" data-frame-delete="${i}">×</button></div>`).join('')}</div><button class="mk-btn ghost" id="mk-add-frame" type="button">+ Fotograma</button><div class="mk-form-actions"><div>${existing?'<button type="button" class="mk-btn ghost" id="mk-story-duplicate">Duplicar secuencia</button>':''}</div><div class="mk-form-actions-right"><button class="mk-btn secondary" type="button" data-close-modal>Cancelar</button><button class="mk-btn primary" type="submit">Guardar</button></div></div></form>`,'HISTORIAS');
      const syncFrames=()=>{draftFrames=draftFrames.map((f,i)=>({...f,text_content:$(`[data-frame-text="${i}"]`)?.value||'',material:$(`[data-frame-material="${i}"]`)?.value||'',cta:$(`[data-frame-cta="${i}"]`)?.value||'',destination:$(`[data-frame-destination="${i}"]`)?.value||''}))};
      $('#mk-add-frame').onclick=()=>{syncFrames();draftFrames.push({sort_order:(draftFrames.length+1)*10,text_content:'',material:'',cta:'',destination:''});render()};$$('[data-frame-delete]').forEach(b=>b.onclick=()=>{syncFrames();draftFrames.splice(Number(b.dataset.frameDelete),1);render()});$$('[data-up]').forEach(b=>b.onclick=()=>{syncFrames();const i=Number(b.dataset.up);if(i>0)[draftFrames[i-1],draftFrames[i]]=[draftFrames[i],draftFrames[i-1]];render()});$$('[data-down]').forEach(b=>b.onclick=()=>{syncFrames();const i=Number(b.dataset.down);if(i<draftFrames.length-1)[draftFrames[i+1],draftFrames[i]]=[draftFrames[i],draftFrames[i+1]];render()});$('[data-close-modal]').onclick=closeModal;
      $('#mk-story-form').onsubmit=async e=>{e.preventDefault();syncFrames();const fd=new FormData(e.currentTarget),payload=Object.fromEntries(fd.entries());['branch_id','highlight_id','content_id','valid_from','valid_until','objective','destination','cta'].forEach(k=>{if(payload[k]==='')payload[k]=null});if(payload.valid_from)payload.valid_from=new Date(payload.valid_from).toISOString();if(payload.valid_until)payload.valid_until=new Date(payload.valid_until).toISOString();payload.updated_by=state.session.user.id;let saved;if(existing)saved=await state.client.from(tables.stories).update(payload).eq('id',x.id).select().single();else saved=await state.client.from(tables.stories).insert({...payload,created_by:state.session.user.id}).select().single();if(saved.error){alert(saved.error.message);return}const sid=saved.data.id;const del=await state.client.from(tables.frames).delete().eq('sequence_id',sid);if(del.error){alert(del.error.message);return}if(draftFrames.length){const ins=await state.client.from(tables.frames).insert(draftFrames.map((f,i)=>({sequence_id:sid,sort_order:(i+1)*10,text_content:f.text_content||null,material:f.material||null,cta:f.cta||null,destination:f.destination||null,created_by:state.session.user.id}))).select();if(ins.error){alert(ins.error.message);return}}await reloadStories();closeModal();renderStories();toast('Secuencia guardada')};
      if(existing)$('#mk-story-duplicate').onclick=async()=>{syncFrames();const clone={...x};['id','created_at','updated_at','created_by','updated_by'].forEach(k=>delete clone[k]);clone.stable_id=`${x.stable_id}-COPY-${Date.now().toString().slice(-4)}`;clone.title=`${x.title} · copia`;clone.status_id='idea';const {data,error}=await state.client.from(tables.stories).insert(clone).select().single();if(error){alert(error.message);return}if(draftFrames.length)await state.client.from(tables.frames).insert(draftFrames.map((f,i)=>({sequence_id:data.id,sort_order:(i+1)*10,text_content:f.text_content,material:f.material,cta:f.cta,destination:f.destination})));await reloadStories();render();};
    };render();
  }
  async function reloadStories(){state.stories=await fetchTable(tables.stories);state.frames=await fetchTable(tables.frames)}

  function renderAds(){
    const pools=$('#mk-budget-pools');if(!pools)return;const rows=state.budgets.filter(x=>!x.is_template);const src=rows.length?rows:state.budgets.filter(x=>x.is_template);pools.innerHTML=src.map(x=>{const planned=Number(x.planned_amount||0),spent=Number(x.actual_spend||0),pct=planned>0?Math.min(100,spent/planned*100):0;return `<article class="mk-budget"><span class="mk-kicker">${esc(x.is_template?'PLANTILLA':x.scope)} · ${esc(x.platform||'TOTAL')}</span><strong>${C.formatMoney(planned,x.currency)}</strong><small>${x.is_template?'Referencia editable':`Gastado ${C.formatMoney(spent,x.currency)} · saldo ${C.formatMoney(planned-spent,x.currency)}`}</small><div class="mk-progress"><span style="width:${pct}%"></span></div></article>`}).join('')||'<div class="mk-empty">Sin presupuestos.</div>';
    const body=$('#mk-campaigns');body.innerHTML=state.campaigns.map(x=>{const pool=state.budgets.find(b=>b.id===x.budget_pool_id),planned=x.planned_budget??pool?.planned_amount,spend=x.actual_spend??pool?.actual_spend;return `<tr data-campaign-id="${x.id}"><td><strong>${esc(x.name)}</strong><br><small>${esc(x.stable_id)}</small></td><td>${esc(x.platform)}</td><td>${esc(x.commercial_objective||'—')}</td><td>${esc(optionLabel('ad_status',x.status_id))}</td><td>${C.formatMoney(planned,x.currency)}</td><td>${C.formatMoney(spend,x.currency)}</td><td>${esc(fmtDate(x.next_review))}</td><td><button class="mk-btn ghost small">Abrir</button></td></tr>`}).join('')||'<tr><td colspan="8">Sin campañas cargadas.</td></tr>';$$('[data-campaign-id]',body).forEach(r=>r.onclick=()=>openCampaign(state.campaigns.find(x=>x.id===r.dataset.campaignId)));
  }

  function openCampaign(campaign={}){
    const existing=!!campaign.id,x={stable_id:stableId('CMP'),platform:'meta',status_id:'not_activated',currency:'ARS',...campaign};const campaignSets=existing?state.adSets.filter(s=>s.campaign_id===x.id):[],campaignAds=existing?state.ads.filter(a=>a.campaign_id===x.id):[];
    openModal(existing?'Editar campaña':'Nueva campaña',`<form id="mk-campaign-form"><div class="mk-form-grid"><div class="mk-field"><label>ID</label><input name="stable_id" value="${esc(x.stable_id)}" ${existing?'readonly':''}></div><div class="mk-field"><label>Nombre</label><input name="name" value="${esc(x.name||'')}" required></div><div class="mk-field"><label>Plataforma</label><select name="platform"><option value="meta" ${x.platform==='meta'?'selected':''}>Meta</option><option value="google" ${x.platform==='google'?'selected':''}>Google</option><option value="other" ${x.platform==='other'?'selected':''}>Otra</option></select></div><div class="mk-field"><label>Estado</label><select name="status_id">${selectOptions('ad_status',x.status_id,false)}</select></div><div class="mk-field"><label>Responsable</label><input name="responsible" value="${esc(x.responsible||'')}"></div><div class="mk-field"><label>Sucursal</label><select name="branch_id">${branchOptions(x.branch_id)}</select></div><div class="mk-field"><label>Objetivo comercial</label><input name="commercial_objective" value="${esc(x.commercial_objective||'')}" placeholder="Ventas / consultas / visitas"></div><div class="mk-field"><label>Objetivo plataforma</label><input name="platform_objective" value="${esc(x.platform_objective||'')}" placeholder="Solo si está confirmado"><small>No asumir nombres de Ads Manager.</small></div><div class="mk-field"><label>Inicio</label><input name="start_date" type="date" value="${esc(x.start_date||'')}"></div><div class="mk-field"><label>Fin</label><input name="end_date" type="date" value="${esc(x.end_date||'')}"></div><div class="mk-field"><label>Destino</label><input name="destination" value="${esc(x.destination||'')}"></div><div class="mk-field"><label>Público</label><input name="audience_type" value="${esc(x.audience_type||'')}" placeholder="Amplio / intereses / retargeting"></div><div class="mk-field"><label>Edad mínima</label><input name="age_min" type="number" min="13" value="${esc(x.age_min??'')}"></div><div class="mk-field"><label>Edad máxima</label><input name="age_max" type="number" min="13" value="${esc(x.age_max??'')}"></div><div class="mk-field full"><label>Geografía / zonas / radios / exclusiones</label><textarea name="geography_text">${esc(x.geography?.text||'')}</textarea><small>No segmentar por condiciones de salud ni recetas.</small></div><div class="mk-field full"><label>Intereses / audiencias</label><textarea name="interests_text">${esc((x.interests||[]).join(', '))}</textarea></div><div class="mk-field full"><label>Exclusiones</label><textarea name="exclusions_text">${esc((x.exclusions||[]).join(', '))}</textarea></div><div class="mk-field"><label>Partida presupuestaria</label><select name="budget_pool_id"><option value="">Sin asignar</option>${state.budgets.map(b=>`<option value="${b.id}" ${b.id===x.budget_pool_id?'selected':''}>${esc(b.name)} · ${C.formatMoney(b.planned_amount,b.currency)}</option>`).join('')}</select><small>Los anuncios vinculados comparten esta partida; no se suma por video.</small></div><div class="mk-field"><label>Presupuesto previsto específico</label><input name="planned_budget" type="number" step="0.01" value="${esc(x.planned_budget??'')}"></div><div class="mk-field"><label>Gasto real</label><input name="actual_spend" type="number" step="0.01" value="${esc(x.actual_spend??'')}"></div><div class="mk-field"><label>Próxima revisión</label><input name="next_review" type="date" value="${esc(x.next_review||'')}"></div><div class="mk-field"><label>KPI</label><input name="kpi_name" value="${esc(x.kpi_name||'')}"></div><div class="mk-field"><label>KPI objetivo</label><input name="kpi_target" type="number" step="0.01" value="${esc(x.kpi_target??'')}"></div><div class="mk-field"><label>CPA objetivo</label><input name="cpa_target" type="number" step="0.01" value="${esc(x.cpa_target??'')}"></div><div class="mk-field"><label>ROAS objetivo</label><input name="roas_target" type="number" step="0.01" value="${esc(x.roas_target??'')}"></div><div class="mk-field full"><label>Fuente / supuestos ROAS</label><textarea name="assumptions">${esc(x.assumptions||'')}</textarea></div><div class="mk-field full"><label>Notas</label><textarea name="notes">${esc(x.notes||'')}</textarea></div></div>${existing?`<div class="mk-grid two"><div class="mk-panel"><h3>Conjuntos</h3><div id="mk-adsets-inline" class="mk-list">${campaignSets.map(s=>`<div class="mk-item"><strong>${esc(s.name)}</strong><span class="mk-item-sub">${esc(optionLabel('ad_status',s.status_id))}</span></div>`).join('')||'<div class="mk-empty">Sin conjuntos</div>'}</div><button type="button" class="mk-btn ghost small" id="mk-add-adset">+ Conjunto</button></div><div class="mk-panel"><h3>Anuncios</h3><div id="mk-ads-inline" class="mk-list">${campaignAds.map(a=>`<div class="mk-item"><strong>${esc(a.name)}</strong><span class="mk-item-sub">${esc(state.contents.find(c=>c.id===a.content_id)?.stable_id||'Sin pieza')} · presupuesto compartido</span></div>`).join('')||'<div class="mk-empty">Sin anuncios</div>'}</div><button type="button" class="mk-btn ghost small" id="mk-add-ad">+ Anuncio</button></div></div>`:''}<div class="mk-form-actions"><div></div><div class="mk-form-actions-right"><button type="button" class="mk-btn secondary" data-close-modal>Cancelar</button><button class="mk-btn primary" type="submit">Guardar</button></div></div></form>`,'PUBLICIDAD');
    $('[data-close-modal]').onclick=closeModal;$('#mk-campaign-form').onsubmit=async e=>{e.preventDefault();const fd=new FormData(e.currentTarget),p=Object.fromEntries(fd.entries());p.geography={text:p.geography_text||''};delete p.geography_text;p.interests=(p.interests_text||'').split(',').map(s=>s.trim()).filter(Boolean);delete p.interests_text;p.exclusions=(p.exclusions_text||'').split(',').map(s=>s.trim()).filter(Boolean);delete p.exclusions_text;['branch_id','start_date','end_date','destination','audience_type','budget_pool_id','planned_budget','actual_spend','next_review','kpi_target','cpa_target','roas_target','age_min','age_max'].forEach(k=>{if(p[k]==='')p[k]=null});['planned_budget','actual_spend','kpi_target','cpa_target','roas_target','age_min','age_max'].forEach(k=>{if(p[k]!==null)p[k]=Number(p[k])});p.updated_by=state.session.user.id;let saved=existing?await state.client.from(tables.campaigns).update(p).eq('id',x.id).select().single():await state.client.from(tables.campaigns).insert({...p,created_by:state.session.user.id}).select().single();if(saved.error){alert(saved.error.message);return}await reloadAds();closeModal();renderAds();renderDashboard();toast('Campaña guardada')};
    if(existing){$('#mk-add-adset').onclick=()=>openAdSet(x);$('#mk-add-ad').onclick=()=>openAd(x)}
  }

  async function reloadAds(){state.campaigns=await fetchTable(tables.campaigns);state.adSets=await fetchTable(tables.adSets);state.ads=await fetchTable(tables.ads);state.budgets=await fetchTable(tables.budgets)}
  function openAdSet(campaign){openModal('Nuevo conjunto',`<form id="mk-adset-form"><div class="mk-form-grid"><div class="mk-field"><label>ID</label><input name="stable_id" value="${esc(stableId('SET'))}" required></div><div class="mk-field"><label>Nombre</label><input name="name" required></div><div class="mk-field"><label>Estado</label><select name="status_id">${selectOptions('ad_status','not_activated',false)}</select></div><div class="mk-field"><label>Partida compartida</label><select name="budget_pool_id"><option value="">Hereda / sin asignar</option>${state.budgets.map(b=>`<option value="${b.id}">${esc(b.name)}</option>`).join('')}</select></div><div class="mk-field full"><label>Audiencia</label><textarea name="audience_text"></textarea></div><div class="mk-field full"><label>Geografía</label><textarea name="geography_text"></textarea></div></div><div class="mk-form-actions"><div></div><div class="mk-form-actions-right"><button type="button" class="mk-btn secondary" data-close-modal>Cancelar</button><button class="mk-btn primary">Guardar</button></div></div></form>`,'PUBLICIDAD');$('[data-close-modal]').onclick=()=>openCampaign(campaign);$('#mk-adset-form').onsubmit=async e=>{e.preventDefault();const p=Object.fromEntries(new FormData(e.currentTarget).entries());p.campaign_id=campaign.id;p.audience={text:p.audience_text};p.geography={text:p.geography_text};delete p.audience_text;delete p.geography_text;if(!p.budget_pool_id)p.budget_pool_id=null;const {error}=await state.client.from(tables.adSets).insert(p);if(error){alert(error.message);return}await reloadAds();openCampaign(state.campaigns.find(c=>c.id===campaign.id))}}
  function openAd(campaign){const sets=state.adSets.filter(s=>s.campaign_id===campaign.id);openModal('Nuevo anuncio',`<form id="mk-ad-form"><div class="mk-form-grid"><div class="mk-field"><label>ID</label><input name="stable_id" value="${esc(stableId('AD'))}" required></div><div class="mk-field"><label>Nombre</label><input name="name" required></div><div class="mk-field"><label>Conjunto</label><select name="ad_set_id"><option value="">Sin conjunto</option>${sets.map(s=>`<option value="${s.id}">${esc(s.name)}</option>`).join('')}</select></div><div class="mk-field"><label>Pieza vinculada</label><select name="content_id"><option value="">Sin pieza</option>${state.contents.filter(c=>!c.archived_at).map(c=>`<option value="${c.id}">${esc(c.stable_id)} · ${esc(c.title)}</option>`).join('')}</select></div><div class="mk-field"><label>Estado</label><select name="status_id">${selectOptions('ad_status','not_activated',false)}</select></div><div class="mk-field"><label>Partida compartida</label><select name="budget_pool_id"><option value="">Hereda / sin asignar</option>${state.budgets.map(b=>`<option value="${b.id}">${esc(b.name)}</option>`).join('')}</select></div><div class="mk-field"><label>CTA</label><input name="cta"></div><div class="mk-field"><label>Enlace</label><input name="link"></div><div class="mk-field full"><label>Notas</label><textarea name="notes"></textarea></div></div><div class="mk-help">El anuncio no crea una nueva partida presupuestaria: puede heredar la campaña/conjunto o vincularse a una partida existente.</div><div class="mk-form-actions"><div></div><div class="mk-form-actions-right"><button type="button" class="mk-btn secondary" data-close-modal>Cancelar</button><button class="mk-btn primary">Guardar</button></div></div></form>`,'PUBLICIDAD');$('[data-close-modal]').onclick=()=>openCampaign(campaign);$('#mk-ad-form').onsubmit=async e=>{e.preventDefault();const p=Object.fromEntries(new FormData(e.currentTarget).entries());p.campaign_id=campaign.id;['ad_set_id','content_id','budget_pool_id'].forEach(k=>{if(!p[k])p[k]=null});const {error}=await state.client.from(tables.ads).insert(p);if(error){alert(error.message);return}await reloadAds();openCampaign(state.campaigns.find(c=>c.id===campaign.id))}}

  function renderResults(){
    const rows=state.results.slice().sort((a,b)=>String(b.period_end).localeCompare(String(a.period_end)));const totals=rows.reduce((a,r)=>{a.sales+=Number(r.sales||0);a.inq+=Number(r.qualified_inquiries||0);a.rev+=Number(r.revenue||0);a.spend+=Number(r.spend||0);a.contrib+=Number(r.contribution_before_ads||0);return a},{sales:0,inq:0,rev:0,spend:0,contrib:0});const totalRoas=totals.sales>0&&totals.spend>0?totals.rev/totals.spend:null,totalCpa=totals.sales>0?totals.spend/totals.sales:null;
    $('#mk-result-kpis').innerHTML=[['Consultas calificadas',totals.inq,'No incluye mensajes automáticos'],['Ventas',totals.sales,'Registradas / atribuidas'],['CPA',totalCpa===null?'No calculable':C.formatMoney(totalCpa),'Pauta / ventas'],['ROAS',totalRoas===null?'No calculable':totalRoas.toFixed(2)+'x','Ingresos / pauta; no utilidad']].map(x=>`<article class="mk-kpi"><span>${x[0]}</span><strong>${x[1]}</strong><small>${x[2]}</small></article>`).join('');
    $('#mk-results').innerHTML=rows.map(r=>{const m=C.resultMetrics(r);return `<tr data-result-id="${r.id}"><td>${esc(fmtDate(r.period_start))}<br>${esc(fmtDate(r.period_end))}</td><td>${esc(r.source||'manual')}</td><td>${r.qualified_inquiries??'—'}</td><td>${r.quotes??'—'}</td><td>${r.sales??'—'}</td><td>${C.formatMoney(r.revenue)}</td><td>${C.formatMoney(r.spend)}</td><td>${m.cpa===null?'—':C.formatMoney(m.cpa)}</td><td>${m.roas===null?'No calculable':m.roas.toFixed(2)+'x'}</td></tr>`}).join('')||'<tr><td colspan="9">Sin resultados cargados.</td></tr>';$$('[data-result-id]').forEach(r=>r.onclick=()=>openResult(state.results.find(x=>x.id===r.dataset.resultId)));
  }
  function openResult(result={}){const existing=!!result.id,x={period_start:C.isoToday(),period_end:C.isoToday(),source:'manual',...result};openModal(existing?'Editar resultado':'Cargar resultado',`<form id="mk-result-form"><div class="mk-form-grid"><div class="mk-field"><label>Desde</label><input name="period_start" type="date" value="${esc(x.period_start)}" required></div><div class="mk-field"><label>Hasta</label><input name="period_end" type="date" value="${esc(x.period_end)}" required></div><div class="mk-field"><label>Contenido</label><select name="content_id"><option value="">Sin contenido</option>${state.contents.map(c=>`<option value="${c.id}" ${c.id===x.content_id?'selected':''}>${esc(c.stable_id)} · ${esc(c.title)}</option>`).join('')}</select></div><div class="mk-field"><label>Campaña</label><select name="campaign_id"><option value="">Sin campaña</option>${state.campaigns.map(c=>`<option value="${c.id}" ${c.id===x.campaign_id?'selected':''}>${esc(c.name)}</option>`).join('')}</select></div><div class="mk-field"><label>Sucursal</label><select name="branch_id">${branchOptions(x.branch_id)}</select></div><div class="mk-field"><label>Fuente</label><input name="source" value="${esc(x.source||'manual')}" placeholder="manual / desconocida / Meta"></div><div class="mk-field"><label>Clave atribución</label><input name="attribution_key" value="${esc(x.attribution_key||'')}" placeholder="Evita duplicados"></div>${[['reach','Alcance'],['impressions','Impresiones'],['plays','Reproducciones'],['interactions','Interacciones'],['profile_visits','Visitas al perfil'],['saves','Guardados'],['qualified_inquiries','Consultas calificadas'],['quotes','Presupuestos'],['sales','Ventas']].map(([k,l])=>`<div class="mk-field"><label>${l}</label><input name="${k}" type="number" min="0" value="${esc(x[k]??'')}"></div>`).join('')}<div class="mk-field"><label>Retención %</label><input name="retention_pct" type="number" step="0.01" value="${esc(x.retention_pct??'')}"></div><div class="mk-field"><label>Ingresos atribuidos</label><input name="revenue" type="number" step="0.01" value="${esc(x.revenue??'')}"></div><div class="mk-field"><label>Contribución antes de pauta</label><input name="contribution_before_ads" type="number" step="0.01" value="${esc(x.contribution_before_ads??'')}"></div><div class="mk-field"><label>Gasto atribuido</label><input name="spend" type="number" step="0.01" value="${esc(x.spend??'')}"></div><div class="mk-field full"><label>Motivo de pérdida</label><input name="lost_reason" value="${esc(x.lost_reason||'')}"></div><div class="mk-field full"><label>Notas</label><textarea name="notes">${esc(x.notes||'')}</textarea></div></div><div class="mk-form-actions"><div></div><div class="mk-form-actions-right"><button type="button" class="mk-btn secondary" data-close-modal>Cancelar</button><button class="mk-btn primary">Guardar</button></div></div></form>`,'RESULTADOS');$('[data-close-modal]').onclick=closeModal;$('#mk-result-form').onsubmit=async e=>{e.preventDefault();const p=Object.fromEntries(new FormData(e.currentTarget).entries());['content_id','campaign_id','branch_id','attribution_key','lost_reason'].forEach(k=>{if(!p[k])p[k]=null});['reach','impressions','plays','interactions','profile_visits','saves','qualified_inquiries','quotes','sales','retention_pct','revenue','contribution_before_ads','spend'].forEach(k=>p[k]=p[k]===''?null:Number(p[k]));let saved=existing?await state.client.from(tables.results).update(p).eq('id',x.id).select().single():await state.client.from(tables.results).insert(p).select().single();if(saved.error){alert(saved.error.message);return}state.results=await fetchTable(tables.results);closeModal();renderResults();renderDashboard();toast('Resultado guardado')}}

  function renderOptions(){const el=$('#mk-options');if(!el)return;const kind=$('#mk-option-kind')?.value||'production_status';const rows=state.options.filter(x=>x.kind===kind).sort((a,b)=>(a.sort_order||0)-(b.sort_order||0));el.innerHTML=rows.map(x=>`<div class="mk-item mk-option-row"><span class="mk-color" style="--color:${esc(x.color)}"></span><div><strong class="mk-item-title">${esc(x.label)}</strong><span class="mk-item-sub">${esc(x.id)} · orden ${x.sort_order}</span></div><span class="mk-chip">${x.is_active?'Activo':'Inactivo'}</span><button class="mk-btn ghost small" data-option-id="${esc(x.id)}">Editar</button></div>`).join('')||'<div class="mk-empty">Sin opciones.</div>';$$('[data-option-id]',el).forEach(b=>b.onclick=()=>openOption(state.options.find(x=>x.id===b.dataset.optionId)))}

  function openOption(opt={}){
    const existing=!!opt.id,x={kind:$('#mk-option-kind')?.value||'theme',color:'#77736e',sort_order:100,is_active:true,...opt};
    openModal(existing?'Editar opción':'Nueva opción',`<form id="mk-option-form"><div class="mk-form-grid">
      <div class="mk-field"><label>ID estable</label><input name="id" value="${esc(x.id||'')}" ${existing?'readonly':''} required></div>
      <div class="mk-field"><label>Grupo</label><input name="kind" value="${esc(x.kind)}" ${existing?'readonly':''} required></div>
      <div class="mk-field"><label>Nombre</label><input name="label" value="${esc(x.label||'')}" required></div>
      <div class="mk-field"><label>Color</label><input name="color" type="color" value="${esc(x.color||'#77736e')}"></div>
      <div class="mk-field"><label>Orden</label><input name="sort_order" type="number" value="${esc(x.sort_order??100)}"></div>
      <div class="mk-field"><label>Estado</label><select name="is_active"><option value="true" ${x.is_active!==false?'selected':''}>Activo</option><option value="false" ${x.is_active===false?'selected':''}>Inactivo</option></select></div>
    </div><div class="mk-form-actions"><div>${existing&&x.is_active!==false?'<button type="button" class="mk-btn danger" id="mk-option-deactivate">Desactivar</button>':''}</div><div class="mk-form-actions-right"><button type="button" class="mk-btn secondary" data-close-modal>Cancelar</button><button class="mk-btn primary">Guardar</button></div></div></form>`,'CONFIGURACIÓN');
    $('[data-close-modal]').onclick=closeModal;
    $('#mk-option-form').onsubmit=async e=>{e.preventDefault();const p=Object.fromEntries(new FormData(e.currentTarget).entries());p.sort_order=Number(p.sort_order||100);p.is_active=p.is_active==='true';let saved=existing?await state.client.from(tables.options).update(p).eq('id',x.id).select().single():await state.client.from(tables.options).insert(p).select().single();if(saved.error){alert(saved.error.message);return}state.options=await fetchTable(tables.options);closeModal();fillFilters();renderOptions();renderLegend();renderAll();toast('Configuración guardada')};
    if(existing&&x.is_active!==false)$('#mk-option-deactivate').onclick=()=>prepareDeactivateOption(x);
  }

  function optionUsage(opt){
    const field={content_type:'content_type_id',theme:'theme_id',format:'format_id',production_status:'status_id',ad_decision:'ad_decision_id',ad_status:'ad_status_id'}[opt.kind];
    if(!field)return [];
    return state.contents.filter(x=>x[field]===opt.id);
  }
  function prepareDeactivateOption(opt){
    const used=optionUsage(opt),alts=state.options.filter(x=>x.kind===opt.kind&&x.id!==opt.id&&x.is_active);
    if(!used.length){if(confirm(`¿Desactivar “${opt.label}”?`))deactivateOption(opt,null);return;}
    openModal('Reasignar antes de desactivar',`<div class="mk-notice">“${esc(opt.label)}” está usado en ${used.length} contenido(s). Para conservar asociaciones elegí un reemplazo antes de desactivarlo.</div><div class="mk-field" style="margin-top:14px"><label>Reasignar a</label><select id="mk-option-reassign"><option value="">Elegir opción…</option>${alts.map(a=>`<option value="${esc(a.id)}">${esc(a.label)}</option>`).join('')}</select></div><div class="mk-form-actions"><div></div><div class="mk-form-actions-right"><button class="mk-btn secondary" type="button" data-close-modal>Cancelar</button><button class="mk-btn primary" type="button" id="mk-option-reassign-go">Reasignar y desactivar</button></div></div>`,'CONFIGURACIÓN');
    $('[data-close-modal]').onclick=closeModal;$('#mk-option-reassign-go').onclick=()=>{const target=$('#mk-option-reassign').value;if(!target){alert('Elegí una opción de reemplazo.');return}deactivateOption(opt,target)};
  }
  async function deactivateOption(opt,target){
    const field={content_type:'content_type_id',theme:'theme_id',format:'format_id',production_status:'status_id',ad_decision:'ad_decision_id',ad_status:'ad_status_id'}[opt.kind];
    if(target&&field){const {error}=await state.client.from(tables.contents).update({[field]:target,updated_by:state.session.user.id}).eq(field,opt.id);if(error){alert(error.message);return}}
    const {error}=await state.client.from(tables.options).update({is_active:false}).eq('id',opt.id);if(error){alert(error.message);return}state.options=await fetchTable(tables.options);state.contents=await fetchTable(tables.contents);closeModal();renderAll();toast('Opción desactivada')
  }
  function renderLegend(){const el=$('#mk-legend');if(!el)return;el.innerHTML=byKind('content_type').map(x=>`<span class="mk-chip"><span class="mk-chip-dot" style="--chip:${esc(x.color)}"></span>${esc(x.label)}</span>`).join('')+byKind('ad_decision').map(x=>`<span class="mk-badge ad ${esc(x.id)}">Pauta: ${esc(x.label)}</span>`).join('')}

  async function refreshSuggestions(){
    if(!state.ready)return;const today=C.isoToday(),drafts=[];
    state.contents.filter(x=>!x.archived_at&&x.publish_date&&x.publish_date<today&&!['published','analyzed'].includes(x.status_id)).slice(0,12).forEach(x=>drafts.push({stable_id:`SUG-OVERDUE-${x.stable_id}`,suggestion_type:'overdue',title:`Resolver contenido atrasado: ${x.stable_id}`,proposal:`Reprogramar, publicar cuando esté validado o devolver al banco “${x.title}”.`,observed_data:{content_id:x.id,stable_id:x.stable_id,publish_date:x.publish_date,status:x.status_id},rationale:'La fecha propuesta ya pasó y la pieza no figura publicada ni analizada.',objective:'Evitar que un pendiente quede oculto en el calendario.',missing_validation:'Confirmar si el material está listo y si la fecha sigue siendo pertinente.',source_links:[{type:'content',id:x.id}]}));
    state.contents.filter(x=>x.status_id==='published'&&!x.archived_at).slice(0,8).forEach(x=>{if(!state.results.some(r=>r.content_id===x.id))drafts.push({stable_id:`SUG-MEASURE-${x.stable_id}`,suggestion_type:'measurement',title:`Completar resultados: ${x.stable_id}`,proposal:`Registrar métricas y resultado comercial de “${x.title}” antes de afirmar que funcionó o no.`,observed_data:{content_id:x.id,stable_id:x.stable_id},rationale:'La pieza figura publicada pero no tiene resultados manuales vinculados.',objective:'Cerrar el ciclo publicación → aprendizaje.',missing_validation:'Cargar alcance/interacciones y, si corresponde, consultas, presupuestos, ventas e ingresos.',source_links:[{type:'content',id:x.id}]})});
    state.results.filter(r=>Number(r.sales||0)>0&&r.content_id).slice(0,8).forEach(r=>{const c=state.contents.find(x=>x.id===r.content_id);if(c)drafts.push({stable_id:`SUG-VARIANT-${c.stable_id}`,suggestion_type:'variant',title:`Probar una variante de ${c.stable_id}`,proposal:`Crear una nueva versión de “${c.title}” conservando la propuesta principal y cambiando un solo elemento —por ejemplo gancho, cierre o formato— para comparar.`,observed_data:{content_id:c.id,stable_id:c.stable_id,sales:r.sales,revenue:r.revenue,period:[r.period_start,r.period_end]},rationale:'Hay ventas registradas asociadas a la pieza; esto es un dato observado, no prueba de causalidad.',objective:'Explorar si la propuesta puede repetirse sin atribuir el resultado únicamente a la creatividad.',missing_validation:'Revisar atribución, contribución y condiciones vigentes antes de pautar.',source_links:[{type:'content',id:c.id},{type:'result',id:r.id}]})});
    state.campaigns.filter(c=>Number(c.actual_spend||0)>0).forEach(c=>{if(!state.results.some(r=>r.campaign_id===c.id))drafts.push({stable_id:`SUG-CAMPAIGN-DATA-${c.stable_id}`,suggestion_type:'campaign_data',title:`Faltan resultados de ${c.name}`,proposal:'Cargar ventas/consultas atribuidas y contribución antes de reasignar presupuesto.',observed_data:{campaign_id:c.id,spend:c.actual_spend},rationale:'Hay gasto real registrado pero no resultados vinculados.',objective:'Evitar decisiones de presupuesto basadas solo en clics o reproducciones.',missing_validation:'Registrar la cohorte comercial y reconciliar ventas asistidas/atribuidas.',source_links:[{type:'campaign',id:c.id}]})});
    if(drafts.length){const payload=drafts.map(x=>({...x,status:'pending',updated_by:state.session.user.id}));const {error}=await state.client.from(tables.suggestions).upsert(payload,{onConflict:'stable_id',ignoreDuplicates:true});if(error){alert(error.message);return}}
    state.suggestions=await fetchTable(tables.suggestions);renderSuggestionsHome();toast('Sugerencias actualizadas');
  }
  function renderSuggestionsHome(){const el=$('#mk-suggestions-home');if(!el)return;const today=C.isoToday(),rows=state.suggestions.filter(x=>x.status==='pending'&&(!x.snoozed_until||x.snoozed_until<=today)).slice(0,6);el.innerHTML=rows.length?rows.map(x=>`<div class="mk-item" data-suggestion-id="${x.id}"><strong class="mk-item-title">${esc(x.title)}</strong><span class="mk-item-sub">${esc(x.rationale||'')}</span><div class="mk-meta"><button class="mk-btn primary small" data-sug-accept="${x.id}">Aceptar</button><button class="mk-btn ghost small" data-sug-edit="${x.id}">Editar</button><button class="mk-btn ghost small" data-sug-snooze="${x.id}">Posponer</button><button class="mk-btn ghost small" data-sug-dismiss="${x.id}">Descartar</button></div></div>`).join(''):'<div class="mk-empty">Sin sugerencias pendientes. Podés actualizarlas con los datos actuales.</div>';$$('[data-sug-accept]',el).forEach(b=>b.onclick=()=>acceptSuggestion(b.dataset.sugAccept));$$('[data-sug-edit]',el).forEach(b=>b.onclick=()=>editSuggestion(b.dataset.sugEdit));$$('[data-sug-snooze]',el).forEach(b=>b.onclick=()=>updateSuggestion(b.dataset.sugSnooze,{status:'snoozed',snoozed_until:C.toISODate(C.addDays(new Date(),7))}));$$('[data-sug-dismiss]',el).forEach(b=>b.onclick=()=>updateSuggestion(b.dataset.sugDismiss,{status:'dismissed'}));}
  async function updateSuggestion(id,patch){const {error}=await state.client.from(tables.suggestions).update({...patch,updated_by:state.session.user.id}).eq('id',id);if(error){alert(error.message);return}state.suggestions=await fetchTable(tables.suggestions);renderSuggestionsHome()}
  function editSuggestion(id){const x=state.suggestions.find(s=>s.id===id);if(!x)return;openModal('Editar sugerencia',`<form id="mk-sug-form"><div class="mk-field"><label>Título</label><input name="title" value="${esc(x.title)}"></div><div class="mk-field"><label>Propuesta</label><textarea name="proposal">${esc(x.proposal)}</textarea></div><div class="mk-field"><label>Por qué</label><textarea name="rationale">${esc(x.rationale||'')}</textarea></div><div class="mk-field"><label>Objetivo</label><textarea name="objective">${esc(x.objective||'')}</textarea></div><div class="mk-field"><label>Falta validar</label><textarea name="missing_validation">${esc(x.missing_validation||'')}</textarea></div><div class="mk-form-actions"><div></div><div class="mk-form-actions-right"><button type="button" class="mk-btn secondary" data-close-modal>Cancelar</button><button class="mk-btn primary">Guardar</button></div></div></form>`,'SUGERENCIA');$('[data-close-modal]').onclick=closeModal;$('#mk-sug-form').onsubmit=async e=>{e.preventDefault();await updateSuggestion(id,Object.fromEntries(new FormData(e.currentTarget).entries()));closeModal()}}
  async function acceptSuggestion(id){const s=state.suggestions.find(x=>x.id===id);if(!s)return;const src=s.observed_data?.content_id?state.contents.find(x=>x.id===s.observed_data.content_id):null;const payload={stable_id:stableId('SUG'),title:s.title.replace(/^Probar una variante de\s*/,'Variante · '),content_type_id:src?.content_type_id||'commercial',theme_id:src?.theme_id||'general',format_id:src?.format_id||'reel_video',objective:s.objective||src?.objective||null,branch_id:src?.branch_id||null,responsible:src?.responsible||null,brief:s.proposal,hook:null,development:s.rationale,notes:`Origen: sugerencia ${s.stable_id||s.id}. Falta validar: ${s.missing_validation||'—'}`,parent_id:src?.id||null,status_id:'idea',ad_decision_id:'organic',ad_status_id:'not_activated',source_name:'marketing_suggestion',source_payload:{suggestion_id:s.id,observed_data:s.observed_data,source_links:s.source_links},created_by:state.session.user.id,updated_by:state.session.user.id};const {data,error}=await state.client.from(tables.contents).insert(payload).select().single();if(error){alert(error.message);return}await state.client.from(tables.suggestions).update({status:'accepted',accepted_content_id:data.id,updated_by:state.session.user.id}).eq('id',s.id);state.contents.push(data);state.suggestions=await fetchTable(tables.suggestions);fillFilters();renderAll();openContent(data)}

  async function loadCanonicalSource(){
    const response=await fetch('data/marketing-plan-v10.json.gz',{cache:'no-store'});if(!response.ok)throw new Error(`No se pudo leer la fuente canónica (${response.status}).`);
    if(typeof DecompressionStream==='undefined')throw new Error('Este navegador no soporta la descompresión requerida para la precarga.');
    const stream=response.body.pipeThrough(new DecompressionStream('gzip'));const text=await new Response(stream).text();return JSON.parse(text);
  }
  function canonicalRows(source){
    const rows=[];(source.content_items||[]).forEach(item=>rows.push({entity_kind:'content',stable_id:item.stable_id,title:item.title,payload:item}));
    (source.story_templates||[]).forEach(item=>rows.push({entity_kind:'story',stable_id:item.stable_id,title:item.title,payload:item}));
    (source.reference_notes||[]).forEach(item=>rows.push({entity_kind:'reference',stable_id:item.stable_id,title:item.title,payload:item}));
    (source.brand_references||[]).forEach(item=>rows.push({entity_kind:'reference',stable_id:`REF-${item.stable_id}`,title:`Referencia de marca: ${item.label}`,payload:{stable_id:`REF-${item.stable_id}`,title:`Referencia de marca: ${item.label}`,content:`${item.label} aparece en el plan como referencia. No asumir características comerciales, stock, procedencia, distribución oficial ni disponibilidad hasta validarlas.`,needs_review:true,tags:['marca','validar']}}));
    return rows;
  }
  function existingForRow(row){
    if(row.entity_kind==='content')return state.contents.find(x=>x.stable_id===row.stable_id)||null;
    if(row.entity_kind==='story')return state.stories.find(x=>x.stable_id===row.stable_id)||null;
    if(row.entity_kind==='reference')return state.references.find(x=>x.stable_id===row.stable_id)||null;
    return null;
  }
  async function buildImportPreview(source,meta={}){
    // Refrescar las entidades reconciliables antes de clasificar NEW/UPDATE.
    // Evita que una importación previa parcial o cambios en otra sesión dejen
    // state.* desactualizado y hagan que la preview marque como NEW un stable_id existente.
    const [contents,stories,references]=await Promise.all([
      fetchTable(tables.contents),
      fetchTable(tables.stories),
      fetchTable(tables.references)
    ]);
    Object.assign(state,{contents,stories,references});
    const rows=canonicalRows(source);const seen=new Set();const preview=rows.map(row=>{const issues=[];if(!row.stable_id)issues.push('Falta ID');if(seen.has(row.stable_id))issues.push('ID duplicado en lote');seen.add(row.stable_id);const existing=existingForRow(row),hash=C.fastHash(row.payload);let action=issues.length?'review':existing?(existing.source_hash===hash?'duplicate':'update'):'new';return {...row,existing,source_hash:hash,action,issues}});
    const summary=preview.reduce((a,r)=>(a[r.action]=(a[r.action]||0)+1,a),{});const sourceMeta=source.source||meta||{};
    const batchInsert=await state.client.from('marketing_import_batches').insert({source_name:sourceMeta.name||meta.name||'Importación manual',source_version:sourceMeta.version||meta.version||null,source_hash:sourceMeta.sha256||C.fastHash(source),status:'preview',summary,source_meta:sourceMeta}).select().single();if(batchInsert.error)throw batchInsert.error;
    const batch=batchInsert.data;const importRows=preview.map(r=>({batch_id:batch.id,entity_kind:r.entity_kind,stable_id:r.stable_id,payload:r.payload,action:r.action,matched_id:r.existing?.id||null,validation:{issues:r.issues,source_hash:r.source_hash}}));
    const rowInsert=await state.client.from('marketing_import_rows').insert(importRows);if(rowInsert.error)throw rowInsert.error;
    state.currentImport={batch,source,preview};return state.currentImport;
  }
  function showImportPreview(current){
    const {batch,preview}=current,counts=preview.reduce((a,r)=>(a[r.action]=(a[r.action]||0)+1,a),{});openModal('Previsualización de importación',`<div class="mk-import-summary"><div class="mk-import-stat"><strong>${counts.new||0}</strong><span>Nuevos</span></div><div class="mk-import-stat"><strong>${counts.update||0}</strong><span>Coincidencias a actualizar</span></div><div class="mk-import-stat"><strong>${counts.duplicate||0}</strong><span>Sin cambios / duplicados</span></div><div class="mk-import-stat"><strong>${counts.review||0}</strong><span>Revisar</span></div></div><div class="mk-help">Los IDs estables evitan copias. Al actualizar una pieza existente se preservan fecha reprogramada, estado de producción, decisión de pauta, responsable, adjuntos y resultados operativos.</div><div class="mk-import-list" style="max-height:430px;overflow:auto;margin-top:12px">${preview.map(r=>`<div class="mk-import-row"><span class="action ${r.action}">${esc(r.action)}</span><span>${esc(r.entity_kind)}</span><div><strong>${esc(r.stable_id)}</strong> · ${esc(r.title||'')}</div></div>`).join('')}</div><div class="mk-form-actions"><div><span class="mk-item-sub">Lote ${esc(batch.id.slice(0,8))}</span></div><div class="mk-form-actions-right"><button type="button" class="mk-btn secondary" data-close-modal>Cancelar</button><button type="button" class="mk-btn primary" id="mk-apply-import" ${(counts.review||0)?'':''}>Aplicar nuevos y actualizaciones</button></div></div>`,'IMPORTACIÓN');$('[data-close-modal]').onclick=async()=>{await state.client.from('marketing_import_batches').update({status:'cancelled'}).eq('id',batch.id);closeModal();state.imports=await fetchTable(tables.imports);renderImportHistory()};$('#mk-apply-import').onclick=applyCurrentImport;
  }
  async function previewCanonicalImport(){try{setSync('Leyendo plan…');const source=await loadCanonicalSource();const current=await buildImportPreview(source);showImportPreview(current)}catch(error){console.error(error);alert(humanError(error));setSync('Error de importación')}}

  function mapCanonicalContent(item,existing){
    const p={stable_id:item.stable_id,title:item.title,content_type_id:item.type_key||'other',theme_id:item.theme_key||'general',format_id:item.format_key||'reel_video',objective:item.objective||null,branch_id:item.branch_key||null,responsible:item.responsible||null,brief:item.brief||null,hook:item.hook||null,development:item.development||null,material:item.material||null,cta:item.cta||null,channel:item.channel||null,destination:item.destination||null,publish_date:item.proposed_date||null,status_id:item.production_status||'scheduled',ad_decision_id:item.ad_decision||'organic',ad_status_id:item.ad_status||'not_activated',notes:item.notes||null,source_name:'Black Óptica — Plan ampliado de contenido y Meta Ads',source_version:'10',source_hash:C.fastHash(item),source_payload:item,needs_review:!!item.needs_review,updated_by:state.session.user.id};
    if(existing){p.publish_date=existing.publish_date||p.publish_date;p.status_id=existing.status_id||p.status_id;p.ad_decision_id=existing.ad_decision_id||p.ad_decision_id;p.ad_status_id=existing.ad_status_id||p.ad_status_id;p.responsible=existing.responsible||p.responsible;p.channel=existing.channel||p.channel;p.destination=existing.destination||p.destination;p.product_id=existing.product_id||null;p.product_label=existing.product_label||null;p.promotion_label=existing.promotion_label||null;p.audience_zone=existing.audience_zone||null;p.attachments=existing.attachments||[];p.results=existing.results||{};p.script=existing.script||null;p.archived_at=existing.archived_at||null;}
    else p.created_by=state.session.user.id;return p;
  }
  function mapGenericContent(item,existing){
    const p={stable_id:item.stable_id,title:item.title||item.name||'Sin título',content_type_id:item.content_type_id||item.type_key||'other',theme_id:item.theme_id||item.theme_key||'general',format_id:item.format_id||item.format_key||'reel_video',objective:item.objective||null,branch_id:item.branch_id||item.branch_key||null,responsible:item.responsible||null,brief:item.brief||null,hook:item.hook||null,development:item.development||null,script:item.script||null,material:item.material||null,cta:item.cta||null,channel:item.channel||null,destination:item.destination||null,publish_date:item.publish_date||item.proposed_date||null,status_id:item.status_id||item.production_status||'idea',ad_decision_id:item.ad_decision_id||item.ad_decision||'organic',ad_status_id:item.ad_status_id||item.ad_status||'not_activated',notes:item.notes||null,source_name:'Importación JSON/CSV',source_version:item.source_version||null,source_hash:C.fastHash(item),source_payload:item,needs_review:!!item.needs_review,updated_by:state.session.user.id};if(existing){p.publish_date=existing.publish_date||p.publish_date;p.status_id=existing.status_id||p.status_id;p.ad_decision_id=existing.ad_decision_id||p.ad_decision_id;p.responsible=existing.responsible||p.responsible;p.results=existing.results||{};p.attachments=existing.attachments||[]}else p.created_by=state.session.user.id;return p;
  }
  async function applyCurrentImport(){
    const current=state.currentImport;if(!current)return;
    const rows=current.preview.filter(r=>['new','update'].includes(r.action));
    setSync(`Importando ${rows.length}…`);
    let applied=0;

    const lookupByStableId=async(table,stableId)=>{
      const {data,error}=await state.client.from(table).select('*').eq('stable_id',stableId).maybeSingle();
      if(error)throw error;
      return data||null;
    };

    for(const r of rows){
      let result=null;
      try{
        if(r.entity_kind==='content'){
          // La preview es informativa. La verdad final se consulta justo antes de escribir:
          // si el stable_id apareció entre preview y apply, upsert actualiza en vez de duplicar.
          const existingNow=await lookupByStableId(tables.contents,r.stable_id);
          const payload=(current.source.schema_version==='black-marketing-import-v1')
            ? mapCanonicalContent(r.payload,existingNow)
            : mapGenericContent(r.payload,existingNow);
          result=await state.client
            .from(tables.contents)
            .upsert(payload,{onConflict:'stable_id'})
            .select('id')
            .single();
        }else if(r.entity_kind==='story'){
          const existingNow=await lookupByStableId(tables.stories,r.stable_id);
          const p={
            stable_id:r.payload.stable_id,
            title:r.payload.title,
            objective:r.payload.objective||null,
            notes:`Ejemplos: ${r.payload.examples||''}\nMaterial/frecuencia: ${r.payload.material_frequency||''}`,
            status_id:existingNow?.status_id||'idea',
            source_version:current.source.source?.version||null,
            source_payload:r.payload,
            updated_by:state.session.user.id
          };
          if(existingNow){
            p.content_id=existingNow.content_id||null;
            p.branch_id=existingNow.branch_id||null;
            p.cta=existingNow.cta||null;
            p.channel=existingNow.channel||'stories';
            p.destination=existingNow.destination||null;
            p.valid_from=existingNow.valid_from||null;
            p.valid_until=existingNow.valid_until||null;
            p.highlight_id=existingNow.highlight_id||null;
            p.archived_at=existingNow.archived_at||null;
          }else{
            p.created_by=state.session.user.id;
          }
          result=await state.client
            .from(tables.stories)
            .upsert(p,{onConflict:'stable_id'})
            .select('id')
            .single();

          if(!result.error&&result.data?.id){
            const {data:frameRows,error:frameLookupError}=await state.client
              .from(tables.frames)
              .select('id')
              .eq('sequence_id',result.data.id)
              .limit(1);
            if(frameLookupError)throw frameLookupError;
            if(!(frameRows||[]).length){
              const {error:frameInsertError}=await state.client.from(tables.frames).insert({
                sequence_id:result.data.id,
                sort_order:10,
                text_content:r.payload.examples||null,
                material:r.payload.material_frequency||null,
                created_by:state.session.user.id
              });
              if(frameInsertError)throw frameInsertError;
            }
          }
        }else if(r.entity_kind==='reference'){
          const existingNow=await lookupByStableId(tables.references,r.stable_id);
          const p={
            stable_id:r.payload.stable_id,
            title:r.payload.title,
            content:r.payload.content||'',
            tags:r.payload.tags||[],
            source_version:current.source.source?.version||null,
            source_hash:C.fastHash(r.payload),
            needs_review:!!r.payload.needs_review,
            updated_by:state.session.user.id
          };
          if(!existingNow)p.created_by=state.session.user.id;
          result=await state.client
            .from(tables.references)
            .upsert(p,{onConflict:'stable_id'})
            .select('id')
            .single();
        }
      }catch(error){
        result={error};
      }

      if(result?.error){
        await state.client.from('marketing_import_batches').update({
          status:'failed',
          summary:{...current.batch.summary,error:result.error.message||String(result.error),applied}
        }).eq('id',current.batch.id);
        // Refrescar estado local después de una aplicación parcial para que un reintento
        // no vuelva a clasificar registros ya escritos como nuevos.
        try{await loadAll();}catch(_){}
        alert(`Importación detenida en ${r.stable_id}: ${result.error.message||result.error}`);
        setSync('Error de importación');
        return;
      }

      applied++;
      await state.client.from('marketing_import_rows').update({
        action:'applied',
        applied_at:nowISO()
      }).eq('batch_id',current.batch.id).eq('entity_kind',r.entity_kind).eq('stable_id',r.stable_id);
    }

    await state.client.from('marketing_import_batches').update({
      status:'applied',
      applied_at:nowISO(),
      summary:{...current.batch.summary,applied}
    }).eq('id',current.batch.id);

    await loadAll();
    state.currentImport=null;
    closeModal();
    fillFilters();
    renderAll();
    toast(`Importación aplicada · ${applied} cambios`);
  }

  async function handleImportFile(event){const file=event.target.files?.[0];if(!file)return;try{const text=await file.text();let source;if(file.name.toLowerCase().endsWith('.json')){const data=JSON.parse(text);source=Array.isArray(data)?{content_items:data}:{...data};if(!source.content_items)throw new Error('El JSON debe incluir content_items o ser un array de contenidos.')}else{const rows=C.csvRows(text);source={content_items:rows.map(r=>({...r,stable_id:r.stable_id||r.id,title:r.title||r.titulo})),source:{name:file.name,version:'manual'}}}source.schema_version=source.schema_version||'manual-import-v1';source.story_templates=source.story_templates||[];source.reference_notes=source.reference_notes||[];source.brand_references=source.brand_references||[];const current=await buildImportPreview(source,{name:file.name,version:'manual'});showImportPreview(current)}catch(error){alert(`No se pudo previsualizar: ${error.message}`)}finally{event.target.value=''}}

  function renderImportHistory(){const el=$('#mk-import-history');if(!el)return;const rows=state.imports.slice().sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at))).slice(0,8);el.innerHTML=rows.length?rows.map(x=>`<div class="mk-item"><div class="mk-item-top"><strong>${esc(x.source_name)}</strong><span class="mk-chip">${esc(x.status)}</span></div><span class="mk-item-sub">v${esc(x.source_version||'—')} · ${esc(new Date(x.created_at).toLocaleString('es-AR'))}</span></div>`).join(''):'<div class="mk-empty">Sin importaciones todavía.</div>'}
  function renderReferenceNotes(){const el=$('#mk-reference-notes');if(!el)return;const rows=state.references.slice().sort((a,b)=>String(a.stable_id).localeCompare(String(b.stable_id)));el.innerHTML=rows.length?rows.map(x=>`<details><summary>${esc(x.title)} ${x.needs_review?'<span class="mk-badge">Revisar</span>':''}</summary><pre>${esc(x.content)}</pre></details>`).join(''):'<div class="mk-empty">Las notas globales del plan se cargarán con la importación canónica.</div>'}

  window.BlackMarketing={reload:async()=>{await loadAll();renderAll()},openContent,previewCanonicalImport};
  boot();
})();
