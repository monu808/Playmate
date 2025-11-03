/**
 * One-time script to verify all existing turfs in the database
 * Run this to migrate existing turfs to the new verification system
 */

import { collection, getDocs, updateDoc, doc } from 'firebase/firestore';
import { db } from '../config/firebase';

async function verifyAllExistingTurfs() {
  try {
    console.log('🔄 Starting turf verification migration...');
    
    // Get all turfs
    const turfsCol = collection(db, 'turfs');
    const snapshot = await getDocs(turfsCol);
    
    console.log(`📊 Found ${snapshot.size} turfs in database`);
    
    let updated = 0;
    let alreadyVerified = 0;
    let errors = 0;
    
    // Update each turf
    for (const turfDoc of snapshot.docs) {
      try {
        const data = turfDoc.data();
        
        // Check if already verified
        if (data.isVerified === true) {
          alreadyVerified++;
          console.log(`✓ ${turfDoc.id} (${data.name}) - Already verified`);
          continue;
        }
        
        // Update to verified
        await updateDoc(doc(db, 'turfs', turfDoc.id), {
          isVerified: true,
          isActive: data.isActive !== undefined ? data.isActive : true,
          verifiedAt: new Date(),
        });
        
        updated++;
        console.log(`✅ ${turfDoc.id} (${data.name}) - Verified successfully`);
        
      } catch (error) {
        errors++;
        console.error(`❌ Error updating ${turfDoc.id}:`, error);
      }
    }
    
    console.log('\n📈 Migration Summary:');
    console.log(`   Total turfs: ${snapshot.size}`);
    console.log(`   ✅ Newly verified: ${updated}`);
    console.log(`   ✓ Already verified: ${alreadyVerified}`);
    console.log(`   ❌ Errors: ${errors}`);
    console.log('\n✨ Migration complete!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
  }
}

// Export for use
export { verifyAllExistingTurfs };
