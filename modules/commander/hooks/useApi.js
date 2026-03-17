import { useCallback } from 'react';
import {
  applyParams,
  buildParamPack,
  fileToBase64Data,
  normalizeDraftResponse,
  stripModelFlags,
} from '../lib/promptUtils';

export default function useApi({ architect, draftState, factory, knowledge, setters }) {
  const {
    batchText,
    buildRequirements,
    count,
    detailLevel,
    generationModel,
    topic,
    useKnowledge,
  } = architect;
  const { draft, draftEdits, draftPick, factoryEdits } = draftState;
  const {
    isFactoryRunning,
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
    repeatPerPrompt,
  } = factory;
  const { knowledgeSelected } = knowledge;
  const {
    setActiveTab,
    setArchitectStatus,
    setBatchText,
    setCuratorStatus,
    setDraft,
    setDraftEdits,
    setDraftHistory,
    setDraftPick,
    setFactoryEdits,
    setIsArchRunning,
    setIsDraftLoading,
    setIsImporting,
    setKnowledgeContent,
    setKnowledgeFiles,
    setKnowledgeSelected,
    setKnowledgeStatus,
    setParamCref,
    setParamCrefEnabled,
    setParamOref,
    setParamOrefEnabled,
    setQueuedFile,
    setUploadStatus,
  } = setters;

  const populateDraftState = useCallback(
    (data) => {
      const normalized = normalizeDraftResponse(data);
      setDraft(normalized.draft);
      setDraftEdits(normalized.prompts);
      setFactoryEdits(normalized.prompts.map((item) => String(item.prompt || '')));
      return normalized.draft;
    },
    [setDraft, setDraftEdits, setFactoryEdits]
  );

  const fetchKnowledgeList = useCallback(async () => {
    try {
      const res = await fetch('/api/knowledge/list');
      const data = await res.json();
      setKnowledgeFiles(Array.isArray(data.files) ? data.files : []);
    } catch {
      setKnowledgeFiles([]);
    }
  }, [setKnowledgeFiles]);

  const readKnowledge = useCallback(
    async (name) => {
      setKnowledgeSelected(name);
      setKnowledgeContent('');
      if (!name) return;

      try {
        const res = await fetch(`/api/knowledge/read?name=${encodeURIComponent(name)}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'read failed');
        setKnowledgeContent(String(data.content || ''));
      } catch (error) {
        setKnowledgeContent('');
        setKnowledgeStatus(String(error.message || error));
      }
    },
    [setKnowledgeContent, setKnowledgeSelected, setKnowledgeStatus]
  );

  const upsertKnowledgeFile = useCallback(
    async (file) => {
      if (!file) return;
      const name = String(file.name || '');
      if (!name.endsWith('.md') && !name.endsWith('.txt')) {
        setKnowledgeStatus('Only .md or .txt supported / 仅支持 .md 或 .txt');
        return;
      }

      setKnowledgeStatus('Uploading... / 上传中...');
      try {
        const content = await file.text();
        const res = await fetch('/api/knowledge/upsert', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, content }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'upload failed');
        setKnowledgeStatus(`Uploaded / 已上传: ${data.file}`);
        await fetchKnowledgeList();
        await readKnowledge(data.file);
      } catch (error) {
        setKnowledgeStatus(String(error.message || error));
      }
    },
    [fetchKnowledgeList, readKnowledge, setKnowledgeStatus]
  );

  const deleteKnowledgeFile = useCallback(
    async (name) => {
      if (!name) return;
      setKnowledgeStatus('Deleting... / 删除中...');
      try {
        const res = await fetch('/api/knowledge/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'delete failed');
        setKnowledgeStatus('Deleted / 已删除');
        if (knowledgeSelected === name) {
          setKnowledgeSelected('');
          setKnowledgeContent('');
        }
        await fetchKnowledgeList();
      } catch (error) {
        setKnowledgeStatus(String(error.message || error));
      }
    },
    [fetchKnowledgeList, knowledgeSelected, setKnowledgeContent, setKnowledgeSelected, setKnowledgeStatus]
  );

  const fetchDraftHistory = useCallback(async () => {
    try {
      const res = await fetch('/api/prompts/drafts/list');
      const data = await res.json();
      const files = Array.isArray(data.files) ? data.files : [];
      setDraftHistory(files);
      if (!draftPick && files.length) {
        setDraftPick(String(files[0].file || ''));
      }
    } catch {
      setDraftHistory([]);
    }
  }, [draftPick, setDraftHistory, setDraftPick]);

  const loadDraftFile = useCallback(
    async (file) => {
      const name = String(file || '').trim();
      if (!name) return;
      setIsDraftLoading(true);
      setQueuedFile('');

      try {
        const res = await fetch(`/api/prompts/drafts/read?file=${encodeURIComponent(name)}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to load draft');
        populateDraftState(data);
        setDraftPick(String(data.file || name));
        setArchitectStatus(`Draft loaded / 草稿已加载: ${data.file}`);
      } catch (error) {
        setDraft(null);
        setDraftEdits([]);
        setFactoryEdits([]);
        setArchitectStatus(String(error.message || error));
      } finally {
        setIsDraftLoading(false);
      }
    },
    [populateDraftState, setArchitectStatus, setDraft, setDraftEdits, setDraftPick, setFactoryEdits, setIsDraftLoading, setQueuedFile]
  );

  const loadLatestDraft = useCallback(async () => {
    setIsDraftLoading(true);
    setQueuedFile('');

    try {
      const res = await fetch('/api/prompts/drafts/latest');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No draft');
      populateDraftState(data);
      setDraftPick(String(data.file || ''));
      setArchitectStatus(`Draft loaded / 草稿已加载: ${data.file}`);
    } catch (error) {
      setDraft(null);
      setDraftEdits([]);
      setFactoryEdits([]);
      setArchitectStatus(String(error.message || error));
    } finally {
      setIsDraftLoading(false);
    }
  }, [populateDraftState, setArchitectStatus, setDraft, setDraftEdits, setDraftPick, setFactoryEdits, setIsDraftLoading, setQueuedFile]);

  const igniteArchitect = useCallback(async () => {
    if (!topic.trim()) return;
    setIsArchRunning(true);
    setArchitectStatus('Generating draft... / 生成草稿中...');
    setDraft(null);
    setDraftEdits([]);
    setFactoryEdits([]);
    setQueuedFile('');

    try {
      const res = await fetch('/api/architect/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: topic.trim(),
          count,
          niji: generationModel === 'niji',
          detailLevel,
          useKnowledge,
          requirements: buildRequirements(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Architect start failed');
    } catch (error) {
      setIsArchRunning(false);
      setArchitectStatus(String(error.message || error));
    }
  }, [buildRequirements, count, detailLevel, generationModel, setArchitectStatus, setDraft, setDraftEdits, setFactoryEdits, setIsArchRunning, setQueuedFile, topic, useKnowledge]);

  const importBatchPromptsAsDraft = useCallback(async () => {
    const payload = batchText.trim();
    if (!payload) return;
    setIsImporting(true);
    setArchitectStatus('');
    setQueuedFile('');

    try {
      const res = await fetch('/api/architect/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          promptsText: payload,
          niji: generationModel === 'niji',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Import failed');
      setArchitectStatus(`Imported draft / 已导入草稿: ${data.file}`);
      setBatchText('');
      await loadLatestDraft();
      setActiveTab('factory');
    } catch (error) {
      setArchitectStatus(String(error.message || error));
    } finally {
      setIsImporting(false);
    }
  }, [batchText, generationModel, loadLatestDraft, setActiveTab, setArchitectStatus, setBatchText, setIsImporting, setQueuedFile]);

  const approveDraftToQueue = useCallback(async () => {
    if (!draft || !draft.file) throw new Error('No draft loaded');
    if (!draftEdits.length) throw new Error('No prompts to approve');

    const parameters = applyParams(
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
    const detectedMode = parameters.toLowerCase().includes('--niji') ? 'niji' : 'standard';
    const sourceTexts = factoryEdits.length ? factoryEdits : draftEdits.map((item) => item.prompt);
    const prompts = sourceTexts
      .map((text, index) => ({
        prompt: stripModelFlags(String(text || '').trim()),
        parameters,
        description: String((draftEdits[index] && draftEdits[index].description) || '').trim(),
      }))
      .filter((item) => item.prompt);

    const repeats = Math.max(1, Math.min(8, Number(repeatPerPrompt || 1)));
    const expanded = [];
    for (const prompt of prompts) {
      for (let index = 0; index < repeats; index += 1) expanded.push(prompt);
    }

    const res = await fetch('/api/prompts/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        topic: topic.trim() || draft.topic || 'approved',
        prompts: expanded,
        sourceDraft: draft.file,
        mode: detectedMode,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Approve failed');
    return String(data.file || '');
  }, [
    draft,
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
    repeatPerPrompt,
    topic,
  ]);

  const startFactory = useCallback(async () => {
    const res = await fetch('/api/factory/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'start' }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Factory start failed');
    return data.status;
  }, []);

  const stopFactory = useCallback(async () => {
    const res = await fetch('/api/factory/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'stop' }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Factory stop failed');
    return data.status;
  }, []);

  const startFromPreview = useCallback(async () => {
    setArchitectStatus('Approving... / 审核中...');
    try {
      const file = await approveDraftToQueue();
      setQueuedFile(file);
      setArchitectStatus('Approved / 已通过. Starting Factory... / 启动工厂...');
      if (!isFactoryRunning) {
        await startFactory();
      }
      setArchitectStatus('Factory running / 工厂运行中');
    } catch (error) {
      setArchitectStatus(String(error.message || error));
    }
  }, [approveDraftToQueue, isFactoryRunning, setArchitectStatus, setQueuedFile, startFactory]);

  const uploadToDriveAndFill = useCallback(
    async (file, kind) => {
      if (!file) return;
      setUploadStatus('Uploading to Discord CDN... / 上传到 Discord CDN...');

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 310000);
        const dataBase64 = await fileToBase64Data(file);
        const res = await fetch('/api/refs/upload-discord', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            filename: file.name,
            mimeType: file.type || 'application/octet-stream',
            dataBase64,
            mode: generationModel === 'niji' ? 'niji' : 'standard',
          }),
        });

        clearTimeout(timeout);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'upload failed');

        const url = String(data.url || '');
        if (!url) throw new Error('No url returned');
        if (kind === 'oref') {
          setParamOrefEnabled(true);
          setParamOref(url);
        } else {
          setParamCrefEnabled(true);
          setParamCref(url);
        }

        setUploadStatus(`Uploaded: ${url}`);
      } catch (error) {
        const msg = String(error && error.name === 'AbortError' ? 'Upload timed out / 上传超时' : error.message || error);
        setUploadStatus(msg);
      }
    },
    [generationModel, setParamCref, setParamCrefEnabled, setParamOref, setParamOrefEnabled, setUploadStatus]
  );

  const startCurator = useCallback(async () => {
    setCuratorStatus('Starting curator...');
    try {
      const res = await fetch('/api/curator/start', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'failed');
      setCuratorStatus(`Curator: ${data.status} (${data.url})`);
    } catch (error) {
      setCuratorStatus(String(error.message || error));
    }
  }, [setCuratorStatus]);

  return {
    fetchKnowledgeList,
    readKnowledge,
    upsertKnowledgeFile,
    deleteKnowledgeFile,
    fetchDraftHistory,
    loadDraftFile,
    loadLatestDraft,
    igniteArchitect,
    importBatchPromptsAsDraft,
    approveDraftToQueue,
    startFactory,
    stopFactory,
    startFromPreview,
    uploadToDriveAndFill,
    startCurator,
  };
}
