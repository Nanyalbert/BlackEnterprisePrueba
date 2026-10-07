// Black Óptica — Liquidaciones médicas imprimibles
// Capa de salida documental: genera un anexo A4 listo para imprimir y adjuntar a una carta.
(() => {
  const IVA_DEFAULT = 21;

  function money(value){
    return new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',maximumFractionDigits:2}).format(Number(value)||0);
  }
  function xml(value){
    return String(value??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
  function branchCode(recipe){
    const raw=String(recipe?.branch||recipe?.branch_code||recipe?.sucursal||'general-paz').trim().toLowerCase();
    if(['alto-palermo','zona-norte','cerro'].includes(raw)) return 'cerro-de-las-rosas';
    return raw==='cerro-de-las-rosas'?'cerro-de-las-rosas':'general-paz';
  }
  function branchName(recipe){ return branchCode(recipe)==='cerro-de-las-rosas'?'Cerro de las Rosas':'General Paz'; }
  function ivaRate(recipe){
    const candidate=Number(recipe?.iva_rate ?? recipe?.alicuota_iva ?? recipe?.vat_rate ?? IVA_DEFAULT);
    return Number.isFinite(candidate)&&candidate>=0&&candidate<=100?candidate:IVA_DEFAULT;
  }
  function commissionPct(recipe,doctor){
    const saved=Number(recipe?.commission_pct ?? recipe?.porcentaje_comision);
    if(Number.isFinite(saved)&&saved>=0) return saved;
    const historical=window.BlackCommissionRules?.getPct?.(doctor,branchCode(recipe),recipe?.fecha);
    if(Number.isFinite(Number(historical))) return Math.max(0,Number(historical));
    try{return Math.max(0,Number(window.getComision?.(doctor,branchCode(recipe)))||0)}catch(_){return 20}
  }
  function rowCalc(recipe,doctor){
    // El Excel de comisiones importa "Total Receta S/IVA": recipe.monto es la base neta.
    const rate=ivaRate(recipe);
    const explicitNet=Number(recipe?.monto_sin_iva ?? recipe?.amount_net ?? recipe?.net_amount ?? recipe?.monto);
    const net=Math.max(0,Number.isFinite(explicitNet)?explicitNet:0);
    const explicitGross=Number(recipe?.monto_con_iva ?? recipe?.amount_gross);
    const gross=Number.isFinite(explicitGross)&&explicitGross>=0 ? explicitGross : net*(1+rate/100);
    const vat=Math.max(0,gross-net);
    const pct=commissionPct(recipe,doctor);
    const explicitCommission=Number(recipe?.commission_amount ?? recipe?.importe_comision);
    const commission=Number.isFinite(explicitCommission)&&explicitCommission>=0 ? explicitCommission : net*pct/100;
    return {gross,rate,net,vat,pct,commission};
  }
  function parseDate(value){
    const raw=String(value||'').trim();
    if(!raw)return null;
    const dmY=raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if(dmY) return new Date(Number(dmY[3]),Number(dmY[2])-1,Number(dmY[1]));
    const date=new Date(raw.includes('T')?raw:raw+'T00:00:00');
    return Number.isNaN(date.getTime())?null:date;
  }
  function displayDate(value){
    const date=parseDate(value);
    return date?date.toLocaleDateString('es-AR',{day:'2-digit',month:'2-digit',year:'numeric'}):String(value||'');
  }
  function paragraph(text,{size=20,bold=false,color='1C1C1C',align='left',before=0,after=80,keep=false}={}){
    return `<w:p><w:pPr><w:jc w:val="${align}"/><w:spacing w:before="${before}" w:after="${after}"/>${keep?'<w:keepNext/>':''}</w:pPr><w:r><w:rPr>${bold?'<w:b/>':''}<w:color w:val="${color}"/><w:sz w:val="${size}"/><w:szCs w:val="${size}"/></w:rPr><w:t xml:space="preserve">${xml(text)}</w:t></w:r></w:p>`;
  }
  function cell(text,width,{bold=false,fill='',align='left',size=15,color='252525'}={}){
    return `<w:tc><w:tcPr><w:tcW w:w="${width}" w:type="dxa"/>${fill?`<w:shd w:val="clear" w:color="auto" w:fill="${fill}"/>`:''}<w:tcMar><w:top w:w="75" w:type="dxa"/><w:left w:w="80" w:type="dxa"/><w:bottom w:w="75" w:type="dxa"/><w:right w:w="80" w:type="dxa"/></w:tcMar></w:tcPr><w:p><w:pPr><w:jc w:val="${align}"/><w:spacing w:before="0" w:after="0"/></w:pPr><w:r><w:rPr>${bold?'<w:b/>':''}<w:color w:val="${color}"/><w:sz w:val="${size}"/><w:szCs w:val="${size}"/></w:rPr><w:t xml:space="preserve">${xml(text)}</w:t></w:r></w:p></w:tc>`;
  }
  function detailTable(recipes,doctor){
    const widths=[720,2250,1130,1240,940,1240,610,1970];
    const headers=['Fecha','Paciente','Sucursal','Monto c/IVA','IVA','Monto s/IVA','%','Comisión'];
    let rows=`<w:tr><w:trPr><w:tblHeader/></w:trPr>${headers.map((h,i)=>cell(h,widths[i],{bold:true,fill:'1A1A1A',color:'FFFFFF',align:i>=3?'right':'left',size:14})).join('')}</w:tr>`;
    recipes.forEach((r,index)=>{
      const c=rowCalc(r,doctor);
      const fill=index%2===0?'F8F8F6':'FFFFFF';
      const values=[displayDate(r.fecha),r.paciente||'—',branchName(r),money(c.gross),money(c.vat),money(c.net),`${c.pct.toFixed(c.pct%1?1:0)}%`,money(c.commission)];
      rows+=`<w:tr>${values.map((v,i)=>cell(v,widths[i],{fill,align:i>=3?'right':'left',bold:i===7,size:14})).join('')}</w:tr>`;
    });
    return `<w:tbl><w:tblPr><w:tblW w:w="10100" w:type="dxa"/><w:tblLayout w:type="fixed"/><w:tblBorders><w:top w:val="single" w:sz="4" w:color="D8D8D3"/><w:left w:val="single" w:sz="4" w:color="D8D8D3"/><w:bottom w:val="single" w:sz="4" w:color="D8D8D3"/><w:right w:val="single" w:sz="4" w:color="D8D8D3"/><w:insideH w:val="single" w:sz="3" w:color="E5E5E1"/><w:insideV w:val="single" w:sz="3" w:color="E5E5E1"/></w:tblBorders></w:tblPr><w:tblGrid>${widths.map(w=>`<w:gridCol w:w="${w}"/>`).join('')}</w:tblGrid>${rows}</w:tbl>`;
  }
  function summaryTable(recipes,doctor){
    const totals=recipes.reduce((a,r)=>{const c=rowCalc(r,doctor);a.gross+=c.gross;a.vat+=c.vat;a.net+=c.net;a.commission+=c.commission;a.pcts.add(c.pct);return a},{gross:0,vat:0,net:0,commission:0,pcts:new Set()});
    const pctLabel=totals.pcts.size===1?`${[...totals.pcts][0]}%`:'Según detalle';
    const items=[
      ['Recetas incluidas',String(recipes.length)],
      ['Total facturado c/IVA',money(totals.gross)],
      ['IVA incluido',money(totals.vat)],
      ['Base comisionable s/IVA',money(totals.net)],
      ['Porcentaje aplicado',pctLabel],
      ['TOTAL COMISIÓN',money(totals.commission)]
    ];
    return `<w:tbl><w:tblPr><w:tblW w:w="6200" w:type="dxa"/><w:tblLayout w:type="fixed"/><w:tblBorders><w:top w:val="single" w:sz="5" w:color="CFCFC9"/><w:left w:val="single" w:sz="5" w:color="CFCFC9"/><w:bottom w:val="single" w:sz="5" w:color="CFCFC9"/><w:right w:val="single" w:sz="5" w:color="CFCFC9"/><w:insideH w:val="single" w:sz="3" w:color="E5E5E1"/></w:tblBorders></w:tblPr><w:tblGrid><w:gridCol w:w="3550"/><w:gridCol w:w="2650"/></w:tblGrid>${items.map(([label,value],index)=>`<w:tr>${cell(label,3550,{bold:index===5,fill:index===5?'1A1A1A':'F7F7F4',color:index===5?'FFFFFF':'4A4A46',size:index===5?17:15})}${cell(value,2650,{bold:true,fill:index===5?'1A1A1A':'F7F7F4',color:index===5?'FFFFFF':'171717',align:'right',size:index===5?18:15})}</w:tr>`).join('')}</w:tbl>`;
  }
  function periodText(periodo){return periodo||'Período seleccionado en Black OS'}
  function emissionDate(){return new Date().toLocaleDateString('es-AR',{day:'2-digit',month:'2-digit',year:'numeric'});}
  function documentXml(byDoc,periodo){
    let body='';
    const doctors=Object.keys(byDoc).sort((a,b)=>a.localeCompare(b,'es'));
    doctors.forEach((doctor,index)=>{
      const recipes=(byDoc[doctor]||[]).filter(Boolean).slice().sort((a,b)=>(parseDate(a.fecha)||0)-(parseDate(b.fecha)||0));
      if(!recipes.length)return;
      const branches=[...new Set(recipes.map(branchName))];
      body+=paragraph('BLACK ÓPTICA',{size:18,bold:true,color:'111111',after:30,keep:true});
      body+=paragraph('RESPALDO — LIQUIDACIÓN DE COMISIONES MÉDICAS',{size:28,bold:true,color:'111111',after:180,keep:true});
      body+=`<w:tbl><w:tblPr><w:tblW w:w="10100" w:type="dxa"/><w:tblBorders><w:bottom w:val="single" w:sz="5" w:color="D8D8D3"/></w:tblBorders></w:tblPr><w:tblGrid><w:gridCol w:w="2200"/><w:gridCol w:w="7900"/></w:tblGrid>`+
        `<w:tr>${cell('Profesional',2200,{bold:true,color:'666660',size:15})}${cell(doctor,7900,{bold:true,size:17})}</w:tr>`+
        `<w:tr>${cell('Período',2200,{bold:true,color:'666660',size:15})}${cell(periodText(periodo),7900,{size:15})}</w:tr>`+
        `<w:tr>${cell('Sucursal',2200,{bold:true,color:'666660',size:15})}${cell(branches.length===1?branches[0]:'Consolidado · '+branches.join(' + '),7900,{size:15})}</w:tr>`+
        `<w:tr>${cell('Fecha de emisión',2200,{bold:true,color:'666660',size:15})}${cell(emissionDate(),7900,{size:15})}</w:tr></w:tbl>`;
      body+=paragraph('Detalle de operaciones incluidas',{size:19,bold:true,before:220,after:90,keep:true});
      body+=detailTable(recipes,doctor);
      body+=paragraph('Resumen de liquidación',{size:19,bold:true,before:230,after:90,keep:true});
      body+=summaryTable(recipes,doctor);
      body+=paragraph('Criterio de cálculo',{size:16,bold:true,before:210,after:45,keep:true});
      body+=paragraph('La comisión se calcula sobre el importe efectivamente facturado al paciente, neto de IVA. Los descuentos comerciales aplicados al paciente reducen la base comisionable. Los costos financieros, aranceles o cargos asociados al medio de pago no se descuentan de dicha base.',{size:14,color:'666660',after:40});
      body+=paragraph('Respaldo administrativo de la liquidación digital. Los importes se detallan operación por operación para facilitar su verificación.',{size:13,color:'777772',after:0});
      if(index<doctors.length-1) body+='<w:p><w:r><w:br w:type="page"/></w:r></w:p>';
    });
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml" mc:Ignorable="w14"><w:body>${body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="850" w:right="900" w:bottom="850" w:left="900" w:header="400" w:footer="400"/><w:cols w:space="720"/><w:docGrid w:linePitch="360"/></w:sectPr></w:body></w:document>`;
  }

  function buildData(){
    const periodo=document.getElementById('word-periodo-texto')?.value.trim()||'';
    const inst=document.getElementById('word-inst-filter')?.value||'';
    const doctorFilter=document.getElementById('word-medico-filter')?.value||'';
    const desde=document.getElementById('periodo-desde')?.value||'';
    const hasta=document.getElementById('periodo-hasta')?.value||'';
    const filtered=window.filterRecetas(desde,hasta,inst);
    const byDoc={};
    filtered.forEach(r=>{
      if(doctorFilter&&window.normName(r.medico)!==window.normName(doctorFilter))return;
      (byDoc[r.medico]??=[]).push(r);
    });
    return {periodo,doctorFilter,byDoc};
  }
  function isIndividualMode(){
    return document.getElementById('word-opt-individual')?.classList.contains('selected')===true;
  }
  function polishWordModal(){
    const modal=document.getElementById('modal-word');
    if(!modal)return;
    const title=modal.querySelector('.modal-title');
    if(title)title.textContent='Respaldo detallado de liquidación';
    const intro=modal.querySelector('.modal-body > p');
    if(intro)intro.textContent='Descargá una copia editable de respaldo con el mismo detalle económico que se envía por WhatsApp. La entrega principal se realiza desde la tarjeta del profesional.';
    const all=modal.querySelector('#word-opt-todos');
    if(all){
      const titleNode=all.querySelector('.word-option-text');
      const sub=all.querySelector('.word-option-sub');
      if(titleNode)titleNode.textContent='Liquidaciones en un solo archivo';
      if(sub)sub.textContent='Un médico por página, como respaldo administrativo.';
    }
    const individual=modal.querySelector('#word-opt-individual');
    if(individual){
      const titleNode=individual.querySelector('.word-option-text');
      const sub=individual.querySelector('.word-option-sub');
      if(titleNode)titleNode.textContent='Archivo individual por médico';
      if(sub)sub.textContent='Genera un ZIP con una liquidación separada para cada profesional.';
    }
    const periodLabel=[...modal.querySelectorAll('.form-label')].find(x=>/Período/.test(x.textContent||''));
    if(periodLabel)periodLabel.textContent='Período que figurará en el anexo';
    const button=modal.querySelector('button.btn-primary[onclick="generateWord()"]');
    if(button)button.textContent='Descargar respaldo Word';
  }

  window.generateWord=function(){
    const {periodo,doctorFilter,byDoc}=buildData();
    if(!Object.keys(byDoc).length){window.showToast?.('Sin datos para generar el anexo.');return;}
    window.closeModal?.('modal-word');
    const safe=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9_-]+/g,'_').replace(/_+/g,'_').replace(/^_|_$/g,'');
    if(doctorFilter){
      window.generateWordDoc(byDoc,periodo,`${safe(doctorFilter)}_${safe(periodo)||'liquidacion'}.docx`);
    }else if(isIndividualMode()){
      window.generateAllWordDocs(byDoc,periodo);
    }else{
      window.generateWordDoc(byDoc,periodo,`Liquidaciones_medicas_${safe(periodo)||'periodo'}.docx`);
    }
  };
  window.buildDocxXml=documentXml;
  window.generateWordDoc=async function(byDoc,periodo,filename){
    if(typeof window.JSZip==='undefined'){window.showToast?.('No se pudo iniciar el generador Word.');return;}
    window.showToast?.('Generando anexo imprimible...');
    const zip=window.buildDocxZip(documentXml(byDoc,periodo));
    const blob=await zip.generateAsync({type:'blob',mimeType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'});
    window.downloadBlob(blob,filename);
    window.showToast?.('Documento Word generado ✓');
  };
  window.generateAllWordDocs=async function(byDoc,periodo){
    if(typeof window.JSZip==='undefined'){window.showToast?.('No se pudo iniciar el generador Word.');return;}
    window.showToast?.('Generando anexos individuales...');
    const main=new window.JSZip();
    for(const doctor of Object.keys(byDoc)){
      const zip=window.buildDocxZip(documentXml({[doctor]:byDoc[doctor]},periodo));
      const blob=await zip.generateAsync({type:'blob',mimeType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'});
      const filename=String(doctor).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9_-]+/g,'_')+'.docx';
      main.file(filename,blob);
    }
    const bundle=await main.generateAsync({type:'blob'});
    window.downloadBlob(bundle,`Liquidaciones_medicas_${String(periodo||'periodo').replace(/\s+/g,'_')}.zip`);
    window.showToast?.('Anexos individuales generados ✓');
  };

  window.generatePdf=function(){
    if(!window.jspdf){window.showToast?.('No se pudo iniciar el generador PDF.');return;}
    const from=document.getElementById('periodo-desde')?.value||'';
    const to=document.getElementById('periodo-hasta')?.value||'';
    const inst=document.getElementById('filter-institucion')?.value||'';
    const activeBranch=document.querySelector('[data-commission-branch].active')?.dataset?.commissionBranch||'all';
    let rows=window.filterRecetas(from,to,inst);
    if(activeBranch!=='all')rows=rows.filter(r=>branchCode(r)===activeBranch);
    const byDoc={};
    rows.forEach(r=>(byDoc[r.medico]??=[]).push(r));
    if(!Object.keys(byDoc).length){window.showToast?.('Sin datos para generar el PDF.');return;}

    const {jsPDF}=window.jspdf;
    const pdf=new jsPDF({orientation:'landscape',unit:'mm',format:'a4'});
    const pw=297,ph=210,margin=12;
    const safe=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9_-]+/g,'_').replace(/_+/g,'_').replace(/^_|_$/g,'');

    Object.keys(byDoc).sort((a,b)=>a.localeCompare(b,'es')).forEach((doctor,index)=>{
      if(index)pdf.addPage('a4','landscape');
      const recipes=byDoc[doctor].slice().sort((a,b)=>(parseDate(a.fecha)||0)-(parseDate(b.fecha)||0));
      const totals=recipes.reduce((a,r)=>{const x=rowCalc(r,doctor);a.net+=x.net;a.vat+=x.vat;a.gross+=x.gross;a.commission+=x.commission;return a},{net:0,vat:0,gross:0,commission:0});
      let y=0;
      const pageHeader=()=>{
        pdf.setFillColor(18,18,18);pdf.rect(0,0,pw,25,'F');
        pdf.setTextColor(211,189,145);pdf.setFont('helvetica','bold');pdf.setFontSize(13);pdf.text('BLACK ÓPTICA',margin,10);
        pdf.setTextColor(255,255,255);pdf.setFont('helvetica','normal');pdf.setFontSize(8);pdf.text('Liquidación de comisiones médicas',margin,16);
        pdf.setTextColor(25,25,25);pdf.setFont('helvetica','bold');pdf.setFontSize(12);pdf.text(doctor,margin,34);
        pdf.setFont('helvetica','normal');pdf.setFontSize(7.8);pdf.setTextColor(100,100,95);
        pdf.text('Período: '+(from?displayDate(from):'—')+' al '+(to?displayDate(to):'—'),margin,40);
        y=49;
      };
      const tableHeader=()=>{
        pdf.setFillColor(35,35,35);pdf.rect(margin,y,pw-margin*2,8,'F');
        pdf.setFont('helvetica','bold');pdf.setFontSize(6.7);pdf.setTextColor(255,255,255);
        const xs=[margin+2,margin+22,margin+88,margin+126,margin+160,margin+195,margin+210,margin+245];
        ['Fecha','Paciente','Sucursal','Monto s/IVA','IVA','Monto c/IVA','%','Comisión'].forEach((h,i)=>pdf.text(h,xs[i],y+5.2));
        y+=10;return xs;
      };
      pageHeader();let xs=tableHeader();
      recipes.forEach(r=>{
        if(y>177){pdf.addPage('a4','landscape');pageHeader();xs=tableHeader();}
        const x=rowCalc(r,doctor);
        pdf.setFillColor(249,249,246);pdf.rect(margin,y-1,pw-margin*2,8,'F');
        pdf.setFont('helvetica','normal');pdf.setFontSize(6.6);pdf.setTextColor(45,45,43);
        const patient=String(r.paciente||'—').slice(0,37);
        [displayDate(r.fecha),patient,branchName(r),money(x.net),money(x.vat),money(x.gross),x.pct+'%',money(x.commission)].forEach((v,i)=>{
          pdf.setFont('helvetica',i===7?'bold':'normal');pdf.text(String(v),xs[i],y+4.2,{maxWidth:i===1?62:undefined});
        });
        y+=8.7;
      });
      y=Math.min(Math.max(y+7,145),181);
      pdf.setDrawColor(210,210,205);pdf.line(margin,y,pw-margin,y);y+=7;
      pdf.setFont('helvetica','normal');pdf.setFontSize(7.5);pdf.setTextColor(80,80,76);
      pdf.text('Base comisionable s/IVA',margin,y);pdf.setFont('helvetica','bold');pdf.setTextColor(25,25,25);pdf.text(money(totals.net),margin+55,y);
      pdf.setFont('helvetica','normal');pdf.setTextColor(80,80,76);pdf.text('IVA incluido',margin+105,y);pdf.setFont('helvetica','bold');pdf.setTextColor(25,25,25);pdf.text(money(totals.vat),margin+138,y);
      pdf.setFont('helvetica','normal');pdf.setTextColor(80,80,76);pdf.text('Total c/IVA',margin+184,y);pdf.setFont('helvetica','bold');pdf.setTextColor(25,25,25);pdf.text(money(totals.gross),margin+213,y);
      y+=8;pdf.setFillColor(25,25,25);pdf.rect(margin,y-5,95,10,'F');pdf.setTextColor(255,255,255);pdf.setFont('helvetica','bold');pdf.setFontSize(8.5);pdf.text('TOTAL COMISIÓN',margin+4,y+1.5);pdf.text(money(totals.commission),margin+62,y+1.5);
    });
    pdf.save('Liquidaciones_'+safe(from||'periodo')+'_'+safe(to||'actual')+'.pdf');
    window.showToast?.('PDF de respaldo generado ✓');
  };

  polishWordModal();
})();
