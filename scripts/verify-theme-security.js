import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('====================================================');
console.log('🔒 SPECTRAX Security Test Layer: Theme Sanitizer');
console.log('====================================================\n');

try {
  const contextPath = path.resolve(__dirname, '../src/context/ThemeContext.tsx');
  if (!fs.existsSync(contextPath)) {
    throw new Error(`ThemeContext.tsx not found at: ${contextPath}`);
  }

  const sourceCode = fs.readFileSync(contextPath, 'utf8');

  // 1. Verify presence of VALID_THEMES declaration in source
  console.log('🔍 Step 1: Checking VALID_THEMES declaration...');
  const themesMatch = sourceCode.match(/const VALID_THEMES.*=.*\[([\s\S]*?)\];/);
  if (!themesMatch) {
    throw new Error('FAIL: VALID_THEMES declaration not found in ThemeContext.tsx');
  }
  
  const validThemes = themesMatch[1]
    .split(',')
    .map(t => t.replace(/['\"\s]/g, ''))
    .filter(Boolean);
  
  console.log(`✅ SUCCESS: Found valid themes list in source: ${JSON.stringify(validThemes)}\n`);

  // 2. Extract and dynamically compile sanitizeTheme function body for testing
  console.log('🔍 Step 2: Compiling sanitizeTheme function dynamically from source...');
  const functionMatch = sourceCode.match(/function sanitizeTheme\([\s\S]*?\{([\s\S]*?)\n\}/);
  if (!functionMatch) {
    throw new Error('FAIL: Could not extract sanitizeTheme function body from ThemeContext.tsx');
  }

  // Strip TypeScript castings "as Theme" to make it valid vanilla Javascript for runtime test execution
  const cleanBody = functionMatch[1].replace(/\s+as\s+Theme/g, '');
  
  // Compile the function using new Function
  const testSanitize = new Function('val', 'VALID_THEMES', `
    ${cleanBody}
  `);

  console.log('✅ SUCCESS: sanitizeTheme function successfully compiled from source!\n');

  // Helper wrapper for assertions
  const runSanitize = (val) => {
    return testSanitize(val, validThemes);
  };

  // 3. Run Test Matrix
  console.log('🧪 Step 3: Running security assertion matrix...');
  let passed = 0;
  let failed = 0;

  const assertEqual = (input, expected, description) => {
    try {
      const result = runSanitize(input);
      if (result === expected) {
        console.log(`   ✔️ PASS: [${description}] -> Input: "${input}" yielded secure output: "${result}"`);
        passed++;
      } else {
        console.error(`   ❌ FAIL: [${description}] -> Input: "${input}" expected: "${expected}" but got: "${result}"`);
        failed++;
      }
    } catch (err) {
      console.error(`   ❌ FAIL: [${description}] -> Input: "${input}" threw error: ${err.message}`);
      failed++;
    }
  };

  // Legitimate cases
  assertEqual('cyber-dark', 'cyber-dark', 'Accept valid Cyber Dark theme');
  assertEqual('retro', 'retro', 'Accept valid Retro theme');
  assertEqual('light', 'light', 'Accept valid Light theme');

  // Backwards compatibility migration check
  assertEqual('dark', 'cyber-dark', 'Map legacy "dark" theme to new "cyber-dark"');

  // Injection and malformed payloads (must safely fallback to cyber-dark)
  assertEqual('', 'cyber-dark', 'Fallback for empty string');
  assertEqual(null, 'cyber-dark', 'Fallback for null');
  assertEqual(undefined, 'cyber-dark', 'Fallback for undefined');
  assertEqual('invalid-theme', 'cyber-dark', 'Fallback for invalid theme string');
  assertEqual('<script>alert("xss")</script>', 'cyber-dark', 'XSS tags sanitized');
  assertEqual('cyber-dark" onclick="alert(1)', 'cyber-dark', 'Attribute breakout payloads sanitized');
  assertEqual('../../etc/passwd', 'cyber-dark', 'Path traversal inputs blocked');
  assertEqual('body { background: red; }', 'cyber-dark', 'CSS Injection payloads blocked');
  assertEqual('system', 'cyber-dark', 'Fallback for system identifier');

  console.log('\n====================================================');
  console.log(`📊 Test Results: ${passed} passed, ${failed} failed`);
  
  if (failed > 0) {
    console.error('🚨 SECURITY VULNERABILITY DETECTED! Sanitizer is insecure.');
    process.exit(1);
  } else {
    console.log('🛡️ All security assertions PASSED. Theme layer is highly secure.');
    console.log('====================================================');
  }

} catch (err) {
  console.error(`\n🚨 Test runner crashed: ${err.message}`);
  process.exit(1);
}
