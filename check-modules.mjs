import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
if (!supabaseUrl || !supabaseKey) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_KEY are required.');
const supabase = createClient(supabaseUrl, supabaseKey);

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
