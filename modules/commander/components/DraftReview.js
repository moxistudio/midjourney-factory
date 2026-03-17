import React from 'react';
import { RefreshCw, Trash2, Upload } from 'lucide-react';
import { bi } from '../lib/promptUtils';

export default function DraftReview({
  batchText,
  draft,
  draftEdits,
  draftHistory,
  draftPick,
  fetchDraftHistory,
  importBatchPromptsAsDraft,
  isDraftLoading,
  isImporting,
  loadDraftFile,
  loadLatestDraft,
  setBatchText,
  setDraftEdits,
  setDraftPick,
  setFactoryEdits,
}) {
  const onBatchFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setBatchText(text);
  };

  return (
    <>
      <div className="lab-helpbox">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <label className="label-text">{bi('Batch Import', '批量导入')}</label>
          <label className="lab-amber" style={{ opacity: 0.95, cursor: 'pointer' }}>
            <Upload size={16} style={{ display: 'inline' }} />
            <input type="file" accept=".txt,.md" className="lab-hidden" onChange={onBatchFile} />
          </label>
        </div>

        <textarea
          value={batchText}
          onChange={(event) => setBatchText(event.target.value)}
          placeholder={
            'One prompt per line / 每行一个提示词\n' +
            'Cinematic robot chef plating ramen / 电影感机器人厨师摆盘拉面\n' +
            'Anime street racer at sunset / 日落时分的街头赛车（动漫风）'
          }
          className="input-field mono-code lab-full"
          style={{ height: 112, resize: 'none', borderRadius: 14, padding: 12, fontSize: 12 }}
        />

        <button
          onClick={importBatchPromptsAsDraft}
          disabled={isImporting || !batchText.trim()}
          className="btn-secondary lab-full"
          style={{ marginTop: 10, borderRadius: 14, padding: '10px 12px', fontSize: 14 }}
        >
          {isImporting ? bi('Importing...', '导入中...') : bi('Import as Draft', '导入为草稿')}
        </button>
      </div>

      <div className="lab-helpbox" style={{ padding: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <span className="label-text">{bi('Prompt Review', '审稿')}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <select
              value={draftPick}
              onChange={(event) => setDraftPick(String(event.target.value || ''))}
              className="input-field"
              style={{ borderRadius: 12, padding: '8px 10px', fontSize: 12, minWidth: 240, maxWidth: 360 }}
            >
              {(draftHistory.length ? draftHistory : [{ file: '' }]).map((item) => (
                <option key={String(item.file || '')} value={String(item.file || '')}>
                  {String(item.file || '')}
                  {item.topic ? ` — ${String(item.topic)}` : ''}
                </option>
              ))}
            </select>
            <button
              className="btn-secondary"
              style={{ borderRadius: 12, padding: '8px 10px', fontSize: 12 }}
              onClick={() => loadDraftFile(draftPick)}
              type="button"
              disabled={isDraftLoading || !draftPick}
            >
              <RefreshCw size={14} style={{ display: 'inline', marginRight: 6 }} />
              {isDraftLoading ? bi('Loading...', '加载中...') : bi('Load Selected', '加载选中')}
            </button>
            <button className="btn-secondary" style={{ borderRadius: 12, padding: '8px 10px', fontSize: 12 }} onClick={fetchDraftHistory} type="button">
              {bi('Refresh List', '刷新列表')}
            </button>
            <button className="btn-secondary" style={{ borderRadius: 12, padding: '8px 10px', fontSize: 12 }} onClick={loadLatestDraft} type="button" disabled={isDraftLoading}>
              {isDraftLoading ? bi('Loading...', '加载中...') : bi('Load Latest', '加载最新')}
            </button>
          </div>
        </div>

        {draft ? (
          <div className="mono-code" style={{ marginTop: 10, fontSize: 12, color: 'var(--lab-text-secondary)' }}>
            {bi('Draft file', '草稿文件')}: {draft.file}
          </div>
        ) : (
          <div className="mono-code lab-muted" style={{ marginTop: 10, fontSize: 12 }}>
            {bi('No draft loaded', '未加载草稿')}
          </div>
        )}

        {draftEdits.length ? (
          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {draftEdits.slice(0, 16).map((prompt, index) => (
              <div key={index} className="input-field" style={{ borderRadius: 14, padding: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <div className="label-text" style={{ textTransform: 'none' }}>
                    {bi('Prompt', '提示词')} #{index + 1}
                  </div>
                  <button
                    type="button"
                    className="btn-secondary"
                    style={{ borderRadius: 12, padding: '8px 10px', fontSize: 12 }}
                    onClick={() => {
                      setDraftEdits((prev) => prev.filter((_, promptIndex) => promptIndex !== index));
                      setFactoryEdits((prev) => prev.filter((_, promptIndex) => promptIndex !== index));
                    }}
                  >
                    <Trash2 size={14} style={{ display: 'inline', marginRight: 6 }} /> {bi('Remove', '删除')}
                  </button>
                </div>

                <textarea
                  value={prompt.prompt}
                  onChange={(event) => {
                    const value = event.target.value;
                    setDraftEdits((prev) => prev.map((item, promptIndex) => (promptIndex === index ? { ...item, prompt: value } : item)));
                    setFactoryEdits((prev) => prev.map((item, promptIndex) => (promptIndex === index ? value : item)));
                  }}
                  className="input-field mono-code lab-full"
                  style={{ marginTop: 10, height: 92, resize: 'vertical', borderRadius: 12, padding: 10, fontSize: 12 }}
                />
              </div>
            ))}

            <div className="mono-code lab-muted" style={{ fontSize: 12 }}>
              {bi(
                'Per-prompt Parameters are disabled. Configure flags in the Factory tab (AR/chaos/style/sref/oref/cref).',
                '已禁用每条参数栏。请在 Factory 页配置 (AR/chaos/style/sref/oref/cref)。'
              )}
            </div>
          </div>
        ) : null}
      </div>
    </>
  );
}
