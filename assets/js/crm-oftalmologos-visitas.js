// Seguimiento de visitas. Supabase es la fuente; no se infieren fechas de períodos.
(() => {
  const client = window.BlackPortal?.getSupabase?.();
  const zone = 'America/Argentina/Cordoba';
  let lastVisits = new Map();
  let loaded = false;
  let failed = false;
  let requestVersion = 0;
  const saving = new Set();

  function dayKey(value = new Date()) {
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return null;
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(date).reduce((acc, p) => { acc[p.type] = p.value; return acc; }, {});
    return parts.year + '-' + parts.month + '-' + parts.day;
  }
  function status(row, now = new Date()) {
    const today = dayKey(now);
    const date = row?.visited_at ? dayKey(row.visited_at) : null;
    if (!date || date > today) return { days: null, tone: 'never', label: 'Nunca visitado', date: '' };
    const days = Math.round((Date.parse(today) - Date.parse(date)) / 86400000);
    return {
      days, date,
      tone: days <= 7 ? 'recent' : days <= 14 ? 'due' : days <= 30 ? 'late' : 'overdue',
      label: days === 0 ? 'Visitado hoy' : days === 1 ? '1 día sin visitar' : days + ' días sin visitar'
    };
  }
  function canRecord() {
    const portal = window.BlackPortal;
    const user = window.__blackPortalSession?.user;
    const access = portal?.accessSnapshot;
    if (!user || access?.active === false || user.app_metadata?.black_os_active === false) return false;
    if (portal?.isSuperAdmin?.(user)) return true;
    const cfg = access ? access.permissions?.['crm-oftalmologos'] : user.app_metadata?.black_os_permissions?.['crm-oftalmologos'];
    return !!cfg && cfg.level !== 'none' && (cfg.level === 'full' || cfg.items === '*' ||
      Array.isArray(cfg.items) && cfg.items.some(p => p === 'manage' || p === 'referrals'));
  }
  function card(doc) {
    const id = doc._supabaseId;
    const row = lastVisits.get(id);
    const info = status(row);
    const busy = saving.has(id);
    const ready = loaded && !!id;
    const label = failed ? 'No se pudo consultar la última visita' : !loaded ? 'Consultando visitas…' : !id ? 'Profesional pendiente de sincronizar' : info.label;
    const detail = ready && info.date
      ? 'Última visita: ' + info.date.split('-').reverse().join('/') + (row.source === 'payment' ? ' · Pago de comisión' : '')
      : '';
    // El servidor valida los permisos; el botón también se oculta para perfiles de solo lectura.
    const allowed = canRecord();
    const button = allowed ? '<button type="button" class="schedule-visit-btn' +
      (ready && info.days === 0 ? ' is-visited' : '') + '" data-visit-doctor="' + escAttr(id || '') +
      '" ' + (!ready || busy || info.days === 0 ? 'disabled' : '') +
      ' aria-label="' + escAttr('Registrar visita de hoy a ' + doc.nombre) + '">' +
      (busy ? 'Guardando…' : ready && info.days === 0 ? '✓ Visitado hoy' : 'Marcar visitado hoy') + '</button>' : '';
    return '<div class="schedule-visit"><div class="schedule-visit-info" aria-live="polite">' +
      '<span class="schedule-visit-status visit-' + (ready && !failed ? info.tone : 'never') +
      '">' + label + '</span>' + (detail ? '<span class="schedule-visit-date">' + detail + '</span>' : '') +
      '</div>' + button + '</div>';
  }
  function render() { if (typeof renderSchedule === 'function') renderSchedule(); }
  async function refresh() {
    if (!client) return;
    const version = ++requestVersion;
    try {
      const { data, error } = await client.rpc('crm_doctor_last_visits');
      if (error) throw error;
      if (version !== requestVersion) return;
      lastVisits = new Map((data || []).map(row => [row.doctor_id, row]));
      loaded = true; failed = false;
    } catch (error) {
      if (version !== requestVersion) return;
      loaded = false; failed = true;
      console.error('No se pudieron consultar las visitas:', error);
    }
    render();
  }
  async function record(id) {
    if (!client || !canRecord() || !loaded || !id || saving.has(id)) return;
    if (status(lastVisits.get(id)).days === 0) return;
    saving.add(id); render();
    try {
      const { data, error } = await client.rpc('crm_record_doctor_visit', { p_doctor_id: id });
      if (error) throw error;
      if (!data?.length) throw new Error('La visita no fue confirmada por el servidor.');
      // Invalida cualquier lectura anterior todavía en vuelo.
      ++requestVersion;
      lastVisits.set(id, { ...data[0], source: 'visit' });
      showToast('✓ Visita de hoy registrada');
    } catch (error) {
      console.error('No se pudo registrar la visita:', error);
      showToast('No se pudo guardar la visita. Intentá nuevamente.');
    } finally {
      saving.delete(id); render();
    }
  }
  document.addEventListener('click', event => {
    const button = event.target.closest?.('[data-visit-doctor]');
    if (button && !button.disabled) record(button.dataset.visitDoctor);
  });
  let lastDay = dayKey();
  setInterval(() => {
    if (document.visibilityState !== 'visible') return;
    const today = dayKey();
    if (today !== lastDay) { lastDay = today; refresh(); }
  }, 60000);
  window.BlackDoctorVisits = { card, refresh, record, status, dayKey };
})();
