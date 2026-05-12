/**
 * assets.js — 资产管理模块（角色/场景/道具）
 * ShortDrama Studio
 */

const AssetsModule = {
  _currentTab: 'character', // character | scene | prop

  /**
   * 获取当前类型的资产列表
   */
  _getAssetsByType(type) {
    const assets = App.state.assets || [];
    return assets.filter(a => a.type === type);
  },

  /**
   * 渲染资产管理界面
   */
  render() {
    const characters = this._getAssetsByType('character');
    const scenes = this._getAssetsByType('scene');
    const props = this._getAssetsByType('prop');

    const tabs = [
      { id: 'character', label: `角色 (${characters.length})`, icon: '🎭' },
      { id: 'scene', label: `场景 (${scenes.length})`, icon: '🏠' },
      { id: 'prop', label: `道具 (${props.length})`, icon: '📦' }
    ];

    return `
      <div class="card" style="margin-bottom: 20px;">
        <div class="card-header">
          <div>
            <div class="card-title">🎭 资产管理</div>
            <div class="card-subtitle">上传角色、场景和道具的参考图片</div>
          </div>
        </div>

        <!-- Tabs -->
        <div class="tabs" id="assetTabs">
          ${tabs.map(t => `
            <button class="tab-item ${this._currentTab === t.id ? 'active' : ''}"
              onclick="AssetsModule._switchTab('${t.id}')">
              ${t.icon} ${t.label}
            </button>
          `).join('')}
        </div>

        <!-- Add form -->
        <div class="grid-2" style="margin-bottom: 20px;">
          <div class="form-group" style="margin-bottom:0;">
            <label class="form-label">条目名称</label>
            <input type="text" class="form-input" id="assetNameInput"
              placeholder="输入名称..." onkeydown="if(event.key==='Enter')AssetsModule._addEntry()">
          </div>
          <div class="form-group" style="margin-bottom:0; display:flex; align-items:flex-end;">
            <button class="btn btn-primary" onclick="AssetsModule._addEntry()" style="width:100%;">
              ＋ 添加${this._getTabLabel(this._currentTab)}
            </button>
          </div>
        </div>

        <!-- Asset list -->
        ${this._renderAssetList()}

        <!-- Validation warning -->
        <div id="assetValidationWarning"></div>
      </div>
    `;
  },

  /**
   * 渲染资产列表
   */
  _renderAssetList() {
    const items = this._getAssetsByType(this._currentTab);

    if (items.length === 0) {
      return `
        <div style="text-align:center;padding:40px;color:var(--text-muted);">
          <div style="font-size:48px;margin-bottom:12px;opacity:0.4;">📂</div>
          <div>暂无${this._getTabLabel(this._currentTab)}，请添加</div>
        </div>
      `;
    }

    return `
      <div class="list-items">
        ${items.map((item, idx) => this._renderAssetItem(item, idx)).join('')}
      </div>
    `;
  },

  /**
   * 渲染单个资产条目（可展开）
   */
  _renderAssetItem(item, idx) {
    const expanded = App.state._expandedAsset === item.id;
    const images = item.images || [];
    const primaryImage = item.primaryImage || (images.length > 0 ? images[0] : null);

    return `
      <div class="list-item" style="flex-direction:column;padding:0;">
        <div style="display:flex;align-items:center;gap:12px;width:100%;padding:12px 16px;cursor:pointer;"
             onclick="AssetsModule._toggleExpand('${item.id}')">
          <span style="font-size:20px;">${item.type === 'character' ? '👤' : item.type === 'scene' ? '🏠' : '📦'}</span>
          ${primaryImage ? `<img src="${primaryImage}" style="width:40px;height:40px;border-radius:8px;object-fit:cover;border:1px solid var(--border-default);">` : ''}
          <div style="flex:1;">
            <div style="font-weight:500;">${item.name}</div>
            <div style="font-size:12px;color:var(--text-muted);">
              ${images.length > 0 ? `${images.length} 张参考图` : '暂无图片'}
              ${item.description ? ` | ${item.description.substring(0, 20)}${item.description.length > 20 ? '...' : ''}` : ''}
            </div>
          </div>
          <span style="color:var(--text-muted);font-size:12px;">${expanded ? '▲ 收起' : '▼ 展开'}</span>
          <button class="btn-icon" onclick="event.stopPropagation();AssetsModule._deleteEntry('${item.id}')" title="删除">✕</button>
        </div>

        ${expanded ? `
          <div style="padding:0 16px 16px;width:100%;border-top:1px solid var(--border-default);padding-top:12px;">
            <!-- 参考图片 -->
            <div style="margin-bottom:12px;">
              <label class="form-label">参考图片</label>
              <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px;">
                ${images.length > 0 ? images.map((img, imgIdx) => `
                  <div class="thumbnail-item" style="position:relative;">
                    <img src="${img}" style="width:80px;height:80px;object-fit:cover;border-radius:8px;border:2px solid ${imgIdx === 0 ? 'var(--brand-purple)' : 'var(--border-default)'};"
                         onerror="this.style.display='none'">
                    <button class="btn-icon" style="position:absolute;top:-6px;right:-6px;width:20px;height:20px;font-size:10px;background:rgba(239,68,68,0.9);color:#fff;border-radius:50%;"
                      onclick="AssetsModule._deleteImage('${item.id}', ${imgIdx})">✕</button>
                    ${imgIdx === 0 ? '<div style="font-size:10px;color:var(--brand-purple);text-align:center;">主参考</div>' : ''}
                  </div>
                `).join('') : ''}
                <div class="upload-zone" style="padding:16px;width:80px;height:80px;display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer;border:2px dashed var(--border-default);border-radius:8px;"
                     onclick="AssetsModule._uploadImages('${item.id}')">
                  <div style="font-size:24px;opacity:0.5;">+</div>
                </div>
              </div>
            </div>

            <!-- 外观描述 -->
            <div class="form-group" style="margin-bottom:12px;">
              <label class="form-label">外观描述（可选）</label>
              <input type="text" class="form-input"
                placeholder="描述该角色/场景/道具的外观特征..."
                value="${item.description || ''}"
                onchange="AssetsModule._updateDesc('${item.id}', this.value)">
            </div>

            <!-- 变体（高级）折叠 -->
            <div style="margin-bottom:12px;">
              <details>
                <summary style="cursor:pointer;font-size:13px;color:var(--text-muted);">
                  🎨 变体管理（高级） — ${(item.variants || []).length} 个变体
                </summary>
                <div style="margin-top:8px;">
                  <button class="btn btn-sm btn-primary" onclick="AssetsModule._addVariant('${item.id}')" style="margin-bottom:8px;">
                    ＋ 添加变体
                  </button>
                  ${this._renderVariants(item)}
                </div>
              </details>
            </div>

            <div style="text-align:right;">
              <button class="btn btn-sm btn-danger" onclick="AssetsModule._deleteEntry('${item.id}')">删除条目</button>
            </div>
          </div>
        ` : ''}
      </div>
    `;
  },

  /**
   * 渲染变体列表
   */
  _renderVariants(item) {
    const variants = item.variants || [];
    if (variants.length === 0) {
      return `<div style="font-size:13px;color:var(--text-muted);padding:8px;">暂无变体，点击上方按钮添加</div>`;
    }

    return variants.map((v, vi) => `
      <div style="background:var(--bg-input);border-radius:var(--radius-md);padding:12px;margin-bottom:8px;border:1px solid var(--border-default);">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
          <span style="font-weight:500;font-size:13px;">变体 #${vi + 1}${v.isPrimary ? ' <span class="badge badge-green">主参考</span>' : ''}</span>
          <div style="flex:1;"></div>
          ${!v.isPrimary ? `<button class="btn btn-sm btn-secondary" onclick="AssetsModule._setPrimary('${item.id}', ${vi})">设为主参考</button>` : ''}
          <button class="btn-icon" onclick="AssetsModule._deleteVariant('${item.id}', ${vi})">✕</button>
        </div>

        <!-- Upload images -->
        <div style="margin-bottom:8px;">
          <label class="form-label" style="font-size:12px;">参考图片</label>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            <div class="upload-zone" style="padding:16px;min-width:80px;flex:1;max-width:160px;"
                 onclick="AssetsModule._uploadImages('${item.id}', ${vi})">
              <div style="font-size:20px;opacity:0.5;">📷</div>
              <div style="font-size:11px;color:var(--text-muted);">点击上传</div>
            </div>
          </div>
          ${(v.images && v.images.length > 0) ? `
            <div class="thumbnail-grid">
              ${v.images.map((img, imgIdx) => `
                <div class="thumbnail-item">
                  <img src="${img}" alt="参考图" onerror="this.style.display='none'">
                  <button class="delete-btn" onclick="AssetsModule._deleteVariantImage('${item.id}', ${vi}, ${imgIdx})">✕</button>
                </div>
              `).join('')}
            </div>
          ` : ''}
        </div>

        <!-- Description -->
        <div class="form-group" style="margin-bottom:0;">
          <label class="form-label" style="font-size:12px;">外观描述</label>
          <input type="text" class="form-input" style="font-size:12px;padding:6px 10px;"
            placeholder="描述该变体的外观特征..."
            value="${v.description || ''}"
            onchange="AssetsModule._updateVariantDesc('${item.id}', ${vi}, this.value)">
        </div>
      </div>
    `).join('');
  },

  array: function(){},

  /**
   * 切换Tab
   */
  _switchTab(tabId) {
    this._currentTab = tabId;
    App.renderStep();
  },

  /**
   * 获取Tab标签
   */
  _getTabLabel(type) {
    const map = { character: '角色', scene: '场景', prop: '道具' };
    return map[type] || type;
  },

  /**
   * 切换展开/收起
   */
  _toggleExpand(id) {
    App.state._expandedAsset = App.state._expandedAsset === id ? null : id;
    App.renderStep();
  },

  /**
   * 添加条目
   */
  _addEntry() {
    const nameInput = document.getElementById('assetNameInput');
    const name = nameInput ? nameInput.value.trim() : '';
    if (!name) {
      App.showNotification('请输入条目名称', 'warning');
      return;
    }

    const assets = App.state.assets || [];
    if (assets.some(a => a.name === name && a.type === this._currentTab)) {
      App.showNotification('同名条目已存在', 'warning');
      return;
    }

    const asset = {
      id: Utils.uid(),
      name,
      type: this._currentTab,
      variants: [],
      createdAt: Date.now()
    };

    assets.push(asset);
    App.state.assets = assets;
    App.state._expandedAsset = asset.id;
    this._persist();

    if (nameInput) nameInput.value = '';
    App.renderStep();
    App.showNotification(`已添加${this._getTabLabel(this._currentTab)}「${name}」`, 'success');
  },

  /**
   * 删除条目
   */
  _deleteEntry(id) {
    App.showConfirm(`确定要删除这个${this._getTabLabel(this._currentTab)}吗？`, () => {
      App.state.assets = (App.state.assets || []).filter(a => a.id !== id);
      if (App.state._expandedAsset === id) App.state._expandedAsset = null;
      this._persist();
      App.renderStep();
      App.showNotification('已删除', 'info');
    });
  },

  /**
   * 添加变体
   */
  _addVariant(assetId) {
    const assets = App.state.assets || [];
    const asset = assets.find(a => a.id === assetId);
    if (!asset) return;

    if (!asset.variants) asset.variants = [];

    const variant = {
      id: Utils.uid(),
      images: [],
      description: '',
      isPrimary: asset.variants.length === 0 // 第一个变体默认主参考
    };

    asset.variants.push(variant);
    this._persist();
    App.renderStep();
  },

  /**
   * 删除变体
   */
  /**
   * 删除变体中的图片
   */
  _deleteVariantImage(assetId, variantIdx, imgIdx) {
    const assets = App.state.assets || [];
    const asset = assets.find(a => a.id === assetId);
    if (!asset || !asset.variants) return;
    const variant = asset.variants[variantIdx];
    if (!variant || !variant.images) return;
    variant.images.splice(imgIdx, 1);
    this._persist();
    App.renderStep();
  },

  /**
   * 删除图片
   */
  _deleteImage(assetId, imgIdx) {
    const assets = App.state.assets || [];
    const asset = assets.find(a => a.id === assetId);
    if (!asset || !asset.images) return;
    asset.images.splice(imgIdx, 1);
    if (asset.images.length === 0) delete asset.primaryImage;
    this._persist();
    App.renderStep();
  },

  /**
   * 设置主参考
   */
  _setPrimary(assetId, variantIdx) {
    const assets = App.state.assets || [];
    const asset = assets.find(a => a.id === assetId);
    if (!asset || !asset.variants) return;

    asset.variants.forEach((v, i) => v.isPrimary = i === variantIdx);
    this._persist();
    App.renderStep();
  },

  /**
   * 上传图片（直接上传到条目，不需经过变体）
   */
  async _uploadImages(assetId) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = true;

    input.onchange = async (e) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;

      const assets = App.state.assets || [];
      const asset = assets.find(a => a.id === assetId);
      if (!asset) return;

      for (const file of files) {
        try {
          const dataUrl = await Utils.readFileAsDataURL(file);
          if (!asset.images) asset.images = [];
          asset.images.push(dataUrl);
        } catch (err) {
          App.showNotification(`图片上传失败: ${err.message}`, 'error');
        }
      }

      this._persist();
      App.renderStep();
    };

    input.click();
  },



  /**
   * 更新描述
   */
  _updateDesc(assetId, value) {
    const assets = App.state.assets || [];
    const asset = assets.find(a => a.id === assetId);
    if (asset) {
      asset.description = value;
      this._persist();
    }
  },

  /**
   * 校验资产完整性
   */
  validate() {
    const assets = App.state.assets || [];
    const warnings = [];

    assets.forEach(asset => {
      const images = asset.images || [];
      if (asset.variants && asset.variants.length > 0) {
        const hasPrimary = asset.variants.some(v => v.isPrimary);
        if (!hasPrimary) {
          warnings.push(`${asset.name}: 未设置主参考变体`);
        }
        asset.variants.forEach((v, vi) => {
          if (!v.images || v.images.length === 0) {
            warnings.push(`${asset.name} 变体 #${vi + 1}: 无参考图片`);
          }
        });
      } else if (images.length === 0) {
        warnings.push(`${asset.name}: 无参考图片`);
      }
    });

    return warnings;
  },

  /**
   * 渲染校验警告
   */
  renderValidation() {
    const warnings = this.validate();
    const container = document.getElementById('assetValidationWarning');
    if (!container) return;

    if (warnings.length > 0) {
      container.innerHTML = `
        <div class="card" style="border-color:rgba(239,68,68,0.3);background:rgba(239,68,68,0.06);margin-top:16px;">
          <div style="display:flex;align-items:center;gap:8px;color:#F87171;font-weight:500;margin-bottom:8px;">
            ⚠️ 资产校验警告（${warnings.length}项）
          </div>
          <ul style="margin:0;padding-left:20px;font-size:13px;color:var(--text-secondary);">
            ${warnings.map(w => `<li>${w}</li>`).join('')}
          </ul>
          <div style="font-size:12px;color:var(--text-muted);margin-top:8px;">
            请修复以上问题后再进入下一步
          </div>
        </div>
      `;
    } else {
      container.innerHTML = assets && this._getAssetsByType('character').length > 0 ? `
        <div style="text-align:center;margin-top:16px;color:var(--brand-green);font-size:13px;">
          ✅ 所有资产校验通过
        </div>
      ` : '';
    }
  },

  /**
   * 校验是否可进入下一步
   */
  canProceed() {
    const warnings = this.validate();
    // 只要求有资产（角色），不强制有图片（开发阶段可跳过）
    return true;
  },

  /**
   * 持久化
   */
  _persist() {
    App._persist();
  }
};
