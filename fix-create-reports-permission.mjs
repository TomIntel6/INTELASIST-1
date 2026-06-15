import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Error: Falta SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY/SUPABASE_SERVICE_KEY en .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const ALL_PERMISSIONS = [
  // Reports
  'create_reports',
  'view_reports',
  'view_all_reports',
  'edit_reports',
  'delete_reports',
  'close_reports',
  'reopen_reports',
  'change_report_status',
  'assign_reports',
  'export_reports',
  // Evidence
  'upload_evidence',
  'delete_evidence',
  'download_evidence',
  // Updates
  'add_updates',
  'edit_updates',
  'delete_updates',
  // Users
  'view_users',
  'create_users',
  'delete_users',
  'reset_passwords',
  'change_roles',
  // System
  'view_alerts',
  'manage_alerts',
  'view_audit_logs',
  'manage_permissions',
  // Admin
  'suspend_users',
  'restore_users',
  'access_trash',
  'permanently_delete_reports',
];

// Permisos para cada rol
const ROLE_PERMISSIONS = {
  'Agente': [
    'create_reports',
    'view_reports',
    'edit_reports',
    'upload_evidence',
    'download_evidence',
    'add_updates',
  ],
  'Gerente': [
    'create_reports',
    'view_reports',
    'view_all_reports',
    'edit_reports',
    'change_report_status',
    'assign_reports',
    'export_reports',
    'upload_evidence',
    'download_evidence',
    'add_updates',
    'view_users',
    'view_alerts',
    'view_audit_logs',
  ],
  'Admin': ALL_PERMISSIONS,
  'Support': ALL_PERMISSIONS,
};

async function fixCreateReportsPermission() {
  try {
    console.log('🔄 Iniciando actualización de permisos...\n');

    // 1. Obtener todos los usuarios
    const { data: users, error: usersError } = await supabase
      .from('usuarios')
      .select('id, email, rol');

    if (usersError) {
      throw new Error(`Error obteniendo usuarios: ${usersError.message}`);
    }

    console.log(`✅ Se encontraron ${users.length} usuarios\n`);

    // 2. Para cada usuario, asegurar que tenga registros en user_permissions y user_permission_details
    for (const user of users) {
      const userRole = user.rol || 'Agente';
      const permissions = ROLE_PERMISSIONS[userRole] || ROLE_PERMISSIONS['Agente'];

      console.log(`👤 Procesando usuario: ${user.email} (Rol: ${userRole})`);

      // Verificar si existe en user_permissions
      const { data: permRecord, error: permError } = await supabase
        .from('user_permissions')
        .select('id')
        .eq('user_id', user.id)
        .single();

      let permissionId;

      if (!permRecord) {
        // Crear nuevo registro en user_permissions
        const { data: newPerm, error: newPermError } = await supabase
          .from('user_permissions')
          .insert([
            {
              user_id: user.id,
              modules_access: {
                reports: true,
                evidence: true,
                updates: true,
                users: userRole === 'Gerente' || userRole === 'Admin' || userRole === 'Support',
                system: userRole === 'Admin' || userRole === 'Support',
                admin: userRole === 'Admin' || userRole === 'Support',
                create_reports: true,
              },
            },
          ])
          .select('id')
          .single();

        if (newPermError) {
          throw new Error(`Error creando user_permissions para ${user.email}: ${newPermError.message}`);
        }

        permissionId = newPerm.id;
        console.log(`  ✅ Creado registro en user_permissions`);
      } else {
        permissionId = permRecord.id;
        console.log(`  ✅ Registro en user_permissions ya existe`);
      }

      // 3. Obtener todos los detalles de permiso existentes
      const { data: existingDetails, error: detailsError } = await supabase
        .from('user_permission_details')
        .select('permission_key')
        .eq('permission_id', permissionId);

      if (detailsError) {
        throw new Error(`Error obteniendo detalles de permisos: ${detailsError.message}`);
      }

      const existingKeys = new Set(existingDetails?.map(d => d.permission_key) || []);

      // 4. Insertar o actualizar todos los permisos
      const detailsToInsert = ALL_PERMISSIONS.map((perm) => ({
        permission_id: permissionId,
        permission_key: perm,
        granted: permissions.includes(perm),
      }));

      // Filtrar solo los nuevos
      const newDetails = detailsToInsert.filter((d) => !existingKeys.has(d.permission_key));

      if (newDetails.length > 0) {
        const { error: insertError } = await supabase
          .from('user_permission_details')
          .insert(newDetails);

        if (insertError) {
          throw new Error(`Error insertando detalles de permiso: ${insertError.message}`);
        }

        console.log(`  ✅ Agregados ${newDetails.length} nuevos permisos`);
      }

      // Actualizar los existentes
      for (const detail of detailsToInsert.filter((d) => existingKeys.has(d.permission_key))) {
        const { error: updateError } = await supabase
          .from('user_permission_details')
          .update({ granted: detail.granted })
          .eq('permission_id', permissionId)
          .eq('permission_key', detail.permission_key);

        if (updateError) {
          throw new Error(`Error actualizando permiso ${detail.permission_key}: ${updateError.message}`);
        }
      }

      if (detailsToInsert.filter((d) => existingKeys.has(d.permission_key)).length > 0) {
        console.log(`  ✅ Actualizados permisos existentes`);
      }

      console.log(`  ✅ create_reports: ${permissions.includes('create_reports') ? 'HABILITADO ✓' : 'DESHABILITADO'}\n`);
    }

    // 5. Crear user_activity_log si es necesario
    console.log('🔄 Verificando registros de actividad...\n');

    for (const user of users) {
      const { data: activityRecord } = await supabase
        .from('user_activity_log')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (!activityRecord) {
        const { error: activityError } = await supabase
          .from('user_activity_log')
          .insert([
            {
              user_id: user.id,
              reports_created: 0,
              is_suspended: false,
            },
          ]);

        if (activityError && activityError.code !== 'PGRST116') {
          console.warn(`⚠️ Error creando activity log para ${user.email}: ${activityError.message}`);
        } else {
          console.log(`✅ Creado registro de actividad para ${user.email}`);
        }
      }
    }

    console.log('\n✅ ¡Actualización completada exitosamente!');
    console.log('✅ Todos los usuarios ahora tienen permiso para crear informes (create_reports: true)');
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

fixCreateReportsPermission();
