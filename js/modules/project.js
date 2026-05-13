/**
 * project.js — 项目管理模块
 * ShortDrama Studio
 */

const ProjectModule = {
  /**
   * 渲染项目创建/选择界面
   */
  render() {
    const projects = App.state.projects || [];

    let html = '';

    // 已有项目列表
    if (projects.length > 0) {
      html += `
        <div class="card" style="margin-bottom: 24px;">
          <div class="card-header">
            <div>
              <div class="card-title">📁 已有项目</div>
              <div class="card-subtitle">选择已有项目继续编辑，或创建新项目</div>
            </div>
            <button class="btn btn-primary btn-sm" onclick="App.state._showNewProjectForm = true; App.renderStep()">
              ＋ 新建项目
            </button>
          </div>
          <div class="project-list">
            ${projects.map(p => `
              <div class="project-card" onclick="App.selectProject('${p.id}')">
                <div class="project-card-name">${this._escapeHtml(p.name)}</div>
                <div class="project-card-meta">创建于 ${Utils.formatDate(new Date(p.createdAt))}</div>
                <div class="project-card-style badge ${p.style === 'live_action' ? 'badge-purple' : p.style === '2d_anime' ? 'badge-green' : 'badge-blue'}">
                  ${this._getStyleLabel(p.style)}
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }

    // 新建项目表单
    if (projects.length === 0 || App.state._showNewProjectForm) {
      html += this._renderForm(projects.length === 0);
    }

    return html;
  },

  /**
   * 渲染创建表单
   */
  _renderForm(isFirst) {
    const project = App.state.project;

    const styles = [
      { id: 'live_action', label: '真人', icon: '👤', desc: '写实风格真人短剧' },
      { id: '2d_anime', label: '2D动漫', icon: '🎨', desc: '二维动画风格' },
      { id: '3d_anime', label: '3D动漫', icon: '🧊', desc: '三维动画风格' }
    ];

    return `
      <div class="card">
        <div class="card-header">
          <div>
            <div class="card-title">${isFirst ? '🎬 创建你的第一个项目' : '📝 新建项目'}</div>
            <div class="card-subtitle">填写项目信息开始制作你的短剧</div>
          </div>
        </div>
        <div class="card-body">
          <div class="form-group">
            <label class="form-label">项目名称</label>
            <input type="text" class="form-input" id="projectNameInput"
              placeholder="例如：都市奇缘·第一集" 
              value="${project ? this._escapeHtml(project.name) : ''}">
          </div>
          <div class="form-group">
            <label class="form-label">影片风格</label>
            <div class="card-select-group" id="styleSelect">
              ${styles.map(s => `
                <div class="card-select ${(project && project.style === s.id) ? 'selected' : ''}"
                     onclick="ProjectModule._selectStyle('${s.id}')" data-style="${s.id}">
                  <span class="card-select-icon">${s.icon}</span>
                  <span class="card-select-label">${s.label}</span>
                  <div style="font-size:11px;color:var(--text-muted);margin-top:4px;">${s.desc}</div>
                </div>
              `).join('')}
            </div>
            <input type="hidden" id="projectStyleInput" value="${project ? project.style : ''}">
          </div>
          <div style="margin-top: 24px; text-align: right;">
            <button class="btn btn-primary" onclick="ProjectModule._createProject()">
              ${project ? '💾 更新项目' : '🚀 创建项目'}
            </button>
          </div>
        </div>
      </div>
    `;
  },

  /**
   * 选择风格
   */
  _selectStyle(styleId) {
    const container = document.getElementById('styleSelect');
    if (!container) return;
    container.querySelectorAll('.card-select').forEach(el => {
      el.classList.toggle('selected', el.dataset.style === styleId);
    });
    const input = document.getElementById('projectStyleInput');
    if (input) input.value = styleId;
  },

  /**
   * 创建项目
   */
  _createProject() {
    const nameInput = document.getElementById('projectNameInput');
    const styleInput = document.getElementById('projectStyleInput');
    const name = nameInput ? nameInput.value.trim() : '';
    const style = styleInput ? styleInput.value : '';

    if (!name) {
      App.showNotification('请输入项目名称', 'warning');
      nameInput && nameInput.focus();
      return;
    }

    if (!style) {
      App.showNotification('请选择影片风格', 'warning');
      return;
    }

    const projects = App.state.projects || [];

    if (App.state.project && App.state.project.id) {
      // 更新已有项目
      const existing = projects.find(p => p.id === App.state.project.id);
      if (existing) {
        existing.name = name;
        existing.style = style;
        existing.updatedAt = Date.now();
      }
      App.state.project.name = name;
      App.state.project.style = style;
    } else {
      // 创建新项目（清空旧数据）
      const project = {
        id: Utils.uid(),
        name,
        style,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        status: 'draft',
        assets: [],
        script: null,
        storyboard: [],
        promptGroups: [],
        generationTasks: []
      };
      projects.push(project);
      App.state.project = project;
      App.state.assets = [];
      App.state.script = null;
      App.state.storyboard = [];
      App.state.promptGroups = [];
      App.state.generationTasks = [];
    }

    App.state.projects = projects;
    App._persist();
    App.state._showNewProjectForm = false;

    App.showNotification(`项目「${name}」${App.state.project.id && projects.find(p => p.id === App.state.project.id) ? '已更新' : '已创建'}`, 'success');

    // 如果是新项目或更新完成，跳到下一步
    App.nextStep();
  },

  /**
   * 选择已有项目
   */
  selectProject(projectId) {
    const projects = App.state.projects || [];
    const project = projects.find(p => p.id === projectId);
    if (!project) {
      App.showNotification('项目未找到', 'error');
      return;
    }

    App.state.project = project;
    App.state.assets = project.assets || [];
    App.state.script = project.script || null;
    App.state.storyboard = project.storyboard || [];
    App.state.promptGroups = project.promptGroups || [];
    App.state.generationTasks = project.generationTasks || [];

    // 恢复到最后编辑的步骤（至少到步骤2）
    const lastStep = Math.max(project.lastStep || 2, 2);
    App.state.currentStep = lastStep;
    App._persist();
    App.navigateTo(lastStep);

    App.showNotification(`已切换到项目「${project.name}」`, 'info');
  },

  /**
   * 校验是否可进入下一步
   */
  canProceed() {
    return !!App.state.project;
  },

  /**
   * 获取风格标签文字
   */
  _getStyleLabel(style) {
    const map = { live_action: '真人', '2d_anime': '2D动漫', '3d_anime': '3D动漫' };
    return map[style] || style;
  },

  /**
   * HTML转义
   */
  _escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
};
