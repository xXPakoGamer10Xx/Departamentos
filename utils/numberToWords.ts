/**
 * Convierte un número a letras (Español - Pesos Mexicanos)
 */
export function numberToWords(num: number): string {
  const unidades = ['', 'un', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve'];
  const decenas = ['diez', 'veinte', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'];
  const especiales = ['once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve'];
  const centenas = ['', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos', 'seiscientos', 'setecientos', 'ochocientos', 'novecientos'];

  const convertGroup = (n: number): string => {
    let output = '';
    if (n === 100) return 'cien';
    if (n > 100) {
      output += centenas[Math.floor(n / 100)] + ' ';
      n %= 100;
    }
    if (n >= 10 && n <= 19) {
      output += (n === 10 ? 'diez' : especiales[n - 11]) + ' ';
    } else if (n >= 20) {
      if (n === 20) output += 'veinte ';
      else if (n > 20 && n < 30) output += 'veinti' + unidades[n - 20] + ' ';
      else {
        output += decenas[Math.floor(n / 10) - 1] + (n % 10 !== 0 ? ' y ' + unidades[n % 10] : '') + ' ';
      }
    } else if (n > 0) {
      output += unidades[n] + ' ';
    }
    return output;
  };

  if (num === 0) return 'cero pesos';
  
  let result = '';
  const millions = Math.floor(num / 1000000);
  const thousands = Math.floor((num % 1000000) / 1000);
  const remainder = Math.floor(num % 1000);

  if (millions > 0) {
    if (millions === 1) result += 'un millón ';
    else result += convertGroup(millions) + 'millones ';
  }

  if (thousands > 0) {
    if (thousands === 1) result += 'mil ';
    else result += convertGroup(thousands) + 'mil ';
  }

  if (remainder > 0) {
    result += convertGroup(remainder);
  }

  return result.trim().toLowerCase() + ' pesos';
}
