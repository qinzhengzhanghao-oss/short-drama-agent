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
   * 读取文件为文本（分段读取，支持大文件）
   */
  readFileAsText(file) {
    return new Promise((resolve, reject) => {
      // 小文件（< 1MB）直接读
      if (file.size < 1024 * 1024) {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = () => reject(new Error('文件读取失败'));
        if (file.type === 'application/pdf') {
          reject(new Error('PDF解析需要额外库支持'));
        } else {
          reader.readAsText(file);
        }
        return;
      }

      // 大文件使用 Blob 分片读取
      const CHUNK_SIZE = 256 * 1024; // 256KB 每片
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
            // 异步调度，避免阻塞UI
            setTimeout(readNextChunk, 0);
          } else {
            resolve(chunks.join(''));
          }
        };
        reader.onerror = () => reject(new Error('文件读取失败（大文件分片）'));
        reader.readAsText(blob);
      }

      readNextChunk();
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
