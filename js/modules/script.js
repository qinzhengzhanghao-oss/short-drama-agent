/**
 * script.js — 剧本上传与解析模块
 * ShortDrama Studio v2.0
 * 改动: 取消实体绑定环节，仅做剧本预览。绑定移到分镜审核步骤。
 */

const ScriptModule = {
  render() {
    const script = App.state.script;

    return `
      <div class="card" style="margin-bottom:20px;">
        <div class="card-header">
          <div>
            <div class="card-title">📜 剧本上传</div>
            <div class="card-subtitle">支持 TXT / PDF / DOCX 格式，拖拽或点击上传</div>
          </div>
          ${script ? `<span class="badge badge-green">✅ 已上传</span>` : ''}
        </div>

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

        <div id="scriptParseStatus"></div>

        ${script ? `
          <div style="margin-top:24px;">
            <div class="card-header" style="padding:0 0 12px;margin-bottom:12px;">
              <div class="card-title">剧本信息</div>
              <div>
                <span class="badge badge-gray">${script.filename}</span>
                <span class="badge badge-blue">${script.lineCount || 0} 行</span>
                <span class="badge badge-purple">${script.entities ? script.entities.length : 0} 个角色/场景</span>
                ${script.totalLen ? `<span class="badge badge-gray">${(script.totalLen / 10000).toFixed(1)} 万字</span>` : ''}
              </div>
            </div>

            <div style="margin-top:16px;">
              <label class="form-label">剧本原文预览</label>
              <div style="background:var(--bg-input);border:1px solid var(--border-default);border-radius:var(--radius-md);padding:16px;max-height:400px;overflow-y:auto;font-size:14px;line-height:1.8;white-space:pre-wrap;font-family:inherit;">
                ${this._renderPreview()}
              </div>
            </div>
            ${script._debug ? `
              <div style="margin-top:8px;font-size:11px;color:var(--text-muted);padding:8px;background:var(--bg-input);border-radius:var(--radius-sm);">
                <div>🔍 调试：中文字符=${script._debug.chineseCount} 替换字符=${script._debug.hasReplacement}</div>
                <div style="word-break:break-all;margin-top:4px;">前200字符: ${this._escapeHtml(script._debug.previewFirst200)}</div>
              </div>
            ` : ''}
          </div>
        ` : ''}
      </div>
    `;
  },

  _handleFileSelect(event) {
    const file = event.target.files && event.target.files[0];
    if (file) this._processFile(file);
  },

  _handleDrop(event) {
    event.preventDefault();
    const zone = document.getElementById('scriptUploadZone');
    if (zone) zone.classList.remove('dragover');
    const file = event.dataTransfer.files && event.dataTransfer.files[0];
    if (file) this._processFile(file);
  },

  async _processFile(file) {
    const statusEl = document.getElementById('scriptParseStatus');
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['txt', 'pdf', 'docx', 'doc'].includes(ext)) {
      App.showNotification('不支持的文件格式', 'error');
      return;
    }

    statusEl.innerHTML = `<div style="text-align:center;padding:16px;color:var(--text-secondary);">📖 解析中... (${(file.size/1024).toFixed(1)} KB)</div>`;

    try {
      const text = await Utils.readFileAsText(file);
      
      // 调试：检查文本前200字符的合法性
      const debugPreview = text ? text.substring(0, 200) : '(空)'; 
      const chineseCount = (text.match(/[\u4e00-\u9fff]/g) || []).length;
      const hasReplacement = text.includes('\uFFFD');
      
      const parsed = Utils.parseScript(text);

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
        fullText: text,
        preview: text.substring(0, 5000),
        parsedAt: Date.now(),
        _debug: { chineseCount, hasReplacement, previewFirst200: debugPreview }
      };
      this._persist();

      const debugHtml = hasReplacement 
        ? '<br><span style="font-size:11px;color:#F59E0B;">⚠️ 检测到编码问题（含替换字符）</span>'
        : chineseCount > 10 
          ? '<br><span style="font-size:11px;color:var(--brand-green);">✅ 编码正常</span>'
          : '<br><span style="font-size:11px;color:#F59E0B;">⚠️ 中文较少，可能编码不匹配</span>';

      statusEl.innerHTML = `<div style="text-align:center;padding:12px;color:var(--brand-green);font-size:14px;">
        ✅ 解析成功！${parsed.lineCount} 行，${chineseCount} 个中文字符 ${debugHtml}
      </div>`;

      App.renderStep();
      App.showNotification('剧本上传完成！进入下一步生成分镜', 'success');
    } catch (err) {
      statusEl.innerHTML = `<div style="text-align:center;padding:12px;color:#F87171;">❌ 解析失败：${err.message}</div>`;
      App.showNotification(`解析失败: ${err.message}`, 'error');
    }
  },

  _renderPreview() {
    const script = App.state.script;
    const previewText = script.preview || '';
    if (!previewText) return '<span style="color:var(--text-muted);">无内容</span>';
    return Utils.highlightEntities(this._escapeHtml(previewText), script.entities || [], {});
  },

  /**
   * 校验是否可进入下一步（只需上传即可）
   */
  canProceed() {
    return !!App.state.script;
  },

  _escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  },

  _persist() {
    const fullText = App.state.script ? App.state.script.fullText : null;
    App._persist();
    if (App.state.script && fullText) App.state.script.fullText = fullText;
  }
};
