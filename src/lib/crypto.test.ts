import { encrypt, decrypt, encryptJSON, decryptJSON } from './crypto';

// Minimal test runner since we don't have a full test suite setup yet
async function testCrypto() {
  console.log('Running Crypto Tests...');
  
  try {
    // Test basic string
    const originalText = 'secret-api-key-123';
    const encrypted = encrypt(originalText);
    console.log('Encrypted:', encrypted);
    
    const decrypted = decrypt(encrypted);
    console.log('Decrypted:', decrypted);
    
    if (originalText === decrypted) {
      console.log('✅ String Encryption/Decryption: PASSED');
    } else {
      console.error('❌ String Encryption/Decryption: FAILED');
      process.exit(1);
    }
    
    // Test JSON
    const originalObj = { apiKey: 'key', orgId: 'org', settings: { voice: 'alloy' } };
    const encryptedJson = encryptJSON(originalObj);
    const decryptedJson = decryptJSON(encryptedJson);
    
    if (JSON.stringify(originalObj) === JSON.stringify(decryptedJson)) {
      console.log('✅ JSON Encryption/Decryption: PASSED');
    } else {
      console.error('❌ JSON Encryption/Decryption: FAILED');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('❌ Tests errored:', error);
    process.exit(1);
  }
}

// Check if running directly via node/tsx
if (require.main === module) {
  testCrypto();
}
