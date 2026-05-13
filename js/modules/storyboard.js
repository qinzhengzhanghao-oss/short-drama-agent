/**
 * storyboard.js — 分镜审核模块
 * ShortDrama Studio v2.0
 * 改动: 每个分镜可单独通过/驳回，无需全部审核即可进入下一步
 */

const StoryboardModule = {
  render() {
    const shots = App.state.storyboard || [];
    const pending = shots.filter(s => s.status === 'pending').length;
    const passed = shots.filter(s => s.status === 'approved').length;
    const rejected = shots.filter(s => s.status === 'rejected').length;

    let html = `
      <div class="card" style="margin-bottom:20px;">
        <div class="card-header">
          <div>
            <div class="card-title">🎬 分镜审核</div>
            <div class="card-subtitle">
              ${shots.length > 0 
                ? `共 ${shots.length} 个镜头（🟡${pending} 待审 ✅${passed} 通过 ❌${rejected} 需修改）`
                : '暂未生成分镜'}
            </div>
          </div>
          <div style="display:flex;gap:8px;">
            <button class="btn btn-primary btn-sm" onclick="StoryboardModule._generateShots()">
              🎬 生成分镜
            </button>
          </div>
        </div>

        ${shots.length === 0 ? `
          <div style="text-align:center;padding:60px 20px;color:var(--text-muted);">
            <div style="font-size:48px;margin-bottom:16px;">🎬</div>
            <div>上传剧本后点击"生成分镜"</div>
          </div>
        ` : ''}
      </div>
    `;

    if (shots.length > 0) {
      const groups = this._groupShots(shots);
      let groupIndex = 0;

      html += `
        <div style="margin-bottom:16px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
          <button class="btn btn-success btn-sm" onclick="StoryboardModule._approveAll()">
            ✅ 全部通过
          </button>
          <button class="btn btn-outline btn-sm" onclick="StoryboardModule._rejectAllPending()">
            ❌ 全部退回待审
          </button>
          <span style="font-size:13px;color:var(--text-muted);">${passed}/${shots.length} 已通过</span>
        </div>
        <div class="storyboard-list">
      `;

      groups.forEach(group => {
        groupIndex++;
        const groupPassed = group.shots.filter(s => s.status === 'approved').length;
        const totalDuration = group.shots.reduce((sum, s) => sum + (s.duration || 5), 0);
        html += `
          <div class="group-panel">
            <div class="group-header"
                 onclick="StoryboardModule._toggleGroup(${groupIndex})">
              <div class="group-title">
                <span>📋 编组 #${groupIndex}</span>
                <span class="badge ${groupPassed === group.shots.length ? 'badge-green' : 'badge-purple'}">
                  ${groupPassed}/${group.shots.length} 通过
                </span>
              </div>
              <div class="group-meta">
                <span>${group.shots.length} 个镜头</span>
                <span>⏱ ${Utils.formatDuration(totalDuration)} ▾</span>
              </div>
            </div>
            <div class="group-body open" id="groupBody${groupIndex}">
              ${group.shots.map((shot, idx) => this._renderShotCard(shot, idx)).join('')}
            </div>
          </div>
        `;
      });
      html += `</div>`;
    }

    return html;
  },

  _renderShotCard(shot, idx) {
    const isApproved = shot.status === 'approved';
    const isRejected = shot.status === 'rejected';
    const isPending = !isApproved && !isRejected;
    
    const statusIcon = isApproved ? '✅' : isRejected ? '❌' : '🟡';
    const statusLabel = isApproved ? '已通过' : isRejected ? '需修改' : '待审核';
    const cardOpacity = isApproved ? '0.7' : '1';
    const cardBorder = isApproved ? 'rgba(29,185,84,0.3)' : isRejected ? 'rgba(239,68,68,0.3)' : 'var(--border-default)';
    
    const assets = App.state.assets || [];
    const charAssets = assets.filter(a => a.type === 'character');
    const sceneAssets = assets.filter(a => a.type === 'scene');

    // 如果已通过，折叠显示
    if (isApproved) {
      return `
        <div class="shot-card shot-approved">
          <div class="shot-number">${shot.shotNumber || idx + 1}</div>
          <div class="shot-content">
            <div class="shot-meta">
              <span class="shot-meta-item">⏱ ${shot.duration || 5}s</span>
              <span class="shot-meta-item">✅ 已通过</span>
              ${shot.dialogue ? `<span style="font-size:11px;color:var(--text-muted);margin-left:8px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:200px;">${this._escapeHtml(shot.dialogue.substring(0,40))}</span>` : ''}
            </div>
          </div>
          <div class="shot-actions" style="flex-direction:column;gap:4px;">
            <button class="btn-icon" title="取消通过" onclick="StoryboardModule._setShotStatus(${idx}, 'pending')" style="color:var(--brand-green);">↩</button>
          </div>
        </div>
      `;
    }

    return `
      <div class="shot-card" style="opacity:${cardOpacity};border-color:${cardBorder}">
        <div class="shot-number">${shot.shotNumber || idx + 1}</div>
        <div class="shot-content">
          <div class="shot-meta">
            <span class="shot-meta-item">⏱ ${shot.duration || 5}s</span>
            <span class="shot-meta-item">${statusIcon} ${statusLabel}</span>
            ${shot.note ? `<span style="font-size:11px;color:#EF4444;margin-left:8px;">📝 ${this._escapeHtml(shot.note)}</span>` : ''}
          </div>

          ${shot.dialogue ? `
            <div class="shot-dialogue" id="shotDialogue_${idx}">
              💬 ${this._escapeHtml(shot.editedDialogue || shot.dialogue)}
            </div>
          ` : ''}

          <!-- 编辑对话（点击分镜描述进入编辑） -->
          <div style="margin-top:4px;font-size:11px;">
            <span style="color:var(--text-muted);cursor:pointer;" onclick="StoryboardModule._editDialogue(${idx})">
              ✏️ 编辑描述
            </span>
          </div>
          
          <div id="shotEditor_${idx}" style="display:none;margin-top:4px;">
            <textarea style="width:100%;min-height:60px;font-size:12px;padding:6px;border:1px solid var(--border-default);border-radius:6px;background:var(--bg-input);color:var(--text-primary);resize:vertical;font-family:inherit;"
              id="shotEditInput_${idx}">${this._escapeHtml(shot.editedDialogue || shot.dialogue || '')}</textarea>
            <div style="display:flex;gap:4px;margin-top:4px;">
              <button class="btn btn-primary btn-sm" style="font-size:11px;padding:2px 10px;" onclick="StoryboardModule._saveDialogue(${idx})">💾 保存</button>
              <button class="btn btn-outline btn-sm" style="font-size:11px;padding:2px 10px;" onclick="StoryboardModule._cancelEditDialogue(${idx})">取消</button>
            </div>
          </div>

          <!-- 角色绑定 -->
          <div style="margin-top:8px;">
            <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px;">👤 角色</div>
            <div style="display:flex;flex-wrap:wrap;gap:4px;">
              ${(shot.characters && shot.characters.length > 0 ? shot.characters : [{name:'',reference:'',assetId:''}]).map((c, ci) => `
                <select class="form-select" style="flex:1;min-width:80px;padding:2px 20px 2px 6px;font-size:11px;min-height:auto;"
                  onchange="StoryboardModule._bindShotCharacter(${idx}, ${ci}, this.value)">
                  <option value="">-- 角色 --</option>
                  ${charAssets.map(a => `<option value="${a.id}" ${c.assetId === a.id ? 'selected' : ''}>${a.name}</option>`).join('')}
                </select>
              `).join('')}
              <button class="btn-icon" style="font-size:11px;padding:2px 6px;" onclick="StoryboardModule._addShotCharacter(${idx})">+</button>
            </div>
          </div>

          <!-- 场景绑定 -->
          <div style="margin-top:6px;">
            <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px;">🏠 场景</div>
            <select class="form-select" style="width:100%;padding:2px 20px 2px 6px;font-size:11px;min-height:auto;"
              onchange="StoryboardModule._bindShotScene(${idx}, this.value)">
              <option value="">-- 场景 --</option>
              ${sceneAssets.map(a => `<option value="${a.id}" ${shot.sceneAssetId === a.id ? 'selected' : ''}>${a.name}</option>`).join('')}
            </select>
          </div>

          <!-- 道具绑定 -->
          <div style="margin-top:6px;">
            <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px;">📦 道具</div>
            <div style="display:flex;flex-wrap:wrap;gap:4px;">
              ${(shot.props || []).map((p, pi) => `
                <span style="font-size:11px;background:var(--bg-input);padding:1px 6px;border-radius:4px;">
                  ${this._escapeHtml(p)} <span style="cursor:pointer;color:#EF4444;" onclick="StoryboardModule._removeShotProp(${idx}, ${pi})">×</span>
                </span>
              `).join('')}
              <input type="text" placeholder="+添加道具" style="width:70px;font-size:11px;padding:1px 4px;border:1px solid var(--border-default);border-radius:4px;background:transparent;color:var(--text-primary);"
                onkeydown="if(event.key==='Enter'){StoryboardModule._addShotProp(${idx}, this.value);this.value=''}">
            </div>
          </div>

          <!-- 驳回备注 -->
          ${isRejected ? `
            <div style="margin-top:6px;">
              <input type="text" placeholder="修改意见（可选）" value="${this._escapeHtml(shot.note || '')}" style="width:100%;font-size:11px;padding:3px 6px;border:1px solid #EF4444;border-radius:4px;background:var(--bg-input);color:var(--text-primary);"
                onchange="StoryboardModule._setShotNote(${idx}, this.value)">
            </div>
          ` : ''}
        </div>
        <div class="shot-actions" style="flex-direction:column;gap:4px;">
          <button class="btn-icon" onclick="StoryboardModule._moveShot(${idx}, -1)" ${idx === 0 ? 'disabled' : ''}>↑</button>
          <button class="btn-icon" onclick="StoryboardModule._moveShot(${idx}, 1)" ${idx === App.state.storyboard.length - 1 ? 'disabled' : ''}>↓</button>
          <button class="btn-icon" onclick="StoryboardModule._setShotStatus(${idx}, 'approved')" style="color:var(--brand-green);font-size:16px;" title="通过">👍</button>
          <button class="btn-icon" onclick="StoryboardModule._setShotStatus(${idx}, 'rejected')" style="color:#EF4444;font-size:16px;" title="驳回">👎</button>
        </div>
      </div>
    `;
  },

  // ---- 分镜生成 ----
  async _generateShots() {
    const script = App.state.script;
    if (!script || !script.fullText) {
      App.showNotification('请先上传剧本', 'warning');
      return;
    }

    const text = script.fullText;
    const lines = text.split('\n').filter(l => l.trim());
    const isLarge = lines.length > 500;
    if (isLarge) App.showNotification(`正在处理 ${lines.length} 行...`, 'info', 3000);

    const assets = App.state.assets || [];
    const binds = script.bindings || {};
    const sceneTypes = ['远景', '全景', '中景', '近景', '特写', '大特写'];
    const cameraMoves = ['固定镜头', '推镜', '拉镜', '摇镜', '移镜', '跟镜', '升降'];
    const allShots = [];
    const BATCH = 200;

    for (let bs = 0; bs < lines.length; bs += BATCH) {
      const be = Math.min(bs + BATCH, lines.length);
      const batch = lines.slice(bs, be);
      const raw = [];
      let cur = '', cnt = 0;

      batch.forEach((line, idx) => {
        const t = line.trim();
        if (!t) return;
        if (t.includes('"') || t.includes('「') || t.includes('\u201c') || t.length > 30) {
          if (cur) raw.push(cur);
          cur = t; cnt++;
        } else if (t.length > 5) {
          cur += (cur ? '\n' : '') + t;
        }
        if (cnt % 5 === 0 && cur && idx > 0 && idx < batch.length - 1) { raw.push(cur); cur = ''; }
      });
      if (cur) raw.push(cur);

      if (raw.length < 2 && batch.length > 5) {
        raw.length = 0;
        let c = '';
        batch.forEach((l, i) => {
          c += (c ? '\n' : '') + l;
          if ((i+1) % 3 === 0) { raw.push(c); c = ''; }
        });
        if (c) raw.push(c);
      }

      raw.forEach((content, i) => {
        const chars = [];
        Object.entries(binds).forEach(([name, assetId]) => {
          if (content.includes(name)) {
            const a = assets.find(x => x.id === assetId);
            if (a && a.variants && a.variants.length > 0) {
              const p = a.variants.find(v => v.isPrimary) || a.variants[0];
              chars.push({ name, reference: p.images && p.images[0] || '', assetId });
            }
          }
        });

        allShots.push({
          id: Utils.uid(),
          shotNumber: allShots.length + 1,
          duration: Math.max(3, Math.min(15, Math.round(Utils.estimateDuration(content)))),
          sceneType: sceneTypes[(allShots.length) % sceneTypes.length],
          camera: cameraMoves[(allShots.length) % cameraMoves.length],
          dialogue: content.substring(0, 200),
          sceneBackground: '',
          sceneImage: '',
          characters: chars.length > 0 ? chars : [{name:'',reference:'',assetId:''}],
          sceneAssetId: '',
          props: [],
          approved: false,
          status: 'pending',
          note: '',
          editedDialogue: ''
        });
      });
    }

    if (allShots.length > 300) {
      const keep = allShots.filter(s => s.dialogue && s.characters.some(c => c.assetId));
      if (keep.length > 20) {
        allShots.length = 0;
        allShots.push(...keep.slice(0, 200));
      }
    }

    App.state.storyboard = allShots;
    this._persist();
    App.renderStep();
    App.showNotification(`已生成 ${allShots.length} 个分镜`, 'success');
  },

  // ---- 审核操作 ----
  _setShotStatus(idx, status) {
    const shot = App.state.storyboard[idx];
    if (!shot) return;
    shot.status = status;
    shot.approved = status === 'approved';
    this._persist();
    App.renderStep();
    
    if (status === 'approved') {
      App.showNotification(`镜头 #${shot.shotNumber} 已通过`, 'success');
    } else if (status === 'rejected') {
      App.showNotification(`镜头 #${shot.shotNumber} 已驳回`, 'warning');
    }
  },

  _setShotNote(idx, note) {
    const shot = App.state.storyboard[idx];
    if (!shot) return;
    shot.note = note;
    this._persist();
  },

  _approveAll() {
    (App.state.storyboard || []).forEach(s => { s.approved = true; s.status = 'approved'; });
    this._persist();
    App.renderStep();
    App.showNotification('所有分镜已审核通过', 'success');
  },

  _rejectAllPending() {
    (App.state.storyboard || []).forEach(s => {
      if (s.status === 'approved') return;
      s.approved = false;
      s.status = 'rejected';
    });
    this._persist();
    App.renderStep();
  },

  // ---- 编辑对话 ----
  _editDialogue(idx) {
    const editor = document.getElementById(`shotEditor_${idx}`);
    if (editor) editor.style.display = 'block';
  },

  _cancelEditDialogue(idx) {
    const editor = document.getElementById(`shotEditor_${idx}`);
    if (editor) editor.style.display = 'none';
  },

  _saveDialogue(idx) {
    const input = document.getElementById(`shotEditInput_${idx}`);
    const shot = App.state.storyboard[idx];
    if (!input || !shot) return;
    shot.editedDialogue = input.value;
    this._persist();
    App.renderStep();
    App.showNotification(`镜头 #${shot.shotNumber} 描述已更新`, 'success');
  },

  // ---- 分镜角色/场景/道具绑定 ----
  _bindShotCharacter(shotIdx, charIdx, assetId) {
    const shot = App.state.storyboard[shotIdx];
    if (!shot) return;
    if (!shot.characters) shot.characters = [{name:'',reference:'',assetId:''}];
    if (charIdx >= shot.characters.length) return;

    const asset = App.state.assets.find(a => a.id === assetId);
    shot.characters[charIdx] = {
      name: asset ? asset.name : '',
      reference: (asset && asset.variants && asset.variants[0] && asset.variants[0].images && asset.variants[0].images[0]) || '',
      assetId: assetId
    };
    this._persist();
    App.renderStep();
  },

  _addShotCharacter(shotIdx) {
    const shot = App.state.storyboard[shotIdx];
    if (!shot) return;
    if (!shot.characters) shot.characters = [];
    shot.characters.push({name:'',reference:'',assetId:''});
    App.renderStep();
  },

  _removeShotProp(shotIdx, propIdx) {
    const shot = App.state.storyboard[shotIdx];
    if (!shot || !shot.props) return;
    shot.props.splice(propIdx, 1);
    App.renderStep();
  },

  _addShotProp(shotIdx, value) {
    const shot = App.state.storyboard[shotIdx];
    if (!shot) return;
    if (!shot.props) shot.props = [];
    if (value.trim()) shot.props.push(value.trim());
    App.renderStep();
  },

  _bindShotScene(shotIdx, assetId) {
    const shot = App.state.storyboard[shotIdx];
    if (!shot) return;
    shot.sceneAssetId = assetId;
    const asset = App.state.assets.find(a => a.id === assetId);
    shot.sceneBackground = asset ? asset.name : '';
    this._persist();
    App.renderStep();
  },

  _groupShots(shots) {
    const groups = [];
    const groupSize = Math.min(4, Math.max(2, Math.floor(shots.length / 20)));
    for (let i = 0; i < shots.length; i += groupSize)
      groups.push({ id: `group_${Math.floor(i / groupSize)}`, shots: shots.slice(i, i + groupSize) });
    return groups;
  },

  _toggleGroup(index) {
    const body = document.getElementById(`groupBody${index}`);
    if (body) body.classList.toggle('open');
  },

  _moveShot(idx, direction) {
    const shots = App.state.storyboard;
    if (!shots || shots.length < 2) return;
    const t = idx + direction;
    if (t < 0 || t >= shots.length) return;
    [shots[idx], shots[t]] = [shots[t], shots[idx]];
    shots.forEach((s, i) => s.shotNumber = i + 1);
    this._persist();
    App.renderStep();
  },

  canProceed() {
    const shots = App.state.storyboard;
    if (!shots || shots.length === 0) return false;
    return shots.some(s => s.status === 'approved');
  },

  _escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  },

  _persist() { App._persist(); }
};
