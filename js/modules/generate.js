/**
 * generate.js — 视频生成调度与下载模块
 * ShortDrama Studio
 */

const GenerateModule = {
  _pollTimers: {},

  /**
   * 渲染生成与下载界面
   */
  render() {
    const groups = App.state.promptGroups || [];
    const tasks = App.state.generationTasks || [];

    const totalTasks = tasks.length || groups.length;
    const completed = tasks.filter(t => t.status === 'completed').length;
    const running = tasks.filter(t => t.status === 'running').length;
    const failed = tasks.filter(t => t.status === 'failed').length;
    const pending = tasks.filter(t => t.status === 'pending').length;
    const progress = totalTasks > 0 ? Math.round((completed / totalTasks) * 100) : 0;

    let html = '';

    // 检查是否已生成任务
    if (tasks.length === 0 && groups.length > 0) {
      // 显示准备就绪，等待开始
      html += `
        <div class="card" style="margin-bottom:20px;">
          <div style="text-align:center;padding:60px 20px;color:var(--text-muted);">
            <div style="font-size:48px;margin-bottom:16px;opacity:0.4;">🚀</div>
            <div style="font-size:16px;margin-bottom:8px;">准备就绪！</div>
            <div style="font-size:13px;margin-bottom:20px;">
              ${groups.length} 组提示词 · 共 ${groups.reduce((sum, g) => sum + g.shots.length, 0)} 个视频待生成
            </div>
            <button class="btn btn-primary" onclick="GenerateModule._startGeneration()">
              🚀 开始生成所有视频
            </button>
          </div>
        </div>
      `;
    } else {
      // 进度仪表盘
      html += `
        <div class="dashboard-bar">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
            <div>
              <div class="card-title" style="font-size:16px;">📊 生成进度</div>
              <div class="card-subtitle">${progress}% 完成</div>
            </div>
            <div style="display:flex;gap:8px;">
              ${completed === totalTasks && totalTasks > 0 ? `
                <button class="btn btn-success btn-sm" onclick="GenerateModule._downloadAllVideos()">⬇️ 下载全部</button>
              ` : ''}
              ${failed > 0 ? `
                <button class="btn btn-sm btn-secondary" onclick="GenerateModule._retryFailed()">🔄 重试失败</button>
              ` : ''}
              ${running === 0 && pending === 0 && completed < totalTasks ? `
                <button class="btn btn-primary btn-sm" onclick="GenerateModule._startGeneration()">
                  🚀 继续生成
                </button>
              ` : ''}
            </div>
          </div>

          <div class="dashboard-progress">
            <div class="dashboard-progress-fill" style="width:${progress}%"></div>
          </div>

          <div class="dashboard-stats">
            <div class="dashboard-stat">
              <div class="dashboard-stat-value" style="color:var(--text-muted);">${totalTasks}</div>
              <div class="dashboard-stat-label">总计</div>
            </div>
            <div class="dashboard-stat">
              <div class="dashboard-stat-value" style="color:var(--brand-green);">${completed}</div>
              <div class="dashboard-stat-label">已完成</div>
            </div>
            <div class="dashboard-stat">
              <div class="dashboard-stat-value" style="color:var(--brand-purple);">${running}</div>
              <div class="dashboard-stat-label">生成中</div>
            </div>
            <div class="dashboard-stat">
              <div class="dashboard-stat-value" style="color:#EF4444;">${failed}</div>
              <div class="dashboard-stat-label">失败</div>
            </div>
            <div class="dashboard-stat">
              <div class="dashboard-stat-value" style="color:var(--text-muted);">${pending}</div>
              <div class="dashboard-stat-label">等待中</div>
            </div>
          </div>
        </div>

        <!-- Task grid -->
        ${tasks.length > 0 ? `
          <div style="margin-bottom:16px;">
            <div class="card-title" style="font-size:15px;margin-bottom:12px;">📋 生成任务</div>
            <div class="task-grid">
              ${tasks.map((task, idx) => this._renderTaskCard(task, idx)).join('')}
            </div>
          </div>
        ` : ''}
      `;
    }

    // 完成后显示manifest下载
    if (completed === totalTasks && totalTasks > 0) {
      html += `
        <div class="card" style="border-color:rgba(29,185,84,0.3);background:rgba(29,185,84,0.04);">
          <div style="display:flex;align-items:center;justify-content:space-between;">
            <div>
              <div style="font-size:16px;font-weight:600;color:var(--brand-green);">🎉 所有视频生成完成！</div>
              <div style="font-size:13px;color:var(--text-muted);">可以下载manifest.json或批量下载所有视频</div>
            </div>
            <div style="display:flex;gap:8px;">
              <button class="btn btn-secondary btn-sm" onclick="GenerateModule._downloadManifest()">
                📄 manifest.json
              </button>
              <button class="btn btn-success btn-sm" onclick="GenerateModule._downloadAllVideos()">
                ⬇️ 全部下载
              </button>
            </div>
          </div>
        </div>
      `;
    }

    return html;
  },

  /**
   * 渲染单个任务卡片
   */
  _renderTaskCard(task, idx) {
    const statusLabel = {
      pending: '等待中',
      running: '生成中',
      completed: '已完成',
      failed: '生成失败'
    };

    const statusDotClass = {
      pending: 'pending',
      running: 'running',
      completed: 'completed',
      failed: 'failed'
    };

    return `
      <div class="task-card">
        <div class="task-card-header">
          <div class="task-card-title">#${task.shotNumber || idx + 1} ${task.name || ''}</div>
          <div class="task-card-status">
            <span class="status-dot ${statusDotClass[task.status] || 'pending'}"></span>
            ${statusLabel[task.status] || task.status}
          </div>
        </div>

        <div class="task-card-progress">
          <div class="task-card-progress-fill" style="width:${task.progress || (task.status === 'completed' ? 100 : task.status === 'running' ? 45 : 0)}%"></div>
        </div>

        <div class="task-card-body">
          ${task.status === 'completed' && task.videoUrl ? `
            <div style="margin-bottom:8px;">
              <video class="video-preview" controls style="width:100%;border-radius:var(--radius-sm);max-height:200px;">
                <source src="${task.videoUrl}" type="video/mp4">
                您的浏览器不支持视频播放
              </video>
            </div>
          ` : task.status === 'failed' ? `
            <div style="font-size:12px;color:#F87171;">
              ${task.error || '生成出错'}
            </div>
          ` : task.status === 'running' ? `
            <div style="font-size:12px;color:var(--text-muted);">
              任务已提交，等待AI生成...
            </div>
          ` : ''}
        </div>

        <div class="task-card-actions">
          ${task.status === 'completed' && task.videoUrl ? `
            <button class="btn btn-sm btn-primary" onclick="GenerateModule._downloadVideo(${idx})">⬇️ 下载</button>
            <button class="btn btn-sm btn-secondary" onclick="GenerateModule._previewVideo(${idx})">👁 预览</button>
          ` : ''}
          ${task.status === 'failed' ? `
            <button class="btn btn-sm btn-secondary" onclick="GenerateModule._retryTask(${idx})">🔄 重试</button>
          ` : ''}
          ${task.status === 'running' ? `
            <button class="btn btn-sm btn-secondary" onclick="GenerateModule._cancelTask(${idx})">✕ 取消</button>
          ` : ''}
        </div>
      </div>
    `;
  },

  /**
   * 开始生成
   */
  async _startGeneration() {
    const groups = App.state.promptGroups;
    if (!groups || groups.length === 0) {
      App.showNotification('没有可用的提示词组', 'warning');
      return;
    }

    // 构建任务列表
    const tasks = [];
    groups.forEach(group => {
      group.shots.forEach((shot, si) => {
        tasks.push({
          id: `task_${Utils.uid()}`,
          shotNumber: shot.shotNumber,
          name: `镜头 #${shot.shotNumber}`,
          prompt: group.prompts[si] || '',
          status: 'pending',
          progress: 0,
          videoUrl: null,
          error: null,
          createdAt: Date.now()
        });
      });
    });

    App.state.generationTasks = tasks;
    this._persist();
    App.renderStep();
    App.showNotification(`已提交 ${tasks.length} 个生成任务`, 'success');

    // 模拟生成（实际应调用API）
    this._simulateGeneration();
  },

  /**
   * 模拟生成（开发用）
   */
  _simulateGeneration() {
    const tasks = App.state.generationTasks;
    if (!tasks) return;

    tasks.forEach((task, idx) => {
      if (task.status !== 'pending') return;

      setTimeout(() => {
        task.status = 'running';
        task.progress = 10;
        this._persist();
        App.renderStep();
        App.showNotification(`#${task.shotNumber} 开始生成...`, 'info');

        // 模拟进度
        let progress = 10;
        const progressInterval = setInterval(() => {
          progress += Math.random() * 15;
          if (progress >= 95) {
            clearInterval(progressInterval);
          }
          task.progress = Math.min(progress, 95);
          this._persist();
          App.renderStep();
        }, 1500);

        // 模拟完成
        setTimeout(() => {
          clearInterval(progressInterval);
          task.status = 'completed';
          task.progress = 100;
          task.videoUrl = ''; // 实际由API返回
          this._persist();
          App.renderStep();
          App.showNotification(`#${task.shotNumber} 生成完成！`, 'success');
        }, 5000 + Math.random() * 5000);

      }, idx * 800);
    });
  },

  /**
   * 下载单个视频
   */
  _downloadVideo(idx) {
    const task = App.state.generationTasks[idx];
    if (!task || !task.videoUrl) {
      App.showNotification('视频URL不可用', 'warning');
      return;
    }

    const a = document.createElement('a');
    a.href = task.videoUrl;
    a.download = `shortdrama_shot_${task.shotNumber}.mp4`;
    a.click();
  },

  /**
   * 预览视频
   */
  _previewVideo(idx) {
    const task = App.state.generationTasks[idx];
    if (!task || !task.videoUrl) {
      App.showNotification('视频不可用', 'warning');
      return;
    }
    // 打开新窗口播放
    window.open(task.videoUrl, '_blank');
  },

  /**
   * 下载所有视频
   */
  _downloadAllVideos() {
    const completed = (App.state.generationTasks || []).filter(t => t.status === 'completed' && t.videoUrl);
    if (completed.length === 0) {
      App.showNotification('没有可下载的视频', 'warning');
      return;
    }

    completed.forEach((task, idx) => {
      setTimeout(() => {
        this._downloadVideo(App.state.generationTasks.indexOf(task));
      }, idx * 300);
    });

    App.showNotification(`正在下载 ${completed.length} 个视频`, 'info');
  },

  /**
   * 下载manifest
   */
  _downloadManifest() {
    const project = App.state.project;
    const tasks = App.state.generationTasks || [];
    const shots = App.state.storyboard || [];
    const videoUrls = tasks.filter(t => t.status === 'completed').map(t => t.videoUrl || '');

    if (!project) {
      App.showNotification('项目信息不可用', 'warning');
      return;
    }

    const manifest = API.buildManifest(project, shots, videoUrls);
    API.downloadManifest(manifest, `manifest_${project.name}.json`);
    App.showNotification('manifest.json 已下载', 'success');
  },

  /**
   * 重试失败的任务
   */
  _retryFailed() {
    const failed = (App.state.generationTasks || []).filter(t => t.status === 'failed');
    if (failed.length === 0) {
      App.showNotification('没有失败的任务', 'info');
      return;
    }

    failed.forEach(task => {
      task.status = 'pending';
      task.progress = 0;
      task.error = null;
    });

    this._persist();
    App.renderStep();
    this._simulateGeneration();
    App.showNotification(`正在重试 ${failed.length} 个任务`, 'info');
  },

  /**
   * 重试单个任务
   */
  _retryTask(idx) {
    const task = App.state.generationTasks[idx];
    if (!task) return;

    task.status = 'pending';
    task.progress = 0;
    task.error = null;

    this._persist();
    App.renderStep();

    // 重新模拟
    setTimeout(() => {
      this._simulateGeneration();
    }, 100);
  },

  /**
   * 取消任务
   */
  _cancelTask(idx) {
    const task = App.state.generationTasks[idx];
    if (!task) return;

    App.showConfirm('确定要取消这个任务吗？', () => {
      task.status = 'failed';
      task.error = '已取消';
      this._persist();
      App.renderStep();
    });
  },

  /**
   * 校验
   */
  canProceed() {
    const tasks = App.state.generationTasks;
    if (!tasks || tasks.length === 0) return false;
    return tasks.every(t => t.status === 'completed');
  },

  /**
   * 持久化
   */
  _persist() {
    App._persist();
  }
};
