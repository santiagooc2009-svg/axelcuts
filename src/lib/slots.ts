/**
 * Calculo puro de huecos. Sin base de datos y sin zona horaria: todo en
 * minutos desde la medianoche local del dia que se esta viendo.
 *
 * Vive aparte de `availability.ts` para que se pueda probar con numeros a
 * mano, que es justo lo que mas se rompe en una agenda (huecos que se
 * encinan, servicios que no caben antes de cerrar, bloqueos a medias).
 */

export type Window = { staffId: string | null; open: number; close: number };
export type Block = { staffId: string | null; start: number; end: number };

export type SlotDraft = { start: number; staffIds: string[] };

export type ComputeInput = {
  /** Barberos candidatos, en orden de preferencia. */
  staffIds: string[];
  /** Ventanas de horario. `staffId: null` aplica a todos. */
  windows: Window[];
  /** Citas y bloqueos ya ocupados. `staffId: null` cierra para todos. */
  blocks: Block[];
  durationMin: number;
  stepMin: number;
  /** Nada antes de este minuto (anticipacion minima). */
  earliestMin: number;
};

export function computeSlots(input: ComputeInput): SlotDraft[] {
  const { staffIds, windows, blocks, durationMin, stepMin, earliestMin } = input;

  if (durationMin <= 0 || stepMin <= 0) return [];

  const byStart = new Map<number, string[]>();

  for (const staffId of staffIds) {
    // Horario propio si lo tiene; si no, el general del negocio.
    const own = windows.filter((w) => w.staffId === staffId);
    const shared = windows.filter((w) => w.staffId === null);
    const applicable = own.length > 0 ? own : shared;

    for (const window of applicable) {
      // El servicio tiene que caber ENTERO antes de cerrar: un corte de 45
      // min no se ofrece a las 19:45 si se cierra a las 20:00.
      for (let start = window.open; start + durationMin <= window.close; start += stepMin) {
        if (start < earliestMin) continue;

        const end = start + durationMin;
        const busy = blocks.some(
          (b) =>
            (b.staffId === null || b.staffId === staffId) &&
            start < b.end &&
            end > b.start,
        );
        if (busy) continue;

        const list = byStart.get(start);
        if (list) {
          if (!list.includes(staffId)) list.push(staffId);
        } else {
          byStart.set(start, [staffId]);
        }
      }
    }
  }

  return [...byStart.entries()]
    .sort(([a], [b]) => a - b)
    .map(([start, ids]) => ({ start, staffIds: ids }));
}
