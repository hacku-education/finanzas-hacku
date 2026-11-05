/* eslint-disable @typescript-eslint/no-explicit-any */

// Marca que queda en observaciones cuando Alegra rechaza un documento. La usan
// el formulario, el cron de recurrentes y el reintento para identificar las
// solicitudes cuyo envío falló.
export const ALEGRA_ERROR_MARKER = '⚠️ Error al crear en Alegra:'

// Etiqueta interna que el cron agrega a las solicitudes recurrentes; no va en
// el documento de Alegra.
const RECURRING_TAG_RE = /\n*\[Factura recurrente[^\]]*\]\s*$/

export type AlegraLineItem = {
  id: string
  price: number
  quantity: number
  description?: string
  discount?: number
}

/**
 * Convierte los ítems guardados en una solicitud/plantilla al formato de Alegra.
 * Los planes se guardan como `plan_<uuid>` y se traducen a su alegra_item_id;
 * los ítems sin id numérico de Alegra se descartan.
 */
export async function resolveAlegraItems(supabase: any, rawItems: unknown): Promise<AlegraLineItem[]> {
  const list: any[] = Array.isArray(rawItems) ? rawItems : []
  const planIds = list
    .map((i) => String(i.alegra_item_id ?? ''))
    .filter((id) => id.startsWith('plan_'))
    .map((id) => id.slice('plan_'.length))

  const planAlegraIds = new Map<string, string | null>()
  if (planIds.length > 0) {
    const { data: planes, error } = await supabase
      .from('planes')
      .select('id, alegra_item_id')
      .in('id', planIds)
    if (error) throw new Error(error.message)
    for (const p of planes ?? []) planAlegraIds.set(String(p.id), p.alegra_item_id ? String(p.alegra_item_id) : null)
  }

  return list
    .filter((i) => i.alegra_item_id && i.alegra_item_id !== '__nuevo__')
    .map((i) => {
      let alegraId: string | null = String(i.alegra_item_id)
      if (alegraId.startsWith('plan_')) alegraId = planAlegraIds.get(alegraId.slice('plan_'.length)) ?? null
      if (!alegraId || isNaN(Number(alegraId))) return null
      return {
        id: Number(alegraId) as any,
        price: Number(i.price),
        quantity: Number(i.quantity),
        description: i.description || i.name || undefined,
        discount: Number(i.discount) || 0,
      }
    })
    .filter(Boolean) as AlegraLineItem[]
}

/** Observaciones que escribió el usuario, sin la marca de error ni etiquetas internas. */
export function userObservationsForAlegra(observaciones: string | null | undefined): string {
  const text = observaciones ?? ''
  const markerIdx = text.indexOf(ALEGRA_ERROR_MARKER)
  const base = markerIdx === -1 ? text : text.slice(0, markerIdx)
  return base.replace(RECURRING_TAG_RE, '').trim()
}
