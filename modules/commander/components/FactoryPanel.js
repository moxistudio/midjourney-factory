import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Check, Image, Play, RefreshCw, Settings2, Terminal } from 'lucide-react';
import { AR_OPTIONS, MJ_VERSIONS, NIJI_VERSIONS } from '../constants/presets';
import { applyParams, bi, buildParamPack } from '../lib/promptUtils';
import LogTerminal from './LogTerminal';

export default function FactoryPanel({
  applyFactoryEditsToDraft,
  draftEdits,
  factoryEdits,
  factoryLogs,
  generationModel,
  isDraftLoading,
  isFactoryRunning,
  isNiji,
  loadLatestDraft,
  mjVersion,
  nijiVersion,
  paramAR,
  paramChaos,
  paramChaosEnabled,
  paramCref,
  paramCrefEnabled,
  paramOref,
  paramOrefEnabled,
  paramSref,
  paramSrefEnabled,
  paramStyle,
  paramStyleEnabled,
  queuedFile,
  repeatPerPrompt,
  resetFactoryEditsFromDraft,
  setFactoryEdits,
  setGenerationModel,
  setMjVersion,
  setNijiVersion,
  setParamAR,
  setParamChaos,
  setParamChaosEnabled,
  setParamCref,
  setParamCrefEnabled,
  setParamOref,
  setParamOrefEnabled,
  setParamSref,
  setParamSrefEnabled,
  setParamStyle,
  setParamStyleEnabled,
  setRepeatPerPrompt,
  startFactory,
  startFromPreview,
  stopFactory,
  uploadStatus,
  uploadToDriveAndFill,
}) {
  const previewLines = useMemo(() => {
    if (!draftEdits.length) return [];
    const params = applyParams(
      '',
      buildParamPack({
        generationModel,
        mjVersion,
        nijiVersion,
        paramAR,
        paramChaosEnabled,
        paramChaos,
        paramStyleEnabled,
        paramStyle,
        paramSrefEnabled,
        paramSref,
        paramOrefEnabled,
        paramOref,
        paramCrefEnabled,
        paramCref,
      })
    );
    const sourceTexts = factoryEdits.length ? factoryEdits : draftEdits.map((item) => item.prompt);
    return sourceTexts.slice(0, 30).map((text) => `${String(text || '').trim()} ${params}`.trim());
  }, [
    draftEdits,
    factoryEdits,
    generationModel,
    mjVersion,
    nijiVersion,
    paramAR,
    paramChaos,
    paramChaosEnabled,
    paramCref,
    paramCrefEnabled,
    paramOref,
    paramOrefEnabled,
    paramSref,
    paramSrefEnabled,
    paramStyle,
    paramStyleEnabled,
  ]);

  return (
    <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }} className="glass-panel lab-card">
      <div className="lab-card__header">
        <Terminal size={20} className="lab-lavender" />
        <h2 className="heading-sans accent-factory" style={{ flex: 1, fontSize: 18 }}>
          {bi('Factory', '工厂')}
        </h2>
        <span className={`label-text ${isFactoryRunning ? 'animate-pulse lab-success' : 'lab-muted'}`}>
          {isFactoryRunning ? bi('Active', '运行中') : bi('Standby', '待机')}
        </span>
      </div>

      <div className="lab-card__body">
        <div className="lab-helpbox" style={{ padding: 14 }}>
          <div className="label-text" style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
            <Settings2 size={16} /> {bi('Midjourney Parameters', 'Midjourney 参数')}
          </div>

          <div className="lab-grid2" style={{ marginBottom: 12 }}>
            <div>
              <label className="label-text" style={{ display: 'block', marginBottom: 8 }}>
                {bi('Model', '模型')}
              </label>
              <select
                value={generationModel}
                onChange={(event) => setGenerationModel(event.target.value === 'niji' ? 'niji' : 'mj')}
                className="input-field lab-full"
                style={{ borderRadius: 12, padding: '10px 12px', fontSize: 13 }}
              >
                <option value="mj">Midjourney / MJ</option>
                <option value="niji">Niji / 二次元</option>
              </select>
            </div>

            <div>
              <label className="label-text" style={{ display: 'block', marginBottom: 8 }}>
                {bi('Version', '版本')}
              </label>
              {generationModel === 'niji' ? (
                <select
                  value={nijiVersion}
                  onChange={(event) => setNijiVersion(String(event.target.value || '7'))}
                  className="input-field lab-full"
                  style={{ borderRadius: 12, padding: '10px 12px', fontSize: 13 }}
                >
                  {NIJI_VERSIONS.map((version) => (
                    <option key={version} value={version}>
                      Niji {version}
                    </option>
                  ))}
                </select>
              ) : (
                <select
                  value={mjVersion}
                  onChange={(event) => setMjVersion(String(event.target.value || '7'))}
                  className="input-field lab-full"
                  style={{ borderRadius: 12, padding: '10px 12px', fontSize: 13 }}
                >
                  {MJ_VERSIONS.map((version) => (
                    <option key={version} value={version}>
                      V{version}
                    </option>
                  ))}
                </select>
              )}
              <div className="mono-code lab-muted" style={{ fontSize: 12, marginTop: 6 }}>
                {bi('Final sending DM is chosen based on the model/version (V7 -> MJ, Niji7 -> Niji).', '最终发送会根据模型/版本选择私聊 (V7 -> MJ, Niji7 -> Niji)。')}
              </div>
            </div>
          </div>

          <div className="lab-grid2" style={{ marginBottom: 12 }}>
            <div>
              <label className="label-text" style={{ display: 'block', marginBottom: 8 }}>
                {bi('Runs per prompt', '每条生成次数')}
              </label>
              <select
                value={repeatPerPrompt}
                onChange={(event) => setRepeatPerPrompt(Number(event.target.value || 1))}
                className="input-field lab-full"
                style={{ borderRadius: 12, padding: '10px 12px', fontSize: 13 }}
              >
                {[1, 2, 3, 4, 5, 6, 7, 8].map((count) => (
                  <option key={count} value={count}>
                    {count}
                  </option>
                ))}
              </select>
              <div className="mono-code lab-muted" style={{ fontSize: 12, marginTop: 6 }}>
                {bi('Default 1. This duplicates each prompt in the queue.', '默认 1。会把每条提示词复制 N 次进入队列。')}
              </div>
            </div>

            <div>
              <label className="label-text" style={{ display: 'block', marginBottom: 8 }}>
                {bi('Note', '说明')}
              </label>
              <div className="input-field" style={{ borderRadius: 12, padding: '10px 12px', fontSize: 12, color: 'var(--lab-text-secondary)' }}>
                {bi('Architect controls how many prompts to generate.', 'Architect 控制生成多少条 prompt。')}
                <br />
                {bi('Factory controls how many times each prompt runs.', 'Factory 控制每条 prompt 跑几次。')}
              </div>
            </div>
          </div>

          <div className="lab-grid2">
            <div>
              <label className="label-text" style={{ display: 'block', marginBottom: 8 }}>
                {bi('Aspect Ratio', '画幅比例')}
              </label>
              <select value={paramAR} onChange={(event) => setParamAR(String(event.target.value || ''))} className="input-field lab-full" style={{ borderRadius: 12, padding: '10px 12px', fontSize: 13 }}>
                <option value="">{bi('Keep per-prompt', '保留每条提示词')}</option>
                {AR_OPTIONS.map((aspectRatio) => (
                  <option key={aspectRatio} value={aspectRatio}>
                    {aspectRatio}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label-text" style={{ display: 'block', marginBottom: 8 }}>
                {bi('Chaos', '混沌')}
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--lab-text-secondary)' }}>
                  <input type="checkbox" checked={paramChaosEnabled} onChange={(event) => setParamChaosEnabled(Boolean(event.target.checked))} /> {bi('Enable', '启用')}
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={paramChaos}
                  onChange={(event) => setParamChaos(Number(event.target.value || 0))}
                  disabled={!paramChaosEnabled}
                  className="input-field"
                  style={{ width: 140, borderRadius: 12, padding: '10px 12px', fontSize: 13, opacity: paramChaosEnabled ? 1 : 0.6 }}
                />
              </div>
            </div>
          </div>

          <div className="lab-grid2" style={{ marginTop: 12 }}>
            <div>
              <label className="label-text" style={{ display: 'block', marginBottom: 8 }}>
                {bi('Style', '风格')}
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--lab-text-secondary)' }}>
                  <input type="checkbox" checked={paramStyleEnabled} onChange={(event) => setParamStyleEnabled(Boolean(event.target.checked))} disabled={isNiji} />
                  {bi('Enable', '启用')}
                </label>
                <select
                  value={paramStyle}
                  onChange={(event) => setParamStyle(String(event.target.value || 'raw'))}
                  disabled={!paramStyleEnabled}
                  className="input-field"
                  style={{ flex: 1, borderRadius: 12, padding: '10px 12px', fontSize: 13, opacity: paramStyleEnabled ? 1 : 0.6 }}
                >
                  <option value="raw">raw / 原始</option>
                  <option value="expressive">expressive / 表现力</option>
                </select>
              </div>

              {isNiji ? (
                <div className="mono-code lab-muted" style={{ fontSize: 12, marginTop: 6 }}>
                  {bi('Style flag is disabled for Niji to avoid errors.', '为避免 Niji 报错，已禁用 --style 参数。')}
                </div>
              ) : null}
            </div>

            <div>
              <label className="label-text" style={{ display: 'block', marginBottom: 8 }}>
                {bi('SREF', '风格参考')}
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--lab-text-secondary)' }}>
                  <input type="checkbox" checked={paramSrefEnabled} onChange={(event) => setParamSrefEnabled(Boolean(event.target.checked))} /> {bi('Enable', '启用')}
                </label>
                <input
                  value={paramSref}
                  onChange={(event) => setParamSref(event.target.value)}
                  disabled={!paramSrefEnabled}
                  placeholder={bi('sref URL / code', 'sref 链接/代码')}
                  className="input-field"
                  style={{ flex: 1, borderRadius: 12, padding: '10px 12px', fontSize: 13, opacity: paramSrefEnabled ? 1 : 0.6 }}
                />
              </div>
            </div>
          </div>

          <div className="lab-grid2" style={{ marginTop: 12 }}>
            <div>
              <label className="label-text" style={{ display: 'block', marginBottom: 8 }}>
                {bi('OREF', '物体参考')}
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--lab-text-secondary)' }}>
                  <input type="checkbox" checked={paramOrefEnabled} onChange={(event) => setParamOrefEnabled(Boolean(event.target.checked))} /> {bi('Enable', '启用')}
                </label>
                <input
                  value={paramOref}
                  onChange={(event) => setParamOref(event.target.value)}
                  disabled={!paramOrefEnabled}
                  placeholder={bi('public image URL', '公开图片链接')}
                  className="input-field"
                  style={{ flex: 1, borderRadius: 12, padding: '10px 12px', fontSize: 13, opacity: paramOrefEnabled ? 1 : 0.6 }}
                />
                <label className="btn-secondary" style={{ borderRadius: 12, padding: '10px 12px', fontSize: 13, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <Image size={16} /> {bi('Upload', '上传')}
                  <input className="lab-hidden" type="file" accept="image/*" onChange={(event) => uploadToDriveAndFill(event.target.files?.[0], 'oref')} />
                </label>
              </div>
            </div>

            <div>
              <label className="label-text" style={{ display: 'block', marginBottom: 8 }}>
                {bi('CREF', '角色参考')}
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--lab-text-secondary)' }}>
                  <input type="checkbox" checked={paramCrefEnabled} onChange={(event) => setParamCrefEnabled(Boolean(event.target.checked))} /> {bi('Enable', '启用')}
                </label>
                <input
                  value={paramCref}
                  onChange={(event) => setParamCref(event.target.value)}
                  disabled={!paramCrefEnabled}
                  placeholder={bi('public image URL', '公开图片链接')}
                  className="input-field"
                  style={{ flex: 1, borderRadius: 12, padding: '10px 12px', fontSize: 13, opacity: paramCrefEnabled ? 1 : 0.6 }}
                />
                <label className="btn-secondary" style={{ borderRadius: 12, padding: '10px 12px', fontSize: 13, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <Image size={16} /> {bi('Upload', '上传')}
                  <input className="lab-hidden" type="file" accept="image/*" onChange={(event) => uploadToDriveAndFill(event.target.files?.[0], 'cref')} />
                </label>
              </div>
            </div>
          </div>

          {uploadStatus ? <div className="mono-code" style={{ fontSize: 12, marginTop: 10, color: 'var(--lab-warning)' }}>{uploadStatus}</div> : null}
        </div>

        <div className="lab-helpbox" style={{ padding: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <span className="label-text">{bi('Preview', '预览')}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <button className="btn-secondary" style={{ borderRadius: 12, padding: '8px 10px', fontSize: 12 }} onClick={resetFactoryEditsFromDraft} type="button" disabled={!draftEdits.length}>
                {bi('Reset edits', '重置修改')}
              </button>
              <button className="btn-secondary" style={{ borderRadius: 12, padding: '8px 10px', fontSize: 12 }} onClick={applyFactoryEditsToDraft} type="button" disabled={!draftEdits.length}>
                {bi('Apply edits', '应用修改')}
              </button>
              <button className="btn-secondary" style={{ borderRadius: 12, padding: '8px 10px', fontSize: 12 }} onClick={loadLatestDraft} type="button" disabled={isDraftLoading}>
                <RefreshCw size={14} style={{ display: 'inline', marginRight: 6 }} />
                {isDraftLoading ? bi('Loading...', '加载中...') : bi('Load Latest', '加载最新')}
              </button>
            </div>
          </div>

          {previewLines.length === 0 ? (
            <div className="mono-code lab-muted" style={{ marginTop: 10, fontSize: 12 }}>
              {bi('No prompts to preview. Generate a draft on the Architect tab first.', '暂无可预览提示词。请先在 Architect 页生成草稿。')}
            </div>
          ) : (
            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {(factoryEdits.length ? factoryEdits : draftEdits.map((item) => item.prompt)).slice(0, 10).map((text, index) => (
                <div key={index} className="input-field" style={{ borderRadius: 14, padding: 12 }}>
                  <div className="label-text" style={{ textTransform: 'none' }}>
                    {bi('Prompt', '提示词')} #{index + 1}
                  </div>
                  <textarea
                    value={String(text || '')}
                    onChange={(event) => {
                      const value = event.target.value;
                      setFactoryEdits((prev) => {
                        const base = prev.length ? prev.slice() : draftEdits.map((item) => String((item && item.prompt) || ''));
                        base[index] = value;
                        return base;
                      });
                    }}
                    className="input-field mono-code lab-full"
                    style={{ marginTop: 10, height: 86, resize: 'vertical', borderRadius: 12, padding: 10, fontSize: 12 }}
                  />
                  <div className="mono-code" style={{ marginTop: 10, fontSize: 12, color: 'var(--lab-text-secondary)', whiteSpace: 'pre-wrap' }}>
                    {previewLines[index] || ''}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 12 }}>
            <div className="mono-code lab-muted" style={{ fontSize: 12 }}>
              {bi('Clicking Start will approve prompts to', '点击 Start 会把提示词审核写入')} <code className="mono-code">output/prompts</code> {bi('then start the Factory bot.', '然后启动 Factory 机器人。')}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button className="btn-secondary" type="button" onClick={() => (isFactoryRunning ? stopFactory() : startFactory())} style={{ borderRadius: 12, padding: '10px 12px', fontSize: 13 }}>
                {isFactoryRunning ? bi('Stop Factory', '停止工厂') : bi('Start Factory', '启动工厂')}
              </button>
              <button className="btn-primary" type="button" onClick={startFromPreview} disabled={!draftEdits.length} style={{ borderRadius: 12, padding: '10px 14px', fontSize: 13 }}>
                <Play size={16} style={{ display: 'inline', marginRight: 8 }} /> {bi('Start', '开始')}
              </button>
            </div>
          </div>

          {queuedFile ? (
            <div className="mono-code" style={{ marginTop: 10, fontSize: 12, color: 'var(--lab-amber)' }}>
              <Check size={14} style={{ display: 'inline', marginRight: 8 }} />
              {bi('Queued', '已入队')}: {queuedFile}
            </div>
          ) : null}
        </div>
      </div>

      <LogTerminal logs={factoryLogs} emptyMessage={bi('Factory logs will appear here...', '工厂日志会显示在这里...')} style={{ color: 'var(--lab-success)' }} />
    </motion.section>
  );
}
