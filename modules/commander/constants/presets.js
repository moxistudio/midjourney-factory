export const AR_OPTIONS = ['1:1', '2:3', '3:4', '9:16', '9:20', '20:9', '16:9', '4:3', '3:2'];

export const MJ_VERSIONS = ['7', '6.1', '6', '5.2', '5', '4'];

export const NIJI_VERSIONS = ['7', '6'];

export const PRESET_GROUPS = {
  shot: [
    { id: 'default', label: 'Default / 默认', text: '' },
    { id: 'closeup', label: 'Close-up / 特写', text: 'Shot: close-up framing.' },
    { id: 'medium', label: 'Medium shot / 中景', text: 'Shot: medium shot framing.' },
    { id: 'wide', label: 'Wide establishing / 全景', text: 'Shot: wide establishing shot.' },
    { id: 'macro', label: 'Macro detail / 微距细节', text: 'Shot: macro detail focus.' },
    { id: 'topdown', label: 'Top-down / 俯拍', text: 'Shot: top-down overhead view.' },
  ],
  lens: [
    { id: 'default', label: 'Default / 默认', text: '' },
    { id: '24mm', label: '24mm wide / 24mm广角', text: 'Camera: 24mm wide-angle lens, strong perspective depth.' },
    { id: '35mm', label: '35mm documentary / 35mm纪实', text: 'Camera: 35mm lens, natural perspective, documentary feel.' },
    { id: '50mm', label: '50mm natural / 50mm标准', text: 'Camera: 50mm lens, natural perspective.' },
    { id: '85mm', label: '85mm portrait / 85mm人像', text: 'Camera: 85mm portrait lens, shallow depth of field, creamy bokeh.' },
    { id: '100mm_macro', label: '100mm macro / 100mm微距', text: 'Camera: 100mm macro lens, shallow depth, fine texture detail.' },
    { id: '200mm', label: '200mm telephoto / 200mm长焦', text: 'Camera: 200mm telephoto compression, background separation.' },
  ],
  composition: [
    { id: 'default', label: 'Default / 默认', text: '' },
    { id: 'thirds', label: 'Rule of thirds / 三分法', text: 'Composition: rule of thirds, clear subject placement.' },
    { id: 'symmetry', label: 'Symmetry centered / 居中对称', text: 'Composition: centered symmetry, clean geometry.' },
    { id: 'leading', label: 'Leading lines / 引导线', text: 'Composition: strong leading lines and vanishing point.' },
    { id: 'negative', label: 'Negative space / 留白', text: 'Composition: generous negative space, minimal clutter.' },
    { id: 'frame', label: 'Frame within frame / 框中框', text: 'Composition: frame-within-frame, layered depth.' },
    { id: 'dutch', label: 'Dutch angle / 荷兰角', text: 'Composition: dutch angle, dynamic tension.' },
  ],
  lighting: [
    { id: 'default', label: 'Default / 默认', text: '' },
    { id: 'soft', label: 'Soft diffused / 柔光漫射', text: 'Lighting: soft diffused key light, gentle shadows.' },
    { id: 'threepoint', label: 'Three-point studio / 三点布光', text: 'Lighting: three-point lighting (key, fill, rim), studio control.' },
    { id: 'rim', label: 'Rim light / 轮廓光', text: 'Lighting: rim light edge highlights, dimensional separation.' },
    { id: 'chiaroscuro', label: 'Chiaroscuro / 明暗对比', text: 'Lighting: chiaroscuro, deep shadows, high contrast.' },
    { id: 'golden', label: 'Golden hour / 黄金时刻', text: 'Lighting: golden hour, warm backlight, soft flare.' },
    { id: 'neon', label: 'Neon night / 霓虹夜景', text: 'Lighting: neon signage, wet reflections, cinematic glow.' },
    { id: 'volumetric', label: 'Volumetric rays / 体积光', text: 'Lighting: volumetric light beams, subtle haze.' },
  ],
  color: [
    { id: 'default', label: 'Default / 默认', text: '' },
    { id: 'teal_orange', label: 'Teal & Orange / 青橙电影调', text: 'Color grade: teal shadows and warm highlights, cinematic balance.' },
    { id: 'warm_earth', label: 'Warm earth tones / 暖大地色', text: 'Palette: warm earth tones, restrained saturation.' },
    { id: 'cool_mono', label: 'Cool monochrome / 冷单色', text: 'Palette: cool monochrome / near-monochrome, controlled contrast.' },
    { id: 'pastel', label: 'Pastel soft / 柔和粉彩', text: 'Palette: pastel tones, soft gradients, low contrast.' },
    { id: 'muted', label: 'Muted editorial / 低饱和编辑', text: 'Palette: muted editorial tones, subtle color separation.' },
    { id: 'vibrant', label: 'Vibrant pop / 高饱和彩色点缀', text: 'Palette: vibrant accents, high saturation, clean contrast.' },
  ],
  texture: [
    { id: 'default', label: 'Default / 默认', text: '' },
    { id: 'filmgrain', label: '35mm film grain / 35mm胶片颗粒', text: 'Texture: subtle 35mm film grain, realistic micro-contrast.' },
    { id: 'matte', label: 'Matte finish / 哑光', text: 'Surface: matte finish, soft specular highlights.' },
    { id: 'glossy', label: 'Glossy finish / 高光亮面', text: 'Surface: glossy finish, crisp specular highlights.' },
    { id: 'paper', label: 'Paper texture / 纸张纹理', text: 'Texture: fine paper texture, tactile feel.' },
    { id: 'metal_glass', label: 'Metal + glass / 金属+玻璃', text: 'Materials: metal and glass, realistic reflections and refractions.' },
  ],
  atmos: [
    { id: 'default', label: 'Default / 默认', text: '' },
    { id: 'fog', label: 'Fog / 雾', text: 'Atmosphere: fog, depth fade, soft silhouettes.' },
    { id: 'rain', label: 'Rain / 雨', text: 'Atmosphere: rain, wet surfaces, reflective highlights.' },
    { id: 'dust', label: 'Dust / 尘埃颗粒', text: 'Atmosphere: dust particles in light, cinematic depth.' },
    { id: 'smoke', label: 'Haze / 薄雾烟', text: 'Atmosphere: light haze/smoke, volumetric diffusion.' },
    { id: 'crisp', label: 'Crisp / 清透', text: 'Atmosphere: crisp clarity, sharp edges, clean air.' },
  ],
  medium: [
    { id: 'default', label: 'Default / 默认', text: '' },
    { id: 'photo', label: 'Photoreal Photo / 写实摄影', text: 'Medium: photorealistic photography, realistic lighting and textures.' },
    { id: '3d', label: '3D Render / 3D渲染', text: 'Medium: high-end 3D render, physically based materials, clean highlights.' },
    { id: 'vector', label: 'Vector / 矢量插画', text: 'Medium: clean vector illustration, flat shapes, subtle grain.' },
    { id: 'watercolor', label: 'Watercolor / 水彩', text: 'Medium: watercolor wash, pigment blooms, paper texture.' },
    { id: 'ink', label: 'Ink Wash / 水墨', text: 'Medium: ink wash, brush texture, negative space, rice paper texture.' },
    { id: 'gouache', label: 'Gouache / 水粉', text: 'Medium: gouache paint, matte pigment, soft edges.' },
    { id: 'risograph', label: 'Risograph / Riso印刷', text: 'Medium: risograph print, misregistration, halftone texture.' },
  ],
  illustration: [
    { id: 'default', label: 'Default / 默认', text: '' },
    { id: 'lineart', label: 'Clean Lineart / 干净线稿', text: 'Illustration: clean lineart, controlled line weight, crisp edges.' },
    { id: 'painterly', label: 'Painterly / 绘画笔触', text: 'Illustration: painterly brushwork, layered strokes, rich pigments.' },
    { id: 'cel', label: 'Cel Shading / 赛璐璐', text: 'Illustration: cel shading, hard shadow shapes, anime-friendly rendering.' },
    { id: 'manga', label: 'Manga Screentone / 网点', text: 'Illustration: manga screentone, inked outlines, high readability.' },
    { id: 'stipple', label: 'Stippling / 点描', text: 'Illustration: stippling shading, fine dot texture, high detail.' },
    { id: 'linocut', label: 'Linocut / 木刻版画', text: 'Illustration: linocut print, bold cuts, high contrast, paper fibers.' },
  ],
  design: [
    { id: 'default', label: 'Default / 默认', text: '' },
    { id: 'swiss', label: 'Swiss Grid / 瑞士网格', text: 'Design language: swiss grid, clean alignment, editorial hierarchy.' },
    { id: 'bauhaus', label: 'Bauhaus / 包豪斯', text: 'Design language: bauhaus geometry, primary shapes, rational composition.' },
    { id: 'artdeco', label: 'Art Deco / 装饰艺术', text: 'Design language: art deco symmetry, geometric ornament, luxe lines.' },
    { id: 'brutalist', label: 'Brutalist / 粗野主义', text: 'Design language: brutalist layout, raw shapes, bold contrast.' },
    { id: 'minimal', label: 'Minimal Editorial / 极简编辑', text: 'Design language: minimal editorial layout, generous negative space.' },
    { id: 'bento', label: 'Bento Grid / Bento网格', text: 'Design language: bento grid composition, modular panels, clear grouping.' },
  ],
};

export const PRESET_ROWS = [
  [
    { group: 'medium', label: 'Medium / 媒介' },
    { group: 'design', label: 'Design / 设计语言' },
  ],
  [
    { group: 'illustration', label: 'Illustration / 插画风格' },
    { group: 'shot', label: 'Shot / 景别' },
  ],
  [
    { group: 'lens', label: 'Lens / 镜头' },
    { group: 'composition', label: 'Composition / 构图' },
  ],
  [
    { group: 'lighting', label: 'Lighting / 光线' },
    { group: 'color', label: 'Color Grade / 色调' },
  ],
  [
    { group: 'texture', label: 'Texture / Materials / 质感与材质' },
    { group: 'atmos', label: 'Atmosphere / 氛围' },
  ],
];
