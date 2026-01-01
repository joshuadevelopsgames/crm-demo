// Quick script to verify Supabase keys
// Usage: node verify_supabase_keys.js YOUR_KEY_HERE

const key = process.argv[2];

if (!key) {
  console.log('Usage: node verify_supabase_keys.js YOUR_KEY_HERE');
  process.exit(1);
}

try {
  const parts = key.split('.');
  if (parts.length < 3) {
    console.log('❌ Invalid JWT format');
    process.exit(1);
  }
  
  const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
  
  console.log('\n📋 Key Information:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Project ID:', payload.ref || 'N/A');
  console.log('Role:', payload.role || 'N/A');
  console.log('Issuer:', payload.iss || 'N/A');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  if (payload.role === 'anon') {
    console.log('✅ This is an ANON KEY (public, safe to expose)');
    console.log('   Use for: VITE_SUPABASE_ANON_KEY, SUPABASE_ANON_KEY');
  } else if (payload.role === 'service_role') {
    console.log('✅ This is a SERVICE ROLE KEY (secret, admin access)');
    console.log('   Use for: SUPABASE_SERVICE_ROLE_KEY only');
    console.log('   ⚠️  Keep this secret! Never expose to frontend!');
  } else {
    console.log('⚠️  Unknown role:', payload.role);
  }
  
  if (payload.ref === 'nyyukbaodgzyvcccpojn') {
    console.log('✅ Key is from correct project (nyyukbaodgzyvcccpojn)');
  } else {
    console.log('❌ Key is from different project:', payload.ref);
    console.log('   Expected: nyyukbaodgzyvcccpojn');
  }
  
} catch (error) {
  console.error('❌ Error decoding key:', error.message);
  process.exit(1);
}
