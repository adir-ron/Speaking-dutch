const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
const mammoth = require('mammoth');
const fs = require('fs');

async function extractPDFStructured(filepath) {
  const buf = new Uint8Array(fs.readFileSync(filepath));
  const doc = await pdfjsLib.getDocument({data: buf}).promise;
  const allItems = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    content.items.forEach(item => {
      if (item.str.trim()) {
        allItems.push({ str: item.str, x: Math.round(item.transform[4]), y: Math.round(item.transform[5]), page: i });
      }
    });
  }
  return allItems;
}

async function parseListA(filepath) {
  const buf = new Uint8Array(fs.readFileSync(filepath));
  const doc = await pdfjsLib.getDocument({data: buf}).promise;
  let text = '';
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    text += content.items.map(item => item.str).join(' ') + '\n';
  }
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
        let pos = '', meaning = '';
        const he = parts.slice(hebrewIdx).join(' , ');
        if (hebrewIdx >= 3) { pos = parts[1]; meaning = parts.slice(2, hebrewIdx).join(' '); }
        else if (hebrewIdx >= 2) { pos = parts[1]; }
        if (en && he && !/Band|Word|Definition|Translation/.test(en)) {
          words.push({ en: en.trim(), pos: pos.trim(), he: he.trim(), meaning: meaning.trim() });
        }
      }
    }
  }
  return words;
}

async function parseListC(filepath) {
  const items = await extractPDFStructured(filepath);
  // Sort items top-to-bottom (descending y), left-to-right
  items.sort((a, b) => {
    if (a.page !== b.page) return a.page - b.page;
    if (Math.abs(a.y - b.y) > 3) return b.y - a.y; // top to bottom
    return a.x - b.x;
  });

  // Group items into entries by detecting "N." pattern at x < 80
  const entries = [];
  let current = null;
  for (const item of items) {
    if (/^\d+\.$/.test(item.str.trim()) && item.x < 80) {
      if (current) entries.push(current);
      current = { items: [] };
    } else if (current) {
      current.items.push(item);
    }
  }
  if (current) entries.push(current);

  const words = [];
  for (const entry of entries) {
    const wordParts = entry.items.filter(r => r.x < 195 && !/BAND|LIST|Word|Phrase/.test(r.str));
    const posParts = entry.items.filter(r => r.x >= 195 && r.x < 228);
    const meaningParts = entry.items.filter(r => r.x >= 228 && r.x < 440 && !/[\u0590-\u05FF]/.test(r.str));
    const hebrewParts = entry.items.filter(r => /[\u0590-\u05FF]/.test(r.str));

    const en = wordParts.map(r => r.str.trim()).join(' ').replace(/\s+/g, ' ').trim();
    const he = hebrewParts.map(r => r.str.trim()).filter(s => s !== ',').join(', ').trim();
    const pos = posParts.map(r => r.str.trim()).join(' ').replace(/[,\s]+/g, ', ').trim();
    const meaning = meaningParts.map(r => r.str.trim()).join(' ').replace(/\s+/g, ' ').trim();

    if (en && he) {
      words.push({ en, pos, he, meaning });
    }
  }
  return words;
}

async function parseListD(filepath) {
  const result = await mammoth.convertToHtml({path: filepath});
  const html = result.value;
  const trs = html.match(/<tr>[\s\S]*?<\/tr>/g);
  const words = [];
  if (trs) {
    trs.forEach(r => {
      const cells = r.match(/<td>[\s\S]*?<\/td>/g);
      if (cells) {
        const texts = cells.map(c => c.replace(/<[^>]+>/g, '').trim());
        if (texts[0] && texts[0] !== 'Expression/word' && texts[2]) {
          words.push({en: texts[0], pos: texts[1] || '', he: texts[2], meaning: texts[3] || ''});
        }
      }
    });
  }
  return words;
}

async function main() {
  const listA = await parseListA('G:/My Drive/claude/vocabulary/words-list/BAND 3 LIST A 2024-2025 (1).pdf');
  const listC = await parseListC('G:/My Drive/claude/vocabulary/words-list/BAND III-List C-2024-2025_01 (1).pdf');
  const listD = await parseListD('G:/My Drive/claude/vocabulary/words-list/Band III-List D (1).docx');
  console.log('List A:', listA.length, 'words');
  console.log('List C:', listC.length, 'words');
  console.log('List D:', listD.length, 'words');
  console.log('\nSample A:', JSON.stringify(listA.slice(0,2)));
  console.log('Sample C:', JSON.stringify(listC.slice(0,2)));
  console.log('Sample D:', JSON.stringify(listD.slice(0,2)));
  fs.writeFileSync('words_data.json', JSON.stringify({ listA, listC, listD }, null, 2));
  console.log('\nSaved to words_data.json');
}
main().catch(console.error);
