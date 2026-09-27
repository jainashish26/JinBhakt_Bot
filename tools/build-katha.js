#!/usr/bin/env node
/**
 * build-katha.js — Extract 116 stories from content/text/granth/110.json
 * into individual story files and a category manifest.
 *
 * Source: content/text/granth/110.json  (the "आराधना कथा कोश" granth page)
 * Output: content/katha.json           (116-entry category manifest)
 *         content/text/katha/N.json    (N = 1..114, stories with body text)
 *
 * The 116 stories are delimited by marker lines: + <title> -
 *
 * Each block:
 *   line 0: "+ <title> -"        (marker)
 *   line 1: <title>              (repeated, sometimes with typos — ignored)
 *   line 2: "कथा :" or "था :"   (label)
 *   line 3+: story body
 *
 * Stories 115 and 116 have no body text → hasContent:false.
 *
 * Usage:  node tools/build-katha.js
 */
'use strict';

var path = require('path');
var fs = require('fs');

var ROOT = path.join(__dirname, '..');
var SOURCE = path.join(ROOT, 'content', 'text', 'granth', '110.json');
var OUT_DIR = path.join(ROOT, 'content', 'text', 'katha');
var MANIFEST = path.join(ROOT, 'content', 'katha.json');
var T = require(path.join(ROOT, 'js', 'translit.js'));

/* --------------------------------------------------------------- */
/* Parse the source. */

var raw = fs.readFileSync(SOURCE, 'utf8');
var data = JSON.parse(raw);
var hCont = data.hCont;
if (typeof hCont !== 'string' || hCont.length < 1000) {
  throw new Error('Source hCont missing or too short.');
}

var lines = hCont.split('\n');
var markers = [];
for (var i = 0; i < lines.length; i++) {
  if (/^\s*\+/.test(lines[i])) markers.push(i);
}
if (markers.length !== 116) {
  throw new Error('Expected 116 markers, found ' + markers.length);
}

console.log('Front matter: ' + markers[0] + ' lines before first story.');

/* --------------------------------------------------------------- */
/* Helpers. */

function extractTitle(markerLine) {
  return markerLine.trim().replace(/^\+\s*/, '').replace(/\s*-\s*$/, '').trim();
}

function pad3(n) { var s = String(n); while (s.length < 3) s = '0' + s; return s; }

function makeId(num, title) {
  return pad3(num) + '-' + title.replace(/\s+/g, '-');
}

/* --------------------------------------------------------------- */
/* Extract stories. */

var stories = [];
var anomalies = [];
var idSet = {};

for (var b = 0; b < 116; b++) {
  var start = markers[b];
  var end = (b + 1 < 116) ? markers[b + 1] : lines.length;
  var blockLines = lines.slice(start, end);
  var num = b + 1;

  var title = extractTitle(blockLines[0]);
  if (!title || title.length < 2) {
    throw new Error('Story ' + num + ': empty title');
  }
  if (title.indexOf('/') >= 0) {
    throw new Error('Story ' + num + ': title contains "/"');
  }

  var labelLine = (blockLines[2] || '').trim();
  if (labelLine !== 'कथा :' && labelLine !== 'था :') {
    anomalies.push('Story ' + num + ': label "' + labelLine + '"');
  }

  var body = blockLines.slice(3).join('\n').trim();
  var hasContent = body.length > 60;
  var id = makeId(num, title);

  if (idSet[id]) throw new Error('Story ' + num + ': duplicate _id "' + id + '"');
  idSet[id] = true;

  stories.push({
    num: num, id: id, title: title,
    eName: T.display(title).toLowerCase(),
    body: body, hasContent: hasContent
  });
}

/* --------------------------------------------------------------- */
/* Report. */

var readable = stories.filter(function(s) { return s.hasContent; }).length;
console.log('\nExtracted ' + stories.length + ' stories.');
console.log('  Readable:  ' + readable);
console.log('  Stubs:     ' + (stories.length - readable));
if (anomalies.length) {
  console.log('\nAnomalies (non-fatal):');
  anomalies.forEach(function(a) { console.log('  ' + a); });
}

/* --------------------------------------------------------------- */
/* Write output. */

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

var manifest = [];
stories.forEach(function(story, idx) {
  var prevId = idx > 0 ? stories[idx - 1].id : 'TBC#';
  var nextId = idx < stories.length - 1 ? stories[idx + 1].id : 'TBC#';

  manifest.push({
    _id: story.id,
    _index: idx,
    eBrief: 'A story from the Aradhana Katha Kosh: ' + story.title,
    eCtg: 'Katha',
    eName: story.eName,
    eNext: nextId,
    ePrev: prevId,
    hAuth: 'TBC#',
    hCtg: 'कथा-कोश',
    hName: story.title,
    sub: 'आराधना कथा कोश',
    isActive: true,
    cref: story.num,
    hasContent: story.hasContent
  });

  if (story.hasContent) {
    var bodyJson = JSON.stringify({ hCont: story.body });
    fs.writeFileSync(path.join(OUT_DIR, story.num + '.json'), bodyJson, 'utf8');
  }
});

var manifestJson = JSON.stringify(manifest, null, 1);
fs.writeFileSync(MANIFEST, manifestJson, 'utf8');

console.log('\nWrote:');
console.log('  ' + MANIFEST);
console.log('  ' + OUT_DIR + path.sep + '1.json … ' + readable + '.json');

/* --------------------------------------------------------------- */
/* Self-assertions. */

var ids = manifest.map(function(m) { return m._id; });
var uniqueIds = ids.filter(function(v, i) { return ids.indexOf(v) === i; });
var granthOk = fs.existsSync(path.join(ROOT, 'content', 'text', 'granth', '110.json'));

console.log('\nSelf-check:');
console.log('  Stories:        ' + manifest.length + (manifest.length === 116 ? ' ✓' : ' ✗'));
console.log('  Unique _ids:    ' + uniqueIds.length + (uniqueIds.length === 116 ? ' ✓' : ' ✗'));
console.log('  Granth intact:  ' + (granthOk ? '✓' : '✗'));

if (manifest.length !== 116 || uniqueIds.length !== 116) {
  console.error('\nFATAL: assertion failed.');
  process.exit(1);
}

console.log('\nDone. Catalogue: +116 items, +' + readable + ' readable.');