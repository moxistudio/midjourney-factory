import { useEffect } from 'react';
import io from 'socket.io-client';

let socket;

export default function useSocket({
  fetchDraftHistory,
  fetchKnowledgeList,
  loadDraftFile,
  loadLatestDraft,
  setActiveTab,
  setArchLogs,
  setArchitectStatus,
  setCuratorLogs,
  setFactoryLogs,
  setIsArchRunning,
  setIsFactoryRunning,
  setStats,
}) {
  useEffect(() => {
    socket = io();

    socket.on('log:architect', (msg) => {
      setArchLogs((prev) => [...prev.slice(-200), msg]);
    });

    socket.on('status:architect', async (raw) => {
      const payload = typeof raw === 'string' ? { state: raw } : raw || {};
      const status = String(payload.state || '');

      if (status === 'running') {
        setIsArchRunning(true);
        return;
      }

      setIsArchRunning(false);
      if (status === 'succeeded') {
        const file = String(payload.file || '').trim();
        await fetchDraftHistory();
        if (file) {
          await loadDraftFile(file);
        } else {
          await loadLatestDraft();
        }
        setActiveTab('factory');
        return;
      }

      if (status === 'failed') {
        setArchitectStatus(String(payload.message || 'Architect failed / 生成失败'));
      }
    });

    socket.on('log:factory', (msg) => setFactoryLogs((prev) => [...prev.slice(-200), msg]));
    socket.on('log:curator', (msg) => setCuratorLogs((prev) => [...prev.slice(-80), msg]));
    socket.on('status:factory', (status) => setIsFactoryRunning(status === 'running'));

    const poll = async () => {
      const res = await fetch('/api/stats');
      const data = await res.json();
      setStats(data);
    };

    poll();
    fetchKnowledgeList();
    fetchDraftHistory();

    const interval = setInterval(poll, 4000);
    return () => {
      socket.disconnect();
      clearInterval(interval);
    };
  }, [
    fetchDraftHistory,
    fetchKnowledgeList,
    loadDraftFile,
    loadLatestDraft,
    setActiveTab,
    setArchLogs,
    setArchitectStatus,
    setCuratorLogs,
    setFactoryLogs,
    setIsArchRunning,
    setIsFactoryRunning,
    setStats,
  ]);
}
