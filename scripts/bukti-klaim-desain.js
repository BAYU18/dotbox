/* ===================================
   VERIFIKASI KLAIM DESAIN (Architect, revisi 3)

   Memeriksa setiap klaim `berkas:baris` di
   `docs/superpowers/specs/2026-10-10-eksekusi-r3-final-design.md` §2
   terhadap kode nyata, lalu menjalankan `node --test` apa adanya.

   Gunanya: desain menyebut banyak `berkas:baris`; begitu developer
   menyunting `script.js`, nomor-nomor itu bergeser dan pembaca
   berikutnya tersesat. Skrip ini alarm untuk itu.

   Pakai:  node scripts/bukti-klaim-desain.js
   Keluar: 0 bila semua klaim cocok DAN suite exit=0; 1 bila tidak.

   Tanpa dependensi; pola mengikuti scripts/bukti-eksekusi.js.

   CATATAN PEMBERSIHAN: langkah desain ini juga secara tidak sengaja
   meninggalkan `scripts/run-tests-verify.js` (stub sisa, tanpa kode
   produksi). Hapus dengan:  rm scripts/run-tests-verify.js
   =================================== */

'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const baca = (berkas) => fs.readFileSync(path.join(ROOT, berkas), 'utf8');
const baris = (berkas, n) => baca(berkas).split('\n')[n - 1] || '';

let lolos = 0;
let gagal = 0;

function klaim(nama, syarat) {
    if (syarat) { console.log(`  [COCOK]   ${nama}`); lolos++; }
    else { console.log(`  [MELESET] ${nama}`); gagal++; }
}

const script = baca('script.js');
const index = baca('index.html');
const testP0 = baca('test/proposal-p0-p6.test.js');

console.log('=== 1. P0 BELUM — giliran AI menggantung ===');
klaim('script.js:756 = `if (!move) return;`',
    baris('script.js', 756).includes('if (!move) return;'));

console.log('\n=== 2. P6 BELUM — Box masih menulis edges ===');
klaim('script.js:152-157 menulis `edges:` di init Box',
    script.split('\n').slice(151, 157).join('\n').includes('edges:'));

console.log('\n=== 3. P2-sisa BELUM — tanpa parameter `alasan` ===');
klaim('`function buatKandidatState(saveData) {`',
    script.includes('function buatKandidatState(saveData) {'));
const mulai = script.indexOf('function buatKandidatState');
const blok = script.slice(mulai, script.indexOf('\n}', mulai) + 2);
console.log(`  [INFO]    'return null;' telanjang = ${(blok.match(/return null;/g) || []).length}`);

console.log('\n=== 4. P3 BELUM — zoom terkunci & aria-label kosong ===');
klaim('index.html masih memuat `user-scalable=no`', index.includes('user-scalable=no'));
const aria = (index.match(/aria-label/g) || []).length;
klaim(`aria-label di index.html = 0 (nyatanya ${aria})`, aria === 0);

console.log('\n=== 5. P5 BELUM — tidak ada DPR ===');
const dpr = (script.match(/devicePixelRatio/g) || []).length;
klaim(`devicePixelRatio di script.js = 0 (nyatanya ${dpr})`, dpr === 0);

console.log('\n=== 6. P4 BELUM — saveGame() di dalam makeMove ===');
klaim('script.js:585 = `saveGame();`', baris('script.js', 585).includes('saveGame();'));

console.log('\n=== 7. P1/P2 SUDAH terpasang ===');
klaim('`SCHEMA_VERSION = 1` ada', script.includes('SCHEMA_VERSION = 1'));
klaim('`turnQueue.schedule(executeAIMove` ada', script.includes('turnQueue.schedule(executeAIMove'));
klaim('index.html memuat turn-queue.js', index.includes('turn-queue.js'));

console.log('\n=== 8. Test P0 — bentuk sadapan ===');
klaim('ada bentuk benar `aiEngine.getBestMove = function`',
    testP0.includes('aiEngine.getBestMove = function'));
klaim('P0-b (:199) mengukur lewat makeMove (dasar pencabutan penahan p0t)',
    baris('test/proposal-p0-p6.test.js', 199).includes('makeMove'));

console.log('\n=== 9. Suite: `node --test` apa adanya ===');
let keluaran = '';
let kode = 0;
try {
    keluaran = execFileSync('node', ['--test'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 26 });
} catch (e) {
    keluaran = (e.stdout || '') + (e.stderr || '');
    kode = e.status == null ? 1 : e.status;
}
const ringkas = keluaran.split('\n')
    .filter((l) => /^# (tests|pass|fail)/.test(l))
    .join(' | ');
console.log(`  [INFO]    ${ringkas || '(ringkasan tidak terbaca)'}`);
console.log(`  [INFO]    exit=${kode}`);

console.log('\n=== RINGKASAN ===');
console.log(`cocok: ${lolos} | meleset: ${gagal} | suite exit=${kode}`);
if (gagal > 0) {
    console.log('ADA KLAIM DESAIN MELESET — koreksi nomor baris di spec revisi 3.');
    process.exit(1);
}
console.log('Semua klaim baris desain revisi 3 cocok dengan kode.');
process.exit(kode === 0 ? 0 : 1);
