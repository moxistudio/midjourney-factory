import { PRESET_GROUPS } from '../constants/presets';

export const bi = (en, cn) => `${en} / ${cn}`;

export function stripFlag(text, flag) {
  const re = new RegExp(`\\s*--${flag}\\s+[^\\s]+`, 'gi');
  return String(text || '').replace(re, ' ');
}

export function stripModelFlags(text) {
  let out = ` ${String(text || '')} `;
  out = stripFlag(out, 'v');
  out = stripFlag(out, 'niji');
  return out.replace(/\s+/g, ' ').trim();
}

export function applyParams(base, params) {
  let out = ` ${String(base || '')} `;

  out = stripFlag(out, 'v');
  out = stripFlag(out, 'niji');

  if (params.model === 'niji') {
    out = stripFlag(out, 'style');
  }

  if (params.model === 'niji') {
    out += ` --niji ${params.nijiVersion}`;
  } else {
    out += ` --v ${params.mjVersion}`;
  }

  if (params.ar) {
    out = stripFlag(out, 'ar');
    out += ` --ar ${params.ar}`;
  }

  if (params.chaosEnabled) {
    out = stripFlag(out, 'chaos');
    out += ` --chaos ${params.chaos}`;
  }

  if (params.styleEnabled && params.model !== 'niji') {
    out = stripFlag(out, 'style');
    out += ` --style ${params.style}`;
  }

  if (params.srefEnabled && String(params.sref || '').trim()) {
    out = stripFlag(out, 'sref');
    out += ` --sref ${String(params.sref).trim()}`;
  }

  if (params.orefEnabled && String(params.oref || '').trim()) {
    out = stripFlag(out, 'oref');
    out += ` --oref ${String(params.oref).trim()}`;
  }

  if (params.crefEnabled && String(params.cref || '').trim()) {
    out = stripFlag(out, 'cref');
    out += ` --cref ${String(params.cref).trim()}`;
  }

  return out.replace(/\s+/g, ' ').trim();
}

export async function fileToBase64Data(file) {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.onload = () => {
      const result = String(reader.result || '');
      const comma = result.indexOf(',');
      if (comma === -1) return reject(new Error('Unexpected file data'));
      resolve(result.slice(comma + 1));
    };
    reader.readAsDataURL(file);
  });
}

export function pickPresetText(group, id, groups = PRESET_GROUPS) {
  const items = groups[group] || [];
  const found = items.find((item) => item.id === id);
  return found ? String(found.text || '').trim() : '';
}

export function buildRequirements({ selections, detailLevel, allowText, presetGroups = PRESET_GROUPS }) {
  const lines = [];
  const selected = selections.map(({ group, value }) => pickPresetText(group, value, presetGroups)).filter(Boolean);

  if (selected.length) {
    lines.push('Art direction presets (apply if compatible with the topic):');
    lines.push(...selected.map((text) => `- ${text}`));
  }

  lines.push(`Detail level: ${detailLevel}/5. Higher = more layered, art-directed prompts.`);
  if (!allowText) {
    lines.push('Output constraints: no text, no logos, no watermarks, avoid clutter.');
  } else {
    lines.push('Output constraints: avoid logos/watermarks. If typography is used, keep it minimal and legible.');
  }
  lines.push('Safety: avoid violence/gore/explicit content.');
  return lines.join('\n');
}

export function buildParamPack({
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
}) {
  return {
    model: generationModel,
    mjVersion,
    nijiVersion,
    ar: paramAR,
    chaosEnabled: paramChaosEnabled,
    chaos: paramChaos,
    styleEnabled: paramStyleEnabled,
    style: paramStyle,
    srefEnabled: paramSrefEnabled,
    sref: paramSref,
    orefEnabled: paramOrefEnabled,
    oref: paramOref,
    crefEnabled: paramCrefEnabled,
    cref: paramCref,
  };
}

export function getModeLabel(generationModel, mjVersion, nijiVersion) {
  if (generationModel === 'niji') return `Niji ${nijiVersion}`;
  return `Midjourney V${mjVersion}`;
}

export function normalizeDraftResponse(data) {
  const raw = data.data || {};
  const prompts = Array.isArray(raw.prompts) ? raw.prompts : [];
  const normalizedPrompts = prompts.map((prompt) => ({
    prompt: String(prompt.prompt || ''),
    description: String(prompt.description || ''),
  }));

  return {
    draft: {
      file: String(data.file || ''),
      topic: String(raw.topic || ''),
      generated_at: String(raw.generated_at || ''),
      promptsCount: Number(raw.count || normalizedPrompts.length || 0),
    },
    prompts: normalizedPrompts,
  };
}
