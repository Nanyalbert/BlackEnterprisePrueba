// Black OS — CRM Oftalmólogos — Pulido visual Black Óptica
(() => {
  const originalFormatNum = typeof formatNum === 'function' ? formatNum : null;

  // Formato administrativo consistente, evitando abreviaciones ambiguas tipo 1.2M.
  if (originalFormatNum) {
    formatNum = function formatNumBlackOptica(n, decimals = false) {
      const value = Number(n) || 0;
      return value.toLocaleString('es-AR', {
        minimumFractionDigits: decimals ? 2 : 0,
        maximumFractionDigits: decimals ? 2 : 0
      });
    };
  }

  function enhanceDeliveryChecks() {
    document.querySelectorAll('.branch-paid-btn').forEach(btn => {
      const isPaid = btn.classList.contains('is-paid');
      btn.classList.add('delivery-check-btn');
      btn.setAttribute('aria-pressed', isPaid ? 'true' : 'false');
      btn.setAttribute('title', isPaid ? 'Comisión entregada. Tocá para desmarcar.' : 'Marcar comisión como entregada');
      btn.innerHTML = `
        <span class="delivery-check-box" aria-hidden="true">
          ${isPaid ? '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>' : ''}
        </span>
        <span class="delivery-check-copy">
          <strong>${isPaid ? 'Entregada' : 'No entregada'}</strong>
          <small>Comisión</small>
        </span>`;
    });
  }

  function refineLabels() {
    const subtitle = document.querySelector('#page-comisiones .comisiones-header-sub');
    if (subtitle) subtitle.textContent = 'Facturación, liquidaciones y estado de entrega por oftalmólogo';

    const importBtn = document.querySelector('#page-comisiones .import-csv-btn');
    if (importBtn && !importBtn.dataset.blackPolished) {
      importBtn.dataset.blackPolished = '1';
      const svg = importBtn.querySelector('svg');
      importBtn.innerHTML = '';
      if (svg) importBtn.appendChild(svg);
      importBtn.append(document.createTextNode(' Importar facturación'));
    }
  }

  function applyCardSemantics() {
    document.querySelectorAll('.commission-card').forEach(card => {
      card.setAttribute('role', 'group');
      const name = card.querySelector('.commission-name')?.textContent?.trim();
      if (name) card.setAttribute('aria-label', `Comisiones de ${name}`);
    });
  }

  function polish() {
    enhanceDeliveryChecks();
    refineLabels();
    applyCardSemantics();
  }

  const observer = new MutationObserver(polish);

  function boot() {
    const host = document.getElementById('commission-list');
    if (host) observer.observe(host, { childList: true, subtree: true });
    polish();
    if (typeof applyFilters === 'function') applyFilters();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else setTimeout(boot, 0);
})();
