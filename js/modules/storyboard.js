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
    const systemPrompt = `你是一位顶级的影视分镜师，精通电影语言和视觉叙事。以下是你必须严格执行的分镜创作规则和格式。

## 一、核心创作理念（必须遵循）

### 1. 反差蒙太奇
现实世界的冰冷压抑（冷色调、真实场景）与想象空间的热闹智慧（暖色调、CGI动画）形成极度反差。这种视觉上的"爽感"，是观众多巴胺的来源，也是给智慧"造神"的过程。

### 2. 智慧具象化
不要把古人的话当"台词"念。要设计一个独一无二的动作或道具。诸葛亮的PDF全息投影、王阳明的斩心贼的金光、白居易的雪与墨——这才是世界级的视觉记忆点。

### 3. 节奏即情绪
背锅的焦虑用慢镜头、压抑的声音。出谋划策用快速剪辑、华丽的转场。反击过程用有力的蒙太奇，干净利落。情绪流的闭环是：压抑→求助→点化→明悟→执行→释放。

### 4. 有温度的钩子
结尾不能停在"胜利"。要留下余味和期待——比如一个温暖的食物邀请、一个悬念性的下一集预告。让主角和观众都能喘口气，并期待下一次重逢。

## 二、分镜输出格式（必须严格遵循）

输出为JSON数组，按场景分组。每个镜头对象包含以下字段。

### 每个镜头的字段：
- sceneNumber: 场景编号（数字，如1,2,3）
- sceneName: 场景名称（格式：【场景X：场景名 - 情绪副标题】，如"深夜茶水间 - 情绪的深渊"、"群聊宇宙 - 智慧的圣殿"、"现实反击 - 无声的战争"）
- shotId: 镜头标识（格式"XX-YY"，XX=场景编号补零，YY=镜头编号补零，如"01-1"）
- timecode: 时间码（格式"X:XX-X:XX"，如"0:11-0:18"）
- header: 镜头标签行（格式：镜头 XX-YY (Timecode) | 景别，运镜 | 情绪标签，如"镜头 01-1 (0:11-0:18) | 全景，摇镜 | 压抑感"）
- sceneType: 景别（全景/中景/近景/特写/大特写/中近景/手机特写/手机屏幕满屏/主观镜头/分屏画面/蒙太奇等）
- camera: 镜头运动（固定镜头/摇镜/推镜/拉镜/移镜/跟镜/升降/急速推进+急停/快速剪辑/蒙太奇序列/分屏/主观镜头+快速剪辑/动画/大特写+推镜等）
- mood: 情绪标签（单个词概括，如压抑感/诡异感/压迫感/爆发的出口/悲情诗人/乐观派吃货/心学宗师/终极谋略家/暗流涌动/两级反应/画龙点睛/余味等）
- characters: 角色列表（数组，每个元素包含name角色名、action动作、expression表情、appearance出场描述）
- dialogue: 台词内容。台词要标注角色名
- sceneVisual: （画面）段。详细描述画面构图、人物位置、光影色调、特效动画等。约50-150字。必须包含具体的视觉细节。
- soundEffect: （音效）段。描述环境音、配乐节奏、特效音、声音特殊处理等。约20-60字。包含具体的音效元素。
- subtitle: （字幕）段。屏幕文字、画外音、聊天框文字、公告、动图表情包描述等
- cameraMovement: （镜头）段。镜头运动的具体描述、转场特效细节。如果有"转场"镜头，要详细描述视觉特效
- duration: 该镜头时长（秒，整数）
- transition: 转场方式（切/转场特效/分屏/蒙太奇序列/黑屏等）

### 三段式结构规则：
每个镜头输出时，sceneVisual、soundEffect、subtitle、cameraMovement 这四个字段对应格式中的：
(画面) xxx
(音效) xxx
(字幕) xxx（可选，有画外音或屏幕文字时必填）
(镜头/转场) xxx（可选，有特殊镜头运动或转场特效时必填）

## 三、完整示例（必须参考此格式）

【场景1：深夜茶水间 - 情绪的深渊】

镜头 01-1 (0:11-0:18) | 全景，摇镜 | 压抑感
(画面) 深夜空无一人的办公室。灯光惨白。镜头缓慢摇过一排排熄灭的电脑，最终停在茶水间。林远瘫坐在角落，外面城市的霓虹在他脸上明明灭灭。
(音效) 巨大的、令人不安的寂静。只有冰柜压缩机启动的"嗡——"声，被放大数倍，压得人耳膜难受。

镜头 01-2 (0:19-0:25) | 手机特写 | 诡异感
(画面) 林远无意识地划着手机，屏幕光是他脸上唯一的光源。突然，屏幕毫无征兆地闪了一下，一个从未见过的群聊弹了出来：「华夏智库·天团群」。成员列表像瀑布一样刷过：诸葛亮、苏轼、王阳明、白居易……
(音效) 一声短促的、类似老式电报的滴答声，混入一丝极淡的古琴泛音。
(字幕) 林远画外音（疲惫，带着一丝嘲讽）："什么沙雕Cosplay群……都什么年代了。"

镜头 01-3 (0:26-0:35) | 手机屏幕满屏 | 压迫感
(画面) 领导的消息从屏幕顶端弹窗，像一发子弹击中了林远。文字冰冷而无情："小林，X项目那个锅你先扛一下。你还年轻，以后的路还长，我不会亏待你。"
(音效) 心跳声"咚、咚、咚"在耳边响起，越来越急促。周围的环境音瞬间被抽成真空。
(镜头) 急推林远的面部特写，他瞳孔放大，呼吸急促，愤怒、委屈、恐惧在脸上交织，最后化为一种抓狂。

镜头 01-4 (0:36-0:42) | 主观镜头 + 快速剪辑 | 爆发的出口
(画面) 林远颤抖的手指，在手机屏幕上疯狂点击，切换回那个"中二群"。他按下语音键，用低沉、嘶哑、急迫的声音嘶吼。
(音效) 林远的声音被处理成一种在隧道里的回响："各位大佬，领导让我替他背锅，说以后补偿我。这锅，我该不该背？！"
(特效) 这段话没有变成语音条，而是像投入深渊的一颗石子，在群里激起了一圈圈金色的文字涟漪，瞬间扩散开去。

【场景2：群聊宇宙 - 智慧的圣殿】

(转场 0:43-0:46)
(特效) 镜头猛地"撞"进手机屏幕。我们穿越一道由0和1构成的数据流，然后，数据流爆开，化作漫天飞舞的竹简和宣纸。镜头最终落定，一个不可能的空间出现：仿佛是古代文人书房，但四周是星辰宇宙，每个人的"发言"都会具象化。

镜头 02-1 (0:47-0:53) | 中景，动画 | 悲情诗人：白居易
(画面) 白居易一袭素衣，侧身坐在一叶扁舟之上，背景是萧瑟的江雪。"背锅的滋味我最懂。"他转头，眼神里有看透世事悲凉的通透，"但我是被贬，你这是认领不属于自己的罪行——万万不行。"
(音效) 他说完，摊开手掌，一朵雪花落入掌心，瞬间融化成一滴墨。

镜头 02-2 (0:54-1:00) | 近景，动画 | 乐观派吃货：苏轼
(画面) 苏轼手持一双巨大筷子，夹着一块色泽红亮、Q弹震颤的东坡肉，爽朗大笑。肉的特效要极度诱人，酱汁滴落。
(音效) "不值当！"苏轼用肉指着镜头说，"连'乌台诗案'的待遇都混不上。不如学我做东坡肉，吃饱了再战！P.S. 图片仅供参考。"
(字幕) 他发了一个[东坡肉.jpg]的动图表情包，在聊天框里弹跳。

镜头 02-3 (1:01-1:08) | 大特写 + 推镜 | 心学宗师：王阳明
(画面) 镜头从一个幽深的山谷开始，猛地推到王阳明静坐的脸上。他缓缓睁开眼，眼中仿佛有日月星辰。"你怕的不是穿小鞋，你怕的是心中的那个'贼'。此事，可合乎你心中的道义？"
(音效) "不合……" "既不合，心已蒙尘。"王阳明目光如炬，"除山中贼易，除心中贼难。"
(特效) 他说完，林远的"不合"二字，瞬间被一道金光斩碎。

镜头 02-4 (1:09-1:20) | 全景，动画 | 终极谋略家：诸葛亮
(画面) 诸葛亮在由水晶和光线构成的案台前。羽扇纶巾，面前凭空出现一卷竹简，竹简展开，化为一个全息投影的PDF文件。
(音效) 科技感的"嗞——"声，与竹简展开的"唰"声完美结合。
(镜头) 羽扇轻摇，那份名为《职场沟通避坑指南 V2.3》的PDF划出一道流光，精准地飞入代表林远头像的聊天框里。"写一份复盘报告，把责任的来龙去脉、时间节点、参与人员，都'客观'地写清楚。标题就叫——《X项目复盘与优化建议书——请领导和同事们斧正》。名曰复盘，实为立档。"

【场景3：现实反击 - 无声的战争】

(转场 1:21-1:23)
(特效) 镜头从诸葛亮羽扇上的一个光点拉出，光点变成了电脑屏幕上Word文档的光标。

镜头 03-1 (1:24-1:30) | 蒙太奇 | 暗流涌动
(画面) 快速剪辑：林远的手在键盘上飞速敲击。X项目的时间轴、聊天记录截图、邮件凭证被一条条粘贴进文档。他点击"发送"键的瞬间，手指悬停。
(音效) 背景音乐是急促的鼓点，混合着键盘敲击的清脆音效，越来越快，在发送的那一刻，所有声音骤然停止。

镜头 03-2 (1:31-1:40) | 分屏画面 | 两级反应
(画面) 屏幕一分为二。左侧：领导看着手机，脸瞬间绿了。右侧：大领导远远地、不易察觉地，朝林远的方向点了点头。
(镜头) 画面合二为一，聚焦在林远自信而平静的脸上。

【结尾：余味与钩子】

镜头 04-1 (1:41-1:50) | 手机特写 | 画龙点睛
(画面) 群聊界面。一条金色的群公告升起："真正的成熟，不是学会背锅，而是能用君子的方式，守住小人的防线。——华夏智库·天团群宣"
(音效) 一声沉稳、悠远的古钟声。

镜头 04-2 (1:51-2:00) | 林远近景 + 手机震动 | 生活还在继续
(画面) 林远长舒一口气，瘫在椅背上，嘴角有了笑意。手机震动。苏轼的私聊消息：一个Q版苏轼在颠勺，锅里是油亮亮的东坡肉。"打完仗了？来，我教你做东坡肉！"
(镜头) 镜头缓缓拉远，林远在空旷的办公室里真正地笑了。窗外，天边泛起第一丝鱼肚白。
(字幕) 屏幕底部：下一集预告：方案被偷，我成了"抄袭狗"？
(黑屏)`;

const userPrompt = `请为下面的剧本生成专业分镜脚本：

剧本内容：
${text}

角色列表：${charNames || '未知'}
场景列表：${sceneNames || '未知'}

请尽可能覆盖剧本中的所有场景和对话，生成完整的分镜脚本，不要遗漏任何段落。

提示词(prompt)字段必须极其详细和专业，参考示例格式：
【镜头1，00:00--00:03】【机位】侧拍（青玉侧后方，带李云霄正面）【景别】中近景
【视角】平视【构图】对角线构图（青玉剑锋从右下指向左上，李云霄位于左侧）
【镜头焦距】50mm【焦点】剑锋（00:01秒后切换至李云霄面部）
【摄像机运动】急速推进+急停——镜头从青玉肩后极快速度向前推进，0.5秒内推至剑锋特写...

每个字段都要有精确内容，不能为空。
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
          max_tokens: 32768
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
      // 默认展开前5个镜头的提示词
      allShots.slice(0, 5).forEach(s => { s._promptVisible = true; });

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
      allShots[idx] = {
        id: Utils.uid(),
        shotNumber: idx + 1,
        duration: sc.duration || 3,
        sceneType: sceneType,
        focus: '',
        camera: camera,
        dialogue: (sc.text || '').substring(0, 200),
        monologue: '',
        sceneBackground: sc.scene || '',
        sceneImage: '',
        characters: chars.length > 0 ? chars : [{name:'',action:'',expression:'',reference:'',assetId:''}],
        sceneAssetId: '',
        props: [],
        mood: mood,
        soundEffect: '',
        description: sc.text || '',
        prompt: promptParts.join('\n'),
        approved: false,
        status: 'pending',
        note: '',
        editedDialogue: ''
      };
    });

    if (allShots.length > 500) allShots.length = 500;
    // 默认展开前5个镜头的提示词
    allShots.slice(0, 5).forEach(s => { s._promptVisible = true; });
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
    this._persist();
    App.renderStep();
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
