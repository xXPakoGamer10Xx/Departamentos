// Colores de marca aproximados por banco/fintech, para pintar la tarjeta de
// "Datos para transferencia" con el estilo de cada institución. No reproduce
// logos oficiales (son marcas registradas): solo usa su paleta de color.

export interface BankBrand {
  gradient: [string, string];
  chip: string;
  accent: string;
}

const DEFAULT_BRAND: BankBrand = {
  gradient: ['#1a56c4', '#0a3d8a'],
  chip: 'rgba(255,200,0,0.85)',
  accent: 'rgba(255,255,255,0.55)',
};

const BRANDS: { match: RegExp; brand: BankBrand }[] = [
  { match: /bbva|bancomer/i,          brand: { gradient: ['#004C93', '#001B3A'], chip: 'rgba(0,169,224,0.9)',   accent: '#5FD4FF' } },
  { match: /santander/i,              brand: { gradient: ['#EC0000', '#600000'], chip: 'rgba(255,255,255,0.9)', accent: '#FFFFFF' } },
  { match: /banorte/i,                brand: { gradient: ['#D9272E', '#4A0A0D'], chip: 'rgba(255,209,0,0.9)',   accent: '#FFD100' } },
  { match: /hsbc/i,                   brand: { gradient: ['#DB0011', '#161616'], chip: 'rgba(255,255,255,0.9)', accent: '#FFFFFF' } },
  { match: /banamex|citibanamex/i,    brand: { gradient: ['#00285E', '#00112B'], chip: 'rgba(230,0,38,0.9)',    accent: '#FF6A7A' } },
  { match: /scotiabank/i,             brand: { gradient: ['#EC111A', '#4A0000'], chip: 'rgba(255,255,255,0.9)', accent: '#FFFFFF' } },
  { match: /azteca/i,                 brand: { gradient: ['#0F8A5F', '#053626'], chip: 'rgba(255,255,255,0.9)', accent: '#8DC63F' } },
  { match: /inbursa/i,                brand: { gradient: ['#0B3C5D', '#031624'], chip: 'rgba(247,148,30,0.9)',  accent: '#F7941E' } },
  { match: /banregio/i,               brand: { gradient: ['#F5811F', '#5C2E00'], chip: 'rgba(255,255,255,0.9)', accent: '#FFFFFF' } },
  { match: /afirme/i,                 brand: { gradient: ['#8C1D2B', '#2B0509'], chip: 'rgba(212,175,55,0.9)',  accent: '#D4AF37' } },
  { match: /nu\b|nubank/i,            brand: { gradient: ['#8A05BE', '#2E0140'], chip: 'rgba(255,255,255,0.9)', accent: '#FFFFFF' } },
  { match: /klar/i,                   brand: { gradient: ['#1A1A1A', '#000000'], chip: 'rgba(255,255,255,0.9)', accent: '#FFFFFF' } },
  { match: /ual[aá]/i,                brand: { gradient: ['#6C3EF4', '#20104D'], chip: 'rgba(255,255,255,0.9)', accent: '#FFFFFF' } },
  { match: /bienestar/i,              brand: { gradient: ['#7A1FA2', '#260834'], chip: 'rgba(255,255,255,0.9)', accent: '#FFFFFF' } },
  { match: /mercado\s*pago/i,         brand: { gradient: ['#00AEEF', '#005B85'], chip: 'rgba(255,255,255,0.9)', accent: '#FFFFFF' } },
];

export function getBankBrand(nombreBanco?: string | null): BankBrand {
  if (!nombreBanco) return DEFAULT_BRAND;
  const found = BRANDS.find(b => b.match.test(nombreBanco));
  return found ? found.brand : DEFAULT_BRAND;
}

export type CardNetwork = 'visa' | 'mastercard' | 'amex' | null;

// Identifica la red de la tarjeta por el rango del número (BIN), solo cuando
// el dato capturado es un número de tarjeta de 15-16 dígitos (no aplica a
// CLABE de 18 dígitos, que es transferencia SPEI y no usa red de tarjeta).
export function detectCardNetwork(numero: string): CardNetwork {
  const c = (numero || '').replace(/\D/g, '');
  if (c.length === 16 && /^4/.test(c)) return 'visa';
  if (c.length === 16 && (/^5[1-5]/.test(c) || /^2(2[2-9][0-9]|[3-6][0-9]{2}|7[01][0-9]|720)/.test(c))) return 'mastercard';
  if (c.length === 15 && /^3[47]/.test(c)) return 'amex';
  return null;
}

export function detectBankInfo(numero: string): { tipo: string; formato: string } {
  if (!numero) return { tipo: 'CLABE', formato: '•••• •••• •••• ••••' };
  const c = numero.replace(/\D/g, '');
  if (c.length === 18) return { tipo: 'CLABE', formato: `${c.slice(0, 4)} ${c.slice(4, 8)} ${c.slice(8, 12)} ${c.slice(12, 16)} ${c.slice(16)}` };
  if (c.length === 16) return { tipo: 'No. de tarjeta', formato: `${c.slice(0, 4)} ${c.slice(4, 8)} ${c.slice(8, 12)} ${c.slice(12)}` };
  if (c.length >= 10) return { tipo: 'No. de cuenta', formato: c };
  return { tipo: 'Cuenta', formato: numero };
}
