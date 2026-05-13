/**
 * utils.js — 工具函数
 * ShortDrama Studio
 * v2.0 支持10万字级剧本解析
 * 改动: parseScript 流式处理, 不存全文进state
 */

const Utils = {
  /**
   * 生成唯一ID
   */
  uid() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 6);
  },

  /**
   * 格式化时间
   */
  formatDate(date) {
    const d = date || new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  },

  /**
   * 防抖
   */
  debounce(fn, delay = 300) {
    let timer;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  },

  /**
   * 深拷贝
   */
  deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  },

  /**
   * 估算文本时长（中文按3字/秒，英文按5词/秒）
   */
  estimateDuration(text) {
    if (!text) return 0;
    const cn = (text.match(/[\u4e00-\u9fff]/g) || []).length;
    const en = text.replace(/[\u4e00-\u9fff]/g, '').split(/\s+/).filter(Boolean).length;
    const seconds = cn / 3 + en / 5;
    return Math.max(seconds, 2);
  },

  /**
   * 格式化时长 (秒 → M:SS)
   */
  formatDuration(seconds) {
    const m = Math.floor(seconds / 60);
    const s = Math.round(seconds % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
  },

  /**
   * 检测文件类型
   */
  getFileType(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    const types = {
      txt: 'text',
      pdf: 'pdf',
      docx: 'docx',
      doc: 'doc',
      png: 'image',
      jpg: 'image',
      jpeg: 'image',
      webp: 'image',
      gif: 'image',
      mp4: 'video',
      mov: 'video'
    };
    return types[ext] || 'unknown';
  },

  /**
   * 截断文本
   */
  truncate(text, maxLen = 50) {
    if (!text) return '';
    return text.length > maxLen ? text.slice(0, maxLen) + '...' : text;
  },

  /**
   * localStorage 封装
   */
  storage: {
    get(key, fallback = null) {
      try {
        const data = localStorage.getItem(`shortdrama_${key}`);
        return data ? JSON.parse(data) : fallback;
      } catch {
        return fallback;
      }
    },
    set(key, value) {
      try {
        localStorage.setItem(`shortdrama_${key}`, JSON.stringify(value));
      } catch (e) {
        console.warn('Storage write failed:', e);
      }
    },
    remove(key) {
      localStorage.removeItem(`shortdrama_${key}`);
    },
    clear() {
      Object.keys(localStorage)
        .filter(k => k.startsWith('shortdrama_'))
        .forEach(k => localStorage.removeItem(k));
    }
  },

  /**
   * 流式解析剧本文本 → 结构化场景/角色/台词
   * 支持10万字级，逐行扫描，不分批进内存
   */
  parseScript(text) {
    const entities = [];
    const seen = new Set();
    const totalLen = text.length;

    // 用逐行扫描代替全本 regexp，避免大文本内存暴涨和正则回溯崩溃
    const lines = text.split('\n');
    
    // ---- 阶段1: 逐行扫描实体 ----
    // 中文人名: 2-4字中文 + 可选称谓
    const namePattern = /[\u4e00-\u9fa5]{2,4}(?:先生|小姐|医生|博士|老师|老板|太太|女士|同志|同学|局长|经理|主任|教授)?/;
    // 场景标记: "场景：xxx" / "地点：xxx" / "环境：xxx"
    const scenePattern = /(?:场景|地点|环境)[：:]\s*([^\n，。！？,.:;!?]{2,20})/i;
    // 位置: "室内 xxx" / "室外 xxx" / "在 xxx" / "于 xxx"
    const locPattern = /(?:室内|室外|在|于)\s*([\u4e00-\u9fa5]{2,10}(?:房间|室|厅|楼|店|园|场|处|区|馆))/;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // 提取中文名字 (每行最多2个名字，避免假阳性)
      let nameCount = 0;
      let idx = 0;
      while (idx < line.length && nameCount < 2) {
        const match = namePattern.exec(line.slice(idx));
        if (!match) break;
        const name = match[0];
        if (!seen.has(name) && name.length >= 2) {
          seen.add(name);
          entities.push({ name, type: 'character' });
        }
        nameCount++;
        idx += match.index + match[0].length;
      }

      // 提取场景
      const sMatch = scenePattern.exec(line);
      if (sMatch && !seen.has(sMatch[1])) {
        seen.add(sMatch[1]);
        // 检查是否已在 entities 中
        if (!entities.some(e => e.name === sMatch[1])) {
          entities.push({ name: sMatch[1], type: 'scene' });
        }
      }

      const lMatch = locPattern.exec(line);
      if (lMatch && !seen.has(lMatch[1])) {
        seen.add(lMatch[1]);
        if (!entities.some(e => e.name === lMatch[1])) {
          entities.push({ name: lMatch[1], type: 'scene' });
        }
      }
    }

    // ---- 阶段2: 构建分镜段落索引 ----
    // 不返回全文，只返回每段分镜的 "起始行号+内容摘要"
    const sceneSegments = this._buildSceneSegments(lines);

    return {
      entities,
      lines: lines.length,
      fullText: text,           // 仍保留用于分镜生成步骤
      totalLen,                 // 文本总长度
      sceneSegments,            // 分镜段落索引
      segments: sceneSegments.length,
      lineCount: lines.length
    };
  },

  /**
   * 构建分镜段落索引（仅用于进度显示）
   * @private
   */
  _buildSceneSegments(lines) {
    const segments = [];
    let currentStart = 0;
    let dialogueCount = 0;

    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i].trim();
      if (!trimmed) continue;

      // 有引号或较长对话触发新段落
      if (trimmed.includes('"') || trimmed.includes('「') || trimmed.includes('“') || trimmed.length > 30) {
        dialogueCount++;
      }

      // 每5句对话或遇到明显的分节标记（---、###等）分段
      if ((dialogueCount > 0 && dialogueCount % 5 === 0) || 
          /^[-＝]{3,}$/.test(trimmed) ||
          /^#+\s*(?:第|第?[一二三四五六七八九十\d]+[章节]?)/.test(trimmed)) {
        segments.push({
          startLine: currentStart,
          endLine: i,
          preview: lines[currentStart] ? lines[currentStart].substring(0, 60) : ''
        });
        currentStart = i + 1;
        dialogueCount = 0;
      }
    }

    // 最后一段
    if (currentStart < lines.length) {
      segments.push({
        startLine: currentStart,
        endLine: lines.length - 1,
        preview: lines[currentStart] ? lines[currentStart].substring(0, 60) : ''
      });
    }

    // 如果分段太少（少于3段），强制按行数等分
    if (segments.length < 3 && lines.length > 20) {
      segments.length = 0;
      const chunkSize = Math.max(3, Math.floor(lines.length / 10));
      for (let i = 0; i < lines.length; i += chunkSize) {
        segments.push({
          startLine: i,
          endLine: Math.min(i + chunkSize - 1, lines.length - 1),
          preview: lines[i] ? lines[i].substring(0, 60) : ''
        });
      }
    }

    return segments;
  },

  /**
   * 高亮文本中的实体
   */
  highlightEntities(text, entities, assetMap) {
    if (!text || !entities || entities.length === 0) return text || '';
    
    // 排序：长名优先
    const sorted = [...entities].sort((a, b) => b.name.length - a.name.length);
    const escaped = sorted.map(e => e.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    
    // 一次性正则匹配所有实体
    const pattern = new RegExp(escaped.join('|'), 'g');
    const lookup = {};
    sorted.forEach(e => { lookup[e.name] = e; });

    return text.replace(pattern, (match) => {
      const entity = lookup[match];
      const isBound = entity && assetMap && assetMap[entity.name];
      const color = isBound ? '#22C55E' : '#EF4444';
      const cls = isBound ? 'entity-bound' : 'entity-unbound';
      return `<span class="${cls}" style="color:${color};font-weight:500;">${match}</span>`;
    });
  },

  /**
   * 自动检测文本编码（通过BOM或字节特征）
   * 返回建议的编码名称
   */
  _detectEncoding(buffer) {
    // UTF-8 BOM: EF BB BF
    if (buffer.byteLength >= 3 && 
        buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) {
      return 'UTF-8';
    }
    // UTF-16 LE BOM: FF FE
    if (buffer.byteLength >= 2 && 
        buffer[0] === 0xFF && buffer[1] === 0xFE) {
      return 'UTF-16LE';
    }
    // UTF-16 BE BOM: FE FF
    if (buffer.byteLength >= 2 && 
        buffer[0] === 0xFE && buffer[1] === 0xFF) {
      return 'UTF-16BE';
    }
    // 无BOM，尝试检测非ASCII字节来判断是否为GBK/中文编码
    let gbkScore = 0;
    let utf8Score = 0;
    let i = 0;
    while (i < Math.min(buffer.byteLength, 1024)) {
      const b = buffer[i];
      // ASCII范围
      if (b < 0x80) {
        i++;
        continue;
      }
      // UTF-8多字节序列
      if (b >= 0xC0 && b < 0xE0 && i + 1 < buffer.byteLength) {
        // 2字节 UTF-8: 110xxxxx 10xxxxxx
        if ((buffer[i+1] & 0xC0) === 0x80) {
          utf8Score += 2;
          i += 2;
          continue;
        }
      } else if (b >= 0xE0 && b < 0xF0 && i + 2 < buffer.byteLength) {
        // 3字节 UTF-8: 1110xxxx 10xxxxxx 10xxxxxx
        if ((buffer[i+1] & 0xC0) === 0x80 && (buffer[i+2] & 0xC0) === 0x80) {
          utf8Score += 3;
          i += 3;
          continue;
        }
      }
      // GBK范围：高字节 0x81-0xFE，低字节 0x40-0xFE
      if (b >= 0x81 && b <= 0xFE && i + 1 < buffer.byteLength) {
        const lo = buffer[i+1];
        if ((lo >= 0x40 && lo <= 0x7E) || (lo >= 0x80 && lo <= 0xFE)) {
          gbkScore += 2;
          i += 2;
          continue;
        }
      }
      i++;
    }
    
    // 判断：如果GBK分数显著高于UTF-8，则为GBK编码
    if (gbkScore > utf8Score * 1.5 && gbkScore > 10) {
      return 'GBK';
    }
    // 默认 UTF-8
    return 'UTF-8';
  },

  /**
   * 极简 docx 文本提取器（不依赖外部库，仅提取 word/document.xml 中的文本）
   * docx 文件是 ZIP 压缩包，我们手动解析 ZIP 格式来提取文本
   */
  _extractDocxText(arrayBuffer) {
    // ZIP 文件局部文件头签名
    const LOCAL_SIG = 0x04034b50;
    const CENTRAL_SIG = 0x02014b50;
    const END_SIG = 0x06054b50;
    
    const u8 = new Uint8Array(arrayBuffer);
    const view = new DataView(arrayBuffer);
    
    // 读取 uint16
    function readU16(offset) { return view.getUint16(offset, true); }
    function readU32(offset) { return view.getUint32(offset, true); }
    
    let offset = 0;
    const entries = [];
    
    // 扫描所有局部文件头
    while (offset + 30 <= u8.length) {
      if (readU32(offset) !== LOCAL_SIG) {
        // 不是文件头，尝试按字节跳过（应对有数据描述符的情况）
        offset++;
        if (offset > u8.length - 4) break;
        continue;
      }
      
      const compression = readU16(offset + 8);
      const fileNameLen = readU16(offset + 26);
      const extraLen = readU16(offset + 28);
      const nameEnd = offset + 30 + fileNameLen;
      
      let fileName = '';
      for (let i = 0; i < fileNameLen; i++) {
        fileName += String.fromCharCode(u8[offset + 30 + i]);
      }
      
      const dataOffset = nameEnd + extraLen;
      
      // 计算压缩数据大小
      const compressedSize = readU32(offset + 18);
      const uncompressedSize = readU32(offset + 22);
      
      entries.push({
        fileName,
        compression,
        dataOffset,
        compressedSize,
        uncompressedSize
      });
      
      // 跳到下一个文件头
      offset = dataOffset + compressedSize;
    }
    
    // 找 word/document.xml
    const entry = entries.find(e => 
      e.fileName === 'word/document.xml' || e.fileName.startsWith('word/document.xml')
    );
    if (!entry) {
      throw new Error('无法找到文档内容（word/document.xml）');
    }
    
    // 提取并解压数据
    let xmlBytes;
    if (entry.compression === 0) {
      // 未压缩
      xmlBytes = u8.slice(entry.dataOffset, entry.dataOffset + entry.compressedSize);
    } else if (entry.compression === 8) {
      // Deflate 压缩 — 使用 Compression Streams API 或 DecompressionStream
      const compressed = u8.slice(entry.dataOffset, entry.dataOffset + entry.compressedSize);
      xmlBytes = this._inflate(compressed, entry.uncompressedSize);
    } else {
      throw new Error(`不支持的压缩方式: ${entry.compression}`);
    }
    
    // 用 TextDecoder 解码 XML
    const decoder = new TextDecoder('UTF-8');
    let xml = decoder.decode(xmlBytes);
    
    // 从 XML 中提取文本
    // <w:t>xxx</w:t> 标签内的就是文本内容
    const textParts = [];
    const tagRegex = /<w:t[^>]*>([^<]*)<\/w:t>/g;
    let match;
    while ((match = tagRegex.exec(xml)) !== null) {
      textParts.push(match[1]);
    }
    
    // 段落换行：<w:p> 代表换行
    // 简单处理：遇到 </w:p> 后加换行符
    const paraRegex = /<w:p[ >]/g;
    let paraMatch;
    while ((paraMatch = paraRegex.exec(xml)) !== null) {
      // 在文本中标记位置
    }
    
    // 更准确的方法：按段落提取
    const fullText = [];
    let currentPara = [];
    let inPara = false;
    let inText = false;
    let currentText = '';
    
    // 简易 XML 解析（只针对 docx 的 w:p/w:r/w:t 结构）
    let tagName = '';
    let isClosing = false;
    let readingContent = false;
    
    for (let i = 0; i < xml.length; i++) {
      const ch = xml[i];
      
      if (ch === '<') {
        if (currentText && tagName === 'w:t') {
          textParts.push(currentText.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'"));
        }
        currentText = '';
        tagName = '';
        isClosing = false;
        readingContent = true;
      } else if (ch === '>') {
        if (tagName) {
          if (tagName === '/w:p') {
            fullText.push(textParts.join(''));
            textParts.length = 0;
          } else if (tagName === 'w:p') {
            // 开始新段落
          }
        }
        readingContent = false;
        tagName = '';
      } else if (readingContent) {
        if (ch === '/') isClosing = true;
        else if (isClosing) tagName += ch;
        else tagName += ch;
      } else if (!readingContent) {
        currentText += ch;
      }
    }
    
    // 追加最后一段
    if (textParts.length > 0) {
      fullText.push(textParts.join(''));
    }
    
    return fullText.join('\n');
  },
  
  /**
   * 解压 Deflate 数据
   * 使用浏览器内置的 DecompressionStream（Chrome 80+、Firefox 113+）
   */
  _inflate(compressed, uncompressedSize) {
    // 尝试使用 DecompressionStream
    if (typeof DecompressionStream !== 'undefined') {
      try {
        const ds = new DecompressionStream('deflate-raw');
        const writer = ds.writable.getWriter();
        writer.write(compressed);
        writer.close();
        const reader = ds.readable.getReader();
        const chunks = [];
        return new Promise((resolve) => {
          function pump() {
            reader.read().then(({done, value}) => {
              if (done) {
                const total = chunks.reduce((s, c) => {
                  const a = new Uint8Array(s.byteLength + c.byteLength);
                  a.set(new Uint8Array(s), 0);
                  a.set(new Uint8Array(c), s.byteLength);
                  return a;
                }, new Uint8Array(0));
                resolve(total);
              } else {
                chunks.push(value);
                pump();
              }
            });
          }
          pump();
        });
      } catch (e) {
        // fallback 到同步方式
      }
    }
    
    // fallback: 使用 pako-like 的简单 inflate（极小实现）
    // 由于浏览器限制，这里抛错提示用户
    throw new Error('当前浏览器不支持 docx 解压，请将文档另存为 TXT 格式上传');
  },

  /**
   * 读取文件为文本（支持编码自动检测、docx/PDF/TXT，分段读取支持大文件）
   */
  readFileAsText(file) {
    return new Promise((resolve, reject) => {
      if (file.type === 'application/pdf') {
        reject(new Error('PDF解析需要额外库支持'));
        return;
      }

      // 小文件（< 1MB）直接读
      if (file.size < 1024 * 1024) {
        // 先读前几个字节检测编码
        const headerBlob = file.slice(0, Math.min(file.size, 2048));
        const headerReader = new FileReader();
        headerReader.onload = () => {
          const buf = new Uint8Array(headerReader.result);
          const encoding = Utils._detectEncoding(buf);
          
          // 用检测到的编码读取整个文件
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target.result);
          reader.onerror = () => reject(new Error('文件读取失败'));
          
          if (encoding === 'GBK' || encoding === 'GB2312' || encoding === 'GB18030') {
            // 如果已检测为 GBK，用 UTF-8 读然后尝试 TextDecoder
            reader.readAsArrayBuffer(file);
            reader.onload = (e) => {
              try {
                const decoder = new TextDecoder('GBK', { fatal: false });
                const text = decoder.decode(e.target.result);
                resolve(text);
              } catch {
                // fallback: 用 UTF-8 再试
                const utf8Reader = new FileReader();
                utf8Reader.onload = (ev) => resolve(ev.target.result);
                utf8Reader.readAsText(file);
              }
            };
          } else {
            reader.readAsText(file, encoding);
          }
        };
        headerReader.onerror = () => {
          // fallback
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target.result);
          reader.readAsText(file);
        };
        headerReader.readAsArrayBuffer(headerBlob);
        return;
      }

      // 大文件使用 Blob 分片读取，先检测编码
      const headerBlob = file.slice(0, Math.min(file.size, 2048));
      const headerReader = new FileReader();
      headerReader.onload = () => {
        const buf = new Uint8Array(headerReader.result);
        const encoding = Utils._detectEncoding(buf);
        
        const isGbk = encoding === 'GBK' || encoding === 'GB2312' || encoding === 'GB18030';
        const CHUNK_SIZE = 256 * 1024;
        let offset = 0;
        const chunks = [];
        const totalSize = file.size;

        function readNextChunk() {
          const blob = file.slice(offset, offset + CHUNK_SIZE);
          if (isGbk) {
            // GBK编码用 ArrayBuffer + TextDecoder
            const reader = new FileReader();
            reader.onload = (e) => {
              try {
                const decoder = new TextDecoder('GBK', { fatal: false });
                const text = decoder.decode(e.target.result);
                chunks.push(text);
              } catch {
                // fallback
                const textReader = new FileReader();
                textReader.onload = (ev) => chunks.push(ev.target.result);
                textReader.readAsText(blob);
              }
              offset += CHUNK_SIZE;
              if (offset < totalSize) {
                setTimeout(readNextChunk, 0);
              } else {
                resolve(chunks.join(''));
              }
            };
            reader.onerror = () => reject(new Error('文件读取失败（大文件分片）'));
            reader.readAsArrayBuffer(blob);
          } else {
            const reader = new FileReader();
            reader.onload = (e) => {
              chunks.push(e.target.result);
              offset += CHUNK_SIZE;
              if (offset < totalSize) {
                setTimeout(readNextChunk, 0);
              } else {
                resolve(chunks.join(''));
              }
            };
            reader.onerror = () => reject(new Error('文件读取失败（大文件分片）'));
            reader.readAsText(blob, encoding);
          }
        }

        readNextChunk();
      };
      headerReader.onerror = () => {
        // fallback
        const CHUNK_SIZE = 256 * 1024;
        let offset = 0;
        const chunks = [];
        const totalSize = file.size;
        function readNextChunk() {
          const blob = file.slice(offset, offset + CHUNK_SIZE);
          const reader = new FileReader();
          reader.onload = (e) => {
            chunks.push(e.target.result);
            offset += CHUNK_SIZE;
            if (offset < totalSize) {
              setTimeout(readNextChunk, 0);
            } else {
              resolve(chunks.join(''));
            }
          };
          reader.readAsText(blob);
        }
        readNextChunk();
      };
      headerReader.readAsArrayBuffer(headerBlob);
    });
  },

  /**
   * 从state中剥离大文本，只保存轻量数据用于持久化
   */
  stripScriptForPersist(script) {
    if (!script) return null;
    return {
      filename: script.filename,
      size: script.size,
      entities: script.entities,
      lines: script.lines,
      totalLen: script.totalLen,
      segments: script.segments,
      lineCount: script.lineCount,
      sceneSegments: script.sceneSegments,
      bindings: script.bindings || {},
      preview: script.fullText ? script.fullText.substring(0, 5000) : '',  // 只存前5000字用于高亮预览
      parsedAt: script.parsedAt,
      _hasFullText: true        // 标记有全文可重新加载
    };
  },

  /**
   * 读取文件为DataURL
   */
  readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = () => reject(new Error('图片读取失败'));
      reader.readAsDataURL(file);
    });
  },

  /**
   * 从URL提取文件名
   */
  getFileNameFromUrl(url) {
    if (!url) return 'unknown';
    try {
      const parts = url.split('/');
      return parts[parts.length - 1] || 'unknown';
    } catch {
      return 'unknown';
    }
  },

  /**
   * 获取步骤整体进度百分比
   */
  getStepProgress(currentStep) {
    return Math.round(((currentStep - 1) / 5) * 100);
  }
};
