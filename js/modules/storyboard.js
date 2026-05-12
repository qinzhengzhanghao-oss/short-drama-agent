/**
 * storyboard.js — 分镜审核模块
 * ShortDrama Studio
 */

const StoryboardModule = {
  /**
   * 渲染分镜审核界面
   */
  render() {
    const shots = App.state.storyboard || [];

    let html = `
      <div class="card" style="margin-bottom:20px;">
        <div class="card-header">
          <div>
            <div class="card-title">🎬 分镜审核</div>
            <div class="card-subtitle">
              ${shots.length > 0 ? `共 ${shots.length} 个镜头` : '暂未生成分镜，请先生成'}
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
            <div style="font-size:48px;margin-bottom:16px;opacity:0.4;">🎬</div>
            <div style="font-size:16px;margin-bottom:8px;">尚未生成分镜</div>
            <div style="font-size:13px;">确保已上传剧本并完成实体绑定，然后点击"生成分镜"</div>
          </div>
        ` : ''}
      </div>
    `;

    if (shots.length > 0) {
      const groups = this._groupShots(shots);
      let groupIndex = 0;

      html += `
        <div style="margin-bottom:16px;display:flex;align-items:center;gap:12px;">
          <button class="btn btn-success btn-sm" onclick="StoryboardModule._approveAll()">
            ✅ 全部审核通过
          </button>
          <span style="font-size:13px;color:var(--text-muted);">
            ${shots.filter(s => s.approved).length}/${shots.length} 已审核
          </span>
        </div>

        <div class="storyboard-list">
      `;

      groups.forEach(group => {
        groupIndex++;
        const totalDuration = group.shots.reduce((sum, s) => sum + (s.duration || 5), 0);
        const isOvertime = totalDuration > 120;

        html += `
          <div class="group-panel">
            <div class="group-header ${isOvertime ? 'overtime' : ''}"
                 onclick="StoryboardModule._toggleGroup(${groupIndex})">
              <div class="group-title">
                <span>📋 编组 #${groupIndex}</span>
                <span class="badge ${isOvertime ? 'badge-red' : 'badge-purple'}">
                  ${isOvertime ? '⚠️ 超时' : '正常'}
                </span>
              </div>
              <div class="group-meta">
                <span>${group.shots.length} 个镜头</span>
                <span>⏱ ${Utils.formatDuration(totalDuration)}</span>
                <span>${isOvertime ? '' : '▾'}</span>
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

  /**
   * 渲染单个分镜卡片
   */
  _renderShotCard(shot, idx) {
    const statusIcon = shot.approved ? '✅' : shot.status === 'rejected' ? '❌' : '⏳';
    const sceneTypes = ['远景', '全景', '中景', '近景', '特写', '大特写'];

    return `
      <div class="shot-card" style="opacity:${shot.approved ? '1' : '0.85'};border-color:${shot.approved ? 'rgba(29,185,84,0.3)' : shot.status === 'rejected' ? 'rgba(239,68,68,0.3)' : 'var(--border-default)'}">
        <div class="shot-number">${shot.shotNumber || idx + 1}</div>
        <div class="shot-content">
          <div class="shot-meta">
            <span class="shot-meta-item">⏱ ${shot.duration || 5}s</span>
            <span class="shot-meta-item">🎥 ${this._getSceneType(shot.sceneType) || '中景'}</span>
            ${shot.sceneBackground ? `
              <span class="shot-meta-item" style="display:flex;align-items:center;gap:4px;">
                🏠 <span style="max-width:60px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${Utils.truncate(shot.sceneBackground, 8)}</span>
              </span>
            ` : ''}
            ${(shot.characters && shot.characters.length > 0) ? shot.characters.map(c => `
              <span class="shot-meta-item" style="display:flex;align-items:center;gap:4px;">
                👤 ${c.name || ''}
                ${c.reference ? `<img src="${c.reference}" style="width:16px;height:16px;border-radius:50%;object-fit:cover;">` : ''}
              </span>
            `).join('') : ''}
            <span class="shot-meta-item">${statusIcon}</span>
          </div>

          ${shot.camera ? `<div style="font-size:12px;color:var(--text-secondary);margin-bottom:4px;">🎥 运镜: ${shot.camera}</div>` : ''}
          ${shot.dialogue ? `<div class="shot-dialogue">💬 ${this._escapeHtml(shot.dialogue)}</div>` : ''}

          ${(shot.characterImages && shot.characterImages.length > 0) || (shot.sceneImage) ? `
            <div class="shot-thumbnails">
              ${shot.sceneImage ? `
                <div class="shot-thumbnail"><img src="${shot.sceneImage}" alt="场景" title="场景参考"></div>
              ` : ''}
              ${(shot.characterImages || []).map(img => `
                <div class="shot-thumbnail"><img src="${img}" alt="角色" title="角色参考"></div>
              `).join('')}
            </div>
          ` : ''}
        </div>
        <div class="shot-actions">
          <button class="btn-icon" onclick="StoryboardModule._moveShot(${idx}, -1)" title="上移" ${idx === 0 ? 'disabled' : ''}>↑</button>
          <button class="btn-icon" onclick="StoryboardModule._moveShot(${idx}, 1)" title="下移" ${idx === App.state.storyboard.length - 1 ? 'disabled' : ''}>↓</button>
          <button class="btn-icon" onclick="StoryboardModule._toggleApprove(${idx})" title="${shot.approved ? '取消通过' : '审核通过'}"
            style="${shot.approved ? 'color:var(--brand-green);border-color:rgba(29,185,84,0.3);' : ''}">
            ${shot.approved ? '✓' : '○'}
          </button>
          <button class="btn-icon" onclick="StoryboardModule._rejectShot(${idx})" title="拒绝" style="color:#EF4444;">✕</button>
        </div>
      </div>
    `;
  },

  /**
   * 生成分镜（模拟）
   */
  _generateShots() {
    const script = App.state.script;
    if (!script || !script.fullText) {
      App.showNotification('请先上传并解析剧本', 'warning');
      return;
    }

    // 模拟分镜生成
    const text = script.fullText;
    const lines = text.split('\n').filter(l => l.trim());

    // 简单的分段逻辑：按台词/空行分镜
    const rawShots = [];
    let currentDialogue = '';
    let dialogueCount = 0;

    lines.forEach((line, idx) => {
      const trimmed = line.trim();
      if (!trimmed) return;

      // 简单规则：有引号或较长台词行触发分镜
      if (trimmed.includes('"') || trimmed.includes('「') || trimmed.includes('“') || trimmed.length > 30) {
        if (currentDialogue) {
          rawShots.push(currentDialogue);
        }
        currentDialogue = trimmed;
        dialogueCount++;
      } else if (trimmed.length > 5) {
        currentDialogue += (currentDialogue ? '\n' : '') + trimmed;
      }

      // 每5句或末尾生成一个分镜
      if (dialogueCount % 5 === 0 && currentDialogue && idx > 0 && idx < lines.length - 1) {
        rawShots.push(currentDialogue);
        currentDialogue = '';
      }
    });
    if (currentDialogue) rawShots.push(currentDialogue);

    // 如果太少，用随机分割
    if (rawShots.length < 3) {
      rawShots.length = 0;
      let chunk = '';
      lines.forEach((line, idx) => {
        chunk += (chunk ? '\n' : '') + line;
        if ((idx + 1) % 3 === 0 || line.includes('"')) {
          rawShots.push(chunk);
          chunk = '';
        }
      });
      if (chunk) rawShots.push(chunk);
    }

    const sceneTypes = ['远景', '全景', '中景', '近景', '特写'];
    const cameraMoves = ['固定镜头', '推镜', '拉镜', '摇镜', '移镜', '跟镜', '升降'];

    // 获取绑定资产
    const assets = App.state.assets || [];
    const bindings = script.bindings || {};

    const shots = rawShots.map((content, idx) => {
      const duration = Math.max(3, Math.min(15, Math.round(Utils.estimateDuration(content))));

      // 查找对话中的角色
      const characters = [];
      Object.entries(bindings).forEach(([entityName, assetId]) => {
        if (content.includes(entityName)) {
          const asset = assets.find(a => a.id === assetId);
          if (asset && asset.variants && asset.variants.length > 0) {
            const primary = asset.variants.find(v => v.isPrimary) || asset.variants[0];
            characters.push({
              name: entityName,
              reference: primary.images && primary.images[0] || ''
            });
          }
        }
      });

      // 查找场景
      let sceneId = null;
      let sceneImage = '';
      Object.entries(bindings).forEach(([entityName, assetId]) => {
        const asset = assets.find(a => a.id === assetId);
        if (asset && asset.type === 'scene') {
          sceneId = asset.id;
          if (asset.variants && asset.variants.length > 0) {
            const primary = asset.variants.find(v => v.isPrimary) || asset.variants[0];
            sceneImage = primary.images && primary.images[0] || '';
          }
        }
      });

      return {
        id: Utils.uid(),
        shotNumber: idx + 1,
        duration,
        sceneType: sceneTypes[idx % sceneTypes.length],
        camera: cameraMoves[idx % cameraMoves.length],
        dialogue: content.substring(0, 200),
        sceneBackground: sceneId ? (assets.find(a => a.id === sceneId)?.name || '') : '',
        sceneImage,
        characters,
        characterImages: characters.map(c => c.reference).filter(Boolean),
        prompt: '',
        approved: false,
        status: 'pending',
        groupId: null
      };
    });

    App.state.storyboard = shots;
    this._persist();
    App.renderStep();
    App.showNotification(`已生成 ${shots.length} 个分镜`, 'success');
  },

  /**
   * 分镜分组
   */
  _groupShots(shots) {
    // 简单分组：每3-5个分为一组
    const groups = [];
    const groupSize = 4;
    for (let i = 0; i < shots.length; i += groupSize) {
      groups.push({
        id: `group_${Math.floor(i / groupSize)}`,
        shots: shots.slice(i, i + groupSize)
      });
    }
    return groups;
  },

  /**
   * 切换组折叠
   */
  _toggleGroup(index) {
    const body = document.getElementById(`groupBody${index}`);
    if (body) body.classList.toggle('open');
  },

  /**
   * 移动分镜
   */
  _moveShot(idx, direction) {
    const shots = App.state.storyboard;
    if (!shots || shots.length < 2) return;

    const targetIdx = idx + direction;
    if (targetIdx < 0 || targetIdx >= shots.length) return;

    // 交换
    [shots[idx], shots[targetIdx]] = [shots[targetIdx], shots[idx]];
    shots.forEach((s, i) => s.shotNumber = i + 1);

    this._persist();
    App.renderStep();
  },

  /**
   * 切换审核通过
   */
  _toggleApprove(idx) {
    const shot = App.state.storyboard[idx];
    if (!shot) return;

    if (shot.approved) {
      shot.approved = false;
      shot.status = 'pending';
    } else {
      shot.approved = true;
      shot.status = 'approved';
    }

    this._persist();
    App.renderStep();
  },

  /**
   * 拒绝分镜
   */
  _rejectShot(idx) {
    const shot = App.state.storyboard[idx];
    if (!shot) return;

    shot.approved = false;
    shot.status = 'rejected';
    this._persist();
    App.renderStep();
  },

  /**
   * 全部通过
   */
  _approveAll() {
    (App.state.storyboard || []).forEach(shot => {
      shot.approved = true;
      shot.status = 'approved';
    });
    this._persist();
    App.renderStep();
    App.showNotification('所有分镜已审核通过', 'success');
  },

  /**
   * 获取景别文字
   */
  _getSceneType(type) {
    const map = {
      '远景': '远景', '全景': '全景', '中景': '中景',
      '近景': '近景', '特写': '特写', '大特写': '大特写'
    };
    return map[type] || type || '中景';
  },

  /**
   * 校验
   */
  canProceed() {
    const shots = App.state.storyboard;
    if (!shots || shots.length === 0) return false;
    return shots.every(s => s.approved);
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
