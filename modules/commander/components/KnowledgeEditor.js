import React from 'react';
import { FileText, RefreshCw, Trash2, Upload } from 'lucide-react';
import { bi } from '../lib/promptUtils';

export default function KnowledgeEditor({
  deleteKnowledgeFile,
  fetchKnowledgeList,
  knowledgeContent,
  knowledgeFiles,
  knowledgeSelected,
  knowledgeStatus,
  readKnowledge,
  setUseKnowledge,
  upsertKnowledgeFile,
  useKnowledge,
}) {
  return (
    <div className="lab-helpbox" style={{ padding: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <span className="label-text">{bi('Knowledge Base', '知识库')}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button className="btn-secondary" style={{ borderRadius: 12, padding: '8px 10px', fontSize: 12 }} onClick={fetchKnowledgeList} type="button">
            <RefreshCw size={14} style={{ display: 'inline', marginRight: 6 }} /> {bi('Refresh', '刷新')}
          </button>
          <label className="lab-amber" style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <Upload size={14} />
            <span className="label-text" style={{ letterSpacing: '0.12em' }}>
              {bi('Add', '添加')}
            </span>
            <input type="file" accept=".md,.txt" className="lab-hidden" onChange={(event) => upsertKnowledgeFile(event.target.files?.[0])} />
          </label>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 12, marginTop: 10 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {knowledgeFiles.length === 0 ? (
            <div className="mono-code lab-muted" style={{ fontSize: 12 }}>
              {bi('No files', '暂无文件')}
            </div>
          ) : (
            knowledgeFiles.slice(0, 18).map((name) => (
              <button
                key={name}
                type="button"
                className="btn-secondary"
                style={{
                  borderRadius: 12,
                  padding: '8px 10px',
                  fontSize: 12,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                  opacity: knowledgeSelected === name ? 1 : 0.88,
                }}
                onClick={() => readKnowledge(name)}
              >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  <FileText size={14} style={{ display: 'inline', marginRight: 8 }} />
                  {name}
                </span>
                <span
                  title={bi('Delete', '删除')}
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    deleteKnowledgeFile(name);
                  }}
                  style={{ opacity: 0.75 }}
                >
                  <Trash2 size={14} />
                </span>
              </button>
            ))
          )}
        </div>

        <div className="input-field" style={{ borderRadius: 14, padding: 12, fontSize: 12, minHeight: 200 }}>
          {knowledgeSelected ? (
            <pre className="mono-code" style={{ whiteSpace: 'pre-wrap', margin: 0, color: 'var(--lab-text-secondary)' }}>
              {knowledgeContent || bi('Loading...', '加载中...')}
            </pre>
          ) : (
            <div className="mono-code lab-muted" style={{ fontSize: 12 }}>
              {bi('Select a file to preview', '选择文件预览')}
            </div>
          )}
        </div>
      </div>

      {knowledgeStatus ? <div className="mono-code" style={{ marginTop: 10, fontSize: 12, color: 'var(--lab-warning)' }}>{knowledgeStatus}</div> : null}

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}>
        <input type="checkbox" checked={useKnowledge} onChange={(event) => setUseKnowledge(Boolean(event.target.checked))} id="useKnowledge" />
        <label htmlFor="useKnowledge" className="label-text" style={{ textTransform: 'none' }}>
          {bi('Use knowledge base in generation', '生成时使用知识库')}
        </label>
      </div>
    </div>
  );
}
