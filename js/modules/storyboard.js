/**
 * storyboard.js — 分镜审核模块
 * ShortDrama Studio v2.0
 * 改动: 每个分镜可单独通过/驳回/编辑/删除/插入
 *       分镜生成通过 AI 调用 DeepSeek API
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
        <div style="border-top:1px dashed var(--border-default);margin-top:8px;padding-top:8px;">
          <div style="display:flex;gap:4px;align-items:center;margin-bottom:4px;">
            <button class="btn-icon" onclick="StoryboardModule._insertShotAbove(${idx})" style="font-size:12px;color:var(--brand-purple);" title="在此上方插入分镜">＋ 插入</button>
          </div>
          <div class="shot-card shot-approved">
            <div class="shot-number">${shot.shotNumber || idx + 1}</div>
            <div class="shot-content">
              <div class="shot-meta">
                <span class="shot-meta-item">⏱ ${shot.duration || 5}s</span>
                <span class="shot-meta-item">✅ 已通过</span>
                ${shot.dialogue ? `<span style="font-size:11px;color:var(--text-muted);margin-left:8px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:200px;">${this._escapeHtml(shot.dialogue && shot.dialogue.substring ? shot.dialogue.substring(0,40) : '')}</span>` : ''}
              </div>
            </div>
            <div class="shot-actions" style="flex-direction:row;gap:4px;align-items:center;">
              <button class="btn-icon" title="取消通过" onclick="StoryboardModule._setShotStatus(${idx}, 'pending')" style="color:var(--brand-green);">↩</button>
            </div>
          </div>
        </div>
      `;
    }

    return `
      <div style="border-top:1px dashed var(--border-default);margin-top:8px;padding-top:8px;">
        <div style="display:flex;gap:8px;align-items:center;margin-bottom:4px;">
          <button class="btn btn-outline btn-sm" onclick="StoryboardModule._insertShotAbove(${idx})" style="font-size:11px;padding:1px 8px;color:var(--brand-purple);border-color:var(--border-default);">＋ 插入镜头</button>
          <button class="btn btn-outline btn-sm" onclick="StoryboardModule._deleteShot(${idx})" style="font-size:11px;padding:1px 8px;color:#EF4444;border-color:var(--border-default);">🗑 删除</button>
        </div>
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
          
          <div style="margin-top:8px;">
            <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px;cursor:pointer;" onclick="StoryboardModule._togglePrompt(${idx})">
              📝 提示词 ${shot._promptVisible ? '▲' : '▶'}
            </div>
            <div id="promptArea_${idx}" style="${shot._promptVisible ? 'display:block' : 'display:none'};padding:8px;background:rgba(139,92,246,0.06);border:1px solid rgba(139,92,246,0.15);border-radius:6px;font-size:11px;line-height:1.8;color:var(--text-primary);white-space:pre-wrap;font-family:monospace;max-height:400px;overflow-y:auto;">
              ${shot.prompt ? this._escapeHtml(shot.prompt) : '<span style="color:var(--text-muted);">无提示词</span>'}
            </div>
          </div>

          <!-- 编辑对话 -->
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
        <div class="shot-actions" style="flex-direction:row;gap:2px;align-items:center;flex-wrap:wrap;">
          <button class="btn-icon" onclick="StoryboardModule._moveShot(${idx}, -1)" ${idx === 0 ? 'disabled' : ''}>↑</button>
          <button class="btn-icon" onclick="StoryboardModule._moveShot(${idx}, 1)" ${idx === App.state.storyboard.length - 1 ? 'disabled' : ''}>↓</button>
          <button class="btn-icon" onclick="StoryboardModule._setShotStatus(${idx}, 'approved')" style="color:var(--brand-green);font-size:16px;" title="通过">👍</button>
          <button class="btn-icon" onclick="StoryboardModule._setShotStatus(${idx}, 'rejected')" style="color:#EF4444;font-size:16px;" title="驳回">👎</button>
          <!-- 删除按钮已经移到卡片上方 -->
        </div>
      </div>
      </div>
    `;
  },

  // ---- 分镜生成（调用 DeepSeek API）----
  async _generateShots() {
    const script = App.state.script;
    if (!script || !script.fullText) {
      App.showNotification('请先上传剧本', 'warning');
      return;
    }

    App.showNotification('正在调用 AI 生成专业分镜...', 'info', 60000);

    // 1. 全量剧本发送给AI
    const text = script.fullText;
    App.showNotification('正在分析 ' + Math.round(text.length/1000) + 'k 剧本...', 'info', 60000);
    const entities = script.entities || [];
    const charNames = entities.filter(e => e.type === 'character').map(e => e.name).join('、');
    const sceneNames = entities.filter(e => e.type === 'scene').map(e => e.name).join('、');
    
    // 2. 构建 Prompt
    const systemPrompt = `你是一位专业的影视分镜师。请根据提供的剧本内容，输出专业的分镜脚本。

输出格式为JSON数组，每个元素代表一个镜头，包含以下字段：
- shotNumber: 镜头编号（数字）
- sceneType: 景别（远景/全景/中景/近景/特写/大特写）
- focus: 焦点（人物/场景/道具/动作）
- characters: 角色列表（数组，每个元素包含name角色名、action动作、expression表情）
- dialogue: 台词
- monologue: 独白
- camera: 镜头运动（固定镜头/推镜/拉镜/摇镜/移镜/跟镜/升降）
- scene: 场景描述
- duration: 时长（秒）
- mood: 情绪
- soundEffect: 音效
- description: 画面描述（详细描述画面构图、人物位置、光影）
- prompt: 完整的AI视频生成提示词，格式必须严格如下，每个字段单独一行：
  【场景】当前镜头所在的具体场景描述
  【角色】镜头中出现哪些角色，以及他们的基本特征
  【景别】远景/全景/中景/近景/特写/大特写
  【镜头角度】平拍/俯拍/仰拍/侧拍/过肩镜头
  【镜头时长】该镜头持续的秒数
  【焦点】画面焦点在哪里（人物/场景/道具/动作）
  【画面】详细的画面描述，包括构图、人物位置、光影、色调等
  【动作】动作的三阶段：预备（准备动作）、过程（动作过程）、终点（动作完成后的状态）
  【表情控制】角色面部表情的具体要求
  【面部微动作】角色细微的面部动作（眼神、嘴角、眉毛等）
  【镜头运动】固定镜头/推镜/拉镜/摇镜/移镜/跟镜/升降
  【台词】角色说出的具体台词，用【角色名】音色引用自【角色名】
  【音效】环境音效和特效音
  注意：每个【】字段必须都有内容，不能为空。提示词要完整、专业、可直接用于AI视频生成。

规则：
1. 每个镜头只表达一个完整的画面信息
2. 对话和动作要分别对应不同的镜头
3. 景别要丰富变化，不要连续使用相同景别
4. 镜头运动要合理，对话场景多用固定镜头，情绪高潮用推镜
5. 人物情绪要准确贴合剧情走向
6. 时长根据台词长度和动作复杂度合理分配`;

    const userPrompt = `请为下面的剧本生成专业分镜脚本：

剧本内容：
${text}

角色列表：${charNames || '未知'}
场景列表：${sceneNames || '未知'}

请尽可能覆盖剧本中的所有场景和对话，生成完整的分镜脚本，不要遗漏任何段落。
直接输出JSON数组，不要包含其他文字。

注意：每1000字剧本大约对应8-15个镜头，请尽量完整生成。`;

    try {
      // 3. 调用 DeepSeek API
      const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer sk-45988f3fb8d04b038599a182dd54f505'
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.8,
          max_tokens: 8192
        })
      });

      if (!response.ok) {
        const errData = await response.text();
        throw new Error(`API请求失败: ${response.status} ${errData}`);
      }

      const data = await response.json();
      const content = data.choices[0].message.content;
      
      // 4. 解析 JSON
      let shotsFromAI;
      try {
        // 尝试提取 JSON（AI 可能返回 markdown 包裹）
        const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || content.match(/\[[\s\S]*\]/);
        const jsonStr = jsonMatch ? jsonMatch[1] || jsonMatch[0] : content;
        shotsFromAI = JSON.parse(jsonStr);
        if (!Array.isArray(shotsFromAI)) throw new Error('不是数组');
      } catch (e) {
        console.error('AI返回解析失败:', content);
        throw new Error('AI返回格式不正确，无法解析分镜');
      }

      // 5. 转换为系统分镜格式
      const assets = App.state.assets || [];
      const allShots = shotsFromAI.map((s, idx) => ({
        id: Utils.uid(),
        shotNumber: idx + 1,
        duration: s.duration || Math.max(3, Math.min(10, 5)),
        sceneType: s.sceneType || '中景',
        focus: s.focus || '',
        camera: s.camera || '固定镜头',
        dialogue: (s.dialogue || s.description || '').substring(0, 200),
        monologue: s.monologue || '',
        sceneBackground: s.scene || '',
        sceneImage: '',
        characters: (s.characters || []).length > 0 
          ? s.characters.map(c => ({
              name: c.name || '',
              action: c.action || '',
              expression: c.expression || '',
              reference: '',
              assetId: ''
            }))
          : [{name:'',action:'',expression:'',reference:'',assetId:''}],
        sceneAssetId: '',
        props: [],
        mood: s.mood || '平静',
        soundEffect: s.soundEffect || '',
        description: s.description || '',
        prompt: s.prompt || `【场景】${s.scene || ''}\n【角色】${(s.characters || []).map(c => c.name).join('、') || ''}\n【景别】${s.sceneType || '中景'}\n【镜头角度】平拍\n【镜头时长】${s.duration || 5}秒\n【焦点】${s.focus || ''}\n【画面】${s.description || ''}\n【动作】预备→过程→终点\n【表情控制】${s.expression || ''}\n【面部微动作】\n【镜头运动】${s.camera || '固定镜头'}\n【台词】${s.dialogue || ''}，音色引用自${(s.characters || []).map(c => c.name).join('、') || '角色'}\n【音效】${s.soundEffect || ''}`,
        approved: false,
        status: 'pending',
        note: '',
        editedDialogue: ''
      }));

      // 6. 限制数量
      if (allShots.length > 500) {
        allShots.length = 500;
      }

      App.state.storyboard = allShots;
      this._persist();
      App.renderStep();
      App.showNotification(`AI 已生成 ${allShots.length} 个专业分镜`, 'success');

    } catch (err) {
      console.error('AI分镜生成失败:', err);
      App.showNotification(`分镜生成失败: ${err.message}，请检查 API 配置`, 'error');
      // 回退到本地生成
      App.showNotification('正在使用本地规则生成备用分镜...', 'info', 3000);
      this._generateShotsLocal();
    }
  },

  // ---- 备用本地分镜生成 ----
  async _generateShotsLocal() {
    const script = App.state.script;
    if (!script || !script.fullText) return;

    const text = script.fullText;
    const lines = text.split('\n').filter(l => l.trim());
    const assets = App.state.assets || [];
    const binds = script.bindings || {};
    const sceneTypes = ['远景', '全景', '中景', '近景', '特写', '大特写'];
    const cameraMoves = ['固定镜头', '推镜', '拉镜', '摇镜', '移镜', '跟镜', '升降'];
    const moods = ['平静', '紧张', '愉悦', '悲伤', '愤怒', '惊喜', '悬疑', '温馨', '庄重'];
    const allShots = [];

    // 场景分段
    let sceneSegments = [];
    let currentScene = '默认场景';
    lines.forEach((line) => {
      const t = line.trim();
      if (/^【/.test(t) && /】/.test(t)) currentScene = t.replace(/[【】]/g, '');
      else if (/^场景[:：]/.test(t)) currentScene = t.replace(/^场景[:：]\s*/, '');
      sceneSegments.push({ line: t, scene: currentScene });
    });

    // 按对话和动作生成分镜
    for (let i = 0; i < sceneSegments.length; i++) {
      const seg = sceneSegments[i];
      const line = seg.line;
      if (!line) continue;
      if (/^【/.test(line) || /^场景[:：]/.test(line)) {
        allShots.push({
          type: 'transition', text: `场景转换：${seg.scene}`, scene: seg.scene, duration: 2
        });
        continue;
      }
      if (/[「「]/.test(line) && /[」」]/.test(line)) {
        const prevLine = i > 0 ? sceneSegments[i-1].line : '';
        if (prevLine && prevLine.length > 1 && !/[「「」」]/.test(prevLine) && !/^【/.test(prevLine)) {
          allShots.push({
            text: prevLine + '\n' + line, dialogue: line, action: prevLine, scene: seg.scene,
            duration: Math.max(3, Math.min(10, Math.round(line.length / 15)))
          });
          if (i > 0) sceneSegments[i-1].used = true;
        } else {
          allShots.push({
            text: line, dialogue: line, action: '', scene: seg.scene,
            duration: Math.max(3, Math.min(8, Math.round(line.length / 15)))
          });
        }
        continue;
      }
      if (seg.used) continue;
      if (line.length > 2) {
        allShots.push({
          text: line, dialogue: '', action: line, scene: seg.scene, duration: 3
        });
      }
    }

    allShots.forEach((sc, idx) => {
      let sceneType = '中景';
      let camera = '固定镜头';
      let mood = moods[idx % moods.length];
      if (sc.text && (sc.text.includes('哭') || sc.text.includes('悲'))) mood = '悲伤';
      else if (sc.text && (sc.text.includes('笑') || sc.text.includes('高兴'))) mood = '愉悦';
      else if (sc.text && (sc.text.includes('怒') || sc.text.includes('骂'))) mood = '愤怒';

      const chars = [];
      Object.entries(binds).forEach(([name, assetId]) => {
        if ((sc.text || '').includes(name)) {
          const a = assets.find(x => x.id === assetId);
          if (a && a.variants && a.variants.length > 0) {
            const p = a.variants.find(v => v.isPrimary) || a.variants[0];
            chars.push({ name, reference: p.images && p.images[0] || '', assetId, action: '', expression: '' });
          }
        }
      });

      const promptParts = [
        `【场景】${sc.scene || '默认场景'}`,
        `【角色】${chars.map(c => c.name).join('、') || ''}`,
        `【景别】${sceneType}`,
        `【镜头角度】平拍`,
        `【镜头时长】${sc.duration || 5}秒`,
        `【焦点】${'人物'}`,
        `【画面】${sc.text || ''}`,
        `【动作】预备→过程→终点`,
        `【表情控制】`,
        `【面部微动作】`,
        `【镜头运动】${camera}`,
        `【台词】${sc.dialogue || ''}，音色引用自${chars.map(c => c.name).join('、') || '角色'}`,
        `【音效】`
      ];
      prompt: promptParts.join('\n'),
        approved: false,
        status: 'pending',
        note: '',
        editedDialogue: ''
      };
    });

    if (allShots.length > 500) allShots.length = 500;
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

  _deleteShot(idx) {
    const shots = App.state.storyboard;
    if (!shots || shots.length <= 1) {
      App.showNotification('至少保留一个分镜', 'warning');
      return;
    }
    const shot = shots[idx];
    if (!shot) return;
    if (!confirm(`确定删除镜头 #${shot.shotNumber} 吗？`)) return;
    shots.splice(idx, 1);
    shots.forEach((s, i) => s.shotNumber = i + 1);
    this._persist();
    App.renderStep();
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
    if (!shot.characters) shot.characters = [{name:'',reference:'',assetId:'',action:'',expression:''}];
    if (charIdx >= shot.characters.length) return;

    const asset = App.state.assets.find(a => a.id === assetId);
    const existing = shot.characters[charIdx];
    shot.characters[charIdx] = {
      name: asset ? asset.name : existing.name || '',
      action: existing.action || '',
      expression: existing.expression || '',
      reference: (asset && asset.variants && asset.variants[0] && asset.variants[0].images && asset.variants[0].images[0]) || existing.reference || '',
      assetId: assetId || existing.assetId || ''
    };
    this._persist();
    App.renderStep();
  },

  _addShotCharacter(shotIdx) {
    const shot = App.state.storyboard[shotIdx];
    if (!shot) return;
    if (!shot.characters) shot.characters = [];
    shot.characters.push({name:'',action:'',expression:'',reference:'',assetId:''});
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

  _insertShotAbove(idx) {
    const shots = App.state.storyboard;
    if (!shots) return;
    const dialogue = prompt('输入新分镜的描述：', '');
    if (!dialogue || !dialogue.trim()) return;
    const newShot = {
      id: Utils.uid(),
      shotNumber: idx + 1,
      duration: Math.max(2, Math.min(10, Math.round(dialogue.length / 15))),
      sceneType: '中景',
      focus: '',
      camera: '固定镜头',
      dialogue: dialogue.trim().substring(0, 200),
      monologue: '',
      sceneBackground: '',
      sceneImage: '',
      characters: [{name:'',action:'',expression:'',reference:'',assetId:''}],
      sceneAssetId: '',
      props: [],
      mood: '平静',
      soundEffect: '',
      description: '',
      prompt: `【场景】\n【角色】\n【景别】中景\n【镜头角度】平拍\n【镜头时长】5秒\n【焦点】\n【画面】${dialogue.trim().substring(0, 80)}\n【动作】预备→过程→终点\n【表情控制】\n【面部微动作】\n【镜头运动】固定镜头\n【台词】\n【音效】`,
      approved: false,
      status: 'pending',
      note: '',
      editedDialogue: ''
    };
    shots.splice(idx, 0, newShot);
    shots.forEach((s, i) => s.shotNumber = i + 1);
    this._persist();
    App.renderStep();
    App.showNotification('新分镜已插入', 'success');
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

  _togglePrompt(idx) {
    const shot = App.state.storyboard[idx];
    if (!shot) return;
    shot._promptVisible = !shot._promptVisible;
    // 不用full re-render，直接toggle显示
    const el = document.getElementById(`promptArea_${idx}`);
    if (el) {
      el.style.display = shot._promptVisible ? 'block' : 'none';
    }
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
