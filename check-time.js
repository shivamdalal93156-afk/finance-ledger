const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'c:/Users/SHIVAM/Desktop/Khatabook/apps/mobile/.env' });

const supabase = createClient(process.env.EXPO_PUBLIC_SUPABASE_URL, process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY);

async function check() {
  const localTime = new Date().toISOString();
  console.log("Client time (UTC):", localTime);
  
  const { data, error } = await supabase.rpc('now'); // wait, if rpc now is not available, we can use a raw select via postgrest if possible, or just insert a temp customer and read its created_at.
  // Actually, we can run a select query on transactions or check if we can get database time.
  // Let's do a select on transactions and get the created_at of the latest transaction.
  const { data: txs, error: txError } = await supabase
    .from('transactions')
    .select('created_at')
    .order('created_at', { ascending: false })
    .limit(1);

  if (txError) {
    console.error("TX Error:", txError);
  } else if (txs && txs.length > 0) {
    console.log("Latest TX created_at in DB:", txs[0].created_at);
  }

  // Let's insert a test customer to check its exact created_at value vs our local time!
  console.log("Inserting a temp test customer...");
  const tempName = "TimeTest-" + Date.now();
  const { data: newCust, error: insertError } = await supabase
    .from('customers')
    .insert({
      user_id: 'e499d63c-36b1-4f18-b22e-a34237d4567e', // let's use a dummy UUID or just let it insert (if RLS allows, wait, if RLS is on we need auth. Let's see if insert fails).
      name: tempName
    })
    .select()
    .single();

  if (insertError) {
    console.error("Insert Error:", insertError);
  } else {
    console.log("Inserted Temp Customer created_at:", newCust.created_at);
    // Delete it
    await supabase.from('customers').delete().eq('id', newCust.id);
  }
}

check();
