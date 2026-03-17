import React from 'react';
import { motion } from 'framer-motion';
import { ExternalLink, Layers, LayoutGrid } from 'lucide-react';
import { bi } from '../lib/promptUtils';
import LogTerminal from './LogTerminal';

export default function CuratorPanel({ curatorLogs, curatorStatus, startCurator }) {
  return (
    <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }} className="glass-panel lab-card">
      <div className="lab-card__header">
        <Layers size={20} className="lab-success" />
        <h2 className="heading-sans accent-curator" style={{ flex: 1, fontSize: 18 }}>
          {bi('Curator', '筛选')}
        </h2>
        <span className="label-text lab-muted">{bi('Embedded', '内嵌')}</span>
      </div>

      <div className="lab-card__body">
        <div className="lab-helpbox" style={{ padding: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div className="mono-code lab-muted" style={{ fontSize: 12 }}>
              {bi('Curator runs at', 'Curator 运行在')} <code className="mono-code">http://localhost:3000</code> {bi('and is embedded below.', '并内嵌在下方。')}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button className="btn-secondary" type="button" style={{ borderRadius: 12, padding: '8px 10px', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 8 }} onClick={startCurator}>
                <LayoutGrid size={14} /> {bi('Start/Ensure', '启动/确认')}
              </button>
              <a className="btn-secondary" style={{ borderRadius: 12, padding: '8px 10px', fontSize: 12, textDecoration: 'none' }} href="http://localhost:3000" target="_blank" rel="noreferrer">
                {bi('Open New Tab', '新标签打开')} <ExternalLink size={14} style={{ display: 'inline', marginLeft: 6 }} />
              </a>
            </div>
          </div>

          {curatorStatus ? <div className="mono-code" style={{ marginTop: 10, fontSize: 12, color: 'var(--lab-warning)' }}>{curatorStatus}</div> : null}
        </div>

        <div className="lab-curatorFrame">
          <iframe title="Curator" src="http://localhost:3000" className="lab-curatorFrame__iframe" />
        </div>
      </div>

      <LogTerminal logs={curatorLogs} emptyMessage={bi('Curator logs will appear here...', '筛选器日志会显示在这里...')} />
    </motion.section>
  );
}
