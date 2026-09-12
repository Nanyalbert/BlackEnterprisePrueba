// Black OS — CRM Black — acceso a Seguimiento de presupuestos
(() => {
  function addLink(){
    if(document.getElementById('crm-seguimiento-presupuestos-link')) return;
    const menu=document.querySelector('.bottom-nav details>div');
    if(!menu) return;
    const a=document.createElement('a');
    a.id='crm-seguimiento-presupuestos-link';
    a.href='seguimiento-presupuestos.html';
    a.style.cssText='display:flex;align-items:center;gap:8px;text-decoration:none;color:var(--text);padding:11px 12px;border:1px solid var(--border2);border-radius:8px;background:var(--surface2);font-size:12px;font-weight:600';
    a.innerHTML='<span style="font-size:15px">↗</span><span>Seguimiento de presupuestos</span>';
    const automation=menu.querySelector('a[href="automatizaciones-postventa.html"]');
    if(automation) automation.insertAdjacentElement('beforebegin',a);
    else menu.appendChild(a);
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',addLink,{once:true});
  else addLink();
})();