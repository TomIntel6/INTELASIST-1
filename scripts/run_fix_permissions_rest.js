import dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://ceowmvfxjgrgwrespcrb.supabase.co').trim();
const SERVICE_KEY = String(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || '').trim();
const PLACEHOLDER_KEY = 'REPLACE_WITH_REAL_SERVICE_ROLE_KEY';

if (!SUPABASE_URL) {
  console.error('Error: falta SUPABASE_URL en .env o en la variable de entorno.');
  process.exit(1);
}

if (!SERVICE_KEY || SERVICE_KEY === PLACEHOLDER_KEY) {
  console.error('Error: falta SUPABASE_SERVICE_ROLE_KEY o SUPABASE_SERVICE_KEY en .env.');
  process.exit(1);
}

// Default modules: Reports and Users enabled for all, others disabled
const DEFAULT_MODULES = {
  reports: true,
  evidence: false,
  updates: false,
  users: true,
  system: false,
  admin: false,
  create_reports: true,
};

const PERMISSION_KEYS = [
  'create_reports','view_reports','view_all_reports','edit_reports','delete_reports','close_reports','reopen_reports','change_report_status','assign_reports','export_reports','upload_evidence','delete_evidence','download_evidence','add_updates','edit_updates','delete_updates','view_users','create_users','delete_users','reset_passwords','change_roles','view_alerts','manage_alerts','view_audit_logs','manage_permissions','suspend_users','restore_users','access_trash','permanently_delete_reports'
];

async function request(path, options = {}) {
  const url = `${SUPABASE_URL}/rest/v1/${path}`;
  const headers = {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    'Content-Type': 'application/json',
    ...options.headers,
  };

  const res = await fetch(url, { ...options, headers });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch (err) { data = text; }
  return { status: res.status, data, url, method: options.method || 'GET' };
}

function shouldGrant(role, key) {
  if (['create_reports','view_reports','upload_evidence','download_evidence','add_updates'].includes(key)) return true;
  if (role === 'Admin' || role === 'Support') return true;
  if (role === 'Gerente' && ['view_all_reports','edit_reports','change_report_status','assign_reports','export_reports','view_users','view_alerts','view_audit_logs'].includes(key)) return true;
  return false;
}

async function run() {
  console.log('Iniciando script REST de Supabase...');
  const usersRes = await request('usuarios?select=id,rol');
  console.log('Usuarios status:', usersRes.status);
  if (usersRes.status !== 200) {
    console.error('Error al obtener usuarios:', usersRes);
    process.exit(1);
  }

  const users = Array.isArray(usersRes.data) ? usersRes.data : [];
  console.log(`Usuarios encontrados: ${users.length}`);

  for (const u of users) {
    const uid = u.id;
    console.log(`Procesando usuario ${uid} rol=${u.rol}`);

    const aRes = await request(`user_activity_log?select=id&user_id=eq.${uid}`);
    if (aRes.status !== 200) {
      console.error('Error query user_activity_log:', aRes);
      process.exit(1);
    }
    if (Array.isArray(aRes.data) && aRes.data.length === 0) {
      const createA = await request('user_activity_log', { method: 'POST', body: JSON.stringify({ user_id: uid, reports_created: 0, is_suspended: false }) });
      console.log('Creado user_activity_log:', createA.status);
    }

    const pRes = await request(`user_permissions?select=id,modules_access&user_id=eq.${uid}`);
    if (pRes.status !== 200) {
      console.error('Error query user_permissions:', pRes);
      process.exit(1);
    }

    let permissionId = null;
    if (Array.isArray(pRes.data) && pRes.data.length > 0) {
      permissionId = pRes.data[0].id;
      // Update existing user's modules_access with DEFAULT_MODULES
      const updateRes = await request(`user_permissions?id=eq.${permissionId}`, { method: 'PATCH', body: JSON.stringify({ modules_access: DEFAULT_MODULES }) });
      console.log('Update user_permissions status:', updateRes.status);
    } else {
      const createP = await request('user_permissions', { method: 'POST', body: JSON.stringify({ user_id: uid, modules_access: DEFAULT_MODULES }) });
      console.log('Create user_permissions status:', createP.status, createP.data);
      if (Array.isArray(createP.data) && createP.data.length > 0) {
        permissionId = createP.data[0].id;
      } else if (createP.data && createP.data.id) {
        permissionId = createP.data.id;
      }
    }
    if (!permissionId) {
      console.warn('No permissionId for user', uid);
      continue;
    }

    for (const key of PERMISSION_KEYS) {
      const should = shouldGrant(u.rol, key);
      const existRes = await request(`user_permission_details?select=id,granted&permission_id=eq.${permissionId}&permission_key=eq.${encodeURIComponent(key)}`);
      if (existRes.status !== 200) {
        console.error('Error query permission details:', existRes);
        process.exit(1);
      }
      if (Array.isArray(existRes.data) && existRes.data.length > 0) {
        const existing = existRes.data[0];
        if (existing.granted !== should) {
          const patchRes = await request(`user_permission_details?id=eq.${existing.id}`, { method: 'PATCH', body: JSON.stringify({ granted: should }) });
          console.log(`Patch detail ${key} status`, patchRes.status);
        }
      } else {
        const createD = await request('user_permission_details', { method: 'POST', body: JSON.stringify({ permission_id: permissionId, permission_key: key, granted: should }) });
        console.log(`Create detail ${key} status`, createD.status);
      }
    }
  }

  console.log('Inicialización REST completada');
}

await run();
