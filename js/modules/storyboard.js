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
          
          ${shot.prompt ? `
            <div style="margin-top:6px;padding:6px;background:rgba(139,92,246,0.08);border-radius:6px;font-size:10px;line-height:1.6;color:var(--text-muted);white-space:pre-wrap;font-family:monospace;">
              ${this._escapeHtml(shot.prompt)}
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

  // ---- 分镜生成（影视专业化逻辑）----
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
    const allShots = [];
    
    // 标准景别序列（按情绪递进）
    const sceneTypes = ['远景', '全景', '中景', '近景', '特写', '大特写'];
    // 标准运镜方式
    const cameraMoves = ['固定镜头', '推镜', '拉镜', '摇镜', '移镜', '跟镜', '升降'];
    // 标准情绪标签
    const moods = ['平静', '紧张', '愉悦', '悲伤', '愤怒', '惊喜', '悬疑', '温馨', '庄重'];
    
    // ===== 剧本分析 =====
    // 识别场景标记行（如【场景1】、场景：、Scene）
    let sceneSegments = [];
    let currentScene = '默认场景';
    
    lines.forEach((line) => {
      const trimmed = line.trim();
      // 检测场景切换标记
      if (/^【/.test(trimmed) && /】/.test(trimmed)) {
        currentScene = trimmed.replace(/[【】]/g, '');
      } else if (/^场景[:：]/.test(trimmed)) {
        currentScene = trimmed.replace(/^场景[:：]\s*/, '');
      } else if (/^scene/i.test(trimmed)) {
        currentScene = trimmed.replace(/^scene[:：]\s*/i, '');
      }
      sceneSegments.push({ line: trimmed, scene: currentScene });
    });
    
    // ===== 按影视语言划分分镜 =====
    // 规则：
    // 1. 引号内的内容 + 前一行动作 = 一个镜头（对话镜头）
    // 2. 场景切换 = 新镜头起点
    // 3. 纯动作/描写 = 独立镜头
    // 4. 连续动作描述分拆为多个镜头
    
    const shotContents = [];
    
    for (let i = 0; i < sceneSegments.length; i++) {
      const seg = sceneSegments[i];
      const line = seg.line;
      if (!line) continue;
      
      // 场景切换标记：单独作为一个过渡镜头
      if (/^【/.test(line) || /^场景[:：]/.test(line) || /^scene[:：]/i.test(line)) {
        if (shotContents.length > 0) {
          // 先结束上一个镜头组
        }
        shotContents.push({
          type: 'scene_transition',
          text: `场景转换：${seg.scene}`,
          scene: seg.scene,
          duration: 2
        });
        continue;
      }
      
      // 对话行：包含「」或 "" 或 冒号+引号
      if (/[「「]/.test(line) && /[」」]/.test(line)) {
        const dialogue = line;
        // 查找前一行的动作/描写作为镜头铺垫
        const prevLine = i > 0 ? sceneSegments[i-1].line : '';
        if (prevLine && prevLine.length > 1 && !/[「「」」]/.test(prevLine) && !/^【/.test(prevLine) && !/^场景/.test(prevLine)) {
          // 合并前置动作 + 对话 = 一个完整镜头
          shotContents.push({
            type: 'dialogue_with_action',
            text: prevLine + '\n' + dialogue,
            dialogue: dialogue,
            action: prevLine,
            scene: seg.scene,
            duration: Math.max(3, Math.min(10, Math.round(dialogue.length / 15)))
          });
          // 跳过前一行（已经被合并了）
          if (i > 0) sceneSegments[i-1].used = true;
        } else {
          shotContents.push({
            type: 'dialogue',
            text: dialogue,
            dialogue: dialogue,
            action: '',
            scene: seg.scene,
            duration: Math.max(3, Math.min(8, Math.round(dialogue.length / 15)))
          });
        }
        continue;
      }
      
      // 已经被前置对话合并的跳过
      if (seg.used) continue;
      
      // 动作/描写行（没有引号）
      if (line.length > 2 && !/^【/.test(line) && !/^场景/.test(line)) {
        // 长动作描写拆分为多个镜头
        if (line.length > 50 && (line.includes('，') || line.includes('。'))) {
          const parts = line.split(/[。！？]/).filter(p => p.trim().length > 5);
          parts.forEach((part, pi) => {
            const trimmed = part.trim();
            if (trimmed) {
              shotContents.push({
                type: 'action',
                text: trimmed + (pi === parts.length - 1 ? '' : ''),
                dialogue: '',
                action: trimmed,
                scene: seg.scene,
                duration: Math.max(2, Math.min(6, Math.round(trimmed.length / 20)))
              });
            }
          });
        } else {
          shotContents.push({
            type: 'action',
            text: line,
            dialogue: '',
            action: line,
            scene: seg.scene,
            duration: Math.max(2, Math.min(5, 3))
          });
        }
      }
    }
    
    // ===== 生成专业提示词 =====
    shotContents.forEach((sc, idx) => {
      // 智能分配景别（基于镜头内容）
      let sceneType;
      if (sc.type === 'scene_transition') {
        sceneType = '远景';
      } else if (sc.type === 'action' && sc.text.length < 20) {
        sceneType = '全景';
      } else if (sc.text.includes('表情') || sc.text.includes('眼神') || sc.text.includes('流泪') || sc.text.includes('微笑')) {
        sceneType = '特写';
      } else if (sc.dialogue && /[大声喊叫]/ .test(sc.dialogue)) {
        sceneType = '近景';
      } else {
        sceneType = sceneTypes[Math.min(idx, sceneTypes.length - 1)];
      }
      
      // 智能分配运镜
      let camera;
      if (sc.type === 'scene_transition') {
        camera = '摇镜';
      } else if (sc.action && (sc.action.includes('走进') || sc.action.includes('走向'))) {
        camera = '推镜';
      } else if (sc.action && sc.action.includes('离开')) {
        camera = '拉镜';
      } else if (sc.action && (sc.action.includes('转') || sc.action.includes('环顾'))) {
        camera = '摇镜';
      } else if (sc.type === 'dialogue') {
        camera = '固定镜头';
      } else {
        camera = cameraMoves[idx % cameraMoves.length];
      }
      
      // 情绪推断
      let mood = moods[idx % moods.length];
      if (sc.text.includes('哭') || sc.text.includes('悲') || sc.text.includes('难过')) mood = '悲伤';
      else if (sc.text.includes('笑') || sc.text.includes('高兴') || sc.text.includes('开心')) mood = '愉悦';
      else if (sc.text.includes('惊') || sc.text.includes('意外')) mood = '惊喜';
      else if (sc.text.includes('怒') || sc.text.includes('生气') || sc.text.includes('骂')) mood = '愤怒';
      else if (sc.text.includes('紧') || sc.text.includes('焦虑')) mood = '紧张';
      
      // 匹配资产中的角色
      const chars = [];
      const textToMatch = sc.text || sc.dialogue || '';
      Object.entries(binds).forEach(([name, assetId]) => {
        if (textToMatch.includes(name)) {
          const a = assets.find(x => x.id === assetId);
          if (a && a.variants && a.variants.length > 0) {
            const p = a.variants.find(v => v.isPrimary) || a.variants[0];
            chars.push({ name, reference: p.images && p.images[0] || '', assetId });
          }
        }
      });
      
      // == 构造专业提示词 ==
      const charDesc = chars.map(c => c.name).join('、') || '角色';
      const promptParts = [
        `[景别] ${sceneType}`,
        `[运镜] ${camera}`,
        `[场景] ${sc.scene || '默认场景'}`,
        `[动作] ${sc.action || '无'}`,
        `[台词] ${sc.dialogue || '无'}`,
        `[情绪] ${mood}`
      ];
      
      allShots.push({
        id: Utils.uid(),
        shotNumber: allShots.length + 1,
        duration: sc.duration,
        sceneType: sceneType,
        camera: camera,
        dialogue: sc.text.substring(0, 200),
        sceneBackground: sc.scene || '',
        sceneImage: '',
        characters: chars.length > 0 ? chars : [{name:'',reference:'',assetId:''}],
        sceneAssetId: '',
        props: [],
        prompt: promptParts.join('\n'),
        mood: mood,
        approved: false,
        status: 'pending',
        note: '',
        editedDialogue: ''
      });
    });
    
    // 过长限制
    if (allShots.length > 500) {
      allShots.length = 500;
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
