/**
 * app.js — 应用核心：路由/状态管理
 * ShortDrama Studio
 * v2.0 持久化时自动剥离大文本，避免 localStorage 爆配额
 */

const App = {
  /**
   * 应用状态
   */
  state: {
    currentStep: 1,
    project: null,
    projects: [],
    assets: [],
    script: null,
    storyboard: [],
    promptGroups: [],
    generationTasks: [],
    settings: {},
    _showNewProjectForm: false,
    _expandedAsset: null
  },

  /**
   * 步骤定义
   */
  steps: [
    { id: 1, name: '项目创建', icon: '📁', component: 'project' },
    { id: 2, name: '资产管理', icon: '🎭', component: 'assets' },
    { id: 3, name: '剧本上传', icon: '📜', component: 'script' },
    { id: 4, name: '分镜审核', icon: '🎬', component: 'storyboard' },
    { id: 5, name: '提示词审核', icon: '✍️', component: 'prompt' },
    { id: 6, name: '生成与下载', icon: '🚀', component: 'generate' }
  ],

  /**
   * 模块映射
   */
  modules: {
    project: ProjectModule,
    assets: AssetsModule,
    script: ScriptModule,
    storyboard: StoryboardModule,
    prompt: PromptModule,
    generate: GenerateModule
  },

  _confirmCallback: null,

  /**
   * 初始化应用
   */
  init() {
    this._restore();
    this._renderNavigation();
    this.renderStep();
    this._updateProgressBar();
    this._updateButtons();

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closeConfirm();
      }
    });
  },

  /**
   * 渲染左侧步骤导航
   */
  _renderNavigation() {
    const container = document.getElementById('stepsNav');
    if (!container) return;

    let html = '';
    this.steps.forEach((step, idx) => {
      const status = this._getStepStatus(step.id);
      const indicatorContent = status === 'completed' ? '✅' : step.icon;
      const hasProgressLine = status === 'current';

      html += `
        <div class="step-item ${status === 'current' ? 'active' : status === 'completed' ? 'completed' : 'disabled'}"
             onclick="App.navigateTo(${step.id})">
          <div class="step-indicator">${indicatorContent}</div>
          <div class="step-info">
            <div class="step-name">${status === 'completed' ? step.name : step.name}</div>
            ${hasProgressLine ? `
              <div class="step-progress-line">
                <div class="progress-fill-inner"></div>
              </div>
            ` : ''}
          </div>
        </div>
      `;

      if (idx < this.steps.length - 1) {
        html += `<div class="step-line ${status === 'completed' ? 'completed' : ''}"></div>`;
      }
    });

    container.innerHTML = html;
  },

  /**
   * 获取步骤状态
   */
  _getStepStatus(stepId) {
    const current = this.state.currentStep;
    if (stepId < current) return 'completed';
    if (stepId === current) return 'current';
    return 'pending';
  },

  /**
   * 跳转到指定步骤
   */
  navigateTo(step) {
    if (step < 1 || step > 6) return;

    if (!this.canProceedTo(step)) return;

    this.state.currentStep = step;
    this._persist();
    this._renderNavigation();
    this.renderStep();
    this._updateProgressBar();
    this._updateButtons();
  },

  /**
   * 渲染当前步骤内容
   */
  renderStep() {
    const step = this.steps.find(s => s.id === this.state.currentStep);
    if (!step) return;

    const titleEl = document.getElementById('stepTitle');
    if (titleEl) {
      titleEl.textContent = `${step.icon} ${step.name}`;
    }

    const body = document.getElementById('contentBody');
    if (!body) return;

    const module = this.modules[step.component];
    if (module && typeof module.render === 'function') {
      body.innerHTML = module.render();

      if (step.component === 'assets' && AssetsModule.renderValidation) {
        setTimeout(() => AssetsModule.renderValidation(), 100);
      }
    } else {
      body.innerHTML = `<div class="card"><p style="color:var(--text-muted);">模块未加载: ${step.component}</p></div>`;
    }

    this._updateButtons();
  },

  /**
   * 下一步
   */
  nextStep() {
    const currentStep = this.state.currentStep;
    const module = this.modules[this.steps.find(s => s.id === currentStep).component];

    if (module && typeof module.canProceed === 'function') {
      if (!module.canProceed()) {
        const stepNames = {
          'project': '请先创建项目',
          'assets': '请至少添加一个角色资产',
          'script': '请上传并解析剧本，并绑定所有实体',
          'storyboard': '请生成分镜并审核通过所有镜头',
          'prompt': '请确认所有提示词组',
          'generate': '请等待所有视频生成完成'
        };
        App.showNotification(stepNames[this.steps.find(s => s.id === currentStep).component] || '请完成当前步骤', 'warning');
        return;
      }
    }

    if (currentStep < 6) {
      this.navigateTo(currentStep + 1);
    }
  },

  /**
   * 上一步
   */
  prevStep() {
    if (this.state.currentStep > 1) {
      this.navigateTo(this.state.currentStep - 1);
    }
  },

  /**
   * 校验是否可以跳转到目标步骤
   */
  canProceedTo(targetStep) {
    if (targetStep <= this.state.currentStep) return true;

    for (let i = 1; i < targetStep; i++) {
      const step = this.steps.find(s => s.id === i);
      if (!step) continue;

      const module = this.modules[step.component];
      if (module && typeof module.canProceed === 'function') {
        if (!module.canProceed()) return false;
      }
    }
    return true;
  },

  /**
   * 选择项目（由ProjectModule调用）
   */
  selectProject(projectId) {
    ProjectModule.selectProject(projectId);
  },

  /**
   * 更新顶部进度条
   */
  _updateProgressBar() {
    const fill = document.getElementById('progressFill');
    if (fill) {
      const progress = Utils.getStepProgress(this.state.currentStep);
      fill.style.width = progress + '%';
    }
  },

  /**
   * 更新底部按钮状态
   */
  _updateButtons() {
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');

    if (prevBtn) {
      prevBtn.style.display = this.state.currentStep === 1 ? 'none' : 'inline-flex';
    }

    if (nextBtn) {
      if (this.state.currentStep === 6) {
        nextBtn.textContent = '🎉 完成';
        nextBtn.onclick = () => {
          App.showNotification('所有步骤已完成！', 'success');
        };
      } else {
        nextBtn.textContent = '下一步 →';
        nextBtn.onclick = () => App.nextStep();
      }
    }
  },

  /**
   * 显示通知
   */
  showNotification(msg, type = 'info', duration = 3000) {
    const container = document.getElementById('notificationContainer');
    if (!container) return;

    const notif = document.createElement('div');
    notif.className = `notification ${type}`;
    notif.textContent = msg;
    container.appendChild(notif);

    setTimeout(() => {
      notif.classList.add('fade-out');
      setTimeout(() => notif.remove(), 300);
    }, duration);
  },

  /**
   * 显示确认弹窗
   */
  showConfirm(msg, callback) {
    const modal = document.getElementById('confirmModal');
    const body = document.getElementById('confirmBody');
    if (!modal || !body) return;

    body.textContent = msg;
    this._confirmCallback = callback;
    modal.classList.add('show');
  },

  /**
   * 关闭确认弹窗
   */
  closeConfirm() {
    const modal = document.getElementById('confirmModal');
    if (modal) {
      modal.classList.remove('show');
      this._confirmCallback = null;
    }
  },

  /**
   * 执行确认回调
   */
  confirmAction() {
    if (typeof this._confirmCallback === 'function') {
      this._confirmCallback();
    }
    this.closeConfirm();
  },

  /**
   * 持久化状态到localStorage（自动剥离大文本）
   */
  _persist() {
    // 保存剧本全文的内存引用
    const fullTextBackup = this.state.script ? this.state.script.fullText : null;
    const previewBackup = this.state.script ? this.state.script.preview : null;

    // 构建持久化数据（剥离大文本）
    const data = {
      currentStep: this.state.currentStep,
      project: this.state.project,
      projects: this.state.projects,
      assets: this.state.assets,
      script: this.state.script ? Utils.stripScriptForPersist(this.state.script) : null,
      storyboard: this.state.storyboard,
      promptGroups: this.state.promptGroups,
      generationTasks: this.state.generationTasks,
      settings: this.state.settings
    };

    // 保存当前项目进度时也剥离剧本文本
    if (this.state.project) {
      const project = this.state.projects.find(p => p.id === this.state.project.id);
      if (project) {
        project.lastStep = this.state.currentStep;
        project.assets = this.state.assets;
        project.script = this.state.script ? Utils.stripScriptForPersist(this.state.script) : null;
        project.storyboard = this.state.storyboard;
        project.promptGroups = this.state.promptGroups;
        project.generationTasks = this.state.generationTasks;
        project.updatedAt = Date.now();
        data.projects = this.state.projects;
      }
    }

    // 写入 localStorage
    Utils.storage.set('app_state', data);

    // 恢复剧本全文到内存（不会丢）
    if (this.state.script && fullTextBackup) {
      this.state.script.fullText = fullTextBackup;
      this.state.script.preview = previewBackup;
    }
  },

  /**
   * 从localStorage恢复状态（还原全文引用标记）
   */
  _restore() {
    const data = Utils.storage.get('app_state');
    if (data) {
      this.state.currentStep = data.currentStep || 1;
      this.state.project = data.project || null;
      this.state.projects = data.projects || [];
      this.state.assets = data.assets || [];
      this.state.storyboard = data.storyboard || [];
      this.state.promptGroups = data.promptGroups || [];
      this.state.generationTasks = data.generationTasks || [];
      this.state.settings = data.settings || {};

      // 恢复脚本（不含全文，标记需要重新上传）
      if (data.script) {
        this.state.script = {
          ...data.script,
          fullText: '',    // 全文不会持久化
          _needsReload: data.script._hasFullText === true
        };
        // 如果以前上传过且有meta数据但没有全文，显示提示
        if (this.state.script._needsReload) {
          console.log('Script metadata restored, full text needs reload');
        }
      }
    }

    // 恢复API key
    const apiKey = Utils.storage.get('api_key');
    if (apiKey) {
      API.init(apiKey);
    }
  }
};

// 应用启动
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
