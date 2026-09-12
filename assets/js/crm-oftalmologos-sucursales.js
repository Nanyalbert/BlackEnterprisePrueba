// Black OS — CRM Oftalmólogos — Comisiones por sucursal
// Capa incremental: conserva la lógica existente y agrega General Paz / Alto Palermo.
(() => {
  const BRANCHES = {
    'general-paz': { code: 'general-paz', label: 'General Paz', short: 'GP' },
    'alto-palermo': { code: 'alto-palermo', label: 'Alto Palermo', short: 'AP' }
  };

  const IMPORT_HISTORY_KEY = 'blackoptica_commission_imports_v1';
  let activeCommissionBranch = 'all';
  let selectedImportBranch = null;
  let selectedExtraBranch = null;
  let currentImportFileName = '';

  const originalOpenCsvModal = typeof openCsvModal === 'function' ? openCsvModal : null;
  const originalProcessExcelFile = typeof processExcelFile === 'function' ? processExcelFile : null;
  const originalOpenExtraModal = typeof openExtraModal === 'function' ? openExtraModal : null;
  const originalSaveExtra = typeof saveExtra === 'function' ? saveExtra : null;

  function branchLabel(code) {
    return BRANCHES[code]?.label || 'General Paz';
  }

  function branchCodeForRecipe(r) {
    return r?.branch || r?.branch_code || r?.sucursal || selectedImportBranch || 'general-paz';
  }

  function commissionKey(medico, branch) {
    return `${normName(medico)}|${branch}`;
  }

  function legacyCommissionKey(medico) {
    return normName(medico);
  }

  function getBranchCommission(medico, branch) {
    const key = commissionKey(medico, branch);
    if (comisiones[key] !== undefined) return Number(comisiones[key]) || 0;

    // Compatibilidad: los porcentajes históricos pertenecen a General Paz.
    if (branch === 'general-paz') {
      const legacy = legacyCommissionKey(medico);
      if (comisiones[legacy] !== undefined) return Number(comisiones[legacy]) || 0;
    }

    return 20;
  }

  function setBranchCommission(medico, branch, pct) {
    comisiones[commissionKey(medico, branch)] = pct;
    saveState();
  }

  function branchPaymentKey(medico, desde, hasta, branch) {
    return `${normName(medico)}|${branch}|${desde}|${hasta}`;
  }

  function legacyPaymentKey(medico, desde, hasta) {
    return `${normName(medico)}|${desde}|${hasta}`;
  }

  function isBranchPaid(medico, desde, hasta, branch) {
    if (pagos[branchPaymentKey(medico, desde, hasta, branch)]) return true;
    // Compatibilidad con pagos históricos, considerados General Paz.
    return branch === 'general-paz' && !!pagos[legacyPaymentKey(medico, desde, hasta)];
  }

  function groupDoctorByBranch(d) {
    const grouped = {};
    (d.recetas || []).forEach(r => {
      const branch = branchCodeForRecipe(r);
      if (!grouped[branch]) grouped[branch] = { branch, monto: 0, count: 0, recetas: [] };
      grouped[branch].monto += Number(r.monto) || 0;
      grouped[branch].count += 1;
      grouped[branch].recetas.push(r);
    });
    return grouped;
  }

  // La firma ahora incluye sucursal para evitar falsos duplicados entre locales.
  firmaReceta = function firmaRecetaConSucursal(r) {
    return `${branchCodeForRecipe(r)}|${r.fecha}|${normName(r.paciente)}|${normName(r.medico)}|${r.monto}`;
  };

  // Compatibilidad con llamadas antiguas. Si no se indica sucursal usa la vista activa.
  getComision = function getComisionPorSucursal(nombre, branch) {
    const resolved = branch || (activeCommissionBranch !== 'all' ? activeCommissionBranch : 'general-paz');
    return getBranchCommission(nombre, resolved);
  };

  setComision = function setComisionPorSucursal(nombre, pct, branch) {
    const resolved = branch || (activeCommissionBranch !== 'all' ? activeCommissionBranch : 'general-paz');
    setBranchCommission(nombre, resolved, pct);
  };

  comisionDe = function comisionDePorSucursal(d) {
    const grouped = groupDoctorByBranch(d);
    return Object.values(grouped).reduce((total, item) => {
      return total + item.monto * getBranchCommission(d.medico, item.branch) / 100;
    }, 0);
  };

  filterRecetas = function filterRecetasPorSucursal(desde, hasta, inst) {
    return recetas.filter(r => {
      if (activeCommissionBranch !== 'all' && branchCodeForRecipe(r) !== activeCommissionBranch) return false;
      if (inst && r.institucion && r.institucion !== inst) return false;
      if (desde || hasta) {
        const d = parseDate(r.fecha);
        if (!d) return true;
        if (desde && d < new Date(desde + 'T00:00:00')) return false;
        if (hasta && d > new Date(hasta + 'T23:59:59')) return false;
      }
      return true;
    });
  };

  renderDashboard = function renderDashboardPorSucursal(data, desde, hasta, inst) {
    const totalFact = data.reduce((a, r) => a + (Number(r.monto) || 0), 0);
    const byDoc = {};

    data.forEach(r => {
      if (!byDoc[r.medico]) byDoc[r.medico] = { medico: r.medico, monto: 0, extras: 0, count: 0, pacientes: [], recetas: [] };
      byDoc[r.medico].monto += Number(r.monto) || 0;
      byDoc[r.medico].count++;
      if (r.extra) byDoc[r.medico].extras += Number(r.monto) || 0;
      byDoc[r.medico].pacientes.push(r.paciente);
      byDoc[r.medico].recetas.push(r);
    });

    const docList = Object.values(byDoc).sort((a, b) => b.monto - a.monto);
    lastDocList = docList;
    const totalCom = docList.reduce((a, d) => a + comisionDe(d), 0);

    document.getElementById('kpi-facturacion').textContent = `$${formatNum(totalFact)}`;
    document.getElementById('kpi-comisiones').textContent = `$${formatNum(totalCom)}`;
    document.getElementById('kpi-pacientes').textContent = data.filter(r => !r.extra).length;
    document.getElementById('kpi-medicos').textContent = docList.length;

    renderTrend(totalFact, desde, hasta, inst);

    let pendiente = 0;
    docList.forEach(d => {
      const grouped = groupDoctorByBranch(d);
      Object.values(grouped).forEach(item => {
        if (!isBranchPaid(d.medico, desde, hasta, item.branch)) {
          pendiente += item.monto * getBranchCommission(d.medico, item.branch) / 100;
        }
      });
    });

    const kpiPend = document.getElementById('kpi-pendiente');
    if (docList.length && pendiente > 0) {
      kpiPend.textContent = `$${formatNum(pendiente)} sin pagar`;
      kpiPend.className = 'stat-card-trend down';
    } else if (docList.length) {
      kpiPend.textContent = 'Todo pagado ✓';
      kpiPend.className = 'stat-card-trend up';
    } else {
      kpiPend.textContent = '';
    }

    renderBarChart(docList);
    renderCommissionCards(docList, desde, hasta);
    renderEvolution(data);
    renderBranchContext();
  };

  function branchSummaryHTML(d, item, desde, hasta) {
    const pct = getBranchCommission(d.medico, item.branch);
    const com = item.monto * pct / 100;
    const paid = isBranchPaid(d.medico, desde, hasta, item.branch);
    const nonExtra = item.recetas.filter(r => !r.extra).length;

    return `
      <div class="branch-summary ${paid ? 'is-paid' : ''}">
        <div class="branch-summary-main">
          <div class="branch-summary-title">
            <span class="branch-chip branch-${item.branch}">${branchLabel(item.branch)}</span>
            <span class="branch-summary-meta">${nonExtra} receta${nonExtra !== 1 ? 's' : ''}</span>
          </div>
          <div class="branch-summary-amount">$${formatNum(item.monto)}</div>
        </div>
        <div class="branch-summary-commission">
          <div class="branch-pct-wrap">
            <span>Comisión</span>
            <input class="commission-pct-input" type="number" min="0" max="100" value="${pct}"
              onchange="updateBranchComision('${escAttr(d.medico)}','${item.branch}',this.value,this)" />
            <span>%</span>
          </div>
          <strong>$${formatNum(com, true)}</strong>
        </div>
        <div class="branch-summary-actions">
          <button class="branch-extra-btn" onclick="openBranchExtraModal('${escAttr(d.medico)}','${item.branch}')">+ Monto</button>
          <button class="branch-paid-btn ${paid ? 'is-paid' : ''}" onclick="toggleBranchPago('${escAttr(d.medico)}','${item.branch}')">
            ${paid ? '✓ Pagado' : 'Pendiente'}
          </button>
        </div>
      </div>`;
  }

  renderCommissionCards = function renderCommissionCardsPorSucursal(docList, desde, hasta) {
    const list = document.getElementById('commission-list');
    if (!docList.length) {
      list.innerHTML = '<div class="empty-state"><div class="empty-title">Sin datos de recetas</div><div class="empty-sub">Importá un Excel para ver las comisiones.</div></div>';
      return;
    }

    list.innerHTML = docList.map((d, idx) => {
      const grouped = groupDoctorByBranch(d);
      const branchItems = Object.values(grouped).sort((a, b) => {
        const order = { 'general-paz': 0, 'alto-palermo': 1 };
        return (order[a.branch] ?? 9) - (order[b.branch] ?? 9);
      });
      const totalCommission = branchItems.reduce((a, item) => a + item.monto * getBranchCommission(d.medico, item.branch) / 100, 0);
      const paidCount = branchItems.filter(item => isBranchPaid(d.medico, desde, hasta, item.branch)).length;
      const paymentLabel = paidCount === branchItems.length ? 'Pagado' : paidCount > 0 ? 'Pago parcial' : 'Pendiente';
      const paymentClass = paidCount === branchItems.length ? 'paid' : paidCount > 0 ? 'partial' : 'pending';

      const recetasHtml = (d.recetas || [])
        .slice()
        .sort((a, b) => (parseDate(a.fecha) || 0) - (parseDate(b.fecha) || 0))
        .map(r => {
          const branch = branchCodeForRecipe(r);
          const deleteBtn = r.extra ? `<button class="extra-del" onclick="delExtra('${r.xid}')" title="Eliminar">✕</button>` : '';
          const extraTag = r.extra ? '<span class="extra-tag">＋</span>' : '';
          return `<div class="detalle-row branch-detail-row ${r.extra ? 'extra' : ''}">
            <span class="detalle-fecha">${fmtFecha(r.fecha)}</span>
            ${extraTag}
            <span class="detalle-pac">${escHtml(r.paciente)}</span>
            <span class="branch-chip branch-${branch}">${branchLabel(branch)}</span>
            <span class="detalle-monto">$${formatNum(r.monto)}</span>
            ${deleteBtn}
          </div>`;
        }).join('');

      const nonExtra = d.recetas.filter(r => !r.extra).length;

      return `<div class="commission-card branch-aware-card" style="animation-delay:${idx * 40}ms" id="ccard-${idx}">
        <div class="commission-card-top">
          <div class="commission-avatar">${initials(d.medico)}</div>
          <div class="commission-card-identity">
            <div class="commission-name">${escHtml(d.medico)}</div>
            <div class="commission-card-sub">${nonExtra} receta${nonExtra !== 1 ? 's' : ''} · Facturación $${formatNum(d.monto)}</div>
          </div>
          <div class="commission-total-box">
            <span>Comisión total</span>
            <strong>$${formatNum(totalCommission, true)}</strong>
            <em class="payment-state ${paymentClass}">${paymentLabel}</em>
          </div>
        </div>

        <div class="branch-summaries">
          ${branchItems.map(item => branchSummaryHTML(d, item, desde, hasta)).join('')}
        </div>

        <div class="commission-footer branch-card-footer">
          <button class="btn-detalle" onclick="toggleDetalle(${idx})">Detalle de pacientes</button>
        </div>
        <div class="detalle-recetas" id="detalle-${idx}">${recetasHtml}</div>
      </div>`;
    }).join('');
  };

  window.updateBranchComision = function updateBranchComision(medico, branch, val, input) {
    const pct = Math.max(0, Math.min(100, parseFloat(val) || 0));
    input.value = pct;
    setBranchCommission(medico, branch, pct);
    applyFilters();
    showToast(`${branchLabel(branch)} · Comisión actualizada a ${pct}%`);
  };

  window.toggleBranchPago = function toggleBranchPago(medico, branch) {
    const desde = document.getElementById('periodo-desde').value;
    const hasta = document.getElementById('periodo-hasta').value;
    const key = branchPaymentKey(medico, desde, hasta, branch);
    const nuevoEstado = !isBranchPaid(medico, desde, hasta, branch);

    if (nuevoEstado) pagos[key] = true;
    else {
      delete pagos[key];
      if (branch === 'general-paz') delete pagos[legacyPaymentKey(medico, desde, hasta)];
    }

    saveState();
    applyFilters();
    showToast(`${branchLabel(branch)} · ${nuevoEstado ? 'Pago registrado' : 'Marcado pendiente'}`);
  };

  function setBranchButtonState() {
    document.querySelectorAll('[data-commission-branch]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.commissionBranch === activeCommissionBranch);
    });
  }

  window.setCommissionBranch = function setCommissionBranch(branch) {
    if (branch !== 'all' && !BRANCHES[branch]) return;
    activeCommissionBranch = branch;
    setBranchButtonState();
    applyFilters();
  };

  function renderBranchContext() {
    const el = document.getElementById('commission-branch-context');
    if (!el) return;
    el.textContent = activeCommissionBranch === 'all'
      ? 'Vista consolidada · General Paz + Alto Palermo'
      : `Vista de ${branchLabel(activeCommissionBranch)}`;
  }

  function ensureBranchSwitcher() {
    if (document.getElementById('commission-branch-switcher')) return;
    const header = document.querySelector('#page-comisiones .comisiones-header');
    if (!header) return;

    const sub = header.querySelector('.comisiones-header-sub');
    const wrap = document.createElement('div');
    wrap.id = 'commission-branch-switcher';
    wrap.className = 'commission-branch-switcher';
    wrap.innerHTML = `
      <div class="branch-switch-label">Sucursal</div>
      <div class="branch-switch-buttons">
        <button class="branch-switch-btn active" data-commission-branch="all" onclick="setCommissionBranch('all')">Todas</button>
        <button class="branch-switch-btn" data-commission-branch="general-paz" onclick="setCommissionBranch('general-paz')">General Paz</button>
        <button class="branch-switch-btn" data-commission-branch="alto-palermo" onclick="setCommissionBranch('alto-palermo')">Alto Palermo</button>
      </div>
      <div class="branch-context" id="commission-branch-context">Vista consolidada · General Paz + Alto Palermo</div>`;

    if (sub) sub.insertAdjacentElement('afterend', wrap);
    else header.prepend(wrap);
  }

  function ensureImportBranchSelector() {
    const modalBody = document.querySelector('#modal-csv .modal-body');
    const drop = document.getElementById('csv-dropzone');
    if (!modalBody || !drop) return;

    let block = document.getElementById('csv-branch-selector');
    if (!block) {
      block = document.createElement('div');
      block.id = 'csv-branch-selector';
      block.className = 'csv-branch-selector';
      block.innerHTML = `
        <div class="csv-branch-title">1. Elegí la sucursal del archivo</div>
        <div class="csv-branch-buttons">
          <button type="button" data-import-branch="general-paz" onclick="selectImportBranch('general-paz')">
            <strong>General Paz</strong><span>Excel de General Paz</span>
          </button>
          <button type="button" data-import-branch="alto-palermo" onclick="selectImportBranch('alto-palermo')">
            <strong>Alto Palermo</strong><span>Excel de Alto Palermo</span>
          </button>
        </div>
        <div class="csv-branch-help" id="csv-branch-help">Seleccioná la sucursal antes de elegir el archivo.</div>`;
      drop.insertAdjacentElement('beforebegin', block);
    }
    updateImportBranchUI();
  }

  function updateImportBranchUI() {
    document.querySelectorAll('[data-import-branch]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.importBranch === selectedImportBranch);
    });
    const help = document.getElementById('csv-branch-help');
    if (help) help.textContent = selectedImportBranch
      ? `El archivo se registrará como ${branchLabel(selectedImportBranch)}.`
      : 'Seleccioná la sucursal antes de elegir el archivo.';
  }

  window.selectImportBranch = function selectImportBranch(branch) {
    if (!BRANCHES[branch]) return;
    selectedImportBranch = branch;
    updateImportBranchUI();
  };

  if (originalOpenCsvModal) {
    openCsvModal = function openCsvModalPorSucursal() {
      selectedImportBranch = activeCommissionBranch === 'all' ? null : activeCommissionBranch;
      currentImportFileName = '';
      originalOpenCsvModal();
      ensureImportBranchSelector();
    };
  }

  if (originalProcessExcelFile) {
    processExcelFile = function processExcelFilePorSucursal(file) {
      if (!selectedImportBranch) {
        showToast('Elegí General Paz o Alto Palermo antes de cargar el Excel');
        return;
      }
      currentImportFileName = file?.name || '';
      return originalProcessExcelFile(file);
    };
  }

  function readImportHistory() {
    try { return JSON.parse(localStorage.getItem(IMPORT_HISTORY_KEY)) || []; }
    catch (_) { return []; }
  }

  function writeImportHistory(items) {
    try { localStorage.setItem(IMPORT_HISTORY_KEY, JSON.stringify(items.slice(0, 20))); }
    catch (_) {}
  }

  function recordImport(branch, rows, fileName) {
    const history = readImportHistory();
    const total = rows.reduce((a, r) => a + (Number(r.monto) || 0), 0);
    const dates = rows.map(r => parseDate(r.fecha)).filter(Boolean).sort((a, b) => a - b);
    history.unshift({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      branch,
      fileName: fileName || 'Excel importado',
      records: rows.length,
      total,
      from: dates[0] ? dates[0].toISOString().slice(0, 10) : '',
      to: dates.length ? dates[dates.length - 1].toISOString().slice(0, 10) : '',
      importedAt: new Date().toISOString()
    });
    writeImportHistory(history);
    renderImportHistory();
  }

  function renderImportHistory() {
    const host = document.getElementById('commission-import-history');
    if (!host) return;
    const history = readImportHistory();
    if (!history.length) {
      host.innerHTML = '<div class="import-history-empty">Todavía no hay importaciones registradas.</div>';
      return;
    }

    host.innerHTML = history.slice(0, 6).map(item => {
      const date = new Date(item.importedAt);
      const when = Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('es-AR');
      const period = item.from && item.to ? `${item.from.split('-').reverse().join('/')} – ${item.to.split('-').reverse().join('/')}` : 'Período no detectado';
      return `<div class="import-history-row">
        <span class="branch-chip branch-${item.branch}">${branchLabel(item.branch)}</span>
        <div class="import-history-main"><strong>${escHtml(item.fileName)}</strong><span>${period} · ${item.records} registros</span></div>
        <div class="import-history-total">$${formatNum(item.total)}<span>${when}</span></div>
      </div>`;
    }).join('');
  }

  function ensureImportHistory() {
    if (document.getElementById('commission-import-history-wrap')) return;
    const toolbar = document.querySelector('#page-comisiones .comisiones-toolbar');
    if (!toolbar) return;
    const wrap = document.createElement('section');
    wrap.id = 'commission-import-history-wrap';
    wrap.className = 'commission-import-history-wrap';
    wrap.innerHTML = `
      <div class="import-history-head"><div><strong>Últimas cargas</strong><span>Control rápido de Excel procesados</span></div></div>
      <div id="commission-import-history"></div>`;
    toolbar.insertAdjacentElement('afterend', wrap);
    renderImportHistory();
  }

  confirmCsvImport = function confirmCsvImportPorSucursal() {
    if (!parsedCsvData.length) return;
    if (!selectedImportBranch) {
      showToast('Elegí la sucursal antes de importar');
      return;
    }

    const incoming = parsedCsvData.map(r => ({ ...r, branch: selectedImportBranch }));

    // Auto-crear médicos nuevos en la base local actual.
    const existing = new Set(doctors.map(d => normName(d.nombre)));
    incoming.forEach(r => {
      if (!r.medico) return;
      const match = doctors.find(d => normName(d.nombre) === normName(r.medico) || normName(d.nombre).startsWith(normName(r.medico.split(',')[0]) + ','));
      if (!match && !existing.has(normName(r.medico))) {
        existing.add(normName(r.medico));
        doctors.push({
          id: r.medico.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').slice(0, 30) + '-' + Date.now().toString(36),
          nombre: r.medico,
          servicio: 'OFTALMOLOGIA-JR',
          instituciones: [{ nombre: 'Black Optica', turnos: [] }]
        });
      }
    });

    let omitidas = 0;
    if (csvImportMode === 'replace') {
      // Reemplaza solamente la sucursal seleccionada, nunca la otra.
      recetas = recetas.filter(r => branchCodeForRecipe(r) !== selectedImportBranch);
      recetas = [...recetas, ...incoming];
    } else {
      const existentes = new Set(recetas.map(firmaReceta));
      const nuevas = incoming.filter(r => {
        if (existentes.has(firmaReceta(r))) { omitidas++; return false; }
        existentes.add(firmaReceta(r));
        return true;
      });
      recetas = [...recetas, ...nuevas];
    }

    const importadas = incoming.length - omitidas;
    const importedRows = incoming.slice(0, importadas || incoming.length);
    recordImport(selectedImportBranch, importedRows, currentImportFileName);

    saveState();
    closeModal('modal-csv');
    activeCommissionBranch = selectedImportBranch;
    setBranchButtonState();
    applyFilters();
    showToast(`${branchLabel(selectedImportBranch)} · ${importadas} recetas importadas${omitidas > 0 ? ` · ${omitidas} duplicadas omitidas` : ''}`);
    parsedCsvData = [];
  };

  window.openBranchExtraModal = function openBranchExtraModal(medico, branch) {
    selectedExtraBranch = branch;
    if (originalOpenExtraModal) originalOpenExtraModal(medico);
  };

  if (originalOpenExtraModal) {
    openExtraModal = function openExtraModalPorSucursal(medicoPre) {
      if (activeCommissionBranch === 'all') {
        showToast('Elegí General Paz o Alto Palermo para sumar un monto');
        return;
      }
      selectedExtraBranch = activeCommissionBranch;
      originalOpenExtraModal(medicoPre);
    };
  }

  if (originalSaveExtra) {
    saveExtra = function saveExtraPorSucursal() {
      const branch = selectedExtraBranch || (activeCommissionBranch !== 'all' ? activeCommissionBranch : null);
      if (!branch) {
        showToast('Elegí la sucursal del monto');
        return;
      }
      const before = recetas.length;
      originalSaveExtra();
      if (recetas.length > before) {
        recetas[recetas.length - 1].branch = branch;
        saveState();
        applyFilters();
      }
    };
  }

  function migrateLegacyRecipes() {
    let changed = false;
    recetas.forEach(r => {
      if (!r.branch && !r.branch_code && !r.sucursal) {
        // Todo lo previo a Alto Palermo pertenece al flujo histórico de General Paz.
        r.branch = 'general-paz';
        changed = true;
      }
    });
    if (changed) saveState();
  }

  function bootBranchCommissions() {
    ensureBranchSwitcher();
    ensureImportHistory();
    migrateLegacyRecipes();
    setBranchButtonState();
    if (document.getElementById('page-comisiones')?.classList.contains('active')) applyFilters();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bootBranchCommissions);
  else setTimeout(bootBranchCommissions, 0);
})();
