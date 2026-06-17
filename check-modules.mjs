import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL || 'https://ceowmvfxjgrgwrespcrb.supabase.co',
  process.env.SUPABASE_SERVICE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNlb3dtdmZ4amdyZ3dyZXNwY3JiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk0NjYyOSwiZXhwIjoyMDk2NTIyNjI5fQ.DmTZE3eEgRLpH8sgqKxVax0pdg40BYdDkWajr1wA9Xc'
);

async function check() {
  const { data, error } = await supabase
    .from('user_permissions')
    .select('id, user_id, modules_access')
    .eq('user_id', 33)
    .single();
  
  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Abel Lara (user_id=33) modules_access:');
    console.log(JSON.stringify(data, null, 2));
  }
  
  process.exit(0);
}

check();
