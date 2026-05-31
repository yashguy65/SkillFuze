/* eslint-disable */
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../../.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_KEY in env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  try {
    const devEmails = ['dev1@skillfuze.local', 'dev2@skillfuze.local'];

    for (const email of devEmails) {
      console.log(`Generating login link for ${email}...`);
      const { data, error } = await supabase.auth.admin.generateLink({
        type: 'magiclink',
        email: email,
        options: {
          redirectTo: 'http://localhost:3000/auth/callback-implicit'
        }
      });

      if (error) {
        console.error(`Error generating link for ${email}:`, error);
      } else {
        const tokenHash = data.properties.hashed_token;
        const localLoginLink = `http://localhost:3000/auth/callback?token_hash=${tokenHash}&type=magiclink`;
        console.log(`Success! Login link for ${email}:`);
        console.log(localLoginLink);
      }
    }
  } catch (err) {
    console.error('Unexpected error:', err);
  }
}

run();
