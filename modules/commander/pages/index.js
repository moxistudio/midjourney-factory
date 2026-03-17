import React, { useCallback, useEffect, useState } from 'react';
import Head from 'next/head';
import { motion } from 'framer-motion';
import { Layers, Settings2, Sparkles, Terminal, Zap } from 'lucide-react';
import ArchitectPanel from '../components/ArchitectPanel';
import CuratorPanel from '../components/CuratorPanel';
import FactoryPanel from '../components/FactoryPanel';
import SettingsPanel from '../components/SettingsPanel';
import useApi from '../hooks/useApi';
import useSocket from '../hooks/useSocket';
import { bi, buildRequirements as buildRequirementsText, getModeLabel } from '../lib/promptUtils';

const TABS = [
  { id: 'architect', label: 'Architect / 架构', Icon: Zap },
  { id: 'factory', label: 'Factory / 工厂', Icon: Terminal },
  { id: 'curator', label: 'Curator / 筛选', Icon: Layers },
  { id: 'settings', label: 'Settings / 设置', Icon: Settings2 },
];

const TAB_META = {
  architect: bi('Topic + Knowledge + Draft + Review', '主题+知识库+草稿+审稿'),
  factory: bi('Params + Preview + Start', '参数+预览+开始'),
  curator: bi('Embedded curator', '内嵌筛选器'),
  settings: bi('LLM + Discord + Local runtime config', 'LLM + Discord + 本地运行配置'),
};

export default function Commander() {
  const [activeTab, setActiveTab] = useState('architect');
  const [topic, setTopic] = useState(''), [useKnowledge, setUseKnowledge] = useState(true), [allowText, setAllowText] = useState(false);
  const [shotPreset, setShotPreset] = useState('default'), [lensPreset, setLensPreset] = useState('default'), [compositionPreset, setCompositionPreset] = useState('default');
  const [lightingPreset, setLightingPreset] = useState('default'), [colorPreset, setColorPreset] = useState('default'), [texturePreset, setTexturePreset] = useState('default'), [atmosPreset, setAtmosPreset] = useState('default');
  const [mediumPreset, setMediumPreset] = useState('default'), [illustrationPreset, setIllustrationPreset] = useState('default'), [designPreset, setDesignPreset] = useState('default');
  const [generationModel, setGenerationModel] = useState('mj'), [mjVersion, setMjVersion] = useState('7'), [nijiVersion, setNijiVersion] = useState('7'), [count, setCount] = useState(20), [detailLevel, setDetailLevel] = useState(4);
  const [repeatPerPrompt, setRepeatPerPrompt] = useState(1), [paramAR, setParamAR] = useState(''), [paramChaosEnabled, setParamChaosEnabled] = useState(false), [paramChaos, setParamChaos] = useState(15);
  const [paramStyleEnabled, setParamStyleEnabled] = useState(false), [paramStyle, setParamStyle] = useState('raw'), [paramSrefEnabled, setParamSrefEnabled] = useState(false), [paramSref, setParamSref] = useState('');
  const [paramOrefEnabled, setParamOrefEnabled] = useState(false), [paramOref, setParamOref] = useState(''), [paramCrefEnabled, setParamCrefEnabled] = useState(false), [paramCref, setParamCref] = useState('');
  const [uploadStatus, setUploadStatus] = useState(''), [archLogs, setArchLogs] = useState([]), [factoryLogs, setFactoryLogs] = useState([]), [curatorLogs, setCuratorLogs] = useState([]);
  const [isArchRunning, setIsArchRunning] = useState(false), [isFactoryRunning, setIsFactoryRunning] = useState(false), [isImporting, setIsImporting] = useState(false), [stats, setStats] = useState({ incoming: 0, best: 0 });
  const [batchText, setBatchText] = useState(''), [architectStatus, setArchitectStatus] = useState(''), [draft, setDraft] = useState(null), [draftEdits, setDraftEdits] = useState([]), [factoryEdits, setFactoryEdits] = useState([]);
  const [queuedFile, setQueuedFile] = useState(''), [isDraftLoading, setIsDraftLoading] = useState(false), [draftHistory, setDraftHistory] = useState([]), [draftPick, setDraftPick] = useState('');
  const [knowledgeFiles, setKnowledgeFiles] = useState([]), [knowledgeSelected, setKnowledgeSelected] = useState(''), [knowledgeContent, setKnowledgeContent] = useState(''), [knowledgeStatus, setKnowledgeStatus] = useState(''), [curatorStatus, setCuratorStatus] = useState('');

  const isNiji = generationModel === 'niji';
  useEffect(() => { if (isNiji) setParamStyleEnabled(false); }, [isNiji]);

  const buildRequirements = useCallback(() => buildRequirementsText({
    selections: [
      { group: 'medium', value: mediumPreset }, { group: 'design', value: designPreset }, { group: 'illustration', value: illustrationPreset },
      { group: 'shot', value: shotPreset }, { group: 'lens', value: lensPreset }, { group: 'composition', value: compositionPreset },
      { group: 'lighting', value: lightingPreset }, { group: 'color', value: colorPreset }, { group: 'texture', value: texturePreset }, { group: 'atmos', value: atmosPreset },
    ],
    detailLevel,
    allowText,
  }), [allowText, atmosPreset, colorPreset, compositionPreset, designPreset, detailLevel, illustrationPreset, lensPreset, lightingPreset, mediumPreset, shotPreset, texturePreset]);

  const api = useApi({
    architect: { batchText, buildRequirements, count, detailLevel, generationModel, topic, useKnowledge },
    draftState: { draft, draftEdits, draftPick, factoryEdits },
    factory: { generationModel, isFactoryRunning, mjVersion, nijiVersion, paramAR, paramChaos, paramChaosEnabled, paramCref, paramCrefEnabled, paramOref, paramOrefEnabled, paramSref, paramSrefEnabled, paramStyle, paramStyleEnabled, repeatPerPrompt },
    knowledge: { knowledgeSelected },
    setters: { setActiveTab, setArchitectStatus, setBatchText, setCuratorStatus, setDraft, setDraftEdits, setDraftHistory, setDraftPick, setFactoryEdits, setIsArchRunning, setIsDraftLoading, setIsImporting, setKnowledgeContent, setKnowledgeFiles, setKnowledgeSelected, setKnowledgeStatus, setParamCref, setParamCrefEnabled, setParamOref, setParamOrefEnabled, setQueuedFile, setUploadStatus },
  });

  useSocket({
    fetchDraftHistory: api.fetchDraftHistory,
    fetchKnowledgeList: api.fetchKnowledgeList,
    loadDraftFile: api.loadDraftFile,
    loadLatestDraft: api.loadLatestDraft,
    setActiveTab,
    setArchLogs,
    setArchitectStatus,
    setCuratorLogs,
    setFactoryLogs,
    setIsArchRunning,
    setIsFactoryRunning,
    setStats,
  });

  const resetFactoryEditsFromDraft = useCallback(() => setFactoryEdits(draftEdits.map((item) => String((item && item.prompt) || ''))), [draftEdits]);
  const applyFactoryEditsToDraft = useCallback(() => {
    setDraftEdits((prev) => prev.map((item, index) => ({ ...item, prompt: typeof factoryEdits[index] === 'string' ? factoryEdits[index] : item.prompt })));
    setArchitectStatus(bi('Preview updated', '预览已更新'));
  }, [factoryEdits]);

  const modeLabel = getModeLabel(generationModel, mjVersion, nijiVersion);
  const presetSelections = { atmos: atmosPreset, color: colorPreset, composition: compositionPreset, design: designPreset, illustration: illustrationPreset, lens: lensPreset, lighting: lightingPreset, medium: mediumPreset, shot: shotPreset, texture: texturePreset };
  const presetSetters = { atmos: setAtmosPreset, color: setColorPreset, composition: setCompositionPreset, design: setDesignPreset, illustration: setIllustrationPreset, lens: setLensPreset, lighting: setLightingPreset, medium: setMediumPreset, shot: setShotPreset, texture: setTexturePreset };

  return (
    <div className="app-container lab-shell">
      <Head><title>Midjourney Factory — AI Image Generation Laboratory / AI 图像生成实验室</title></Head>
      <div className="lab-max">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: [0.34, 1.56, 0.64, 1] }} className="lab-top">
          <div>
            <div className="lab-brandline"><div className="icon-badge"><Sparkles size={18} /></div><span className="label-text">Generation Laboratory / 生成实验室</span></div>
            <h1 className="heading-serif lab-title">Midjourney Factory<span className="lab-mode">{modeLabel}</span></h1>
          </div>
          <div className="lab-stats">
            <motion.div whileHover={{ scale: 1.05 }} className="stat-badge lab-stat"><div className="stat-value">{stats.incoming}</div><div className="label-text" style={{ marginTop: 6 }}>Processing / 处理中</div></motion.div>
            <motion.div whileHover={{ scale: 1.05 }} className="stat-badge lab-stat"><div className="stat-value">{stats.best}</div><div className="label-text" style={{ marginTop: 6 }}>Selected / 已精选</div></motion.div>
          </div>
        </motion.div>

        <div className="lab-tabswrap">
          <div className="lab-tabs">
            {TABS.map(({ Icon, id, label }) => {
              const active = activeTab === id;
              return (
                <button key={id} type="button" className={`lab-tab ${active ? 'lab-tab--active' : ''}`} onClick={() => setActiveTab(id)}>
                  <Icon size={16} style={{ opacity: active ? 1 : 0.9 }} />
                  <span>{label}</span>
                </button>
              );
            })}
          </div>
          <div className="lab-tabmeta"><div className="mono-code lab-muted" style={{ fontSize: 12 }}>{TAB_META[activeTab]}</div></div>
        </div>

        <div className="lab-tabpanel">
          {activeTab === 'architect' ? <ArchitectPanel allowText={allowText} archLogs={archLogs} architectStatus={architectStatus} count={count} detailLevel={detailLevel} draftReviewProps={{ batchText, draft, draftEdits, draftHistory, draftPick, fetchDraftHistory: api.fetchDraftHistory, importBatchPromptsAsDraft: api.importBatchPromptsAsDraft, isDraftLoading, isImporting, loadDraftFile: api.loadDraftFile, loadLatestDraft: api.loadLatestDraft, setBatchText, setDraftEdits, setDraftPick, setFactoryEdits }} generationModel={generationModel} igniteArchitect={api.igniteArchitect} isArchRunning={isArchRunning} mediumSelections={presetSelections} mjVersion={mjVersion} nijiVersion={nijiVersion} presetSetters={presetSetters} setAllowText={setAllowText} setCount={setCount} setDetailLevel={setDetailLevel} setGenerationModel={setGenerationModel} setMjVersion={setMjVersion} setNijiVersion={setNijiVersion} setTopic={setTopic} topic={topic} useKnowledgeProps={{ deleteKnowledgeFile: api.deleteKnowledgeFile, fetchKnowledgeList: api.fetchKnowledgeList, knowledgeContent, knowledgeFiles, knowledgeSelected, knowledgeStatus, readKnowledge: api.readKnowledge, setUseKnowledge, upsertKnowledgeFile: api.upsertKnowledgeFile, useKnowledge }} /> : null}
          {activeTab === 'factory' ? <FactoryPanel applyFactoryEditsToDraft={applyFactoryEditsToDraft} draftEdits={draftEdits} factoryEdits={factoryEdits} factoryLogs={factoryLogs} generationModel={generationModel} isDraftLoading={isDraftLoading} isFactoryRunning={isFactoryRunning} isNiji={isNiji} loadLatestDraft={api.loadLatestDraft} mjVersion={mjVersion} nijiVersion={nijiVersion} paramAR={paramAR} paramChaos={paramChaos} paramChaosEnabled={paramChaosEnabled} paramCref={paramCref} paramCrefEnabled={paramCrefEnabled} paramOref={paramOref} paramOrefEnabled={paramOrefEnabled} paramSref={paramSref} paramSrefEnabled={paramSrefEnabled} paramStyle={paramStyle} paramStyleEnabled={paramStyleEnabled} queuedFile={queuedFile} repeatPerPrompt={repeatPerPrompt} resetFactoryEditsFromDraft={resetFactoryEditsFromDraft} setFactoryEdits={setFactoryEdits} setGenerationModel={setGenerationModel} setMjVersion={setMjVersion} setNijiVersion={setNijiVersion} setParamAR={setParamAR} setParamChaos={setParamChaos} setParamChaosEnabled={setParamChaosEnabled} setParamCref={setParamCref} setParamCrefEnabled={setParamCrefEnabled} setParamOref={setParamOref} setParamOrefEnabled={setParamOrefEnabled} setParamSref={setParamSref} setParamSrefEnabled={setParamSrefEnabled} setParamStyle={setParamStyle} setParamStyleEnabled={setParamStyleEnabled} setRepeatPerPrompt={setRepeatPerPrompt} startFactory={api.startFactory} startFromPreview={api.startFromPreview} stopFactory={api.stopFactory} uploadStatus={uploadStatus} uploadToDriveAndFill={api.uploadToDriveAndFill} /> : null}
          {activeTab === 'curator' ? <CuratorPanel curatorLogs={curatorLogs} curatorStatus={curatorStatus} startCurator={api.startCurator} /> : null}
          {activeTab === 'settings' ? <SettingsPanel /> : null}
        </div>
      </div>
    </div>
  );
}
