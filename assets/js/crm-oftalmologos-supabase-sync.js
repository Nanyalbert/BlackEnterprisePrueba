// Black OS — CRM Oftalmólogos — Sincronización de comisiones con Supabase
// Supabase es la fuente principal cuando hay datos; localStorage queda como respaldo temporal.
(() => {
  const client = window.BlackPortal?.getSupabase?.();
  if (!client) return;

  const IMPORT_HISTORY_KEY = 'blackoptica_commission_imports_v1';
  let branchIdByCode = {};
  let branchCodeById = {};
  let doctorIdByNormName = {};
  let doctorNameById = {};
  let syncing = false;

  const originalConfirmCsvImport = window.confirmCsvImport;
  const originalUpdateBranchComision = window.updateBranchComision;
  const originalToggleBranchPago = window.toggleBranchPago;
  const originalSaveExtra = window.saveExtra;
  const originalDelExtra = window.delExtra;
  const originalSaveDoctor = window.saveDoctor;

  function currentBranchFromUI() {
    const active = document.querySelector('[data-commission-branch].active');
    const code = active?.dataset?.commissionBranch;
    return code && code !== 'all' ? code : null;
  }

  function branchCodeForRecipe(r) {
    return r?.branch || r?.branch_code || r?.sucursal || 'general-paz';
  }

  function toIsoDate(fecha) {
    const d = parseDate(fecha);
    if (!d || Number.isNaN(d.getTime())) return null;
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function stableFingerprint(r) {
    return `${branchCodeForRecipe(r)}|${toIsoDate(r.fecha) || r.fecha}|${normName(r.paciente)}|${normName(r.medico)}|${Number(r.monto) || 0}`;
  }

  async function getSessionUserId() {
    const { data: { session } } = await client.auth.getSession();
    return session?.user?.id || null;
  }

  async function loadCatalogs() {
    const [{ data: branches, error: branchError }, { data: dbDoctors, error: doctorError }] = await Promise.all([
      client.from('branches').select('id,code,name').in('code', ['general-paz', 'cerro-de-las-rosas']),
      client.from('doctors').select('id,full_name,phone,birthday,service,notes,active')
    ]);

    if (branchError) throw branchError;
    if (doctorError) throw doctorError;

    branchIdByCode = {};
    branchCodeById = {};
    (branches || []).forEach(b => {
      branchIdByCode[b.code] = b.id;
      branchCodeById[b.id] = b.code;
    });

    doctorIdByNormName = {};
    doctorNameById = {};

    const initialByName = new Map(
      (typeof INITIAL_DOCTORS !== 'undefined' ? INITIAL_DOCTORS : [])
        .map(d => [normName(d.nombre), d])
    );
    const localByName = new Map(
      (Array.isArray(doctors) ? doctors : [])
        .filter(d => d?.nombre)
        .map(d => [normName(d.nombre), d])
    );
    const cloudNames = new Set();
    const mergedDoctors = [];
    const contactBackfill = [];

    (dbDoctors || []).filter(d => d.active !== false).forEach(d => {
      const key = normName(d.full_name);
      cloudNames.add(key);
      doctorIdByNormName[key] = d.id;
      doctorNameById[d.id] = d.full_name;

      let local = localByName.get(key);
      if (!local) {
        const initial = initialByName.get(key);
        local = initial
          ? JSON.parse(JSON.stringify(initial))
          : {
              id: 'cloud-' + d.id,
              nombre: d.full_name,
              servicio: d.service || 'OFTALMOLOGIA-JR',
              telefono: '',
              cumple: '',
              notas: '',
              instituciones: []
            };
      }

      local.nombre = d.full_name || local.nombre;
      local._supabaseId = d.id;

      const localPhone = String(local.telefono || '').trim();
      const localBirthday = local.cumple || null;
      local.telefono = d.phone || localPhone || '';
      local.cumple = d.birthday || localBirthday || '';
      local.servicio = d.service || local.servicio || 'OFTALMOLOGIA-JR';
      if (d.notes) local.notas = d.notes;
      if (!Array.isArray(local.instituciones)) local.instituciones = [];

      // Migración suave: si el CRM histórico tenía contacto local y Supabase aún no,
      // lo subimos una sola vez para habilitar entregas por WhatsApp.
      const patch = {};
      if (!d.phone && localPhone) patch.phone = localPhone;
      if (!d.birthday && localBirthday) patch.birthday = localBirthday;
      if (!d.notes && local.notas) patch.notes = local.notas;
      if (Object.keys(patch).length) {
        patch.updated_at = new Date().toISOString();
        contactBackfill.push(client.from('doctors').update(patch).eq('id', d.id));
      }

      mergedDoctors.push(local);
    });

    // Nunca borrar un médico local que todavía no llegó a sincronizarse.
    (Array.isArray(doctors) ? doctors : []).forEach(local => {
      const key = normName(local?.nombre);
      if (key && !cloudNames.has(key)) mergedDoctors.push(local);
    });

    doctors = mergedDoctors.sort((a,b) => String(a.nombre||'').localeCompare(String(b.nombre||''),'es'));

    if (contactBackfill.length) {
      const results = await Promise.all(contactBackfill);
      const failed = results.find(x => x.error);
      if (failed?.error) console.warn('No se pudieron migrar algunos contactos locales:', failed.error);
    }

    saveState();
  }

  async function ensureDoctorId(name) {
    const key = normName(name);
    if (doctorIdByNormName[key]) return doctorIdByNormName[key];

    const userId = await getSessionUserId();
    const { data, error } = await client
      .from('doctors')
      .insert({
        full_name: name,
        service: 'OFTALMOLOGIA-JR',
        created_by: userId
      })
      .select('id,full_name')
      .single();

    if (error) throw error;
    doctorIdByNormName[key] = data.id;
    doctorNameById[data.id] = data.full_name;
    return data.id;
  }

  async function loadPrescriptions() {
    const { data, error } = await client
      .from('prescriptions')
      .select('id,branch_id,doctor_id,prescription_date,patient_name,amount,vat_rate,source,import_fingerprint')
      .order('prescription_date', { ascending: true });

    if (error) throw error;
    if (!data?.length) return false;

    recetas = data.map(row => {
      const branch = branchCodeById[row.branch_id] || 'general-paz';
      const isExtra = row.source === 'manual-extra';
      return {
        fecha: row.prescription_date,
        paciente: row.patient_name || '',
        medico: doctorNameById[row.doctor_id] || 'Médico sin nombre',
        monto: Number(row.amount) || 0,
        vat_rate: Number(row.vat_rate ?? 21) || 21,
        institucion: '',
        branch,
        extra: isExtra,
        xid: isExtra ? row.import_fingerprint || row.id : undefined,
        _supabaseId: row.id,
        _fingerprint: row.import_fingerprint || null
      };
    });

    localStorage.setItem('blackoptica_recetas', JSON.stringify(recetas));
    return true;
  }

  async function loadCommissionRules(allowBackfill = true) {
    const { data, error } = await client
      .from('doctor_commission_rules')
      .select('id,doctor_id,branch_id,percentage,valid_from,valid_to,active')
      .order('valid_from', { ascending: true });

    if (error) throw error;
    let sourceRows = data || [];

    // Migración suave de porcentajes que antes vivían solo en localStorage.
    // Solo crea una regla si existe un valor local explícito y Supabase no tiene regla activa.
    if (allowBackfill) {
      const todayParts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Argentina/Cordoba',
        year: 'numeric', month: '2-digit', day: '2-digit'
      }).formatToParts(new Date()).reduce((acc,part)=>{ if(part.type!=='literal') acc[part.type]=part.value; return acc; },{});
      const today = `${todayParts.year}-${todayParts.month}-${todayParts.day}`;
      const inserts = [];
      doctors.forEach(doc => {
        const doctorId = doctorIdByNormName[normName(doc.nombre)];
        if (!doctorId) return;
        ['general-paz','cerro-de-las-rosas'].forEach(branch => {
          const branchId = branchIdByCode[branch];
          if (!branchId) return;
          const branchKey = `${normName(doc.nombre)}|${branch}`;
          let localPct = comisiones[branchKey];
          if (localPct === undefined && branch === 'general-paz') localPct = comisiones[normName(doc.nombre)];
          if (localPct === undefined) return;
          const exists = sourceRows.some(r => r.doctor_id === doctorId && r.branch_id === branchId && r.active !== false);
          if (!exists) inserts.push({
            doctor_id: doctorId,
            branch_id: branchId,
            percentage: Number(localPct) || 0,
            valid_from: today,
            active: true
          });
        });
      });
      if (inserts.length) {
        const { error: insertError } = await client.from('doctor_commission_rules').insert(inserts);
        if (insertError) throw insertError;
        return loadCommissionRules(false);
      }
    }

    const rows = sourceRows.map(row => ({
      ...row,
      doctor_name: doctorNameById[row.doctor_id] || '',
      branch_code: branchCodeById[row.branch_id] || ''
    })).filter(row => row.doctor_name && row.branch_code);

    const activeRows = rows.filter(row => row.active !== false).sort((a,b) => String(b.valid_from).localeCompare(String(a.valid_from)));
    const seen = new Set();
    activeRows.forEach(row => {
      const key = `${normName(row.doctor_name)}|${row.branch_code}`;
      if (seen.has(key)) return;
      seen.add(key);
      comisiones[key] = Number(row.percentage) || 0;
    });

    window.BlackCommissionRules = {
      rows,
      getPct(medico, branchCode, fecha) {
        const branch = ['alto-palermo','zona-norte','cerro'].includes(branchCode) ? 'cerro-de-las-rosas' : branchCode;
        const doctorKey = normName(medico);
        const date = toIsoDate(fecha) || String(fecha || '').slice(0,10);
        const candidates = rows
          .filter(r => normName(r.doctor_name) === doctorKey && r.branch_code === branch)
          .sort((a,b) => String(a.valid_from).localeCompare(String(b.valid_from)));
        if (!candidates.length) return getComision(medico, branch);
        const exact = candidates.filter(r => String(r.valid_from || '') <= date && (!r.valid_to || String(r.valid_to) >= date));
        if (exact.length) return Number(exact[exact.length - 1].percentage) || 0;
        const before = candidates.filter(r => String(r.valid_from || '') <= date);
        if (before.length) return Number(before[before.length - 1].percentage) || 0;
        return Number(candidates[0].percentage) || 0;
      }
    };

    localStorage.setItem('blackoptica_comisiones', JSON.stringify(comisiones));
  }

  async function loadPayments() {
    const { data, error } = await client
      .from('doctor_commission_payments')
      .select('doctor_id,branch_id,period_from,period_to,payment_status')
      .eq('payment_status', 'paid');

    if (error) throw error;
    if (!data?.length) return;

    pagos = {};
    data.forEach(row => {
      const name = doctorNameById[row.doctor_id];
      const branch = branchCodeById[row.branch_id];
      if (!name || !branch) return;
      pagos[`${normName(name)}|${branch}|${row.period_from}|${row.period_to}`] = true;
    });

    localStorage.setItem('blackoptica_pagos', JSON.stringify(pagos));
  }

  async function loadImportHistory() {
    const { data, error } = await client
      .from('commission_imports')
      .select('id,branch_id,file_name,period_from,period_to,records_count,total_amount,duplicate_count,status,created_at')
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) throw error;
    if (!data) return;

    const history = data.map(row => ({
      id: row.id,
      branch: branchCodeById[row.branch_id] || 'general-paz',
      fileName: row.file_name,
      records: row.records_count,
      total: Number(row.total_amount) || 0,
      from: row.period_from || '',
      to: row.period_to || '',
      duplicateCount: row.duplicate_count || 0,
      importedAt: row.created_at
    }));

    localStorage.setItem(IMPORT_HISTORY_KEY, JSON.stringify(history));
  }

  async function persistBranchPrescriptions(branchCode) {
    const branchId = branchIdByCode[branchCode];
    if (!branchId) throw new Error(`Sucursal no encontrada: ${branchCode}`);

    const branchRecipes = recetas.filter(r => branchCodeForRecipe(r) === branchCode);
    const rows = [];
    const userId = await getSessionUserId();

    for (const r of branchRecipes) {
      const doctorId = await ensureDoctorId(r.medico);
      rows.push({
        branch_id: branchId,
        doctor_id: doctorId,
        prescription_date: toIsoDate(r.fecha),
        patient_name: r.paciente || 'Paciente',
        amount: Number(r.monto) || 0,
        vat_rate: Number(r.vat_rate ?? 21) || 21,
        source: r.extra ? 'manual-extra' : 'excel',
        created_by: userId,
        import_fingerprint: stableFingerprint(r)
      });
    }

    // La pantalla actual permite "reemplazar sucursal". Para conservar exactamente ese comportamiento,
    // se resincroniza solo la sucursal activa. La otra sucursal nunca se toca.
    const { error: deleteError } = await client
      .from('prescriptions')
      .delete()
      .eq('branch_id', branchId);
    if (deleteError) throw deleteError;

    if (rows.length) {
      const { error: insertError } = await client.from('prescriptions').insert(rows);
      if (insertError) throw insertError;
    }
  }

  async function persistCommissionRule(medico, branchCode, pct) {
    const branchId = branchIdByCode[branchCode];
    const doctorId = await ensureDoctorId(medico);
    if (!branchId || !doctorId) return;

    const todayParts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Argentina/Cordoba',
      year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(new Date()).reduce((acc,part)=>{ if(part.type!=='literal') acc[part.type]=part.value; return acc; },{});
    const today = `${todayParts.year}-${todayParts.month}-${todayParts.day}`;
    const yesterdayDate = new Date(today + 'T12:00:00');
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterday = [
      yesterdayDate.getFullYear(),
      String(yesterdayDate.getMonth() + 1).padStart(2, '0'),
      String(yesterdayDate.getDate()).padStart(2, '0')
    ].join('-');

    const { data: existing, error: readError } = await client
      .from('doctor_commission_rules')
      .select('id,percentage,valid_from')
      .eq('doctor_id', doctorId)
      .eq('branch_id', branchId)
      .eq('active', true)
      .order('valid_from', { ascending: false })
      .limit(1);

    if (readError) throw readError;
    const current = existing?.[0] || null;
    if (current && Number(current.percentage) === Number(pct)) return;

    // Si el porcentaje cambia el mismo día, corregimos la regla del día.
    // Si cambia en otra fecha, cerramos la anterior para conservar el histórico.
    if (current?.valid_from === today) {
      const { error } = await client
        .from('doctor_commission_rules')
        .update({ percentage: pct })
        .eq('id', current.id);
      if (error) throw error;
      return;
    }

    if (current) {
      const { error: closeError } = await client
        .from('doctor_commission_rules')
        .update({ active: false, valid_to: yesterday })
        .eq('id', current.id);
      if (closeError) throw closeError;
    }

    const { error } = await client
      .from('doctor_commission_rules')
      .insert({
        doctor_id: doctorId,
        branch_id: branchId,
        percentage: pct,
        valid_from: today,
        active: true
      });
    if (error) throw error;
  }

  async function persistPayment(medico, branchCode) {
    const desde = document.getElementById('periodo-desde')?.value;
    const hasta = document.getElementById('periodo-hasta')?.value;
    if (!desde || !hasta) {
      showToast('Definí Desde y Hasta para registrar el pago');
      return;
    }

    const branchId = branchIdByCode[branchCode];
    const doctorId = await ensureDoctorId(medico);
    const paid = !!pagos[`${normName(medico)}|${branchCode}|${desde}|${hasta}`];

    const relevant = recetas.filter(r => {
      if (branchCodeForRecipe(r) !== branchCode || normName(r.medico) !== normName(medico)) return false;
      const d = parseDate(r.fecha);
      if (!d) return false;
      return d >= new Date(desde + 'T00:00:00') && d <= new Date(hasta + 'T23:59:59');
    });
    const amount = relevant.reduce((sum, r) => {
      const pct = window.BlackCommissionRules?.getPct?.(medico, branchCode, r.fecha) ?? getComision(medico, branchCode);
      return sum + (Number(r.monto) || 0) * (Number(pct) || 0) / 100;
    }, 0);

    const { error } = await client
      .from('doctor_commission_payments')
      .upsert({
        doctor_id: doctorId,
        branch_id: branchId,
        period_from: desde,
        period_to: hasta,
        amount,
        paid_at: paid ? new Date().toISOString() : null,
        payment_status: paid ? 'paid' : 'pending',
        created_by: await getSessionUserId()
      }, { onConflict: 'doctor_id,branch_id,period_from,period_to' });

    if (error) throw error;
  }

  async function persistImportHistoryFromLocal(branchCode) {
    const history = JSON.parse(localStorage.getItem(IMPORT_HISTORY_KEY) || '[]');
    const latest = history.find(h => h.branch === branchCode);
    if (!latest || latest._synced) return;

    const branchId = branchIdByCode[branchCode];
    const userId = await getSessionUserId();
    const { data, error } = await client
      .from('commission_imports')
      .insert({
        branch_id: branchId,
        file_name: latest.fileName || 'Excel importado',
        period_from: latest.from || null,
        period_to: latest.to || null,
        records_count: latest.records || 0,
        total_amount: latest.total || 0,
        duplicate_count: latest.duplicateCount || 0,
        status: 'processed',
        created_by: userId
      })
      .select('id,created_at')
      .single();

    if (error) throw error;
    latest.id = data.id;
    latest.importedAt = data.created_at;
    latest._synced = true;
    localStorage.setItem(IMPORT_HISTORY_KEY, JSON.stringify(history));
  }

  function ensureSyncBadge() {
    if (document.getElementById('supabase-sync-badge')) return;
    const toolbar = document.querySelector('#page-comisiones .comisiones-toolbar');
    if (!toolbar) return;
    const badge = document.createElement('div');
    badge.id = 'supabase-sync-badge';
    badge.style.cssText = 'display:inline-flex;align-items:center;gap:7px;font-size:.72rem;font-weight:600;color:#6f624f;padding:8px 10px;border:1px solid rgba(201,169,110,.28);border-radius:999px;background:rgba(255,255,255,.7);white-space:nowrap';
    badge.innerHTML = '<span style="width:7px;height:7px;border-radius:50%;background:#c9a96e;display:inline-block"></span><span>Supabase conectando…</span>';
    toolbar.appendChild(badge);
  }

  function setSyncBadge(state, text) {
    const badge = document.getElementById('supabase-sync-badge');
    if (!badge) return;
    const dot = badge.querySelector('span:first-child');
    const label = badge.querySelector('span:last-child');
    if (dot) dot.style.background = state === 'ok' ? '#3da96f' : state === 'error' ? '#c0564e' : '#c9a96e';
    if (label) label.textContent = text;
  }

  async function hydrateFromSupabase() {
    if (syncing) return;
    syncing = true;
    ensureSyncBadge();
    setSyncBadge('loading', 'Supabase sincronizando…');

    try {
      await loadCatalogs();

      // Los profesionales vienen de Supabase como fuente principal y se reconstruyen
      // aunque el localStorage se haya borrado o esté vacío.
      try {
        renderHero?.();
        renderDaySelector?.();
        renderSchedule?.();
        renderDoctorsList?.();
        renderBirthdays?.();
      } catch (renderError) {
        console.warn('No se pudo refrescar alguna vista de profesionales:', renderError);
      }

      const hasCloudRecipes = await loadPrescriptions();
      await Promise.all([loadCommissionRules(), loadPayments(), loadImportHistory()]);

      // Si Supabase todavía está vacío, no borramos el respaldo local actual.
      saveState();
      applyFilters();
      if (!hasCloudRecipes) {
        setSyncBadge('ok', 'Supabase listo · profesionales sincronizados');
      } else {
        setSyncBadge('ok', 'Supabase sincronizado');
      }
    } catch (err) {
      console.error('Black OS · Error de sincronización Supabase:', err);
      setSyncBadge('error', 'Supabase sin sincronizar');
      showToast('No se pudo sincronizar Supabase. Se mantiene el respaldo local.');
    } finally {
      syncing = false;
    }
  }

  if (typeof originalSaveDoctor === 'function') {
    window.saveDoctor = async function saveDoctorSupabase() {
      const name = document.getElementById('input-nombre')?.value.trim() || '';
      const phone = document.getElementById('input-telefono')?.value.trim() || '';
      const birthday = document.getElementById('input-cumple')?.value || null;
      const service = document.getElementById('input-servicio')?.value || 'OFTALMOLOGIA-JR';
      if (!name) {
        originalSaveDoctor();
        return;
      }

      originalSaveDoctor();

      try {
        await loadCatalogs();
        const doctorId = await ensureDoctorId(name);
        const local = doctors.find(d => normName(d.nombre) === normName(name));
        const { error } = await client.from('doctors').update({
          full_name: name,
          phone: phone || null,
          birthday: birthday || null,
          service,
          notes: local?.notas || null,
          updated_at: new Date().toISOString()
        }).eq('id', doctorId);
        if (error) throw error;
        if (local) {
          local._supabaseId = doctorId;
          local.telefono = phone;
          local.cumple = birthday || '';
        }
        saveState();
        setSyncBadge('ok', 'Profesional sincronizado');
        window.BlackDoctorDelivery?.hydrate?.();
      } catch (err) {
        console.error(err);
        setSyncBadge('error', 'Profesional pendiente de sincronizar');
        showToast('El profesional quedó guardado localmente, pero sus datos de contacto no pudieron sincronizarse.');
      }
    };
  }

  if (typeof originalConfirmCsvImport === 'function') {
    window.confirmCsvImport = async function confirmCsvImportSupabase() {
      const before = recetas.length;
      originalConfirmCsvImport();
      const branch = currentBranchFromUI();
      if (!branch) return;
      try {
        setSyncBadge('loading', 'Guardando en Supabase…');
        await loadCatalogs();
        await persistBranchPrescriptions(branch);
        await persistImportHistoryFromLocal(branch);
        setSyncBadge('ok', 'Supabase sincronizado');
      } catch (err) {
        console.error(err);
        setSyncBadge('error', 'Pendiente de sincronizar');
        showToast('La importación quedó local, pero no pudo guardarse en Supabase.');
      }
    };
  }

  if (typeof originalUpdateBranchComision === 'function') {
    window.updateBranchComision = async function updateBranchComisionSupabase(medico, branch, val, input) {
      originalUpdateBranchComision(medico, branch, val, input);
      const pct = Math.max(0, Math.min(100, parseFloat(val) || 0));
      try {
        await loadCatalogs();
        await persistCommissionRule(medico, branch, pct);
        setSyncBadge('ok', 'Supabase sincronizado');
      } catch (err) {
        console.error(err);
        setSyncBadge('error', 'Comisión pendiente de sincronizar');
      }
    };
  }

  if (typeof originalToggleBranchPago === 'function') {
    window.toggleBranchPago = async function toggleBranchPagoSupabase(medico, branch) {
      originalToggleBranchPago(medico, branch);
      try {
        await loadCatalogs();
        await persistPayment(medico, branch);
        setSyncBadge('ok', 'Supabase sincronizado');
      } catch (err) {
        console.error(err);
        setSyncBadge('error', 'Pago pendiente de sincronizar');
        showToast('El estado quedó local, pero no pudo guardarse en Supabase.');
      }
    };
  }

  if (typeof originalSaveExtra === 'function') {
    window.saveExtra = async function saveExtraSupabase() {
      originalSaveExtra();
      const branch = currentBranchFromUI();
      if (!branch) return;
      try {
        await loadCatalogs();
        await persistBranchPrescriptions(branch);
        setSyncBadge('ok', 'Supabase sincronizado');
      } catch (err) {
        console.error(err);
        setSyncBadge('error', 'Monto pendiente de sincronizar');
      }
    };
  }

  if (typeof originalDelExtra === 'function') {
    window.delExtra = async function delExtraSupabase(xid) {
      const recipe = recetas.find(r => r.xid === xid);
      const branch = recipe ? branchCodeForRecipe(recipe) : currentBranchFromUI();
      originalDelExtra(xid);
      if (!branch) return;
      try {
        await loadCatalogs();
        await persistBranchPrescriptions(branch);
        setSyncBadge('ok', 'Supabase sincronizado');
      } catch (err) {
        console.error(err);
        setSyncBadge('error', 'Eliminación pendiente de sincronizar');
      }
    };
  }

  window.BlackOftSupabaseSync = {
    refresh: hydrateFromSupabase
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(hydrateFromSupabase, 700));
  } else {
    setTimeout(hydrateFromSupabase, 700);
  }
})();
