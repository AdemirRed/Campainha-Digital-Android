const KEY = 'campainha_doorbell_id';

export function getDoorbellId(): number {
  const raw = localStorage.getItem(KEY);
  const n = raw ? parseInt(raw, 10) : NaN;
  return Number.isFinite(n) && n > 0 ? n : 1;
}

export function setDoorbellId(id: number): void {
  localStorage.setItem(KEY, String(id));
}

// O app Android abre a WebView com "?doorbell=<id>"; persistimos e seguimos
// usando localStorage nas próximas cargas.
export function bootstrapDoorbellFromUrl(): void {
  try {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get('doorbell');
    if (raw) {
      const n = parseInt(raw, 10);
      if (Number.isFinite(n) && n > 0) {
        setDoorbellId(n);
        localStorage.setItem('campainha_is_kiosk', '1');
      }
    }
  } catch {
    // sem window/URL — ignora
  }
}

// Um navegador que JÁ carregou com "?doorbell=" alguma vez é o dispositivo
// kiosk (o app Android sempre abre assim). Telefones de moradores / painel
// admin nunca têm esse parâmetro.
export function isKioskDevice(): boolean {
  try {
    return localStorage.getItem('campainha_is_kiosk') === '1';
  } catch {
    return false;
  }
}
