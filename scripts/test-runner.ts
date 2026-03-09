// scripts/test-runner.ts
import { execSync } from 'child_process';

async function runNagaratharNexusSuite() {
  console.log('--------------------------------------------');
  console.log('Nagarathar Nexus • Functional + Perf Runner');
  console.log('--------------------------------------------');

  try {
    // 1. Reset Database
    console.log('\n▶ supabase db reset');
    execSync('supabase db reset', { stdio: 'inherit' });

    // 2. STABILIZATION DELAY 
    // This gives Docker/PostgREST time to wake up.
    // Prevents the "502 Bad Gateway" error we saw earlier.
    console.log('\n⏳ Waiting 5s for containers to stabilize...');
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // 3. Seed Test Data
    console.log('\n▶ npm run seed:test');
    execSync('npm run seed:test', { stdio: 'inherit' });

    // 4. Run Functional Tests
    console.log('\n▶ npm run test:functional');
    execSync('npm run test:functional', { stdio: 'inherit' });

    console.log('\n✅ ALL CHECKS PASSED');
  } catch (error) {
    console.error('\n--------------------------------------------');
    console.error('❌ CHECKS FAILED');
    console.error('--------------------------------------------');
    process.exit(1);
  }
}

// Execute the wrapper
runNagaratharNexusSuite().catch((err) => {
  console.error('Fatal Runner Error:', err);
  process.exit(1);
});