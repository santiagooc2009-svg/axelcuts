/**
 * Armado del filtro de busqueda de clientes.
 *
 * PostgREST recibe las condiciones como UNA cadena donde la coma separa
 * condiciones y los parentesis agrupan. Si el texto que escribio el usuario
 * entra crudo, un nombre con coma deja de ser un nombre y se vuelve parte de
 * la consulta. Por eso se limpia a letras, numeros y espacios.
 */
export function customerSearchFilter(raw: string): string | null {
  const search = raw.trim();
  if (!search) return null;

  const name = search.replace(/[^\p{L}\p{N} ]/gu, '').trim().slice(0, 40);
  const digits = search.replace(/\D/g, '').slice(0, 15);

  const conditions: string[] = [];
  if (name) conditions.push(`name.ilike.%${name}%`);
  // Menos de 4 digitos empareja con medio directorio; no vale la pena.
  if (digits.length >= 4) conditions.push(`phone.ilike.%${digits}%`);

  return conditions.length > 0 ? conditions.join(',') : null;
}
