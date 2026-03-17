import React from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, Flame, Zap } from 'lucide-react';
import { MJ_VERSIONS, NIJI_VERSIONS } from '../constants/presets';
import { bi } from '../lib/promptUtils';
import DraftReview from './DraftReview';
import KnowledgeEditor from './KnowledgeEditor';
import LogTerminal from './LogTerminal';
import PresetDropdowns from './PresetDropdowns';

export default function ArchitectPanel({
  allowText,
  archLogs,
  architectStatus,
  count,
  detailLevel,
  draftReviewProps,
  generationModel,
  igniteArchitect,
  isArchRunning,
  mediumSelections,
  mjVersion,
  nijiVersion,
  presetSetters,
  setAllowText,
  setCount,
  setDetailLevel,
  setGenerationModel,
  setMjVersion,
  setNijiVersion,
  setTopic,
  topic,
  useKnowledgeProps,
}) {
  return (
    <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }} className="glass-panel lab-card">
      <div className="lab-card__header">
        <Zap size={20} className="lab-amber" />
        <h2 className="heading-sans accent-architect" style={{ flex: 1, fontSize: 18 }}>
          {bi('Architect', '架构')}
        </h2>
        <span className={`label-text ${isArchRunning ? 'animate-pulse lab-peach' : 'lab-muted'}`}>
          {isArchRunning ? bi('Running', '运行中') : bi('Ready', '就绪')}
        </span>
      </div>

      <div className="lab-card__body">
        <div>
          <label className="label-text" style={{ display: 'block', marginBottom: 8 }}>
            Topic / 主题
          </label>
          <input
            value={topic}
            onChange={(event) => setTopic(event.target.value)}
            placeholder="Describe your creative vision... / 描述你的创意主题..."
            className="input-field lab-full"
            style={{ borderRadius: 12, padding: '12px 14px', fontSize: 14 }}
          />
        </div>

        <PresetDropdowns allowText={allowText} selections={mediumSelections} setAllowText={setAllowText} setters={presetSetters} />

        <div className="lab-helpbox" style={{ padding: 14 }}>
          <div className="label-text" style={{ marginBottom: 10 }}>
            {bi('Model & Generation', '模型与生成')}
          </div>

          <div className="lab-grid2">
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
                {bi('Niji needs a separate DM; set', 'Niji 需要单独私聊; 请设置')} <code className="mono-code">midjourney.niji_channel_id</code>.
              </div>
            </div>
          </div>

          <div className="lab-grid2" style={{ marginTop: 14 }}>
            <div>
              <label className="label-text" style={{ display: 'block', marginBottom: 8 }}>
                {bi('Prompt Count', '提示词数量')}: {count}
              </label>
              <input type="range" min="5" max="80" step="5" value={count} onChange={(event) => setCount(Number(event.target.value))} className="lab-full" />
            </div>
            <div>
              <label className="label-text" style={{ display: 'block', marginBottom: 8 }}>
                {bi('Detail', '复杂度')}: {detailLevel}/5
              </label>
              <input type="range" min="1" max="5" step="1" value={detailLevel} onChange={(event) => setDetailLevel(Number(event.target.value))} className="lab-full" />
            </div>
          </div>

          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            onClick={igniteArchitect}
            disabled={isArchRunning || !topic.trim()}
            className="btn-primary lab-full"
            style={{ marginTop: 14, borderRadius: 14, padding: '12px 14px', fontSize: 14 }}
          >
            <Flame size={16} style={{ marginRight: 8, display: 'inline' }} />
            {isArchRunning ? bi('Generating...', '生成中...') : bi('Generate Draft Prompts', '生成草稿提示词')}
          </motion.button>

          {architectStatus ? (
            <div className="mono-code" style={{ marginTop: 10, fontSize: 12, color: 'var(--lab-text-secondary)' }}>
              <CheckCircle2 size={14} style={{ display: 'inline', marginRight: 8 }} />
              {architectStatus}
            </div>
          ) : null}
        </div>

        <KnowledgeEditor {...useKnowledgeProps} />
        <DraftReview {...draftReviewProps} />
      </div>

      <LogTerminal logs={archLogs} emptyMessage={bi('Architect logs will appear here...', '架构日志会显示在这里...')} />
    </motion.section>
  );
}
