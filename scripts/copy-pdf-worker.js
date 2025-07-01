const fs = require('fs');
const path = require('path');

// Create public directory if it doesn't exist
const publicDir = path.join(__dirname, '..', 'public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir);
}

// Copy PDF.js worker file
const workerSource = path.join(__dirname, '..', 'node_modules', 'pdfjs-dist', 'build', 'pdf.worker.mjs');
const workerDest = path.join(publicDir, 'pdf.worker.js');

fs.copyFileSync(workerSource, workerDest);
console.log('PDF.js worker file copied to public directory'); 