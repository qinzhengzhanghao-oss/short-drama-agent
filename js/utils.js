/**
 * utils.js — 工具函数
 * ShortDrama Studio
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
   * 解析剧本文本 → 结构化场景/角色/台词
   */
  parseScript(text) {
    const lines = text.split('\n');
    const entities = [];
    const fullText = text;

    // 简单实体提取：中文名（2-4字常见姓氏组合）或英文名
    const namePattern = /([\u4e00-\u9fa5]{2,4}(?:先生|小姐|医生|博士|老师|老板|太太)?)/g;
    let match;
    const seen = new Set();

    while ((match = namePattern.exec(fullText)) !== null) {
      const name = match[1].trim();
      if (name && !seen.has(name) && name.length >= 2) {
        seen.add(name);
        entities.push({
          name,
          type: 'character',
          positions: []
        });
      }
    }

    // 场景关键词
    const scenePatterns = [
      /(?:场景|地点|环境)[：:]\s*([^\n]+)/gi,
      /(?:室内|室外|在|于)\s*([\u4e00-\u9fa5]{2,10}(?:房间|室|厅|楼|店|园|场|处))/g
    ];

    scenePatterns.forEach(pattern => {
      while ((match = pattern.exec(fullText)) !== null) {
        const scene = match[1].trim();
        if (scene && !entities.find(e => e.name === scene)) {
          entities.push({ name: scene, type: 'scene', positions: [] });
        }
      }
    });

    return { entities, lines, fullText };
  },

  /**
   * 高亮文本中的实体
   */
  highlightEntities(text, entities, assetMap) {
    let result = text;
    entities.sort((a, b) => b.name.length - a.name.length).forEach(entity => {
      const isBound = assetMap && assetMap[entity.name];
      const color = isBound ? '#22C55E' : '#EF4444';
      const cls = isBound ? 'entity-bound' : 'entity-unbound';
      const regex = new RegExp(entity.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
      result = result.replace(regex, `<span class="${cls}" style="color:${color};font-weight:500;">$&</span>`);
    });
    return result;
  },

  /**
   * 读取文件为文本
   */
  readFileAsText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = () => reject(new Error('文件读取失败'));
      if (file.type === 'application/pdf') {
        reject(new Error('PDF解析需要额外库支持'));
      } else {
        reader.readAsText(file);
      }
    });
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
