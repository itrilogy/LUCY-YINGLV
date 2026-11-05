// StudioApp: 应律 · YingLv (BeatStream) 独立工程化工作台主程序
// 严格遵循《鹿溪设计范式 · LUXI Design System v1.1.1》(LUCY-DESIGN) 规范构建
import { AudioData } from './engine/audio';
import { Lyrics } from './engine/lyrics';
import {
  AESTHETIC_STYLES,
  SEMANTIC_IMAGERIES,
  ACOUSTIC_METRICS,
  PLUGIN_REGISTRY,
  COLOR_GRADES,
  getPluginsByLayer,
  assembleLayeredLens,
  matchOptimalVisualPlugin,
  type PluginMeta
} from './engine/tag-system';

// 官方推荐黄金大师单体编排预设与分层预设由 studio-presets.ts 统一定义与管理
import { MASTERPIECE_PRESET as _MASTERPIECE_PRESET } from './engine/studio-presets';
export const MASTERPIECE_PRESET = _MASTERPIECE_PRESET;

import { LAYERED_CINEMA_PRESET as _LAYERED_CINEMA_PRESET } from './engine/studio-presets';
export const LAYERED_CINEMA_PRESET = _LAYERED_CINEMA_PRESET;
import { adjacencyReport, snapTimelineToDownbeats } from './engine/shot-assembly';

class StandaloneStudioWorkbench {
  private track: string = 'demo';
  private availableTracks: string[] = ['demo', 'default'];
  private audio!: AudioData;
  private lyrics!: Lyrics;
  private timelineDSL: any[] = [];
  private lyricsDoc: { lines: any[] } = { lines: [] };
  private activeTab: 'timeline' | 'effects' | 'tags' | 'llm' | 'lyrics' = 'timeline';
  private allPluginNames: string[] = Object.keys(PLUGIN_REGISTRY);
  private effectOrigin: 'all' | 'film' | 'bespoke' | 'generated' = 'all';
  private effectRole: 'all' | 'background' | 'imagery' | 'accent' | 'typography' = 'all';
  private lyricLowOnly = true;
  private lastGenLog = '';
  private theme: 'dark' | 'light' | 'ink' = (localStorage.getItem('yinglv_theme') as 'dark' | 'light' | 'ink') || 'dark';

  async init() {
    const params = new URLSearchParams(location.search);
    this.track = params.get('track') || 'demo';
    this.applyTheme(this.theme);

    // 1. 加载音频与歌词
    const trackBase = `tracks/${this.track}`;
    const [audio, lyricsRes] = await Promise.all([
      AudioData.load(`${trackBase}/audio.json`),
      fetch(`${trackBase}/lyrics.json`),
    ]);
    this.audio = audio;
    if (!lyricsRes.ok) throw new Error(`歌词文件没有读到：${trackBase}/lyrics.json`);
    this.lyricsDoc = await lyricsRes.json();
    this.lyrics = new Lyrics(this.lyricsDoc);
    await this.refreshCatalog();

    // 2. 加载时间轴（优先读取本地暂存，其次服务端）
    const cachedCustom = localStorage.getItem(`pdoom_custom_timeline:${this.track}`);
    if (cachedCustom) {
      try {
        this.timelineDSL = JSON.parse(cachedCustom);
      } catch (err: any) {
        console.warn('[StudioApp] Failed to parse cached custom timeline:', err.message);
      }
    }

    if (!this.timelineDSL || this.timelineDSL.length === 0) {
      try {
        const r = await fetch(`${trackBase}/timeline.json`);
        if (r.ok) {
          this.timelineDSL = await r.json();
        }
      } catch (err: any) {
        console.warn(`[StudioApp] Failed to fetch server timeline from ${trackBase}/timeline.json:`, err.message);
      }
    }

    if (!this.timelineDSL || this.timelineDSL.length === 0) {
      this.timelineDSL = JSON.parse(JSON.stringify(MASTERPIECE_PRESET));
    }

    this.render();
    this.bindEvents();
  }

  private applyTheme(theme: 'dark' | 'light' | 'ink') {
    this.theme = theme;
    localStorage.setItem('yinglv_theme', theme);
    if (theme === 'light') {
      document.documentElement.removeAttribute('data-theme');
    } else {
      document.documentElement.setAttribute('data-theme', theme);
    }
  }

  private render() {
    const root = document.getElementById('app-root')!;
    root.innerHTML = `
      <!-- 鹿溪设计范式顶部导航栏 (Sticky Top Shell · 56px 标准顶栏) -->
      <header class="top-shell">
        <div class="top-nav">
          <div class="brand-cluster">
            <!-- 双标并排等大 (36×36)：应律产品方标 × 鹿溪实验室符号标（无方框） -->
            <div class="brand-marks-pair" title="应律 · YingLv (BeatStream) × 鹿溪联合创新实验室">
              <svg class="brand-mark" viewBox="0 0 48 48" role="img" aria-label="应律 · YingLv 产品方标">
                <use href="#yinglv-product-mark"></use>
              </svg>
              <svg class="brand-mark luxi-symbol" viewBox="0 0 48 48" role="img" aria-label="鹿溪联合创新实验室 LUXI LAB">
                <use href="#luxi-symbol-mark"></use>
              </svg>
            </div>
            <div class="brand-text">
              <div class="brand-title">应律 · YingLv <span class="brand-version">BeatStream v2.5</span></div>
              <div class="brand-subtitle">知行·五动 // 循声应律，逐拍成画 · 鹿溪联合创新实验室</div>
            </div>
          </div>

          <!-- 导航场景切换 -->
          <nav class="nav-tabs" role="tablist">
            <span class="nav-kicker">视效组装</span>
            <button class="nav-tab-btn ${this.activeTab === 'timeline' ? 'active' : ''}" data-tab="timeline">镜头组装</button>
            <button class="nav-tab-btn ${this.activeTab === 'effects' ? 'active' : ''}" data-tab="effects">视效库</button>
            <button class="nav-tab-btn ${this.activeTab === 'llm' ? 'active' : ''}" data-tab="llm">模型编写</button>
            <button class="nav-tab-btn ${this.activeTab === 'tags' ? 'active' : ''}" data-tab="tags">标签</button>
            <span class="nav-kicker">歌词切分</span>
            <button class="nav-tab-btn ${this.activeTab === 'lyrics' ? 'active' : ''}" data-tab="lyrics">切分校对</button>
          </nav>

          <!-- 核心行动按钮组（遵循每屏唯一鹿溪绿实底 Primary 按钮规范） -->
          <div class="controller-bar">
            <select id="select-active-track" class="cut-plugin-select" style="max-width:148px;" title="切换当前曲目包 (public/tracks/<track>)">
              ${this.availableTracks.map((t) => `<option value="${this.esc(t)}" ${t === this.track ? 'selected' : ''}>🎵 曲目: ${this.esc(t)}</option>`).join('')}
            </select>
            <select id="select-theme-mode" class="cut-plugin-select" style="max-width:118px;color:var(--text-secondary);" title="切换鹿溪设计范式三套主题 (dark / light / ink)">
              <option value="dark" ${this.theme === 'dark' ? 'selected' : ''}>🌲 深林 Dark</option>
              <option value="light" ${this.theme === 'light' ? 'selected' : ''}>☀️ 源启 Light</option>
              <option value="ink" ${this.theme === 'ink' ? 'selected' : ''}>🖋️ 沉浸 Ink</option>
            </select>
            <button id="btn-load-preset" class="btn btn-preset" title="一键加载官方验证的黄金 16 幕全曲编排">
              🌟 大师单体预设
            </button>
            <button id="btn-load-cinema" class="btn btn-outline" title="一键载入5层正交复合电影级镜头编排（背景+意象+点缀+字效+调色）">
              🎬 五层电影预设
            </button>
            <button id="btn-save-disk" class="btn btn-secondary" title="持久化写回 public/tracks/${this.esc(this.track)}/timeline.json">
              💾 保存至磁盘
            </button>
            <button id="btn-preview-full" class="btn btn-primary" title="在新标签页全屏播放当前自定义编排（每屏唯一主行动）">
              🚀 整体全屏预览 ↗
            </button>
          </div>
        </div>
      </header>

      <!-- 工作台主视口 (Viewport) -->
      <main class="viewport">
        <!-- 产品定义与设计哲学说明横幅 -->
        <div class="product-hero-card">
          <div class="hero-left">
            <p class="eyebrow">知行·五动 · 工程代号 BEATSTREAM · 循声应律，逐拍成画</p>
            <h1 class="hero-title">应律 · YingLv — 歌曲节拍与歌词时序动效 MTV 生成引擎</h1>
            <p class="hero-desc">
              输入一首歌与一份歌词，输出可直接投屏的 MTV：先做节拍检测（BPM / 强拍 / 段落边界）与歌词时间轴强制对齐，
              再以时间轴为唯一真源，把原片整幕、五层正交插件和模型新写的镜头拼进时间轴，逐帧确定性渲染成片。面向 KTV 点播与年会晚会大屏，零手工剪辑，全流程可复现。
            </p>
          </div>
          <div class="hero-stats">
            <div class="stat-item">
              <span class="stat-num">${this.timelineDSL.length}</span>
              <span class="stat-label">当前幕数</span>
            </div>
            <div class="stat-item">
              <span class="stat-num">${this.catalogCounts().film}</span>
              <span class="stat-label">原片整幕</span>
            </div>
            <div class="stat-item">
              <span class="stat-num">${this.catalogCounts().bespoke + this.catalogCounts().generated}</span>
              <span class="stat-label">分层插件</span>
            </div>
            <div class="stat-item">
              <span class="stat-num">${this.lowConfCount()}</span>
              <span class="stat-label">低置信词</span>
            </div>
          </div>
        </div>

        <!-- 场景分栏容器 -->
        <div class="scene-content">
          ${this.renderActiveTabContent()}
        </div>

        <!-- 鹿溪设计范式标准页脚（双标等大 + 出品方声明） -->
        <footer class="luxi-footer">
          <div class="brand-marks-pair">
            <svg class="brand-mark" style="width:28px;height:28px;" viewBox="0 0 48 48" role="img" aria-label="应律 · YingLv">
              <use href="#yinglv-product-mark"></use>
            </svg>
            <svg class="brand-mark luxi-symbol" style="width:28px;height:28px;" viewBox="0 0 48 48" role="img" aria-label="鹿溪联合创新实验室">
              <use href="#luxi-symbol-mark"></use>
            </svg>
            <span><strong>应律 · YingLv (BeatStream)</strong> · 循声应律，逐拍成画 · <em>Following the beat, shaping sound into vision.</em></span>
          </div>
          <div class="mono">
            © 鹿溪联合创新实验室 · LUXI Joint Innovation Lab · itrilogy/LUCY-YINGLV
          </div>
        </footer>
      </main>
    `;
  }

  private renderActiveTabContent(): string {
    switch (this.activeTab) {
      case 'timeline':
        return this.renderTimelineTab();
      case 'effects':
        return this.renderEffectsTab();
      case 'tags':
        return this.renderTagsTab();
      case 'llm':
        return this.renderLlmTab();
      case 'lyrics':
        return this.renderLyricsTab();
    }
  }

  private catalogCounts() {
    const all = Object.values(PLUGIN_REGISTRY);
    return {
      film: all.filter((p) => p.origin === 'film').length,
      bespoke: all.filter((p) => (p.origin ?? 'bespoke') === 'bespoke').length,
      generated: all.filter((p) => p.origin === 'generated').length,
    };
  }

  private lowConfCount() {
    return this.lyricsDoc.lines.reduce((n, line) => n + (line.words ?? []).filter((w: { conf?: number }) => (w.conf ?? 1) < 0.7).length, 0);
  }

  private esc(value: unknown) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  private async refreshCatalog() {
    try {
      const r = await fetch('/api/plugins');
      if (!r.ok) return;
      const data = await r.json();
      for (const item of data.plugins ?? []) {
        const assetStatus = item.status === 'temporary' || item.status === 'asset' ? item.status : undefined;
        const existing = PLUGIN_REGISTRY[item.id];
        if (existing) {
          if (assetStatus) existing.assetStatus = assetStatus;
          continue;
        }
        const role = (['background', 'imagery', 'accent', 'typography'].includes(item.layerRole) ? item.layerRole : 'imagery') as 'background' | 'imagery' | 'accent' | 'typography';
        PLUGIN_REGISTRY[item.id] = {
          id: item.id,
          name: item.id,
          zhName: item.zh || item.id,
          sourceScene: `${item.id}.ts`,
          layerRole: role,
          origin: item.origin === 'generated' ? 'generated' : item.origin === 'film' ? 'film' : 'bespoke',
          kind: 'layer',
          styles: [],
          imageries: [],
          acousticFocus: ['kick'],
          recommendedPaces: ['medium'],
          description: item.origin === 'generated' ? '模型写入的分层插件。' : '磁盘上的插件，登记里还没有说明。',
          promptGuidance: '',
          assetStatus,
        };
      }
      this.allPluginNames = Object.keys(PLUGIN_REGISTRY);
      const tr = await fetch('/api/tracks');
      if (tr.ok) {
        const tData = await tr.json();
        const ids = (tData.tracks ?? []).map((x: { id: string }) => x.id).filter(Boolean);
        if (ids.length) {
          this.availableTracks = Array.from(new Set([...ids, this.track]));
        }
      }
    } catch (err) {
      console.warn('[StudioApp] plugin catalog', err);
    }
  }

  private optionsForRole(role: 'background' | 'imagery' | 'accent' | 'typography', selected?: string) {
    const items = getPluginsByLayer(role);
    const film = items.filter((p) => p.origin === 'film');
    const rest = items.filter((p) => p.origin !== 'film');
    const opt = (p: (typeof items)[number]) =>
      `<option value="${this.esc(p.id)}" ${p.id === selected ? 'selected' : ''}>${this.esc(p.zhName)}</option>`;
    return [
      rest.length ? `<optgroup label="分层插件">${rest.map(opt).join('')}</optgroup>` : '',
      film.length ? `<optgroup label="原片整幕">${film.map(opt).join('')}</optgroup>` : '',
    ].join('');
  }

  private catalogPayload() {
    return Object.values(PLUGIN_REGISTRY)
      .filter((p) => p.layerRole === 'background' || p.layerRole === 'imagery' || p.layerRole === 'accent' || p.layerRole === 'typography')
      .map((p) => ({
        id: p.id,
        role: p.layerRole,
        zh: p.zhName,
        description: p.description.slice(0, 80),
      }));
  }

  private applyLayers(cut: any, assembled: { background: string; imagery: string; accent: string; typography: string; colorGrade: string }) {
    cut.background = assembled.background;
    cut.imagery = assembled.imagery;
    cut.accent = assembled.accent;
    cut.typography = assembled.typography;
    cut.colorGrade = assembled.colorGrade;
    delete cut.scene;
    delete cut.plugin;
    for (const id of [assembled.background, assembled.imagery, assembled.accent, assembled.typography]) {
      const meta = PLUGIN_REGISTRY[id];
      if (!meta) continue;
      if (meta.paramsHint) cut.params = { ...(cut.params ?? {}), ...meta.paramsHint };
      if (meta.maxSamples) cut.maxSamples = meta.maxSamples;
    }
  }

  private assembling = false;
  private shotRunning = false;
  private shotAbort: AbortController | null = null;
  private shotStatusText = '';

  private updateShotBanner(text: string, running = this.shotRunning) {
    this.shotStatusText = text;
    const bar = document.getElementById('shot-program-status-bar');
    const txt = document.getElementById('shot-program-status-text');
    const cancelBtn = document.getElementById('btn-shot-cancel');
    if (bar) bar.style.display = text || running ? 'flex' : 'none';
    if (txt) txt.textContent = text;
    if (cancelBtn) cancelBtn.style.display = running ? 'inline-flex' : 'none';
  }

  private rememberTimeline() {
    localStorage.setItem(`pdoom_custom_timeline:${this.track}`, JSON.stringify(this.timelineDSL));
    localStorage.removeItem('pdoom_custom_timeline');
  }

  private async pullServerTimeline() {
    const r = await fetch(`tracks/${this.track}/timeline.json`, { cache: 'no-store' });
    if (!r.ok) throw new Error(`没有读到 timeline.json（HTTP ${r.status}）`);
    const data = await r.json();
    if (!Array.isArray(data)) throw new Error('timeline.json 不是数组');
    this.timelineDSL = data;
    this.rememberTimeline();
  }

  private async runIntelligentProgram() {
    if (this.shotRunning) return;
    if (this.track === 'default') {
      alert('default 曲目走 makeTimeline()，不写 timeline.json');
      return;
    }
    this.shotRunning = true;
    const ac = new AbortController();
    this.shotAbort = ac;
    this.updateShotBanner('⏳ [阶段 1/2] 正在请求模型切分歌词与分配镜头标签…', true);
    try {
      const res = await fetch('/api/shot-program', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ track: this.track }),
        signal: ac.signal,
      });
      const ctype = res.headers.get('content-type') || '';
      if (ctype.includes('application/json')) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text.slice(0, 400) || `HTTP ${res.status}`);
      }
      const events: { event?: string; stage?: number; shots?: number; id?: string; role?: string; status?: string; calls?: number; repairs?: number; skipped?: number; error?: string }[] = [];
      let fileIdx = 0;
      let totalShots = 0;
      const handleLine = (line: string) => {
        const trimmed = line.trim();
        if (!trimmed) return;
        const ev = JSON.parse(trimmed);
        events.push(ev);
        if (ev.event === 'arrangement') {
          totalShots = ev.shots ?? 0;
          this.updateShotBanner(`✅ [阶段 1/2] 已编排 ${totalShots} 幕无缝时间窗，准备进入阶段 2…`, true);
        } else if (ev.event === 'stage' && ev.stage === 2) {
          this.updateShotBanner(`⚙️ [阶段 2/2] 正在逐层生成并校验新视效插件 (共 ${totalShots} 幕)…`, true);
        } else if (ev.event === 'file') {
          fileIdx++;
          const tag = ev.status === 'ok' ? '通过' : ev.status === 'repair' ? '已修复' : '跳过兜底';
          this.updateShotBanner(`⚙️ [阶段 2/2] 已处理第 ${fileIdx} 个图层: ${ev.id} (${ev.role}) -> ${tag}`, true);
        }
      };

      if (res.body) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = '';
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const lines = buf.split('\n');
          buf = lines.pop() ?? '';
          for (const l of lines) handleLine(l);
        }
        buf += decoder.decode();
        if (buf.trim()) handleLine(buf);
      } else {
        const text = await res.text();
        for (const l of text.split('\n')) handleLine(l);
      }

      const failed = events.find((event) => event.event === 'error');
      if (failed) throw new Error(failed.error || '分镜中断');
      const done = events.find((event) => event.event === 'done');
      if (!done) throw new Error('分镜没有写完');
      await this.pullServerTimeline();
      await this.refreshCatalog();
      const notes = this.timelineDSL.map((cut) => cut.programError).filter(Boolean);
      const summary = `✅ 智能分镜已写回：共 ${this.timelineDSL.length} 幕 | 模型调用 ${done.calls ?? 0} 次 | 修复 ${done.repairs ?? 0} | 跳过 ${done.skipped ?? 0}`;
      this.shotRunning = false;
      this.shotAbort = null;
      this.updateShotBanner(summary, false);
      alert(`智能分镜已写回。模型调用 ${done.calls ?? 0} 次，修复 ${done.repairs ?? 0}，跳过 ${done.skipped ?? 0}。${notes.length ? `\n${notes.join('\n')}` : ''}`);
      this.render();
      this.bindEvents();
    } catch (err: any) {
      this.shotRunning = false;
      this.shotAbort = null;
      if (err?.name === 'AbortError') {
        this.updateShotBanner('⏹ 已取消本次智能分镜（原时间轴未被覆盖）', false);
        return;
      }
      this.updateShotBanner(`❌ 智能分镜失败：${err.message || err}`, false);
      alert(`智能分镜没有写成：${err.message || err}`);
    } finally {
      this.shotRunning = false;
      this.shotAbort = null;
    }
  }

  private async undoShotProgram() {
    if (this.track === 'default') {
      alert('default 曲目走 makeTimeline()，不写 timeline.json');
      return;
    }
    const res = await fetch('/api/revert-timeline', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ track: this.track }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.ok === false) {
      alert(data.error || '没有上一版可以撤回');
      return;
    }
    await this.pullServerTimeline();
    this.render();
    this.bindEvents();
  }

  private async assembleWithModel(indexes: number[]) {
    if (this.assembling || indexes.length === 0) return;
    this.assembling = true;
    try {
      const shots = indexes.map((index) => {
        const cut = this.timelineDSL[index];
        const lines = this.lyrics.linesIn(cut.start, cut.end);
        return {
          index,
          lyric: lines.length ? lines.map((l) => l.text).join(' / ') : '(纯器乐，没有歌词)',
        };
      });
      const res = await fetch('/api/assemble-shot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shots, catalog: this.catalogPayload() }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || `HTTP ${res.status}`);
      for (const shot of data.shots ?? []) {
        const cut = this.timelineDSL[shot.index];
        if (cut) this.applyLayers(cut, shot);
      }
      this.rememberTimeline();
      const note = (data.shots ?? []).map((shot: { index: number; rationale?: string }) => `#${shot.index + 1} ${shot.rationale || ''}`).join('\n');
      alert(`模型已写回 ${data.shots?.length ?? 0} 个镜头。\n${note}`);
      this.render();
      this.bindEvents();
    } catch (err: any) {
      alert(`模型装配没有写成：${err.message || err}`);
    } finally {
      this.assembling = false;
    }
  }

  // --- 01. 视觉编排面板 ---
  private renderTimelineTab(): string {
    return `
      <section class="studio-section">
        <div class="section-toolbar">
          <div class="toolbar-left">
            <span class="toolbar-badge">严格接壤代数: <strong>t_end[i] ≡ t_start[i+1]</strong></span>
            <span class="toolbar-meta">当前曲目: <strong>${this.track}</strong> (${this.audio.duration.toFixed(2)}s)</span>
          </div>
          <div class="toolbar-right">
            <button id="btn-llm-auto-compose" class="btn btn-accent">
              关键词规则装配五层
            </button>
            <button id="btn-model-assemble" class="btn btn-accent">
              模型装配全曲
            </button>
            <button id="btn-shot-program" class="btn btn-accent">
              智能分镜
            </button>
            <button id="btn-shot-undo" class="btn btn-outline">
              撤回上一版分镜
            </button>
            <button id="btn-random-shuffle" class="btn btn-outline">
              🎲 随机分布视效
            </button>
            <button id="btn-snap-downbeats" class="btn btn-outline">
              ⏱️ 吸附至最近下拍
            </button>
          </div>
        </div>

        <div id="shot-program-status-bar" class="section-toolbar" style="${this.shotRunning || this.shotStatusText ? 'display:flex;' : 'display:none;'}margin-top:-8px;margin-bottom:16px;border-color:var(--border-strong);background:var(--bg-sunken);">
          <span id="shot-program-status-text" class="mono" style="font-size:12px;color:var(--text-info);">${this.esc(this.shotStatusText)}</span>
          <button id="btn-shot-cancel" class="btn btn-outline" type="button" style="${this.shotRunning ? 'display:inline-flex;' : 'display:none;'}height:var(--h-xs);padding:0 10px;font-size:11px;">
            ⏹ 取消分镜
          </button>
        </div>

        <div class="cuts-grid-container">
          ${this.timelineDSL.map((cut, idx) => {
            const solo = cut.scene || cut.plugin || '';
            const plugin = solo || cut.typography || cut.imagery || cut.background || 'typography';
            const meta = PLUGIN_REGISTRY[plugin] || PLUGIN_REGISTRY['typography']!;
            const dur = (cut.end - cut.start).toFixed(2);
            const lRange = this.lyrics.linesIn(cut.start, cut.end);
            const lyricText = lRange.length > 0 ? lRange.map(l => l.text).join(' / ') : '(纯器乐间歇/尾奏)';
            const isLayered = !!(cut.background || cut.imagery || cut.accent || cut.typography);

            const plateWarning = cut.background?.startsWith('plate-')
              ? '<p class="card-desc">原片只在词表和这一镜对齐时播放原片。对不上就改成逐句切换。叠了字效层后，原片不再画自己的字幕。</p>'
              : '';
            const programError = cut.programError
              ? `<p class="card-desc">${this.esc(cut.programError)}</p>`
              : '';

            return `
              <article class="cut-card-item">
                <div class="cut-card-top">
                  <div class="cut-index-badge">#${String(idx + 1).padStart(2, '0')}</div>
                  <div class="cut-time-range">${cut.start.toFixed(2)}s ~ ${cut.end.toFixed(2)}s</div>
                  <div class="cut-dur-tag">${dur}s</div>
                </div>

                <div class="cut-lyric-box" title="${lyricText}">
                  “${lyricText}”
                </div>

                <div class="cut-plugin-selector-row">
                  <label class="select-label">单体镜头:</label>
                  <select class="cut-plugin-select" data-cut-idx="${idx}">
                    <option value="" ${!solo ? 'selected' : ''}>（用下面的分层，不叠单体）</option>
                    <optgroup label="分层插件">
                    ${this.allPluginNames.filter(id => PLUGIN_REGISTRY[id]?.origin !== 'film').map(pName => {
                      const pMeta = PLUGIN_REGISTRY[pName]!;
                      return `<option value="${pName}" ${pName === solo ? 'selected' : ''}>${this.esc(pMeta.zhName)}</option>`;
                    }).join('')}
                    </optgroup>
                    <optgroup label="原片整幕">
                    ${this.allPluginNames.filter(id => PLUGIN_REGISTRY[id]?.origin === 'film').map(pName => {
                      const pMeta = PLUGIN_REGISTRY[pName]!;
                      return `<option value="${pName}" ${pName === solo ? 'selected' : ''}>${this.esc(pMeta.zhName)}</option>`;
                    }).join('')}
                    </optgroup>
                  </select>
                </div>

                <!-- 5 层正交镜头装配器 -->
                <div class="layered-assembler-box">
                  <div style="display:flex;justify-content:space-between;align-items:center;">
                    <span style="font-size:11px;font-weight:700;color:var(--text-info);">5 层镜头语言装配</span>
                    <span class="mono" style="font-size:10px;color:var(--text-warn);">${cut.colorGrade || 'cold-industrial'}</span>
                  </div>

                  ${plateWarning}
                  ${programError}
                  <div class="layer-row">
                    <span class="layer-label">0.背景层:</span>
                    <select class="layer-select" data-layer-key="background" data-cut-idx="${idx}">
                      <option value="">（不铺背景）</option>
                      ${this.optionsForRole('background', cut.background)}
                    </select>
                  </div>

                  <div class="layer-row">
                    <span class="layer-label">1.意象层:</span>
                    <select class="layer-select" data-layer-key="imagery" data-cut-idx="${idx}">
                      <option value="">（不叠意象）</option>
                      ${this.optionsForRole('imagery', cut.imagery)}
                    </select>
                  </div>

                  <div class="layer-row">
                    <span class="layer-label">2.线条层:</span>
                    <select class="layer-select" data-layer-key="accent" data-cut-idx="${idx}">
                      <option value="">（不叠线条）</option>
                      ${this.optionsForRole('accent', cut.accent)}
                    </select>
                  </div>

                  <div class="layer-row">
                    <span class="layer-label">3.字效层:</span>
                    <select class="layer-select" data-layer-key="typography" data-cut-idx="${idx}">
                      <option value="">（不叠字效）</option>
                      ${this.optionsForRole('typography', cut.typography)}
                    </select>
                  </div>

                  <div class="layer-row">
                    <span class="layer-label">4.调色:</span>
                    <select class="layer-select" data-layer-key="colorGrade" data-cut-idx="${idx}">
                      ${COLOR_GRADES.map(cg => `<option value="${cg.id}" ${(cut.colorGrade || 'cold-industrial') === cg.id ? 'selected' : ''}>${cg.name} (${cg.en})</option>`).join('')}
                    </select>
                  </div>

                  <button class="btn-auto-assemble" data-cut-idx="${idx}" data-lyric="${lyricText}">
                    ⚡ 智能匹配五层装配
                  </button>
                  <div style="display:flex;gap:6px;">
                    <button class="btn-model-assemble-one" data-cut-idx="${idx}" style="flex:1;">
                      模型装配这一镜
                    </button>
                    <button class="btn-write-shot-layer" data-cut-idx="${idx}" style="flex:1;" title="调用 Stage 2 为当前镜头的指定图层生成合规临时插件并自动挂载">
                      ✨ AI 写单层
                    </button>
                  </div>
                </div>

                <div class="cut-tags-flow">
                  ${meta.styles.map(s => `<span class="tag-pill style">${s.replace('style_', '')}</span>`).join('')}
                  ${meta.imageries.map(im => `<span class="tag-pill imagery">${im.replace('img_', '')}</span>`).join('')}
                </div>

                <div class="cut-card-actions">
                  <button class="btn-slice-play" data-t="${cut.start}">
                    ▶ 本地播放
                  </button>
                  <button class="btn-slice-newtab" data-t="${cut.start}">
                    🚀 新标签页预览此句 ↗
                  </button>
                </div>
              </article>
            `;
          }).join('')}
        </div>
      </section>
    `;
  }

  // --- 视效库 ---
  private renderEffectsTab(): string {
    const roleLabels: Record<string, string> = {
      background: '背景',
      imagery: '意象',
      accent: '点缀',
      typography: '字效',
      hybrid: '混合',
    };
    const originLabels: Record<string, string> = {
      film: '原片整幕',
      bespoke: '手写分层',
      generated: '模型新写',
    };
    const cards = this.allPluginNames.map((id) => PLUGIN_REGISTRY[id]!).filter((meta) => {
      if (!meta) return false;
      const origin = meta.origin ?? 'bespoke';
      if (this.effectOrigin !== 'all' && origin !== this.effectOrigin) return false;
      if (this.effectRole !== 'all' && meta.layerRole !== this.effectRole) return false;
      return true;
    });
    const chip = (kind: 'origin' | 'role', value: string, label: string, current: string) =>
      `<button type="button" class="filter-chip ${current === value ? 'active' : ''}" data-filter-kind="${kind}" data-filter-value="${value}">${label}</button>`;
    return `
      <section class="studio-section">
        <div class="card" style="margin-bottom:16px;">
          <h2 class="card-title">视效库</h2>
          <p class="card-desc">原片整幕来自第一版 scenes/，可以作为一整镜，也可以只铺在背景层。手写插件和模型新写的文件按图层分类。临时文件可以晋升成固定资产；没有被任何编排引用的临时文件可以丢掉。</p>
          <button type="button" id="btn-discard-temps" class="btn btn-outline">丢掉未被引用的临时分镜</button>
          <div class="filter-row">
            <span class="nav-kicker">来源</span>
            ${chip('origin', 'all', '全部', this.effectOrigin)}
            ${chip('origin', 'film', `原片 ${this.catalogCounts().film}`, this.effectOrigin)}
            ${chip('origin', 'bespoke', `手写 ${this.catalogCounts().bespoke}`, this.effectOrigin)}
            ${chip('origin', 'generated', `模型 ${this.catalogCounts().generated}`, this.effectOrigin)}
          </div>
          <div class="filter-row">
            <span class="nav-kicker">图层</span>
            ${chip('role', 'all', '全部', this.effectRole)}
            ${chip('role', 'background', '背景', this.effectRole)}
            ${chip('role', 'imagery', '意象', this.effectRole)}
            ${chip('role', 'accent', '点缀', this.effectRole)}
            ${chip('role', 'typography', '字效', this.effectRole)}
          </div>
        </div>
        <div class="arsenal-grid">
          ${cards.map((meta) => {
            const origin = meta.origin ?? 'bespoke';
            const life = meta.assetStatus === 'temporary' ? '临时' : meta.assetStatus === 'asset' ? '固定资产' : '';
            return `
              <div class="arsenal-card">
                <div class="arsenal-card-header" style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
                  <div>
                    <div class="arsenal-title-zh">${this.esc(meta.zhName)}</div>
                    <div class="arsenal-title-en mono">${this.esc(meta.id)}</div>
                  </div>
                  <span class="mono" style="font-size:10px;padding:2px 6px;border-radius:4px;background:rgba(255,255,255,0.06);">
                    ${originLabels[origin] || origin}${life ? ` · ${life}` : ''} · ${roleLabels[meta.layerRole] || meta.layerRole}
                  </span>
                </div>
                <p class="arsenal-desc">${this.esc(meta.description)}</p>
                <div class="arsenal-actions">
                  <button class="btn btn-sandbox" data-plugin="${this.esc(meta.id)}">沙箱预览</button>
                  ${meta.assetStatus === 'temporary' ? `<button class="btn btn-promote" data-plugin="${this.esc(meta.id)}">晋升为固定资产</button>` : ''}
                </div>
              </div>
            `;
          }).join('') || '<p class="card-desc">这个分类下还没有视效。</p>'}
        </div>
      </section>
    `;
  }

  // --- 04. 标签与意象库 ---
  private renderTagsTab(): string {
    return `
      <section class="studio-section">
        <div class="card" style="margin-bottom:24px;">
          <h2 class="card-title">语义意象与大模型匹配测试沙盘</h2>
          <p class="card-desc">输入任意歌词或意象提示词，实时演练算法加权打分匹配的效果器与本体推导过程。</p>
          <div style="display:flex;gap:12px;margin-top:12px;">
            <input type="text" id="sandbox-tag-query" class="input-text" placeholder="输入歌词片段，如：'Silicon substrate, hundreds of thousands of GPUs'..." style="flex:1;" />
            <button id="btn-test-match" class="btn btn-accent">执行加权匹配计算</button>
          </div>
          <div id="sandbox-match-result" class="match-result-box" style="margin-top:16px;display:none;"></div>
        </div>

        <div class="grid-2">
          <div class="card">
            <h2 class="card-title">美学流派标签集 (Aesthetic Styles)</h2>
            <div class="tag-cluster-list">
              ${AESTHETIC_STYLES.map(tag => `
                <div class="tag-def-item">
                  <div class="tag-def-header">
                    <span class="tag-def-name" style="color:${tag.color};">${tag.name}</span>
                    <span class="tag-def-en mono">${tag.en}</span>
                  </div>
                  <div class="tag-def-desc">${tag.desc}</div>
                </div>
              `).join('')}
            </div>
          </div>

          <div class="card">
            <h2 class="card-title">哲学与具象意象集 (Semantic Imageries)</h2>
            <div class="tag-cluster-list">
              ${SEMANTIC_IMAGERIES.map(tag => `
                <div class="tag-def-item">
                  <div class="tag-def-header">
                    <span class="tag-def-name" style="color:${tag.color};">${tag.name}</span>
                    <span class="tag-def-en mono">${tag.en}</span>
                  </div>
                  <div class="tag-def-desc">${tag.desc}</div>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      </section>
    `;
  }

  // --- 05. 大模型接入面板 ---
  private renderLlmTab(): string {
    return `
      <section class="studio-section">
        <div class="card">
          <h2 class="card-title">用 deepseek-flash 写分层视效</h2>
          <p class="card-desc" id="llm-status">正在确认本地密钥…</p>
          <div class="form-group">
            <label>写哪些层</label>
            <select id="gen-mode" class="input-text">
              <option value="stack">四层一起写（背景、意象、点缀、字效）</option>
              <option value="one">只写一层</option>
            </select>
          </div>
          <div class="form-group" id="gen-role-row" style="display:none;">
            <label>这一层</label>
            <select id="gen-role" class="input-text">
              <option value="background">背景</option>
              <option value="imagery" selected>意象</option>
              <option value="accent">点缀</option>
              <option value="typography">字效</option>
            </select>
          </div>
          <div class="form-group">
            <label>插件 id（四层时作为前缀，会写成 id-bg / id-img / id-acc / id-typo）</label>
            <input id="gen-id" class="input-text" value="motif" />
          </div>
          <div class="form-group">
            <label>画面</label>
            <textarea id="gen-brief" class="code-textarea" style="min-height:120px;">冷色细环随底鼓涨一下，中心留黑，给歌词留位置。点缀只留一条沿环的亮线。</textarea>
          </div>
          <label style="display:flex;gap:8px;align-items:center;font-size:13px;">
            <input id="gen-overwrite" type="checkbox" /> 覆盖同名文件
          </label>
          <div style="display:flex;gap:10px;margin-top:12px;">
            <button id="btn-generate-effect" class="btn btn-accent" type="button">写入插件文件</button>
          </div>
          <pre id="gen-log" class="card-desc" style="white-space:pre-wrap;margin-top:12px;">${this.esc(this.lastGenLog)}</pre>
        </div>
      </section>
    `;
  }

  private renderLyricsTab(): string {
    const words = this.lyricsDoc.lines.flatMap((line) => line.words ?? []);
    const mean = words.reduce((s: number, w: { conf?: number }) => s + (w.conf ?? 1), 0) / Math.max(1, words.length);
    const rows = this.lyricsDoc.lines.map((line, li: number) => {
      const shown = ((line.words ?? []) as { w: string; start: number; end: number; conf?: number }[])
        .map((w, wi) => ({ w, wi }))
        .filter(({ w }) => !this.lyricLowOnly || (w.conf ?? 1) < 0.7);
      if (!shown.length) return '';
      return `
        <article class="card" style="margin-bottom:12px;">
          <div style="display:flex;justify-content:space-between;gap:12px;">
            <strong>${this.esc(line.text)}</strong>
            <span class="mono" style="color:var(--text-muted);">${Number(line.start).toFixed(2)}–${Number(line.end).toFixed(2)}s</span>
          </div>
          <div class="lyric-word-grid">
            ${shown.map(({ w, wi }) => `
              <label class="lyric-word ${ (w.conf ?? 1) < 0.7 ? 'low' : '' }">
                <span>${this.esc(w.w)} <em>${((w.conf ?? 1) * 100).toFixed(0)}%</em></span>
                <input class="input-text lyric-time" data-line="${li}" data-word="${wi}" data-field="start" type="number" step="0.001" value="${w.start}" />
                <input class="input-text lyric-time" data-line="${li}" data-word="${wi}" data-field="end" type="number" step="0.001" value="${w.end}" />
              </label>
            `).join('')}
          </div>
        </article>
      `;
    }).join('');
    return `
      <section class="studio-section">
        <div class="card" style="margin-bottom:16px;">
          <h2 class="card-title">歌词切分校对</h2>
          <p class="card-desc">
            当前曲目 ${this.esc(this.track)} · ${this.audio.duration.toFixed(2)}s · ${this.audio.bpm.toFixed(2)} BPM · ${this.audio.downbeats.length} 个下拍。
            歌词 ${this.lyricsDoc.lines.length} 行 · ${words.length} 词 · 平均置信 ${(mean * 100).toFixed(1)}% · 低于 0.7 的 ${this.lowConfCount()} 词。
            改的是词的起止时间，保存后写回 tracks/${this.esc(this.track)}/lyrics.json。第一次对齐仍由 analysis/ 离线脚本生成。
          </p>
          <div style="display:flex;gap:10px;align-items:center;">
            <button id="btn-lyric-filter" class="btn btn-outline" type="button">${this.lyricLowOnly ? '只看低置信' : '看全部词'}</button>
            <button id="btn-save-lyrics" class="btn btn-primary" type="button">保存切分文件</button>
          </div>
        </div>
        ${rows || '<p class="card-desc">没有要看的词。</p>'}
      </section>
    `;
  }

  // --- 事件绑定与交互 ---
  private bindEvents() {
    const root = document.getElementById('app-root')!;

    const trackSel = root.querySelector('#select-active-track') as HTMLSelectElement | null;
    trackSel?.addEventListener('change', () => {
      const nextTrack = trackSel.value.trim();
      if (nextTrack && nextTrack !== this.track) {
        location.search = `?track=${encodeURIComponent(nextTrack)}`;
      }
    });

    const themeSel = root.querySelector('#select-theme-mode') as HTMLSelectElement | null;
    themeSel?.addEventListener('change', () => {
      const nextTheme = themeSel.value as 'dark' | 'light' | 'ink';
      this.applyTheme(nextTheme);
    });

    // 切换 Tab
    root.querySelectorAll('.nav-tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.activeTab = (e.currentTarget as HTMLElement).dataset.tab as any;
        this.render();
        this.bindEvents();
      });
    });

    root.querySelectorAll('.filter-chip').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const el = e.currentTarget as HTMLElement;
        const kind = el.dataset.filterKind;
        const value = el.dataset.filterValue as any;
        if (kind === 'origin') this.effectOrigin = value;
        if (kind === 'role') this.effectRole = value;
        this.render();
        this.bindEvents();
      });
    });

    const genMode = root.querySelector('#gen-mode') as HTMLSelectElement | null;
    const genRoleRow = root.querySelector('#gen-role-row') as HTMLElement | null;
    genMode?.addEventListener('change', () => {
      if (genRoleRow) genRoleRow.style.display = genMode.value === 'one' ? '' : 'none';
    });

    const llmStatus = root.querySelector('#llm-status');
    if (llmStatus) {
      void fetch('/api/llm-status').then(async (r) => {
        const data = await r.json();
        llmStatus.textContent = data.configured
          ? `密钥在本地开发服务里。模型 ${data.model}。编写结果写成 src/plugins/*.ts，刷新视效库后可以挂到镜头上。`
          : '开发服务没有读到 DEEPSEEK_API_KEY。把它放在 app/.env.local 后重启预览。';
      }).catch(() => {
        llmStatus.textContent = '预览服务没有接上 /api/llm-status。用 bun run dev 打开工作台。';
      });
    }

    root.querySelector('#btn-generate-effect')?.addEventListener('click', async () => {
      const log = root.querySelector('#gen-log');
      const mode = (root.querySelector('#gen-mode') as HTMLSelectElement).value;
      const id = (root.querySelector('#gen-id') as HTMLInputElement).value.trim();
      const brief = (root.querySelector('#gen-brief') as HTMLTextAreaElement).value.trim();
      const layerRole = (root.querySelector('#gen-role') as HTMLSelectElement).value;
      const overwrite = (root.querySelector('#gen-overwrite') as HTMLInputElement).checked;
      if (log) log.textContent = '正在请 deepseek-flash 写插件…';
      try {
        const res = await fetch('/api/generate-effect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mode,
            id,
            prefix: id,
            layerRole,
            brief,
            overwrite,
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.ok) throw new Error(data.error || `HTTP ${res.status}`);
        await this.refreshCatalog();
        this.lastGenLog = (data.files as { id: string; role: string; zh: string }[])
          .map((f) => `${f.role}  ${f.id}  ${f.zh}`)
          .join('\n');
        this.activeTab = 'effects';
        this.effectOrigin = 'generated';
        this.render();
        this.bindEvents();
      } catch (err: any) {
        if (log) log.textContent = err.message ?? String(err);
      }
    });

    root.querySelector('#btn-lyric-filter')?.addEventListener('click', () => {
      this.lyricLowOnly = !this.lyricLowOnly;
      this.render();
      this.bindEvents();
    });

    root.querySelectorAll('.lyric-time').forEach((input) => {
      input.addEventListener('change', (e) => {
        const el = e.currentTarget as HTMLInputElement;
        const li = Number(el.dataset.line);
        const wi = Number(el.dataset.word);
        const field = el.dataset.field as 'start' | 'end';
        const word = this.lyricsDoc.lines[li]?.words?.[wi];
        if (!word) return;
        const n = Number(el.value);
        if (!Number.isFinite(n)) return;
        word[field] = n;
        this.lyrics = new Lyrics(this.lyricsDoc);
      });
    });

    root.querySelector('#btn-save-lyrics')?.addEventListener('click', async () => {
      const res = await fetch('/api/save-lyrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ track: this.track, lyrics: this.lyricsDoc }),
      });
      const data = await res.json().catch(() => ({}));
      alert(res.ok ? `切分已写回 tracks/${this.track}/lyrics.json` : (data.error || '保存失败'));
    });

    // 🌟 一键加载官方推荐黄金编排预设
    const btnLoadPreset = root.querySelector('#btn-load-preset');
    if (btnLoadPreset) {
      btnLoadPreset.addEventListener('click', () => {
        this.timelineDSL = JSON.parse(JSON.stringify(MASTERPIECE_PRESET));
        this.rememberTimeline();
        fetch('/api/save-timeline', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ track: this.track, timeline: this.timelineDSL }),
        }).catch(() => {});
        alert('🌟 已成功加载《官方推荐大师编排预设》（16 幕黄金分镜无缝衔接）！可直接点击“整体全屏预览”进行体验。');
        this.render();
        this.bindEvents();
      });
    }

    // 🎬 一键加载电影级五层正交组合预设
    const btnLoadCinema = root.querySelector('#btn-load-cinema');
    if (btnLoadCinema) {
      btnLoadCinema.addEventListener('click', () => {
        this.timelineDSL = JSON.parse(JSON.stringify(LAYERED_CINEMA_PRESET));
        this.rememberTimeline();
        fetch('/api/save-timeline', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ track: this.track, timeline: this.timelineDSL }),
        }).catch(() => {});
        alert('🎬 已成功加载《电影级五层正交镜头编排预设》！每幕分镜均由背景、意象物、点缀线条、字效排版与专属调色正交合成，可直接点击“整体全屏预览”体验多层音画联动！');
        this.render();
        this.bindEvents();
      });
    }

    // 5 层分层装配器下拉变更监听
    root.querySelectorAll('.layer-select').forEach(sel => {
      sel.addEventListener('change', (e) => {
        const target = e.target as HTMLSelectElement;
        const cutIdx = parseInt(target.dataset.cutIdx!);
        const layerKey = target.dataset.layerKey!;
        const val = target.value;
        const cut = this.timelineDSL[cutIdx];
        const visual = layerKey === 'background' || layerKey === 'imagery' || layerKey === 'accent' || layerKey === 'typography';
        cut[layerKey] = val || undefined;
        if (val && visual) {
          const meta = PLUGIN_REGISTRY[val];
          if (meta?.paramsHint) cut.params = { ...(cut.params ?? {}), ...meta.paramsHint };
          if (meta?.maxSamples) cut.maxSamples = meta.maxSamples;
        }
        if (visual && val) {
          delete cut.scene;
          delete cut.plugin;
          const soloSel = root.querySelector(`.cut-plugin-select[data-cut-idx="${cutIdx}"]`) as HTMLSelectElement | null;
          if (soloSel) soloSel.value = '';
        } else if (visual && !val && !cut.background && !cut.imagery && !cut.accent && !cut.typography && !cut.plugin && !cut.scene) {
          cut.plugin = 'typography';
        }
        this.rememberTimeline();
      });
    });

    // ⚡ 智能匹配五层装配按钮
    root.querySelectorAll('.btn-auto-assemble').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const cutIdx = parseInt((e.currentTarget as HTMLElement).dataset.cutIdx!);
        const lyric = (e.currentTarget as HTMLElement).dataset.lyric || '';
        const assembled = assembleLayeredLens(lyric);
        this.applyLayers(this.timelineDSL[cutIdx], assembled);
        this.rememberTimeline();
        alert(`⚡ 已完成第 #${cutIdx + 1} 幕分层装配！\n${assembled.rationale}`);
        this.render();
        this.bindEvents();
      });
    });

    root.querySelectorAll('.btn-model-assemble-one').forEach(btn => {
      btn.addEventListener('click', () => {
        const cutIdx = parseInt((btn as HTMLElement).dataset.cutIdx!);
        void this.assembleWithModel([cutIdx]);
      });
    });

    root.querySelectorAll('.btn-write-shot-layer').forEach(btn => {
      btn.addEventListener('click', async () => {
        const cutIdx = parseInt((btn as HTMLElement).dataset.cutIdx!);
        const cut = this.timelineDSL[cutIdx];
        if (!cut) return;
        const roleInput = window.prompt('选择要由 AI 编写的图层角色 (background / imagery / accent / typography):', 'imagery');
        if (!roleInput) return;
        const role = roleInput.trim() as 'background' | 'imagery' | 'accent' | 'typography';
        if (!['background', 'imagery', 'accent', 'typography'].includes(role)) {
          alert('图层角色必须是 background、imagery、accent 或 typography');
          return;
        }
        const brief = window.prompt(`输入第 #${cutIdx + 1} 镜 [${role}] 层的画面描述（80字以内）:`, '随底鼓脉冲收缩的几何线框，中心留暗');
        if (!brief || !brief.trim()) return;
        this.updateShotBanner(`⏳ 正在为镜头 #${cutIdx + 1} 编写 [${role}] 层插件…`, false);
        try {
          const res = await fetch('/api/write-shot-layer', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              track: this.track,
              shotIndex: cutIdx,
              role,
              brief: brief.trim(),
              start: cut.start,
              end: cut.end,
              colorGrade: cut.colorGrade,
            }),
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok || !data.ok) throw new Error(data.error || `HTTP ${res.status}`);
          await this.refreshCatalog();
          delete cut.scene;
          delete cut.plugin;
          cut[role] = data.id;
          if (!cut.background) cut.background = 'terrain';
          if (!cut.typography && this.lyrics.linesIn(cut.start, cut.end).length > 0) cut.typography = 'lyric-line';
          this.rememberTimeline();
          this.updateShotBanner(`✅ 镜头 #${cutIdx + 1} [${role}] 层已挂载新插件 ${data.id} (${data.zh})`, false);
          this.render();
          this.bindEvents();
        } catch (err: any) {
          this.updateShotBanner(`❌ 单层编写失败：${err.message || err}`, false);
          alert(`单层编写没有写成：${err.message || err}`);
        }
      });
    });

    // 🚀 整体全屏预览
    const btnPreviewFull = root.querySelector('#btn-preview-full');
    if (btnPreviewFull) {
      btnPreviewFull.addEventListener('click', () => {
        this.rememberTimeline();
        window.open(`/?track=${this.track}&preview=full`, '_blank');
      });
    }

    // 💾 保存至磁盘
    const btnSaveDisk = root.querySelector('#btn-save-disk');
    if (btnSaveDisk) {
      btnSaveDisk.addEventListener('click', async () => {
        this.rememberTimeline();
        try {
          const res = await fetch('/api/save-timeline', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ track: this.track, timeline: this.timelineDSL }),
          });
          if (res.ok) {
            alert(`时间轴已写回 tracks/${this.track}/timeline.json`);
          } else {
            alert(`写盘失败（HTTP ${res.status}）。编排仍在浏览器本地存储里。`);
          }
        } catch {
          alert('开发服务没有接住写盘请求。编排仍在浏览器本地存储里。');
        }
      });
    }

    // 切片主效果器切换
    root.querySelectorAll('.cut-plugin-select').forEach(sel => {
      sel.addEventListener('change', (e) => {
        const cutIdx = parseInt((e.target as HTMLSelectElement).dataset.cutIdx!);
        const val = (e.target as HTMLSelectElement).value;
        const cut = this.timelineDSL[cutIdx];
        if (!val) {
          delete cut.scene;
          delete cut.plugin;
        } else {
          cut.scene = val;
          cut.plugin = val;
          delete cut.background;
          delete cut.imagery;
          delete cut.accent;
          delete cut.typography;
          delete cut.colorGrade;
        }
        this.rememberTimeline();
        this.render();
        this.bindEvents();
      });
    });

    // 🚀 新标签页预览此句
    root.querySelectorAll('.btn-slice-newtab').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const t = parseFloat((e.currentTarget as HTMLElement).dataset.t!);
        this.rememberTimeline();
        window.open(`/?track=${this.track}&preview=full&t=${t}&loop=1`, '_blank');
      });
    });

    // ▶ 本地播放
    root.querySelectorAll('.btn-slice-play').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const t = parseFloat((e.currentTarget as HTMLElement).dataset.t!);
        window.open(`/?track=${this.track}&preview=full&t=${t}`, '_blank');
      });
    });

    // 🤖 LLM 标签意象自动编排
    const btnAutoCompose = root.querySelector('#btn-llm-auto-compose');
    if (btnAutoCompose) {
      btnAutoCompose.addEventListener('click', () => {
        this.timelineDSL.forEach((cut) => {
          const lyricText = this.lyrics.linesIn(cut.start, cut.end).map(l => l.text).join(' ');
          this.applyLayers(cut, assembleLayeredLens(lyricText));
        });
        this.rememberTimeline();
        alert('关键词规则已写完五层装配。这是本地正则匹配，没有调用模型。');
        this.render();
        this.bindEvents();
      });
    }

    const btnModelAssemble = root.querySelector('#btn-model-assemble');
    if (btnModelAssemble) {
      btnModelAssemble.addEventListener('click', () => {
        void this.assembleWithModel(this.timelineDSL.map((_, i) => i));
      });
    }

    root.querySelector('#btn-shot-program')?.addEventListener('click', () => {
      void this.runIntelligentProgram();
    });
    root.querySelector('#btn-shot-cancel')?.addEventListener('click', () => {
      this.shotAbort?.abort();
    });
    root.querySelector('#btn-shot-undo')?.addEventListener('click', () => {
      void this.undoShotProgram();
    });
    root.querySelector('#btn-discard-temps')?.addEventListener('click', async () => {
      const res = await fetch('/api/discard-unreferenced-temps', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.ok === false) {
        alert(data.error || '临时文件没有丢掉');
        return;
      }
      await this.refreshCatalog();
      alert(data.removed?.length ? `已丢掉 ${data.removed.join(', ')}` : '没有未被引用的临时文件');
      this.render();
      this.bindEvents();
    });
    root.querySelectorAll('.btn-promote').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const from = (btn as HTMLElement).dataset.plugin || '';
        const to = window.prompt('固定资产 id（小写字母开头，只含小写、数字、连字符）', '');
        if (!to) return;
        const post = (promoteOverwrite: boolean) => fetch('/api/promote-plugin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ from, to, zh: PLUGIN_REGISTRY[from]?.zhName, promoteOverwrite }),
        });
        let res = await post(false);
        let data = await res.json().catch(() => ({}));
        if (res.status === 409 && String(data.error || '').includes('手写') && window.confirm('目标已有手写插件。确认覆盖？')) {
          res = await post(true);
          data = await res.json().catch(() => ({}));
        }
        if (!res.ok || data.ok === false) {
          alert(data.error || '晋升没有写成');
          return;
        }
        delete PLUGIN_REGISTRY[from];
        await this.refreshCatalog();
        alert(`已晋升为 ${to}`);
        this.render();
        this.bindEvents();
      });
    });

    // 🎲 随机分布视效
    const btnShuffle = root.querySelector('#btn-random-shuffle');
    if (btnShuffle) {
      btnShuffle.addEventListener('click', () => {
        const pool = [...this.allPluginNames];
        this.timelineDSL.forEach(cut => {
          const rand = pool[Math.floor(Math.random() * pool.length)];
          cut.scene = rand;
          cut.plugin = rand;
          delete cut.background;
          delete cut.imagery;
          delete cut.accent;
          delete cut.typography;
          delete cut.colorGrade;
        });
        this.rememberTimeline();
        this.render();
        this.bindEvents();
      });
    }

    // ⏱️ 吸附下拍
    const btnSnap = root.querySelector('#btn-snap-downbeats');
    if (btnSnap) {
      btnSnap.addEventListener('click', () => {
        this.timelineDSL = snapTimelineToDownbeats(this.timelineDSL, this.audio);
        const fit = adjacencyReport(this.timelineDSL, this.audio.duration);
        this.rememberTimeline();
        void fetch('/api/save-timeline', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ track: this.track, timeline: this.timelineDSL }),
        });
        alert(`已吸附到 ${this.audio.bpm.toFixed(2)} BPM 的下拍。${fit.shots} 幕，最大接缝 ${fit.maxGap.toFixed(4)}s。`);
        this.render();
        this.bindEvents();
      });
    }

    // 🧪 独立沙箱测试 (新标签页)
    root.querySelectorAll('.btn-sandbox').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const plugin = (e.currentTarget as HTMLElement).dataset.plugin!;
        window.open(`/?track=${this.track}&preview=effect&effect=${plugin}`, '_blank');
      });
    });

    // 📋 复制大模型提示词
    root.querySelectorAll('.btn-copy-prompt').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const plugin = (e.currentTarget as HTMLElement).dataset.plugin!;
        const meta = PLUGIN_REGISTRY[plugin]!;
        const promptText = `
[LUXI DESIGN VISUAL EFFECT SPECIFICATION]
Plugin: ${meta.name} (${meta.id})
Layer Role: ${meta.layerRole}
Category: ${meta.styles.join(', ')}
Acoustic Binding: ${meta.acousticFocus.join(', ')}
Guidance: ${meta.promptGuidance}
Strict Paradigm Constraints:
1. Extend Scene from '../engine/scene.ts'.
2. LUMINANCE CAP: Darken central region so lyrics remain crisp. Max HDR luminance <= 1.4.
3. CONTRAST GUARD: Embedded lyrics use tight stroke outline.
4. RHYTHM: Bind uniforms to f.beat, f.barPhase, f.a.kick, f.a.bass, f.downbeat, f.energy.
5. TRANSITIONS: Hard cut. Flash is forced to 0 in the first 0.15s and the last 0.20s of a DSL shot.
        `.trim();
        navigator.clipboard.writeText(promptText);
        alert(`📋 已复制 [${meta.zhName}] 规范提示词至剪贴板！`);
      });
    });

    // 标签匹配沙箱测试
    const btnTestMatch = root.querySelector('#btn-test-match');
    const inputTagQuery = root.querySelector('#sandbox-tag-query') as HTMLInputElement;
    const boxMatchResult = root.querySelector('#sandbox-match-result') as HTMLElement;
    if (btnTestMatch && inputTagQuery && boxMatchResult) {
      btnTestMatch.addEventListener('click', () => {
        const text = inputTagQuery.value.trim();
        if (!text) {
          alert('请输入待测试的文本！');
          return;
        }
        const res = matchOptimalVisualPlugin(text);
        const meta = PLUGIN_REGISTRY[res.plugin]!;
        const assembled = assembleLayeredLens(text);
        boxMatchResult.style.display = 'block';
        boxMatchResult.innerHTML = `
          <div style="font-weight:700;color:var(--text-ok);margin-bottom:6px;">🎯 匹配结果: ${meta.zhName} (${res.plugin})</div>
          <div style="font-size:13px;color:var(--text-primary);margin-bottom:4px;">命中意象/风格标签: <strong style="color:var(--text-info);">${res.matchedTag.name} (${res.matchedTag.en})</strong></div>
          <div style="font-size:12px;color:var(--text-secondary);margin-bottom:6px;">匹配依据: ${res.rationale}  |  置信度: ${(res.confidence * 100).toFixed(0)}%</div>
          <div style="font-size:12px;color:var(--text-warn);background:var(--bg-card);padding:6px 10px;border-radius:4px;border:1px dashed var(--border-strong);">
            ${assembled.rationale}
          </div>
        `;
      });
    }
  }
}

const studioApp = new StandaloneStudioWorkbench();
studioApp.init().catch(console.error);
