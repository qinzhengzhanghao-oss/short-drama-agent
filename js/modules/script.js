/**
 * script.js — 剧本上传与解析模块
 * ShortDrama Studio
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

        <!-- Parse progress -->
        <div id="scriptParseStatus"></div>

        ${script ? `
          <!-- Parsed result -->
          <div style="margin-top:24px;">
            <div class="card-header" style="padding:0 0 12px;margin-bottom:12px;">
              <div class="card-title">解析结果</div>
              <div>
                <span class="badge badge-purple">${script.entities ? script.entities.length : 0} 个实体</span>
                <span class="badge badge-gray">${script.lines ? script.lines.length : 0} 行</span>
              </div>
            </div>

            <!-- Entity binding -->
            ${this._renderEntityBinding()}

            <!-- Highlighted text -->
            <div style="margin-top:16px;">
              <label class="form-label">剧本原文（高亮预览）</label>
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
   * 处理文件
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

    if (statusEl) {
      statusEl.innerHTML = `
        <div style="text-align:center;padding:16px;color:var(--text-secondary);">
          <div style="margin-bottom:8px;">📖 解析中...</div>
          <div style="font-size:12px;color:var(--text-muted);">${file.name} (${(file.size / 1024).toFixed(1)} KB)</div>
          <div class="step-progress-line" style="width:60%;margin:12px auto;">
            <div class="progress-fill-inner"></div>
          </div>
        </div>
      `;
    }

    try {
      let text;

      if (ext === 'txt') {
        text = await Utils.readFileAsText(file);
      } else if (ext === 'pdf') {
        // PDF: 简易提示，需要PDF.js
        App.showNotification('PDF解析需要 PDF.js 库支持，当前以TXT模式处理。', 'warning');
        text = await Utils.readFileAsText(file);
      } else {
        // DOCX: 简化处理
        text = await Utils.readFileAsText(file);
      }

      // 解析文本
      const parsed = Utils.parseScript(text);

      App.state.script = {
        filename: file.name,
        size: file.size,
        text,
        ...parsed,
        bindings: {},
        parsedAt: Date.now()
      };

      this._persist();

      if (statusEl) {
        statusEl.innerHTML = `
          <div style="text-align:center;padding:12px;color:var(--brand-green);font-size:14px;">
            ✅ 解析成功！发现 ${parsed.entities.length} 个实体
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

    return `
      <div class="card" style="margin-bottom:16px;">
        <div class="card-header" style="padding:0 0 8px;margin-bottom:8px;">
          <div class="card-title" style="font-size:14px;">🔗 实体绑定</div>
          ${unbound.length > 0 ? `<span class="badge badge-yellow">${unbound.length} 个未绑定</span>` : '<span class="badge badge-green">全部已绑定</span>'}
        </div>
        <div style="display:flex;flex-direction:column;gap:6px;">
          ${script.entities.map(entity => {
            const boundAsset = script.bindings && script.bindings[entity.name];
            const isBound = !!boundAsset;
            return `
              <div style="display:flex;align-items:center;gap:12px;padding:6px 10px;background:${isBound ? 'rgba(29,185,84,0.05)' : 'rgba(239,68,68,0.05)'};border-radius:var(--radius-sm);">
                <span style="font-size:13px;font-weight:500;color:${isBound ? 'var(--brand-green)' : '#EF4444'};min-width:80px;">
                  ${entity.name}
                </span>
                <span style="font-size:11px;color:var(--text-muted);min-width:40px;">${entity.type === 'character' ? '👤' : entity.type === 'scene' ? '🏠' : '📦'}</span>
                <select class="form-select" style="flex:1;padding:4px 24px 4px 8px;font-size:12px;min-height:auto;"
                  onchange="ScriptModule._bindEntity('${entity.name}', this.value)">
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
      </div>
    `;
  },

  /**
   * 渲染高亮文本
   */
  _renderHighlightedText() {
    const script = App.state.script;
    if (!script || !script.fullText) return '<span style="color:var(--text-muted);">无内容</span>';

    // 构建资产映射
    const assetMap = {};
    const assets = App.state.assets || [];
    if (script.bindings) {
      Object.entries(script.bindings).forEach(([entityName, assetId]) => {
        const asset = assets.find(a => a.id === assetId);
        if (asset) assetMap[entityName] = true;
      });
    }

    // 截断显示
    const previewText = script.fullText.length > 5000
      ? script.fullText.substring(0, 5000) + '\n\n... (内容过长，已截断)'
      : script.fullText;

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
   * 持久化
   */
  _persist() {
    App._persist();
  }
};
