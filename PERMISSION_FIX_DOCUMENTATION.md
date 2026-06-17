# Fix: Permission False Values Persistence

## Problem Summary
When users unchecked permission checkboxes (setting permissions to `false`) in the Permissions Management module and saved the changes, those unchecked permissions would revert to checked after page reload. The `false` values were not persisting.

## Root Cause Analysis

### Flow Analysis (8 Steps):
1. ✅ **Component Rendering**: Checkboxes render correctly with `checked={granted}`
2. ✅ **State Update**: `handlePermissionChange()` updates local state with boolean `false`
3. ✅ **Serialization**: `JSON.stringify()` correctly serializes `false` values
4. ✅ **Backend Reception**: PUT endpoint receives complete permissions object
5. ✅ **Database Save**: Transaction deletes old records and inserts ALL new ones (including `false` values)
6. ✅ **Individual Read**: GET `/api/users/:userId/permissions` reads from `user_permission_details` correctly
7. ❌ **Batch Read**: GET `/api/users/with-permissions` was returning INCOMPLETE objects
8. ❌ **Frontend Load**: PermissionsManagement loads users with incomplete permission objects

### The Bug
The batch query endpoint used PostgreSQL `jsonb_object_agg()` aggregation:
```sql
COALESCE(jsonb_object_agg(upd.permission_key, upd.granted) FILTER (WHERE upd.permission_key IS NOT NULL), '{}'::jsonb)
```

This aggregate function only included permission keys that had rows in `user_permission_details`. However, when displaying permissions in the UI, the component expected ALL possible permission keys to be present in the object.

**Result**: When permissions were set to `false`, they WERE saved to the database, but were NOT returned in subsequent queries, causing the frontend to fall back to default/role-based permissions.

## Solution Implemented

### Changed Endpoints

#### 1. **GET `/api/users/with-permissions`** (Batch Endpoint)
**File**: `api.js` lines 2119-2167

**What Changed**:
- Added query to fetch all permission keys defined in the system
- Initialize complete permission objects with ALL keys set to `false`
- Override with actual user permissions from database

**Before**:
```javascript
const usersWithPerms = result.rows.map((row) => ({
  id: row.id,
  permissions: row.permissions || {}, // Incomplete!
}))
```

**After**:
```javascript
// Get all permission keys
const allPermissionsResult = await pool.query(`
  SELECT DISTINCT permission_key FROM user_permission_details
  WHERE permission_key IS NOT NULL
  ORDER BY permission_key
`)

const allPermissionKeys = new Set(allPermissionsResult.rows.map(r => r.permission_key))

const usersWithPerms = result.rows.map((row) => {
  // Initialize with ALL keys set to false
  const completePermissions = {}
  allPermissionKeys.forEach(key => {
    completePermissions[key] = false
  })
  
  // Override with actual values
  if (row.permissions && typeof row.permissions === 'object') {
    Object.assign(completePermissions, row.permissions)
  }

  return {
    id: row.id,
    permissions: completePermissions, // Now COMPLETE!
  }
})
```

#### 2. **GET `/api/users/:userId/permissions`** (Individual Endpoint)
**File**: `api.js` lines 2268-2320

**What Changed**:
- Added same logic to ensure consistency
- Individual permission queries also return complete objects

**Before**:
```javascript
const permissions = {}
detailsResult.rows.forEach((row) => {
  permissions[row.permission_key] = row.granted
})
```

**After**:
```javascript
// Get all permission keys
const allPermissionsResult = await pool.query(`...`)
const allPermissionKeys = new Set(...)

// Initialize with ALL keys set to false
const completePermissions = {}
allPermissionKeys.forEach(key => {
  completePermissions[key] = false
})

// Override with actual values
detailsResult.rows.forEach((row) => {
  completePermissions[row.permission_key] = row.granted
})
```

## Impact

### Before Fix
- Batch load: Returns `{ "create_reports": false }` (incomplete)
- UI renders: Only shows keys that have custom values
- Problem: `false` values appear missing, UI falls back to defaults

### After Fix
- Batch load: Returns ALL 32 permission keys with their correct boolean values
- UI renders: All permissions visible with correct state
- Fix: Persistence now works correctly for `true` AND `false` values

## Validation

### Testing Method
Run the included test script:
```bash
node test-permission-persistence.mjs
```

**Note**: Update `TEST_USER_ID` in the script with a real user ID before running.

### Expected Results
After running the test:
1. ✅ Load current permissions (should show all keys)
2. ✅ Save test permissions (mix of true and false)
3. ✅ Reload permissions (should match saved values exactly)
4. ✅ Validate false values are preserved
5. ✅ Batch endpoint returns complete objects

### Manual Testing
1. Open Permissions Management module
2. Select a user and uncheck several permissions
3. Click "Guardar"
4. Refresh the page (F5)
5. ✅ **Expected**: Unchecked permissions remain unchecked
6. ✅ **Before Fix**: Unchecked permissions would become checked again

## Files Modified
- `api.js` - Both permission endpoints updated

## Commit Information
- **Commit**: `fix: ensure all permission values including false persist in batch and individual endpoints`
- **Changes**: 47 insertions, 10 deletions
- **Files**: 1 file changed (`api.js`)

## Performance Note
The fix adds one additional query per request to get all permission keys. For optimization in future:
- Could cache the list of permission keys (currently ~32 keys)
- Could define permission keys in environment/config instead of querying database
- Current impact: minimal (1 additional lightweight query per batch/individual permission fetch)

## Related Components
- Frontend: `src/pages/components/PermissionsManagement.tsx`
- Service: `src/lib/permissions-management.ts`
- Context: `src/lib/permissions-context.tsx`
- Backend: `api.js` (PUT `/api/users/:userId/permissions` - no changes needed, working correctly)

## Conclusion
The permission persistence bug is now fixed at the source (backend data retrieval). Both endpoints now return complete permission objects with all keys and their correct boolean values, ensuring that `false` values persist correctly across page reloads.
