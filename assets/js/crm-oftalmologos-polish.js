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

  function enhanceDeliveryChecks(root = document) {
    root.querySelectorAll?.('.branch-paid-btn').forEach(btn => {
      const isPaid = btn.classList.contains('is-paid');
      const state = isPaid ? 'paid' : 'pending';

      // No volver a escribir el DOM si el botón ya fue pulido para este estado.
      if (btn.dataset.deliveryUiState === state) return;
      btn.dataset.deliveryUiState = state;

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
    const desiredSubtitle = 'Facturación, liquidaciones y estado de entrega por oftalmólogo';
    if (subtitle && subtitle.textContent !== desiredSubtitle) subtitle.textContent = desiredSubtitle;

    const importBtn = document.querySelector('#page-comisiones .import-csv-btn');
    if (importBtn && !importBtn.dataset.blackPolished) {
      importBtn.dataset.blackPolished = '1';
      const svg = importBtn.querySelector('svg');
      importBtn.innerHTML = '';
      if (svg) importBtn.appendChild(svg);
      importBtn.append(document.createTextNode(' Importar facturación'));
    }
  }

  function applyCardSemantics(root = document) {
    root.querySelectorAll?.('.commission-card').forEach(card => {
      if (card.dataset.blackSemantics === '1') return;
      card.dataset.blackSemantics = '1';
      card.setAttribute('role', 'group');
      const name = card.querySelector('.commission-name')?.textContent?.trim();
      if (name) card.setAttribute('aria-label', `Comisiones de ${name}`);
    });
  }

  function polish(root = document) {
    enhanceDeliveryChecks(root);
    applyCardSemantics(root);
    refineLabels();
  }

  let scheduled = false;
  function schedulePolish(root) {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      polish(root || document);
    });
  }

  const observer = new MutationObserver(mutations => {
    // Solo procesar nodos nuevos generados por un render real del dashboard.
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (!(node instanceof Element)) continue;
        if (node.matches?.('.commission-card, .branch-paid-btn') || node.querySelector?.('.commission-card, .branch-paid-btn')) {
          schedulePolish(document);
          return;
        }
      }
    }
  });

  function boot() {
    const host = document.getElementById('commission-list');
    if (host) observer.observe(host, { childList: true, subtree: true });

    // El módulo principal ya hace su primer render. No forzamos applyFilters()
    // desde la capa visual para evitar renders dobles y loops al usar fechas.
    polish();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else setTimeout(boot, 0);
})();
