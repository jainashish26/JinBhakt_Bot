#!/usr/bin/env node
/**
 * check-stories-en.js — Validate English story files.
 *
 * Checks:
 * 1. Each hasContent:true entry has a body file in content/text/stories-en/
 * 2. Word count is within budget (soft cap 900, hard cap 1500)
 * 3. Body is valid JSON with hCont key
 * 4. No raw newlines in hCont value (must use HTML tags)
 *
 * Usage: node tools/check-stories-en.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SOFT_CAP = 900;
const HARD_CAP = 1500;

const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'content', 'stories-en.json'), 'utf8'));
const readable = manifest.filter(item => item.hasContent === true);

let errors = 0;
let warnings = 0;

console.log('Validating', readable.length, 'English story files...\n');

readable.forEach(item => {
  const file = path.join(ROOT, 'content', 'text', 'stories-en', item.cref + '.json');

  // Check file exists
  if (!fs.existsSync(file)) {
    console.error('ERROR: Missing file for', item.eName, '(cref=' + item.cref + ')');
    errors++;
    return;
  }

  // Parse JSON
  let data;
  try {
    data = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    console.error('ERROR: Invalid JSON in', file, '-', e.message);
    errors++;
    return;
  }

  // Check hCont key exists
  if (!data.hCont) {
    console.error('ERROR: Missing hCont key in', file);
    errors++;
    return;
  }

  const body = data.hCont;

  // Check no raw newlines
  if (body.indexOf('\n') !== -1 || body.indexOf('\r') !== -1) {
    console.error('ERROR: Raw newlines found in', file, '- use HTML tags instead');
    errors++;
  }

  // Count words (strip HTML tags first)
  const textOnly = body.replace(/<[^>]*>/g, ' ');
  const words = textOnly.split(/\s+/).filter(w => w.length > 0).length;

  if (words > HARD_CAP) {
    console.error('ERROR:', item.eName, 'exceeds hard cap:', words, 'words (max', HARD_CAP + ')');
    errors++;
  } else if (words > SOFT_CAP) {
    console.warn('WARN:', item.eName, 'exceeds soft cap:', words, 'words (soft cap', SOFT_CAP + ')');
    warnings++;
  } else {
    console.log('OK:', item.eName, '-', words, 'words');
  }
});

console.log('\n======================================');
console.log('Checked:', readable.length, 'stories');
console.log('Errors:', errors);
console.log('Warnings:', warnings);
console.log('======================================');

process.exit(errors > 0 ? 1 : 0);
