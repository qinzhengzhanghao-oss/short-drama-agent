/**
 * api.js — API调用模块
 * ShortDrama Studio
 * 复用 metamind.yun 的 Seedance 2.0 接口
 */

const API = {
  // 基础配置（后续可从外部配置）
  config: {
    baseUrl: 'https://api.metamind.yun/v1',
    uploadUrl: 'https://upload.metamind.yun/v1',
    apiKey: ''  // 需要用户填入或从本地存储获取
  },

  /**
   * 初始化API配置
   */
  init(apiKey) {
    this.config.apiKey = apiKey || Utils.storage.get('api_key', '');
    if (this.config.apiKey) {
      Utils.storage.set('api_key', this.config.apiKey);
    }
  },

  /**
   * 通用请求头
   */
  headers() {
    return {
      'Authorization': `Bearer ${this.config.apiKey}`,
      'Content-Type': 'application/json'
    };
  },

  /**
   * 通用请求
   */
  async request(method, path, body = null) {
    try {
      const options = { method, headers: this.headers() };
      if (body) options.body = JSON.stringify(body);

      const response = await fetch(`${this.config.baseUrl}${path}`, options);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.error || `请求失败 (${response.status})`);
      }
      return data;
    } catch (err) {
      console.error(`API请求失败 [${method} ${path}]:`, err);
      throw err;
    }
  },

  /**
   * 上传图片到云存储
   * @param {File|Blob} file - 图片文件
   * @returns {Promise<string>} - 图片URL
   */
  async uploadImage(file) {
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`${this.config.uploadUrl}/images`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${this.config.apiKey}` },
        body: formData
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || '上传失败');

      return data.url;
    } catch (err) {
      console.error('图片上传失败:', err);
      throw err;
    }
  },

  /**
   * 批量上传图片
   */
  async uploadImages(files) {
    const urls = [];
    for (const file of files) {
      const url = await this.uploadImage(file);
      urls.push(url);
    }
    return urls;
  },

  /**
   * 调用 Seedance 2.0 视频生成
   * @param {Object} params - 生成参数
   * @param {string} params.prompt - 视频提示词
   * @param {string} [params.negative_prompt] - 负面提示词
   * @param {string} [params.reference_image] - 参考图URL
   * @param {number} [params.duration] - 视频时长(秒)
   * @param {string} [params.model] - 模型版本 'seedance-v2'
   * @returns {Promise<Object>} - 任务ID等信息
   */
  async generateVideo(params) {
    return this.request('POST', '/video/generate', {
      model: params.model || 'seedance-v2',
      prompt: params.prompt,
      negative_prompt: params.negative_prompt || '',
      reference_image: params.reference_image || '',
      duration: params.duration || 5,
      aspect_ratio: params.aspect_ratio || '9:16'
    });
  },

  /**
   * 查询视频生成任务状态
   * @param {string} taskId
   * @returns {Promise<Object>} - { status, progress, video_url, error }
   */
  async queryTaskStatus(taskId) {
    return this.request('GET', `/video/tasks/${taskId}`);
  },

  /**
   * 批量查询任务状态
   */
  async queryTasksStatus(taskIds) {
    return this.request('POST', '/video/tasks/batch', { task_ids: taskIds });
  },

  /**
   * 取消任务
   */
  async cancelTask(taskId) {
    return this.request('POST', `/video/tasks/${taskId}/cancel`);
  },

  /**
   * 构建 manifest.json
   * @param {Object} project - 项目信息
   * @param {Array} shots - 分镜列表（每段视频的元信息）
   * @param {Array} videoUrls - 生成的视频URL
   */
  buildManifest(project, shots, videoUrls) {
    const manifest = {
      name: project.name || '未命名短剧',
      style: project.style || 'live_action',
      created_at: new Date().toISOString(),
      version: '1.0',
      scenes: shots.map((shot, idx) => ({
        scene_id: `scene_${idx + 1}`,
        shot_number: shot.shotNumber || idx + 1,
        duration: shot.duration || 5,
        camera: shot.camera || '',
        dialogue: shot.dialogue || '',
        characters: (shot.characters || []).map(c => ({
          name: c.name || '',
          reference: c.reference || ''
        })),
        scene_background: shot.sceneBackground || '',
        video_url: videoUrls[idx] || '',
        prompt: shot.prompt || ''
      })),
      total_duration: shots.reduce((sum, s) => sum + (s.duration || 5), 0),
      total_shots: shots.length
    };

    return manifest;
  },

  /**
   * 下载 manifest.json
   */
  downloadManifest(manifest, filename = 'manifest.json') {
    const blob = new Blob([JSON.stringify(manifest, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }
};
