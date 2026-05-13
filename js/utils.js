/**
 * utils.js — 工具函数
 * ShortDrama Studio
 * v2.0 支持10万字级剧本解析 + DOCX/PDF 解析 + GBK编码检测
 */

const Utils = {
  uid() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 6);
  },

  formatDate(date) {
    const d = date || new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  },

  debounce(fn, delay = 300) {
    let timer;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  },

  deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  },

  estimateDuration(text) {
    if (!text) return 0;
    const cn = (text.match(/[\u4e00-\u9fff]/g) || []).length;
    const en = text.replace(/[\u4e00-\u9fff]/g, '').split(/\s+/).filter(Boolean).length;
    return Math.max(cn / 3 + en / 5, 2);
  },

  formatDuration(seconds) {
    const m = Math.floor(seconds / 60);
    const s = Math.round(seconds % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
  },

  getFileType(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    const types = {
      txt: 'text', pdf: 'pdf', docx: 'docx', doc: 'doc',
      png: 'image', jpg: 'image', jpeg: 'image', webp: 'image', gif: 'image',
      mp4: 'video', mov: 'video'
    };
    return types[ext] || 'unknown';
  },

  truncate(text, maxLen = 50) {
    if (!text) return '';
    return text.length > maxLen ? text.slice(0, maxLen) + '...' : text;
  },

  storage: {
    get(key, fallback = null) {
      try {
        const data = localStorage.getItem(`shortdrama_${key}`);
        return data ? JSON.parse(data) : fallback;
      } catch { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem(`shortdrama_${key}`, JSON.stringify(value)); }
      catch (e) { console.warn('Storage write failed:', e); }
    },
    remove(key) { localStorage.removeItem(`shortdrama_${key}`); },
    clear() {
      Object.keys(localStorage).filter(k => k.startsWith('shortdrama_')).forEach(k => localStorage.removeItem(k));
    }
  },

  /**
   * 解析剧本文本（流式逐行扫描，支持10万字级）
   */
  parseScript(text) {
    const entities = [];
    const seen = new Set();
    const lines = text.split('\n');
    const namePattern = /[\u4e00-\u9fa5]{2,4}(?:先生|小姐|医生|博士|老师|老板|太太|女士|同志|同学|局长|经理|主任|教授)?/;
    const scenePattern = /(?:场景|地点|环境)[：:]\s*([^\n，。！？,.:;!?]{2,20})/i;
    const locPattern = /(?:室内|室外|在|于)\s*([\u4e00-\u9fa5]{2,10}(?:房间|室|厅|楼|店|园|场|处|区|馆))/;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      let nameCount = 0;
      let idx = 0;
      while (idx < trimmed.length && nameCount < 2) {
        const match = namePattern.exec(trimmed.slice(idx));
        if (!match) break;
        const name = match[0];
        if (!seen.has(name) && name.length >= 2) { seen.add(name); entities.push({ name, type: 'character' }); }
        nameCount++;
        idx += match.index + match[0].length;
      }

      const sMatch = scenePattern.exec(trimmed);
      if (sMatch && !seen.has(sMatch[1])) {
        seen.add(sMatch[1]);
        if (!entities.some(e => e.name === sMatch[1])) entities.push({ name: sMatch[1], type: 'scene' });
      }

      const lMatch = locPattern.exec(trimmed);
      if (lMatch && !seen.has(lMatch[1])) {
        seen.add(lMatch[1]);
        if (!entities.some(e => e.name === lMatch[1])) entities.push({ name: lMatch[1], type: 'scene' });
      }
    }

    const sceneSegments = this._buildSceneSegments(lines);

    return {
      entities,
      lines: lines.length,
      fullText: text,
      totalLen: text.length,
      sceneSegments,
      segments: sceneSegments.length,
      lineCount: lines.length
    };
  },

  _buildSceneSegments(lines) {
    const segments = [];
    let currentStart = 0, dialogueCount = 0;

    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i].trim();
      if (!trimmed) continue;
      if (trimmed.includes('"') || trimmed.includes('「') || trimmed.includes('"') || trimmed.length > 30) dialogueCount++;
      if ((dialogueCount > 0 && dialogueCount % 5 === 0) ||
          /^[-＝]{3,}$/.test(trimmed) ||
          /^#+\s*(?:第|第?[一二三四五六七八九十\d]+[章节]?)/.test(trimmed)) {
        segments.push({ startLine: currentStart, endLine: i, preview: lines[currentStart] ? lines[currentStart].substring(0, 60) : '' });
        currentStart = i + 1;
        dialogueCount = 0;
      }
    }
    if (currentStart < lines.length)
      segments.push({ startLine: currentStart, endLine: lines.length - 1, preview: lines[currentStart] ? lines[currentStart].substring(0, 60) : '' });

    if (segments.length < 3 && lines.length > 20) {
      segments.length = 0;
      const chunkSize = Math.max(3, Math.floor(lines.length / 10));
      for (let i = 0; i < lines.length; i += chunkSize)
        segments.push({ startLine: i, endLine: Math.min(i + chunkSize - 1, lines.length - 1), preview: lines[i] ? lines[i].substring(0, 60) : '' });
    }
    return segments;
  },

  highlightEntities(text, entities, assetMap) {
    if (!text || !entities || entities.length === 0) return text || '';
    const sorted = [...entities].sort((a, b) => b.name.length - a.name.length);
    const escaped = sorted.map(e => e.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const pattern = new RegExp(escaped.join('|'), 'g');
    const lookup = {};
    sorted.forEach(e => { lookup[e.name] = e; });
    return text.replace(pattern, (match) => {
      const entity = lookup[match];
      const isBound = entity && assetMap && assetMap[entity.name];
      return `<span class="${isBound ? 'entity-bound' : 'entity-unbound'}" style="color:${isBound ? '#22C55E' : '#EF4444'};font-weight:500;">${match}</span>`;
    });
  },

  /**
   * 自动检测文本编码
   */
  _detectEncoding(buffer) {
    if (buffer.byteLength >= 3 && buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) return 'UTF-8';
    if (buffer.byteLength >= 2 && buffer[0] === 0xFF && buffer[1] === 0xFE) return 'UTF-16LE';
    if (buffer.byteLength >= 2 && buffer[0] === 0xFE && buffer[1] === 0xFF) return 'UTF-16BE';

    let gbkScore = 0, utf8Score = 0, i = 0;
    while (i < Math.min(buffer.byteLength, 1024)) {
      const b = buffer[i];
      if (b < 0x80) { i++; continue; }
      if (b >= 0xC0 && b < 0xE0 && i + 1 < buffer.byteLength && (buffer[i+1] & 0xC0) === 0x80) { utf8Score += 2; i += 2; continue; }
      if (b >= 0xE0 && b < 0xF0 && i + 2 < buffer.byteLength && (buffer[i+1] & 0xC0) === 0x80 && (buffer[i+2] & 0xC0) === 0x80) { utf8Score += 3; i += 3; continue; }
      if (b >= 0x81 && b <= 0xFE && i + 1 < buffer.byteLength) { const lo = buffer[i+1]; if ((lo >= 0x40 && lo <= 0x7E) || (lo >= 0x80 && lo <= 0xFE)) { gbkScore += 2; i += 2; continue; } }
      i++;
    }
    return (gbkScore > utf8Score * 1.5 && gbkScore > 10) ? 'GBK' : 'UTF-8';
  },

  /**
   * 从 DOCX 中提取文本（完整可靠的 DOMParser 方案）
   */
  async _extractDocxText(arrayBuffer) {
    const u8 = new Uint8Array(arrayBuffer);
    const view = new DataView(arrayBuffer);

    function readU32(off) { return view.getUint32(off, true); }
    function readU16(off) { return view.getUint16(off, true); }

    let offset = 0;
    let docEntry = null;

    while (offset + 30 <= u8.length) {
      if (readU32(offset) !== 0x04034b50) { offset++; continue; }
      const compression = readU16(offset + 8);
      const fileNameLen = readU16(offset + 26);
      const extraLen = readU16(offset + 28);
      const nameStart = offset + 30;
      let fileName = '';
      for (let i = 0; i < fileNameLen; i++) fileName += String.fromCharCode(u8[nameStart + i]);
      const dataOffset = nameStart + fileNameLen + extraLen;
      const compressedSize = readU32(offset + 18);
      if (fileName === 'word/document.xml') {
        docEntry = { compression, dataOffset, compressedSize, uncompressedSize: readU32(offset + 22) };
        break;
      }
      offset = dataOffset + compressedSize;
    }
    if (!docEntry) throw new Error('无效的 DOCX 文件');

    let xmlBytes;
    if (docEntry.compression === 0) {
      xmlBytes = u8.slice(docEntry.dataOffset, docEntry.dataOffset + docEntry.compressedSize);
    } else if (docEntry.compression === 8) {
      xmlBytes = await Utils._inflate(u8.slice(docEntry.dataOffset, docEntry.dataOffset + docEntry.compressedSize));
    } else {
      throw new Error(`不支持的压缩方式: ${docEntry.compression}`);
    }

    const xml = new TextDecoder('UTF-8').decode(xmlBytes);
    
    // 方法1: 正则提取 <w:t> 标签内容（最可靠，不依赖DOMParser）
    const paragraphs = [];
    
    // 按 </w:p> 切分段落后，再提取每个段落内的 w:t 文本
    // 先提取所有段落原始XML
    const pRegex = /<w:p[ >][\s\S]*?<\/w:p>/g;
    let pMatch;
    while ((pMatch = pRegex.exec(xml)) !== null) {
      const pXml = pMatch[0];
      // 提取这个段落里的所有 w:t 文本
      const tRegex = /<w:t[^>]*>([^<]*)<\/w:t>/g;
      let tMatch;
      let paraText = '';
      while ((tMatch = tRegex.exec(pXml)) !== null) {
        paraText += tMatch[1];
      }
      if (paraText.trim()) {
        paragraphs.push(paraText);
      }
    }
    
    // 方法2: 如果方法1没取到（XML格式特殊），用 DOMParser 备份
    if (paragraphs.length === 0) {
      try {
        const doc = new DOMParser().parseFromString(xml, 'text/xml');
        const pEls = doc.getElementsByTagNameNS('*', 'p');
        for (let pi = 0; pi < pEls.length; pi++) {
          const tEls = pEls[pi].getElementsByTagNameNS('*', 't');
          let paraText = '';
          for (let ti = 0; ti < tEls.length; ti++) {
            paraText += tEls[ti].textContent || '';
          }
          if (paraText.trim()) paragraphs.push(paraText);
        }
      } catch(e) {
        // DOMParser 失败也没关系
      }
    }

    return paragraphs.join('\n');
  },

  /**
   * 解压 Deflate-raw 数据
   */
  async _inflate(compressed) {
    const ds = new DecompressionStream('deflate-raw');
    const writer = ds.writable.getWriter();
    writer.write(compressed);
    writer.close();
    const reader = ds.readable.getReader();
    const chunks = [];
    return new Promise((resolve, reject) => {
      function pump() {
        reader.read().then(({done, value}) => {
          if (done) {
            let totalLen = 0;
            for (const c of chunks) totalLen += c.byteLength;
            const result = new Uint8Array(totalLen);
            let pos = 0;
            for (const c of chunks) { result.set(new Uint8Array(c), pos); pos += c.byteLength; }
            resolve(result);
          } else { chunks.push(value); pump(); }
        }).catch(reject);
      }
      pump();
    });
  },

  /**
   * 从 PDF 中提取文本（动态加载 pdf.js）
   */
  async _extractPdfText(arrayBuffer) {
    if (!window.pdfjsLib) {
      await new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
        s.onload = () => {
          window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
          resolve();
        };
        s.onerror = () => reject(new Error('PDF.js 加载失败，请检查网络'));
        document.head.appendChild(s);
      });
    }
    const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer.slice(0) }).promise;
    const pages = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      pages.push(content.items.map(item => item.str).join(' '));
    }
    return pages.join('\n\n');
  },

  /**
   * 读取文件为文本（支持 TXT/PDF/DOCX，自动检测编码）
   */
  async readFileAsText(file) {
    const ext = file.name.split('.').pop().toLowerCase();

    // PDF 专用路径
    if (ext === 'pdf') {
      const buf = await file.arrayBuffer();
      return await Utils._extractPdfText(buf);
    }

    // DOCX 专用路径
    if (ext === 'docx' || ext === 'doc') {
      const buf = await file.arrayBuffer();
      return await Utils._extractDocxText(buf);
    }

    // TXT 或未知格式：编码检测 + 分段读取
    return new Promise((resolve, reject) => {
      // 先检测编码
      const headerBlob = file.slice(0, Math.min(file.size, 2048));
      const headerReader = new FileReader();
      headerReader.onload = () => {
        const buf = new Uint8Array(headerReader.result);
        const encoding = Utils._detectEncoding(buf);
        const isGbk = encoding === 'GBK' || encoding === 'GB2312';

        if (file.size < 1024 * 1024) {
          // 小文件直接读
          if (isGbk) {
            file.arrayBuffer().then(buf => {
              try { resolve(new TextDecoder('GBK', {fatal: false}).decode(buf)); }
              catch { const r = new FileReader(); r.onload = e => resolve(e.target.result); r.readAsText(file); }
            });
          } else {
            const r = new FileReader();
            r.onload = e => resolve(e.target.result);
            r.onerror = () => reject(new Error('文件读取失败'));
            r.readAsText(file);
          }
          return;
        }

        // 大文件分片
        const CHUNK = 256 * 1024;
        let pos = 0;
        const chunks = [];
        const total = file.size;

        function nextChunk() {
          const blob = file.slice(pos, pos + CHUNK);
          if (isGbk) {
            blob.arrayBuffer().then(buf => {
              try { chunks.push(new TextDecoder('GBK').decode(buf)); } catch { chunks.push(''); }
              pos += CHUNK;
              pos < total ? setTimeout(nextChunk, 0) : resolve(chunks.join(''));
            });
          } else {
            const r = new FileReader();
            r.onload = e => { chunks.push(e.target.result); pos += CHUNK; pos < total ? setTimeout(nextChunk, 0) : resolve(chunks.join('')); };
            r.readAsText(blob);
          }
        }
        nextChunk();
      };
      headerReader.readAsArrayBuffer(headerBlob);
    });
  },

  readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = () => reject(new Error('图片读取失败'));
      reader.readAsDataURL(file);
    });
  },

  getFileNameFromUrl(url) {
    if (!url) return 'unknown';
    try { return url.split('/').pop() || 'unknown'; } catch { return 'unknown'; }
  },

  getStepProgress(currentStep) {
    return Math.round(((currentStep - 1) / 5) * 100);
  },

  /**
   * 从state中剥离大文本
   */
  stripScriptForPersist(script) {
    if (!script) return null;
    return {
      filename: script.filename, size: script.size,
      entities: script.entities, lines: script.lines,
      totalLen: script.totalLen, segments: script.segments,
      lineCount: script.lineCount, sceneSegments: script.sceneSegments,
      bindings: script.bindings || {},
      preview: script.fullText ? script.fullText.substring(0, 5000) : '',
      parsedAt: script.parsedAt, _hasFullText: true
    };
  }
};
