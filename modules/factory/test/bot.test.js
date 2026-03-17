const { detectMode } = require('../bot');

describe('detectMode', () => {
  it('uses top-level mode when batch is marked as niji', () => {
    expect(detectMode({ mode: 'NIJI' })).toBe('niji');
  });

  it('detects niji from structured parameters', () => {
    expect(
      detectMode({
        prompts: [{ prompt: 'anime portrait', parameters: { niji: 7, ar: '1:1' } }],
      })
    ).toBe('niji');
  });

  it('detects niji flags embedded in prompt text', () => {
    expect(
      detectMode({
        prompts: [{ prompt: 'anime portrait --niji 7', parameters: {} }],
      })
    ).toBe('niji');
  });

  it('falls back to mj when no niji signal is present', () => {
    expect(
      detectMode({
        mode: 'standard',
        prompts: [{ prompt: 'photo realistic portrait', parameters: { v: 7 } }],
      })
    ).toBe('mj');
  });
});
