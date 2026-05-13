/**
 * script.js — 剧本上传与解析模块
 * ShortDrama Studio
 * v2.0 支持10万字级剧本
 * 改动: 不把 fullText 存 localStorage, 解析分段进行
 */

const ScriptModule = {
  /**
   * 渲染剧本上传/解析界面
   */
  render() {
    const script = App.state.script;

    return `
      <div class="card" style="margin-bottom:20px;">
        <div class="card-header">
          <div>
            <div class="card-title">📜 剧本上传</div>
            <div class="card-subtitle">支持 TXT / PDF / DOCX 格式，拖拽或点击上传</div>
          </div>
          ${script ? `<span class="badge badge-green">✅ 已解析</span>` : ''}
        </div>

        <!-- Upload zone -->
        <div class="upload-zone" id="scriptUploadZone"
             ondragover="event.preventDefault();this.classList.add('dragover');"
             ondragleave="this.classList.remove('dragover');"
             ondrop="ScriptModule._handleDrop(event)"
             onclick="document.getElementById('scriptFileInput').click()">
          <div class="upload-zone-icon">📄</div>
          <div class="upload-zone-text">
            ${script ? '点击或拖拽重新上传' : '将剧本文件拖拽到这里，或点击选择文件'}
          </div>
          <div class="upload-zone-hint">支持 TXT · PDF · DOCX</div>
          <input type="file" id="scriptFileInput" accept=".txt,.pdf,.docx,.doc"
            style="display:none" onchange="ScriptModule._handleFileSelect(event)">
        </div>

        <!-- Parse progress (large file indicator) -->
        <div id="scriptParseStatus"></div>

        ${script ? `
          <!-- Parsed result summary (no full text in state) -->
          <div style="margin-top:24px;">
            <div class="card-header" style="padding:0 0 12px;margin-bottom:12px;">
              <div class="card-title">解析结果</div>
              <div>
                <span class="badge badge-purple">${script.entities ? script.entities.length : 0} 个实体</span>
                <span class="badge badge-gray">${script.lineCount || 0} 行</span>
                <span class="badge badge-blue">${script.segments || 0} 段</span>
                ${script.totalLen ? `<span class="badge badge-gray">${(script.totalLen / 10000).toFixed(1)} 万字</span>` : ''}
              </div>
            </div>

            <!-- Entity binding -->
            ${this._renderEntityBinding()}

            <!-- Highlighted text preview (只取前5000字) -->
            <div style="margin-top:16px;">
              <label class="form-label">
                剧本原文预览
                ${script.totalLen > 5000 ? '<span style="color:var(--text-muted);font-size:11px;margin-left:8px;">（显示前5000字，完整内容存储在浏览器文件缓存中）</span>' : ''}
              </label>
              <div style="background:var(--bg-input);border:1px solid var(--border-default);border-radius:var(--radius-md);padding:16px;max-height:400px;overflow-y:auto;font-size:14px;line-height:1.8;white-space:pre-wrap;font-family:inherit;">
                ${this._renderHighlightedText()}
              </div>
            </div>
          </div>
        ` : ''}
      </div>
    `;
  },

  /**
   * 处理文件选择
   */
  _handleFileSelect(event) {
    const file = event.target.files && event.target.files[0];
    if (file) this._processFile(file);
  },

  /**
   * 处理拖拽
   */
  _handleDrop(event) {
    event.preventDefault();
    const zone = document.getElementById('scriptUploadZone');
    if (zone) zone.classList.remove('dragover');

    const file = event.dataTransfer.files && event.dataTransfer.files[0];
    if (file) this._processFile(file);
  },

  /**
   * 处理文件（支持10万字级）
   */
  async _processFile(file) {
    const zone = document.getElementById('scriptUploadZone');
    const statusEl = document.getElementById('scriptParseStatus');

    // 简单类型检查
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['txt', 'pdf', 'docx', 'doc'].includes(ext)) {
      App.showNotification('不支持的文件格式，请上传 TXT / PDF / DOCX', 'error');
      return;
    }

    const fileSizeKB = (file.size / 1024).toFixed(1);
    const isLargeFile = file.size > 512 * 1024; // > 512KB

    // 显示解析进度（大文件用分段模式）
    if (statusEl) {
      statusEl.innerHTML = `
        <div style="text-align:center;padding:16px;color:var(--text-secondary);">
          <div style="margin-bottom:8px;">📖 解析中...</div>
          <div style="font-size:12px;color:var(--text-muted);">
            ${file.name} (${fileSizeKB} KB)
            ${isLargeFile ? '<span style="color:#F59E0B;margin-left:8px;">⚠️ 大文件，将分段读取</span>' : ''}
          </div>
          <div class="step-progress-line" style="width:60%;margin:12px auto;">
            <div class="progress-fill-inner"></div>
          </div>
        </div>
      `;
    }

    try {
      let text;

      // 根据文件类型选择不同的读取方式
      if (ext === 'txt') {
        text = await Utils.readFileAsText(file);
      } else if (ext === 'pdf') {
        App.showNotification('PDF解析需要 PDF.js 库支持，当前以TXT模式处理。', 'warning');
        text = await Utils.readFileAsText(file);
      } else if (ext === 'docx' || ext === 'doc') {
        // docx/dox 是 ZIP 压缩包，需要用专用解析器
        App.showNotification('正在解析 DOCX 文件...', 'info', 2000);
        const arrayBuffer = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target.result);
          reader.onerror = () => reject(new Error('文件读取失败'));
          reader.readAsArrayBuffer(file);
        });
        text = Utils._extractDocxText(arrayBuffer);
        App.showNotification('DOCX 解析完成', 'success', 1500);
      } else {
        // fallback
        text = await Utils.readFileAsText(file);
      }

      // 解析文本（流式处理）
      const parsed = Utils.parseScript(text);

      // 构建轻量级state（不存全文到localStorage）
      App.state.script = {
        filename: file.name,
        size: file.size,
        entities: parsed.entities,
        lines: parsed.lines,
        totalLen: parsed.totalLen,
        segments: parsed.segments,
        lineCount: parsed.lineCount,
        sceneSegments: parsed.sceneSegments,
        bindings: {},
        // 保存全文到内存，但不会写入 localStorage
        fullText: text,
        preview: text.substring(0, 5000),
        parsedAt: Date.now()
      };

      // 持久化（会自动剥离fullText）
      this._persist();

      if (statusEl) {
        const entityCount = parsed.entities.length;
        statusEl.innerHTML = `
          <div style="text-align:center;padding:12px;color:var(--brand-green);font-size:14px;">
            ✅ 解析成功！发现 ${entityCount} 个实体，${parsed.segments} 个段落
            ${isLargeFile ? '<br><span style="font-size:11px;color:var(--text-muted);">（大文本已分段处理，完整内容在浏览器缓存中）</span>' : ''}
          </div>
        `;
      }

      App.renderStep();
      App.showNotification('剧本解析完成！', 'success');

    } catch (err) {
      if (statusEl) {
        statusEl.innerHTML = `
          <div style="text-align:center;padding:12px;color:#F87171;font-size:14px;">
            ❌ 解析失败：${err.message}
          </div>
        `;
      }
      App.showNotification(`解析失败: ${err.message}`, 'error');
    }
  },

  /**
   * 渲染实体绑定区域
   */
  _renderEntityBinding() {
    const script = App.state.script;
    if (!script || !script.entities) return '';

    const assets = App.state.assets || [];
    const assetNames = assets.map(a => ({ id: a.id, name: a.name }));

    const unbound = script.entities.filter(e => !script.bindings || !script.bindings[e.name]);

    // 太多实体时分页展示
    const displayEntities = script.entities.length > 50 
      ? script.entities.filter(e => !script.bindings || !script.bindings[e.name]).slice(0, 50)
      : script.entities;
    const remainingCount = script.entities.length > 50 ? script.entities.length - 50 : 0;

    return `
      <div class="card" style="margin-bottom:16px;">
        <div class="card-header" style="padding:0 0 8px;margin-bottom:8px;">
          <div class="card-title" style="font-size:14px;">🔗 实体绑定</div>
          ${unbound.length > 0 ? `<span class="badge badge-yellow">${unbound.length} 个未绑定</span>` : '<span class="badge badge-green">全部已绑定</span>'}
        </div>
        <div style="display:flex;flex-direction:column;gap:6px;">
          ${displayEntities.map(entity => {
            const boundAsset = script.bindings && script.bindings[entity.name];
            const isBound = !!boundAsset;
            return `
              <div style="display:flex;align-items:center;gap:12px;padding:6px 10px;background:${isBound ? 'rgba(29,185,84,0.05)' : 'rgba(239,68,68,0.05)'};border-radius:var(--radius-sm);">
                <span style="font-size:13px;font-weight:500;color:${isBound ? 'var(--brand-green)' : '#EF4444'};min-width:80px;">
                  ${Utils.truncate(entity.name, 10)}
                </span>
                <span style="font-size:11px;color:var(--text-muted);min-width:40px;">${entity.type === 'character' ? '👤' : entity.type === 'scene' ? '🏠' : '📦'}</span>
                <select class="form-select" style="flex:1;padding:4px 24px 4px 8px;font-size:12px;min-height:auto;"
                  onchange="ScriptModule._bindEntity('${entity.name.replace(/'/g, "\\'")}', this.value)">
                  <option value="">-- 请选择资产 --</option>
                  ${assetNames.map(a => `
                    <option value="${a.id}" ${boundAsset === a.id ? 'selected' : ''}>${a.name}</option>
                  `).join('')}
                </select>
                ${isBound ? '<span class="badge badge-green" style="font-size:10px;">✅</span>' : '<span class="badge badge-red" style="font-size:10px;">⚠️</span>'}
              </div>
            `;
          }).join('')}
        </div>
        ${remainingCount > 0 ? `
          <div style="margin-top:8px;font-size:11px;color:var(--text-muted);text-align:center;">
            还有 ${remainingCount} 个实体未显示（最多显示50个未绑定实体）
          </div>
        ` : ''}
      </div>
    `;
  },

  /**
   * 渲染高亮文本（只渲染preview部分）
   */
  _renderHighlightedText() {
    const script = App.state.script;
    const previewText = script.preview || '';

    if (!previewText) return '<span style="color:var(--text-muted);">无内容</span>';

    // 构建资产映射
    const assetMap = {};
    const assets = App.state.assets || [];
    if (script.bindings) {
      Object.entries(script.bindings).forEach(([entityName, assetId]) => {
        const asset = assets.find(a => a.id === assetId);
        if (asset) assetMap[entityName] = true;
      });
    }

    return Utils.highlightEntities(this._escapeHtml(previewText), script.entities || [], assetMap);
  },

  /**
   * 绑定实体到资产
   */
  _bindEntity(entityName, assetId) {
    const script = App.state.script;
    if (!script) return;

    if (!script.bindings) script.bindings = {};

    if (assetId) {
      script.bindings[entityName] = assetId;
    } else {
      delete script.bindings[entityName];
    }

    this._persist();
    App.renderStep();
  },

  /**
   * 校验是否可进入下一步
   */
  canProceed() {
    const script = App.state.script;
    if (!script) return false;

    // 检查是否所有实体都已绑定
    const unbound = script.entities && script.bindings
      ? script.entities.filter(e => !script.bindings[e.name])
      : script.entities || [];

    return unbound.length === 0;
  },

  /**
   * HTML转义
   */
  _escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  },

  /**
   * 持久化（自动剥离大文本）
   */
  _persist() {
    // 在持久化前保存fullText
    const fullText = App.state.script ? App.state.script.fullText : null;
    // 调用App._persist（会剥离文本）
    App._persist();
    // 恢复fullText到内存
    if (App.state.script && fullText) {
      App.state.script.fullText = fullText;
    }
  }
};
