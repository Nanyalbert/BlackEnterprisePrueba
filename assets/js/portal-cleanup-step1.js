// Black OS — Step 1.4
// Limpieza no invasiva de datos de demostración del shell.
// No modifica autenticación, navegación, módulos ni persistencia real.

(() => {
  // Usuarios demo: portal.js todavía usa un store local temporal.
  // Hasta migrarlo a Supabase, evitamos mostrar identidades ficticias.
  try {
    if (typeof usersData !== 'undefined' && Array.isArray(usersData)) {
      usersData.splice(0, usersData.length);
      if (typeof nextUserId !== 'undefined') nextUserId = 1;
      if (typeof renderUsers === 'function') renderUsers();
    }
  } catch (error) {
    console.warn('Black OS: no se pudo limpiar usuarios demo.', error);
  }

  // Notificaciones demo: dejamos un estado vacío hasta conectar eventos reales.
  const notifList = document.getElementById('notif-list');
  if (notifList) {
    notifList.innerHTML = `
      <div class="portal-empty-notifications">
        <strong>Sin notificaciones</strong>
        <span>Las alertas aparecerán acá cuando estén conectadas a eventos reales.</span>
      </div>`;
  }

  const notifDot = document.getElementById('notif-dot');
  if (notifDot) notifDot.style.display = 'none';

  const markRead = document.getElementById('notif-mark-read');
  if (markRead) markRead.hidden = true;

  const notifFooter = document.querySelector('.notif-footer');
  if (notifFooter) notifFooter.hidden = true;

  // El rol real todavía no proviene de Supabase; evitamos etiquetar a toda sesión como Administrador.
  const roleLabel = document.querySelector('.user-chip-role');
  if (roleLabel) roleLabel.textContent = 'Sesión activa';

  // Este indicador representa disponibilidad visual del portal, no un health-check de backend.
  const portalStatus = document.querySelector('.dashboard-status span:last-child');
  if (portalStatus) portalStatus.textContent = 'Portal activo';
})();
