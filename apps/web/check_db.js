/* eslint-disable */
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_KEY);

async function check() {
  const { data: cols, error } = await supabase.rpc('mark_chat_group_read', { p_group_id: '00000000-0000-0000-0000-000000000000' });
  console.log("RPC Check:", { data: cols, error });

  const { data: groups, error: groupsError } = await supabase.from('chat_groups').select('id').limit(1);
  console.log("Groups Check:", { groups, groupsError });
}

check();
