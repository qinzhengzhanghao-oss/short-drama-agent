/**
 * prompt.js — 提示词构建与审核模块
 * ShortDrama Studio
 */

const PromptModule = {
  /**
   * 渲染提示词审核界面
   */
  render() {
    const shots = App.state.storyboard || [];
    if (shots.length === 0) {
      return `
        <div class="card">
          <div style="text-align:center;padding:60px 20px;color:var(--text-muted);">
            <div style="font-size:48px;margin-bottom:16px;opacity:0.4;">✍️</div>
            <div style="font-size:16px;margin-bottom:8px;">无可用分镜数据</div>
            <div style="font-size:13px;">请先完成分镜审核</div>
          </div>
        </div>
      `;
    }

    const groups = this._buildPromptGroups(shots);
    App.state.promptGroups = groups;

    return `
      <div class="card" style="margin-bottom:20px;">
        <div class="card-header">
          <div>
            <div class="card-title">✍️ 提示词审核</div>
            <div class="card-subtitle">审核每组的视频生成提示词，接点镜头锁定不可编辑</div>
          </div>
          <div>
            <span class="badge badge-purple">${groups.length} 组</span>
            <span class="badge badge-gray">${shots.length} 个镜头</span>
          </div>
        </div>

        ${this._renderPromptGroups(groups)}
      </div>
    `;
  },

  /**
   * 构建提示词组（每4个镜头一组）
   */
  _buildPromptGroups(shots) {
    const groups = [];
    const groupSize = 4;

    for (let i = 0; i < shots.length; i += groupSize) {
      const groupShots = shots.slice(i, i + groupSize);
      const group = {
        id: `prompt_group_${groups.length + 1}`,
        name: `提示词组 #${groups.length + 1}`,
        shots: groupShots,
        prompts: groupShots.map(shot => this._generatePrompt(shot)),
        confirmed: false
      };
      groups.push(group);
    }

    return groups;
  },

  /**
   * 生成单条提示词
   */
  _generatePrompt(shot) {
    const parts = [];

    // 场景描述
    if (shot.sceneBackground) {
      parts.push(`场景：${shot.sceneBackground}`);
    }

    // 角色
    if (shot.characters && shot.characters.length > 0) {
      const charNames = shot.characters.map(c => c.name).join('、');
      parts.push(`角色：${charNames}`);
    }

    // 景别
    const sceneTypes = ['远景', '全景', '中景', '近景', '特写', '大特写'];
    const sceneType = shot.sceneType || '中景';
    if (sceneTypes.includes(sceneType)) {
      parts.push(`景别：${sceneType}`);
    }

    // 运镜
    if (shot.camera) {
      parts.push(`运镜：${shot.camera}`);
    }

    // 台词描述
    if (shot.dialogue) {
      const brief = shot.dialogue.substring(0, 80);
      parts.push(`台词/动作：${brief}`);
    }

    // 风格前导
    const styleMap = {
      live_action: '写实风格，电影级画面，自然光影',
      '2d_anime': '二维动画风格，日系动漫质感',
      '3d_anime': '三维动画风格，皮克斯质感'
    };
    const projectStyle = (App.state.project && App.state.project.style) || 'live_action';
    parts.unshift(styleMap[projectStyle] || styleMap.live_action);

    return `[${projectStyle}] ${parts.join('；。')}`;
  },

  /**
   * 渲染提示词组
   */
  _renderPromptGroups(groups) {
    return groups.map((group, gi) => {
      const isAllConfirmed = groups.every(g => g.confirmed);
      const firstShot = group.shots[2]; // 接点镜头通常是每组中间位置

      return `
        <div class="prompt-group-card">
          <div class="prompt-group-header">
            <div>
              <div class="card-title" style="font-size:14px;">${group.name}</div>
              <div class="card-subtitle" style="font-size:12px;">
                ${group.shots.length} 个镜头
                ${group.confirmed ? '｜<span style="color:var(--brand-green);">✅ 已确认</span>' : ''}
              </div>
            </div>
            ${group.confirmed
              ? '<span class="badge badge-green">已确认</span>'
              : `<button class="btn btn-sm btn-success" onclick="PromptModule._confirmGroup(${gi})">确认本组</button>`
            }
          </div>
          <div class="prompt-group-body">
            ${group.shots.map((shot, si) => {
              const shotIdx = App.state.storyboard.indexOf(shot);
              const isLocked = si >= 2; // 前2个镜头可编辑，后2个锁定

              return `
                <div style="margin-bottom:16px;${si > 0 ? 'margin-top:12px;padding-top:12px;border-top:1px solid var(--border-default);' : ''}">
                  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
                    <div style="display:flex;align-items:center;gap:6px;">
                      <span class="badge badge-purple">#${shot.shotNumber}</span>
                      <span style="font-size:12px;color:var(--text-muted);">${shot.sceneType || '中景'} · ${shot.duration || 5}s</span>
                      ${isLocked ? '<span class="badge badge-gray">🔒 接点镜头</span>' : '<span class="badge badge-green">✏️ 可编辑</span>'}
                    </div>
                    ${shot.characterImages && shot.characterImages.length > 0 ? `
                      <div class="prompt-ref-images" style="margin-top:0;">
                        ${shot.characterImages.map(img => `
                          <div class="prompt-ref-image"><img src="${img}" alt="ref" title="参考图"></div>
                        `).join('')}
                        ${shot.sceneImage ? `
                          <div class="prompt-ref-image"><img src="${shot.sceneImage}" alt="场景" title="场景参考" style="border-color:rgba(37,99,235,0.3);"></div>
                        ` : ''}
                      </div>
                    ` : ''}
                  </div>
                  <textarea class="prompt-textarea ${isLocked ? 'locked' : ''}"
                    ${isLocked ? 'readonly' : ''}
                    placeholder="输入提示词..."
                    data-group="${gi}"
                    data-shot="${si}"
                    oninput="PromptModule._updatePrompt(${gi}, ${si}, this.value)">${group.prompts[si] || ''}</textarea>
                </div>
              `;
            }).join('')}

            <div style="text-align:right;padding-top:8px;">
              ${group.confirmed
                ? `<span style="color:var(--brand-green);font-size:13px;">✅ 本组提示词已确认</span>`
                : ''
              }
            </div>
          </div>
        </div>
      `;
    }).join('');
  },

  /**
   * 更新提示词
   */
  _updatePrompt(groupIdx, shotIdx, value) {
    const groups = App.state.promptGroups;
    if (!groups || !groups[groupIdx]) return;
    groups[groupIdx].prompts[shotIdx] = value;
  },

  /**
   * 确认一组
   */
  _confirmGroup(groupIdx) {
    const groups = App.state.promptGroups;
    if (!groups || !groups[groupIdx]) return;

    // 检查是否所有提示词都非空
    const emptyIdx = groups[groupIdx].prompts.findIndex(p => !p || !p.trim());
    if (emptyIdx >= 0) {
      App.showNotification(`请完善镜头 #${groups[groupIdx].shots[emptyIdx].shotNumber} 的提示词`, 'warning');
      return;
    }

    groups[groupIdx].confirmed = true;
    this._persist();
    App.renderStep();

    // 检查是否全部确认
    if (groups.every(g => g.confirmed)) {
      App.showNotification('所有提示词组已确认！可以进入生成步骤', 'success');
    } else {
      App.showNotification(`提示词组 #${groupIdx + 1} 已确认`, 'success');
    }
  },

  /**
   * 校验
   */
  canProceed() {
    const groups = App.state.promptGroups;
    if (!groups || groups.length === 0) return false;
    return groups.every(g => g.confirmed);
  },

  /**
   * 持久化
   */
  _persist() {
    App._persist();
  }
};
