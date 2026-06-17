const SUPABASE_URL = 'https://ceowmvfxjgrgwrespcrb.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNlb3dtdmZ4amdyZ3dyZXNwY3JiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk0NjYyOSwiZXhwIjoyMDk2NTIyNjI5fQ.DmTZE3eEgRLpH8sgqKxVax0pdg40BYdDkWajr1wA9Xc';

// Default modules: Reports and Users enabled for all, others disabled
const DEFAULT_MODULES = { reports: true, evidence: false, updates: false, users: true, system: false, admin: false, create_reports: true };

const PERMISSION_KEYS = [
  'create_reports','view_reports','view_all_reports','edit_reports','delete_reports','close_reports','reopen_reports','change_report_status','assign_reports','export_reports','upload_evidence','delete_evidence','download_evidence','add_updates','edit_updates','delete_updates','view_users','create_users','delete_users','reset_passwords','change_roles','view_alerts','manage_alerts','view_audit_logs','manage_permissions','suspend_users','restore_users','access_trash','permanently_delete_reports'
];

async function request(path, options = {}){
  const url = `${SUPABASE_URL}/rest/v1/${path}`;
  const headers = Object.assign({
    'apikey': SERVICE_KEY,
    'Authorization': `Bearer ${SERVICE_KEY}`,
    'Content-Type': 'application/json'
  }, options.headers || {});
  const res = await fetch(url, Object.assign({}, options, { headers }));
  const text = await res.text();
  let data = null;
  try { data = JSON.parse(text); } catch(e){ data = text; }
  return { status: res.status, data };
}

function shouldGrant(role, key){
  if (['create_reports','view_reports','upload_evidence','download_evidence','add_updates'].includes(key)) return true;
  if (role === 'Admin' || role === 'Support') return true;
  if (role === 'Gerente' && ['view_all_reports','edit_reports','change_report_status','assign_reports','export_reports','view_users','view_alerts','view_audit_logs'].includes(key)) return true;
  return false;
}

async function run() {
  try {
    const usersRes = await request('usuarios?select=id,correo,rol');
    if (usersRes.status !== 200) throw new Error('No se pudo obtener usuarios: ' + JSON.stringify(usersRes));
    const users = usersRes.data;

    for (const u of users){
      const uid = u.id;
      // user_activity_log
      const aRes = await request(`user_activity_log?select=id&user_id=eq.${uid}`);
      if (aRes.status === 200 && Array.isArray(aRes.data) && aRes.data.length === 0){
        await request('user_activity_log', { method: 'POST', body: JSON.stringify({ user_id: uid, reports_created: 0, is_suspended: false }) });
      }

      // user_permissions
      const pRes = await request(`user_permissions?select=id,modules_access&user_id=eq.${uid}`);
      let permissionId = null;
      if (pRes.status === 200 && Array.isArray(pRes.data) && pRes.data.length > 0){
        permissionId = pRes.data[0].id;
        // Update existing user's modules_access with DEFAULT_MODULES
        await request(`user_permissions?id=eq.${permissionId}`, { method: 'PATCH', body: JSON.stringify({ modules_access: DEFAULT_MODULES }) });
      } else {
        const createRes = await request('user_permissions', { method: 'POST', body: JSON.stringify({ user_id: uid, modules_access: DEFAULT_MODULES }) });
        if (createRes.status === 201 || createRes.status === 200) {
          const created = Array.isArray(createRes.data) ? createRes.data[0] : createRes.data;
          permissionId = created.id || created;
        }
      }

      if (!permissionId) {
        console.warn('No permission_id for user', uid);
        continue;
      }

      // permission details
      for (const key of PERMISSION_KEYS){
        const should = shouldGrant(u.rol, key);
        const existRes = await request(`user_permission_details?select=id,granted&permission_id=eq.${permissionId}&permission_key=eq.${encodeURIComponent(key)}`);
        if (existRes.status === 200 && Array.isArray(existRes.data) && existRes.data.length > 0){
          const existing = existRes.data[0];
          if (existing.granted !== should){
            await request(`user_permission_details?id=eq.${existing.id}`, { method: 'PATCH', body: JSON.stringify({ granted: should }) });
          }
        } else {
          await request('user_permission_details', { method: 'POST', body: JSON.stringify({ permission_id: permissionId, permission_key: key, granted: should }) });
        }
      }
    }

    console.log('Inicialización completada');
  } catch (err) {
    console.error('Error en inicialización:', err);
    process.exit(1);
  }
}

await run();
