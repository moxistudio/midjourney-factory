import React from 'react';
import { PRESET_GROUPS, PRESET_ROWS } from '../constants/presets';

function PresetSelect({ group, label, onChange, value }) {
  return (
    <div>
      <div className="label-text" style={{ marginBottom: 8 }}>
        {label}
      </div>
      <select
        value={value}
        onChange={(event) => onChange(String(event.target.value || 'default'))}
        className="input-field lab-full"
        style={{ borderRadius: 12, padding: '10px 12px', fontSize: 13 }}
      >
        {PRESET_GROUPS[group].map((preset) => (
          <option key={preset.id} value={preset.id}>
            {preset.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export default function PresetDropdowns({ allowText, selections, setAllowText, setters }) {
  return (
    <div className="lab-helpbox" style={{ padding: 14 }}>
      <div className="label-text" style={{ marginBottom: 10 }}>
        Art Direction Presets / 画面预设
      </div>

      <div className="mono-code lab-muted" style={{ fontSize: 12, marginBottom: 10 }}>
        Leave each dropdown on <code className="mono-code">Default / 默认</code> to avoid constraining the output. / 每项保持默认即可不限制。
      </div>

      {PRESET_ROWS.map((row, rowIndex) => (
        <div key={row.map((item) => item.group).join('-')} className="lab-grid2" style={rowIndex === 0 ? undefined : { marginTop: 12 }}>
          {row.map((item) => (
            <PresetSelect
              key={item.group}
              group={item.group}
              label={item.label}
              onChange={setters[item.group]}
              value={selections[item.group]}
            />
          ))}
        </div>
      ))}

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12 }}>
        <input type="checkbox" checked={allowText} onChange={(event) => setAllowText(Boolean(event.target.checked))} id="allowText" />
        <label htmlFor="allowText" className="label-text" style={{ textTransform: 'none' }}>
          Allow Text / 允许文字
        </label>
        <span className="mono-code lab-muted" style={{ fontSize: 12 }}>
          (Default: no text / 默认不出文字)
        </span>
      </div>
    </div>
  );
}
