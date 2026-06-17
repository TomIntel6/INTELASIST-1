/**
 * Test script to validate permission persistence with false values
 * This script tests the fixed endpoints to ensure false values are persisted
 */

import fetch from 'node-fetch';

const API_BASE = 'http://localhost:3001';

// Test user ID - replace with an actual user ID from your database
const TEST_USER_ID = 'user-123'; // You need to provide a real user ID

async function testPermissionPersistence() {
  console.log('🧪 Starting Permission Persistence Test...\n');

  try {
    // Step 1: Load current permissions
    console.log('📥 Step 1: Loading current permissions...');
    const loadResponse = await fetch(`${API_BASE}/api/users/${TEST_USER_ID}/permissions`);
    if (!loadResponse.ok) throw new Error(`Failed to load permissions: ${loadResponse.statusText}`);
    const currentData = await loadResponse.json();
    console.log('✅ Current permissions:', Object.keys(currentData.permissions).length, 'keys');
    console.log('   Permissions:', currentData.permissions);

    // Step 2: Create test permissions with mix of true and false
    console.log('\n📤 Step 2: Saving test permissions (mix of true/false)...');
    const testPermissions = {};
    const allKeys = Object.keys(currentData.permissions || {});
    
    // Set first half to true, second half to false
    allKeys.forEach((key, index) => {
      testPermissions[key] = index < allKeys.length / 2;
    });
    
    console.log('   Test permissions object:', testPermissions);
    
    const saveResponse = await fetch(`${API_BASE}/api/users/${TEST_USER_ID}/permissions`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ permissions: testPermissions }),
    });
    
    if (!saveResponse.ok) throw new Error(`Failed to save permissions: ${saveResponse.statusText}`);
    const saveData = await saveResponse.json();
    console.log('✅ Permissions saved:', saveData.message);

    // Step 3: Reload permissions and verify
    console.log('\n✔️ Step 3: Reloading permissions to verify persistence...');
    const reloadResponse = await fetch(`${API_BASE}/api/users/${TEST_USER_ID}/permissions`);
    if (!reloadResponse.ok) throw new Error(`Failed to reload permissions: ${reloadResponse.statusText}`);
    const reloadedData = await reloadResponse.json();
    
    console.log('   Reloaded permissions:', reloadedData.permissions);

    // Step 4: Validate false values are preserved
    console.log('\n🔍 Step 4: Validating persistence...');
    let falseCountOriginal = 0;
    let falseCountReloaded = 0;
    
    Object.entries(testPermissions).forEach(([key, value]) => {
      if (value === false) falseCountOriginal++;
      if (reloadedData.permissions[key] === false) falseCountReloaded++;
    });

    console.log(`   Original false values: ${falseCountOriginal}`);
    console.log(`   Reloaded false values: ${falseCountReloaded}`);

    if (falseCountOriginal === falseCountReloaded) {
      console.log('✅ ✅ ✅ SUCCESS: All false values persisted correctly!');
      
      // Check for exact match
      const allMatch = Object.entries(testPermissions).every(
        ([key, value]) => reloadedData.permissions[key] === value
      );
      
      if (allMatch) {
        console.log('✅ ✅ ✅ PERFECT: Exact match - all permissions match exactly!');
      } else {
        console.log('⚠️ WARNING: Some permission values do not match');
        Object.entries(testPermissions).forEach(([key, value]) => {
          if (reloadedData.permissions[key] !== value) {
            console.log(`   ${key}: expected ${value}, got ${reloadedData.permissions[key]}`);
          }
        });
      }
    } else {
      console.log('❌ ERROR: False values were not persisted correctly!');
      console.log('   This indicates the persistence bug still exists.');
    }

    // Step 5: Test batch endpoint
    console.log('\n📊 Step 5: Testing batch endpoint /api/users/with-permissions...');
    const batchResponse = await fetch(`${API_BASE}/api/users/with-permissions`);
    if (!batchResponse.ok) throw new Error(`Failed to load batch permissions: ${batchResponse.statusText}`);
    const batchData = await batchResponse.json();
    
    const userInBatch = batchData.find((u) => u.id === TEST_USER_ID);
    if (!userInBatch) {
      console.log('⚠️ Test user not found in batch response');
    } else {
      console.log(`✅ User found in batch response with ${Object.keys(userInBatch.permissions).length} permission keys`);
      
      let batchFalseCount = 0;
      Object.values(userInBatch.permissions).forEach((value) => {
        if (value === false) batchFalseCount++;
      });
      console.log(`   False values in batch: ${batchFalseCount}`);
      
      if (batchFalseCount === falseCountReloaded) {
        console.log('✅ Batch endpoint matches individual endpoint - consistent!');
      } else {
        console.log('⚠️ Batch endpoint differs from individual endpoint');
      }
    }

    console.log('\n✅ Test completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

// Run the test
console.log('⚠️  IMPORTANT: Update TEST_USER_ID before running this script!');
console.log(`   Replace 'user-123' with an actual user ID from your database\n`);

if (TEST_USER_ID === 'user-123') {
  console.log('❌ Please update TEST_USER_ID in the script first!');
  process.exit(1);
}

testPermissionPersistence();
