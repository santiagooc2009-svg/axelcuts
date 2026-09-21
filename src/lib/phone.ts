/**
 * Telefonos mexicanos a E.164. El telefono es la identidad del cliente
 * (es por donde le llega WhatsApp), asi que dos formas de escribir el mismo
 * numero tienen que colapsar en la misma fila.
 */

const DEFAULT_COUNTRY = '52';

export function normalizePhone(input: string): string | null {
  const digits = input.replace(/[^\d]/g, '');
  if (digits.length === 0) return null;

  // 10 digitos: numero nacional sin lada de pais.
  if (digits.length === 10) return `+${DEFAULT_COUNTRY}${digits}`;

  // 521XXXXXXXXXX: el "1" que WhatsApp usaba para moviles mexicanos.
  if (digits.length === 13 && digits.startsWith(`${DEFAULT_COUNTRY}1`)) {
    return `+${DEFAULT_COUNTRY}${digits.slice(3)}`;
  }

  // 52XXXXXXXXXX
  if (digits.length === 12 && digits.startsWith(DEFAULT_COUNTRY)) {
    return `+${digits}`;
  }

  // Cualquier otro pais escrito completo.
  if (digits.length >= 11 && digits.length <= 15) return `+${digits}`;

  return null;
}

/** +525512345678 → 55 1234 5678 */
export function formatPhone(e164: string): string {
  if (e164.startsWith(`+${DEFAULT_COUNTRY}`) && e164.length === 13) {
    const n = e164.slice(3);
    return `${n.slice(0, 2)} ${n.slice(2, 6)} ${n.slice(6)}`;
  }
  return e164;
}

/** Lo que wa.me y la Cloud API esperan: digitos pelones. */
export function toWhatsappNumber(e164: string): string {
  return e164.replace(/[^\d]/g, '');
}
