import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { KeyRound, Link2, LogIn, RefreshCw, Save, Settings2 } from 'lucide-react';
import { bi } from '../lib/promptUtils';

const EMPTY_STATE = {
  runtime: {
    dataRoot: '',
    configPath: '',
    envPath: '',
    isDesktop: false,
    pythonAvailable: false,
    pythonVersion: '',
    playwrightCliPath: '',
  },
  env: {
    LLM_PRIMARY_API_KEY: '',
    LLM_PRIMARY_BASE_URL: '',
    LLM_FALLBACK_API_KEY: '',
    LLM_FALLBACK_BASE_URL: '',
    DISCORD_TOKEN: '',
    MJ_CHANNEL_ID: '',
    NIJI_CHANNEL_ID: '',
  },
  settings: {
    llm: {
      primary: { provider: 'openai', model: 'qwen3.5-plus', temperature: 0.7 },
      fallback: { provider: 'openai', model: '', temperature: 0.7 },
    },
    factory: {
      browser_path: '',
      discord_navigation_timeout_ms: 180000,
    },
  },
};

function Field({ label, type = 'text', value, onChange, placeholder = '' }) {
  return (
    <div>
      <label className="label-text" style={{ display: 'block', marginBottom: 8 }}>
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="input-field lab-full"
        style={{ borderRadius: 12, padding: '10px 12px', fontSize: 13 }}
      />
    </div>
  );
}

export default function SettingsPanel() {
  const [form, setForm] = useState(EMPTY_STATE);
  const [status, setStatus] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const updateEnv = (key, value) => {
    setForm((prev) => ({ ...prev, env: { ...prev.env, [key]: value } }));
  };

  const updateSetting = (group, key, value) => {
    setForm((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        [group]: {
          ...prev.settings[group],
          [key]: value,
        },
      },
    }));
  };

  const updateNestedSetting = (group, nested, key, value) => {
    setForm((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        [group]: {
          ...prev.settings[group],
          [nested]: {
            ...prev.settings[group][nested],
            [key]: value,
          },
        },
      },
    }));
  };

  const loadSettings = async () => {
    setIsLoading(true);
    setStatus('');
    try {
      const res = await fetch('/api/settings');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load settings');
      setForm({
        runtime: { ...EMPTY_STATE.runtime, ...(data.runtime || {}) },
        env: { ...EMPTY_STATE.env, ...(data.env || {}) },
        settings: {
          llm: {
            primary: { ...EMPTY_STATE.settings.llm.primary, ...((data.settings && data.settings.llm && data.settings.llm.primary) || {}) },
            fallback: { ...EMPTY_STATE.settings.llm.fallback, ...((data.settings && data.settings.llm && data.settings.llm.fallback) || {}) },
          },
          factory: { ...EMPTY_STATE.settings.factory, ...((data.settings && data.settings.factory) || {}) },
        },
      });
    } catch (error) {
      setStatus(String(error.message || error));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const saveSettings = async () => {
    setIsSaving(true);
    setStatus('');
    try {
      const payload = {
        env: form.env,
        settings: {
          llm: {
            primary: {
              provider: form.settings.llm.primary.provider,
              model: form.settings.llm.primary.model,
              temperature: Number(form.settings.llm.primary.temperature || 0.7),
            },
            fallback: {
              provider: form.settings.llm.fallback.provider,
              model: form.settings.llm.fallback.model,
              temperature: Number(form.settings.llm.fallback.temperature || 0.7),
            },
          },
          factory: {
            browser_path: form.settings.factory.browser_path,
            discord_navigation_timeout_ms: Number(form.settings.factory.discord_navigation_timeout_ms || 180000),
          },
        },
      };

      const res = await fetch('/api/settings/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save settings');
      setStatus(bi('Saved locally. New runs will use the updated settings.', '已保存到本地，新任务会使用更新后的设置。'));
      setForm({
        runtime: { ...EMPTY_STATE.runtime, ...(data.runtime || {}) },
        env: { ...EMPTY_STATE.env, ...(data.env || {}) },
        settings: {
          llm: {
            primary: { ...EMPTY_STATE.settings.llm.primary, ...((data.settings && data.settings.llm && data.settings.llm.primary) || {}) },
            fallback: { ...EMPTY_STATE.settings.llm.fallback, ...((data.settings && data.settings.llm && data.settings.llm.fallback) || {}) },
          },
          factory: { ...EMPTY_STATE.settings.factory, ...((data.settings && data.settings.factory) || {}) },
        },
      });
    } catch (error) {
      setStatus(String(error.message || error));
    } finally {
      setIsSaving(false);
    }
  };

  const openDiscordLogin = async (profile) => {
    setStatus('');
    try {
      const res = await fetch('/api/settings/discord-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to open login');
      setStatus(bi(`Opened Discord login window (${data.profile}).`, `已打开 Discord 登录窗口 (${data.profile})。`));
    } catch (error) {
      setStatus(String(error.message || error));
    }
  };

  const installPlaywright = async () => {
    setStatus('');
    try {
      const res = await fetch('/api/settings/install-playwright', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to install Playwright Chromium');
      setStatus(bi('Playwright Chromium installed.', 'Playwright Chromium 已安装。'));
      await loadSettings();
    } catch (error) {
      setStatus(String(error.message || error));
    }
  };

  return (
    <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }} className="glass-panel lab-card">
      <div className="lab-card__header">
        <Settings2 size={20} className="lab-sky" />
        <h2 className="heading-sans" style={{ flex: 1, fontSize: 18 }}>
          {bi('Settings', '设置')}
        </h2>
        <span className="label-text lab-muted">{form.runtime.isDesktop ? bi('Desktop', '桌面版') : bi('Local', '本地')}</span>
      </div>

      <div className="lab-card__body">
        <div className="lab-helpbox" style={{ padding: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
            <div className="mono-code lab-muted" style={{ fontSize: 12 }}>
              {bi('Configure local runtime credentials and models for this app instance.', '为当前应用实例配置本地凭证和模型。')}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn-secondary" type="button" style={{ borderRadius: 12, padding: '8px 10px', fontSize: 12 }} onClick={loadSettings} disabled={isLoading || isSaving}>
                <RefreshCw size={14} style={{ display: 'inline', marginRight: 6 }} /> {bi('Reload', '重载')}
              </button>
              <button className="btn-primary" type="button" style={{ borderRadius: 12, padding: '8px 12px', fontSize: 12 }} onClick={saveSettings} disabled={isLoading || isSaving}>
                <Save size={14} style={{ display: 'inline', marginRight: 6 }} /> {isSaving ? bi('Saving...', '保存中...') : bi('Save', '保存')}
              </button>
            </div>
          </div>

          <div className="lab-grid2" style={{ marginBottom: 14 }}>
            <div className="input-field" style={{ borderRadius: 14, padding: 12, fontSize: 12 }}>
              <div className="label-text" style={{ marginBottom: 6 }}>{bi('Data Root', '数据目录')}</div>
              <div className="mono-code" style={{ wordBreak: 'break-all', color: 'var(--lab-text-secondary)' }}>{form.runtime.dataRoot || '...'}</div>
            </div>
            <div className="input-field" style={{ borderRadius: 14, padding: 12, fontSize: 12 }}>
              <div className="label-text" style={{ marginBottom: 6 }}>{bi('Config Files', '配置文件')}</div>
              <div className="mono-code" style={{ wordBreak: 'break-all', color: 'var(--lab-text-secondary)' }}>{form.runtime.envPath || '...'}</div>
              <div className="mono-code" style={{ marginTop: 6, wordBreak: 'break-all', color: 'var(--lab-text-secondary)' }}>{form.runtime.configPath || '...'}</div>
            </div>
          </div>

          <div className="lab-grid2" style={{ marginBottom: 14 }}>
            <div className="input-field" style={{ borderRadius: 14, padding: 12, fontSize: 12 }}>
              <div className="label-text" style={{ marginBottom: 6 }}>{bi('Python 3', 'Python 3')}</div>
              <div className="mono-code" style={{ color: form.runtime.pythonAvailable ? 'var(--lab-success)' : 'var(--lab-error)' }}>
                {form.runtime.pythonAvailable ? (form.runtime.pythonVersion || 'python3 detected') : bi('python3 not found on this Mac', '这台 Mac 未检测到 python3')}
              </div>
            </div>
            <div className="input-field" style={{ borderRadius: 14, padding: 12, fontSize: 12 }}>
              <div className="label-text" style={{ marginBottom: 6 }}>{bi('Playwright Runtime', 'Playwright 运行时')}</div>
              <div className="mono-code" style={{ wordBreak: 'break-all', color: 'var(--lab-text-secondary)' }}>{form.runtime.playwrightCliPath || '...'}</div>
              <button className="btn-secondary" type="button" style={{ borderRadius: 12, padding: '8px 10px', fontSize: 12, marginTop: 10 }} onClick={installPlaywright}>
                {bi('Install Chromium', '安装 Chromium')}
              </button>
            </div>
          </div>

          <div className="label-text" style={{ marginBottom: 10 }}>
            <KeyRound size={14} style={{ display: 'inline', marginRight: 6 }} />
            {bi('LLM Credentials (.env)', '.env 中的 LLM 凭证')}
          </div>
          <div className="lab-grid2" style={{ marginBottom: 14 }}>
            <Field label={bi('Primary API Key', '主 API Key')} type="password" value={form.env.LLM_PRIMARY_API_KEY} onChange={(event) => updateEnv('LLM_PRIMARY_API_KEY', event.target.value)} />
            <Field label={bi('Primary Base URL', '主 Base URL')} value={form.env.LLM_PRIMARY_BASE_URL} onChange={(event) => updateEnv('LLM_PRIMARY_BASE_URL', event.target.value)} placeholder="https://api.openai.com/v1" />
            <Field label={bi('Fallback API Key', '备用 API Key')} type="password" value={form.env.LLM_FALLBACK_API_KEY} onChange={(event) => updateEnv('LLM_FALLBACK_API_KEY', event.target.value)} />
            <Field label={bi('Fallback Base URL', '备用 Base URL')} value={form.env.LLM_FALLBACK_BASE_URL} onChange={(event) => updateEnv('LLM_FALLBACK_BASE_URL', event.target.value)} placeholder="https://..." />
          </div>

          <div className="label-text" style={{ marginBottom: 10 }}>
            <Link2 size={14} style={{ display: 'inline', marginRight: 6 }} />
            {bi('LLM Profiles (settings.yaml)', 'settings.yaml 中的模型配置')}
          </div>
          <div className="lab-grid2" style={{ marginBottom: 14 }}>
            <Field label={bi('Primary Provider', '主 Provider')} value={form.settings.llm.primary.provider} onChange={(event) => updateNestedSetting('llm', 'primary', 'provider', event.target.value)} placeholder="openai" />
            <Field label={bi('Primary Model', '主模型')} value={form.settings.llm.primary.model} onChange={(event) => updateNestedSetting('llm', 'primary', 'model', event.target.value)} placeholder="qwen3.5-plus" />
            <Field label={bi('Primary Temperature', '主 Temperature')} value={String(form.settings.llm.primary.temperature)} onChange={(event) => updateNestedSetting('llm', 'primary', 'temperature', event.target.value)} />
            <div />
            <Field label={bi('Fallback Provider', '备用 Provider')} value={form.settings.llm.fallback.provider} onChange={(event) => updateNestedSetting('llm', 'fallback', 'provider', event.target.value)} placeholder="openai" />
            <Field label={bi('Fallback Model', '备用模型')} value={form.settings.llm.fallback.model} onChange={(event) => updateNestedSetting('llm', 'fallback', 'model', event.target.value)} placeholder="claude-sonnet-4-5" />
            <Field label={bi('Fallback Temperature', '备用 Temperature')} value={String(form.settings.llm.fallback.temperature)} onChange={(event) => updateNestedSetting('llm', 'fallback', 'temperature', event.target.value)} />
            <div />
          </div>

          <div className="label-text" style={{ marginBottom: 10 }}>
            {bi('Discord & Factory', 'Discord 与工厂')}
          </div>
          <div className="lab-grid2" style={{ marginBottom: 14 }}>
            <Field label={bi('Discord Token', 'Discord Token')} type="password" value={form.env.DISCORD_TOKEN} onChange={(event) => updateEnv('DISCORD_TOKEN', event.target.value)} />
            <Field label={bi('MJ Channel ID', 'MJ 频道 ID')} value={form.env.MJ_CHANNEL_ID} onChange={(event) => updateEnv('MJ_CHANNEL_ID', event.target.value)} />
            <Field label={bi('Niji Channel ID', 'Niji 频道 ID')} value={form.env.NIJI_CHANNEL_ID} onChange={(event) => updateEnv('NIJI_CHANNEL_ID', event.target.value)} />
            <Field label={bi('Browser Path (optional)', '浏览器路径，可选')} value={form.settings.factory.browser_path} onChange={(event) => updateSetting('factory', 'browser_path', event.target.value)} placeholder="/Applications/Google Chrome.app/..." />
            <Field label={bi('Navigation Timeout (ms)', '导航超时毫秒')} value={String(form.settings.factory.discord_navigation_timeout_ms)} onChange={(event) => updateSetting('factory', 'discord_navigation_timeout_ms', event.target.value)} />
            <div style={{ display: 'flex', alignItems: 'end', gap: 10 }}>
              <button className="btn-secondary" type="button" style={{ borderRadius: 12, padding: '10px 12px', fontSize: 12, flex: 1 }} onClick={() => openDiscordLogin('factory')}>
                <LogIn size={14} style={{ display: 'inline', marginRight: 6 }} /> {bi('Login Factory', '登录 Factory')}
              </button>
              <button className="btn-secondary" type="button" style={{ borderRadius: 12, padding: '10px 12px', fontSize: 12, flex: 1 }} onClick={() => openDiscordLogin('uploader')}>
                <LogIn size={14} style={{ display: 'inline', marginRight: 6 }} /> {bi('Login Uploader', '登录 Uploader')}
              </button>
            </div>
          </div>

          {status ? (
            <div className="mono-code" style={{ fontSize: 12, color: 'var(--lab-warning)' }}>
              {status}
            </div>
          ) : null}
        </div>
      </div>
    </motion.section>
  );
}
