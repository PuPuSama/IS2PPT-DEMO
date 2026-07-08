// LazyLLM 支持的厂商列表
export const LAZYLLM_SOURCES = [
  { value: 'qwen', label: 'Qwen (通义千问)' },
  { value: 'doubao', label: 'Doubao (豆包)' },
  { value: 'deepseek', label: 'DeepSeek' },
  { value: 'glm', label: 'GLM (智谱)' },
  { value: 'siliconflow', label: 'SiliconFlow' },
  { value: 'sensenova', label: 'SenseNova (商汤)' },
  { value: 'minimax', label: 'MiniMax' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'kimi', label: 'Kimi' },
];

// 所有可用的提供商选项（Gemini/OpenAI/Codex + LazyLLM 厂商）
export const ALL_PROVIDER_SOURCES = [
  { value: 'gemini', label: 'Gemini' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'codex', label: 'Codex (OpenAI OAuth)' },
  ...LAZYLLM_SOURCES.filter(s => s.value !== 'openai'),
];

// 需要 API Key + Base URL 的提供商（非 LazyLLM 厂商）
export const API_KEY_PROVIDERS = new Set(['gemini', 'openai']);

const LAZYLLM_VENDOR_SET = new Set(LAZYLLM_SOURCES.map(s => s.value));

export const isLazyllmVendor = (vendor: string) =>
  LAZYLLM_VENDOR_SET.has(vendor) && vendor !== 'openai';

// When backend returns "lazyllm", infer specific vendor from configured keys.
export const resolveLazyllmVendor = (format: string, keysInfo?: Record<string, number>): string => {
  if (format !== 'lazyllm') return format;
  if (keysInfo) {
    const vendor = LAZYLLM_SOURCES.find(s => isLazyllmVendor(s.value) && keysInfo[s.value]);
    if (vendor) return vendor.value;
  }
  return LAZYLLM_SOURCES.find(s => isLazyllmVendor(s.value))?.value || 'deepseek';
};
