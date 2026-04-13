const express = require('express');
const multer = require('multer');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
const mammoth = require('mammoth');
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');

const app = express();
app.set('trust proxy', 1); // trust nginx proxy
const PORT = 3099;
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const PUBLIC_DIR = path.join(__dirname, 'public');
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_LISTS = 50;

// --- Security ---

// Helmet with CSP allowing speech APIs
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://www.googletagmanager.com", "https://www.google-analytics.com"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https://www.google-analytics.com", "https://www.googletagmanager.com"],
      connectSrc: ["'self'", "https://www.google-analytics.com", "https://www.googletagmanager.com", "https://*.google-analytics.com", "https://*.analytics.google.com"],
      scriptSrcAttr: ["'unsafe-inline'"],
    }
  }
}));

// Rate limiting: general
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: { error: 'Too many requests, try again later' }
}));

// Stricter rate limit for uploads
const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many uploads, try again later' }
});

// --- File upload config ---
const ALLOWED_MIME = [
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
];
const ALLOWED_EXT = ['.docx'];

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    // Sanitize filename: only allow alphanumeric, dash, underscore, dot
    const sanitized = file.originalname
      .replace(/[^a-zA-Z0-9\u0590-\u05FF._\- ]/g, '')
      .replace(/\s+/g, '_')
      .substring(0, 100);
    const unique = Date.now() + '_' + sanitized;
    cb(null, unique);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE, files: 1 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_EXT.includes(ext)) {
      return cb(new Error('Only .docx files are allowed'));
    }
    if (!ALLOWED_MIME.includes(file.mimetype)) {
      return cb(new Error('Invalid file type'));
    }
    cb(null, true);
  }
});

// --- Word parsing ---

async function parsePDF(filepath) {
  const buf = new Uint8Array(fs.readFileSync(filepath));
  const doc = await pdfjsLib.getDocument({ data: buf }).promise;
  const allItems = [];

  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    content.items.forEach(item => {
      if (item.str.trim()) {
        allItems.push({
          str: item.str,
          x: Math.round(item.transform[4]),
          y: Math.round(item.transform[5]),
          page: i
        });
      }
    });
  }

  allItems.sort((a, b) => {
    if (a.page !== b.page) return a.page - b.page;
    if (Math.abs(a.y - b.y) > 3) return b.y - a.y;
    return a.x - b.x;
  });

  // Try structured parsing (numbered entries)
  const entries = [];
  let current = null;
  for (const item of allItems) {
    if (/^\d+\.$/.test(item.str.trim()) && item.x < 100) {
      if (current) entries.push(current);
      current = { items: [] };
    } else if (current) {
      current.items.push(item);
    }
  }
  if (current) entries.push(current);

  if (entries.length > 5) {
    return parseStructuredPDF(entries);
  }

  // Fallback: split by numbered entries in text
  return parseTextPDF(allItems);
}

function parseStructuredPDF(entries) {
  const words = [];
  for (const entry of entries) {
    const wordParts = entry.items.filter(r => r.x < 195 && !/BAND|LIST|Word|Phrase/i.test(r.str));
    const hebrewParts = entry.items.filter(r => /[\u0590-\u05FF]/.test(r.str));
    const meaningParts = entry.items.filter(r => r.x >= 228 && r.x < 460 && !/[\u0590-\u05FF]/.test(r.str));

    const en = wordParts.map(r => r.str.trim()).join(' ').replace(/\s+/g, ' ').trim();
    const he = hebrewParts.map(r => r.str.trim()).filter(s => s !== ',').join(', ').trim();
    const meaning = meaningParts.map(r => r.str.trim()).join(' ').replace(/\s+/g, ' ').trim();

    if (en && he) {
      words.push({ en, he, meaning });
    }
  }
  return words;
}

function parseTextPDF(allItems) {
  const text = allItems.map(i => i.str).join(' ');
  const words = [];
  const entries = text.split(/(?:^|\s)(\d+)\s{3,}/);
  for (let i = 1; i < entries.length; i += 2) {
    const content = entries[i + 1]?.trim();
    if (!content) continue;
    const parts = content.split(/\s{2,}/);
    if (parts.length >= 3) {
      const hebrewIdx = parts.findIndex(p => /[\u0590-\u05FF]/.test(p));
      if (hebrewIdx >= 0) {
        const en = parts[0];
        const he = parts.slice(hebrewIdx).join(' , ');
        const meaning = hebrewIdx >= 3 ? parts.slice(2, hebrewIdx).join(' ') : '';
        if (en && he && !/Band|Word|Definition|Translation/i.test(en)) {
          words.push({ en: en.trim(), he: he.trim(), meaning: meaning.trim() });
        }
      }
    }
  }
  return words;
}

async function parseDOCX(filepath) {
  const result = await mammoth.convertToHtml({ path: filepath });
  const html = result.value;
  const words = [];

  // Try table format first
  const trs = html.match(/<tr>[\s\S]*?<\/tr>/g);
  if (trs && trs.length > 2) {
    for (const r of trs) {
      const cells = r.match(/<td>[\s\S]*?<\/td>/g);
      if (!cells) continue;
      const texts = cells.map(c => c.replace(/<[^>]+>/g, '').trim());
      // Find english and hebrew columns
      const heCol = texts.findIndex(t => /[\u0590-\u05FF]/.test(t));
      if (heCol > 0 && texts[0] && !/Expression|word|Word/i.test(texts[0])) {
        words.push({
          en: texts[0],
          he: texts[heCol],
          meaning: heCol >= 2 ? texts.slice(1, heCol).join(' ') : ''
        });
      }
    }
  }

  // Fallback: line-by-line
  if (words.length === 0) {
    const rawResult = await mammoth.extractRawText({ path: filepath });
    const lines = rawResult.value.split('\n').filter(l => l.trim());
    for (const line of lines) {
      const parts = line.split(/\t+|\s{3,}/);
      if (parts.length >= 2) {
        const heIdx = parts.findIndex(p => /[\u0590-\u05FF]/.test(p));
        if (heIdx > 0) {
          words.push({
            en: parts[0].trim(),
            he: parts[heIdx].trim(),
            meaning: heIdx >= 2 ? parts.slice(1, heIdx).join(' ').trim() : ''
          });
        }
      }
    }
  }

  return words;
}

// --- Sanitize extracted words (XSS prevention) ---
function sanitizeText(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .substring(0, 500);
}

function sanitizeWords(words) {
  return words.map(w => ({
    en: sanitizeText(w.en),
    he: sanitizeText(w.he),
    meaning: sanitizeText(w.meaning || '')
  }));
}

// --- List metadata ---
function getListsIndex() {
  const indexPath = path.join(UPLOADS_DIR, 'lists.json');
  if (fs.existsSync(indexPath)) {
    return JSON.parse(fs.readFileSync(indexPath, 'utf8'));
  }
  return [];
}

function saveListsIndex(lists) {
  fs.writeFileSync(path.join(UPLOADS_DIR, 'lists.json'), JSON.stringify(lists, null, 2));
}

// --- Routes ---

app.use(express.static(PUBLIC_DIR));

// Get all available lists (built-in + uploaded)
app.get('/api/lists', (req, res) => {
  const uploaded = getListsIndex();
  res.json({ uploaded });
});

// Get words for an uploaded list
app.get('/api/lists/:id', (req, res) => {
  const id = req.params.id.replace(/[^a-zA-Z0-9_\-]/g, '');
  const wordsPath = path.join(UPLOADS_DIR, id + '.json');
  if (!fs.existsSync(wordsPath)) {
    return res.status(404).json({ error: 'List not found' });
  }
  const words = JSON.parse(fs.readFileSync(wordsPath, 'utf8'));
  res.json({ words });
});

// Upload a new word list
app.post('/api/upload', uploadLimiter, (req, res) => {
  // Check total lists limit
  const lists = getListsIndex();
  if (lists.length >= MAX_LISTS) {
    return res.status(400).json({ error: `Maximum ${MAX_LISTS} uploaded lists reached. Delete some first.` });
  }

  upload.single('file')(req, res, async (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ error: 'File too large. Maximum 5MB.' });
        }
        return res.status(400).json({ error: err.message });
      }
      return res.status(400).json({ error: err.message });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const listName = (req.body.name || req.file.originalname)
      .replace(/\.[^.]+$/, '')
      .replace(/[<>"'&]/g, '')
      .substring(0, 100)
      .trim();

    try {
      const ext = path.extname(req.file.originalname).toLowerCase();
      let words;

      if (ext === '.pdf') {
        words = await parsePDF(req.file.path);
      } else if (ext === '.docx') {
        words = await parseDOCX(req.file.path);
      }

      // Delete the uploaded file after parsing
      fs.unlinkSync(req.file.path);

      if (!words || words.length === 0) {
        return res.status(400).json({ error: 'Could not extract any words from this file. Make sure it contains English words with Hebrew translations.' });
      }

      // Validate: at least some entries have hebrew
      const withHebrew = words.filter(w => /[\u0590-\u05FF]/.test(w.he));
      if (withHebrew.length === 0) {
        return res.status(400).json({ error: 'No Hebrew translations found in the file.' });
      }

      words = sanitizeWords(withHebrew);

      // Save parsed words
      const id = Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 8);
      fs.writeFileSync(path.join(UPLOADS_DIR, id + '.json'), JSON.stringify(words));

      // Update index
      const lists = getListsIndex();
      lists.push({ id, name: listName, count: words.length, date: new Date().toISOString() });
      saveListsIndex(lists);

      res.json({ success: true, id, name: listName, count: words.length });
    } catch (e) {
      // Clean up uploaded file on error
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      console.error('Parse error:', e);
      res.status(500).json({ error: 'Failed to parse file' });
    }
  });
});

// Delete an uploaded list
app.delete('/api/lists/:id', (req, res) => {
  const id = req.params.id.replace(/[^a-zA-Z0-9_\-]/g, '');
  const wordsPath = path.join(UPLOADS_DIR, id + '.json');

  if (fs.existsSync(wordsPath)) {
    fs.unlinkSync(wordsPath);
  }

  const lists = getListsIndex().filter(l => l.id !== id);
  saveListsIndex(lists);

  res.json({ success: true });
});

app.listen(PORT, '127.0.0.1', () => {
  console.log(`Vocabulary server running on port ${PORT}`);
});
