export const DELIVERY_COMPANIES = [
  { value: 'mercadolivre', label: 'Mercado Livre', icon: '📦' },
  { value: 'shopee', label: 'Shopee', icon: '🛍️' },
  { value: 'correios', label: 'Correios', icon: '📮' },
  { value: 'amazon', label: 'Amazon', icon: '📦' },
  { value: 'other', label: 'Outra Empresa', icon: '📦' }
] as const;

export const BUTTON_OPTIONS = [
  { value: 'call', label: 'CHAMAR MORADOR', icon: '📞' },
  { value: 'assistant', label: 'FALAR COM ASSISTENTE', icon: '🤖' },
  { value: 'delivery', label: 'ENTREGA', icon: '📦' },
  { value: 'other', label: 'OUTRO MOTIVO', icon: '💬' }
] as const;
