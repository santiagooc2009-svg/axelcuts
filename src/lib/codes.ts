import { randomInt } from 'node:crypto';

/**
 * Alfabeto sin 0/O ni 1/I/L: estos codigos se dictan por telefono y se leen
 * en una pantalla chica.
 */
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

export function randomCode(length = 7): string {
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += ALPHABET[randomInt(ALPHABET.length)];
  }
  return out;
}

/**
 * Genera un codigo y verifica contra la base que no exista. Hay colisiones
 * posibles (31^7), asi que se reintenta en vez de confiar en la suerte.
 */
export async function uniqueCode(
  exists: (code: string) => Promise<boolean>,
  length = 7,
  attempts = 8,
): Promise<string> {
  for (let i = 0; i < attempts; i += 1) {
    const code = randomCode(length);
    if (!(await exists(code))) return code;
  }
  throw new Error('No se pudo generar un codigo unico despues de varios intentos.');
}
