/* eslint-disable @typescript-eslint/no-explicit-any */
'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { getAllAlegraContacts, createAlegraContact } from './alegra.actions'
import { requiresAlegra, validateFiscal, mustRequireFiscal } from '@/lib/alegra-fiscal'
import { sanitizePostgrestValue } from '@/lib/commission-math'

export async function getCustomers(filters?: {
  sociedadCliente?: string
  kam?: string
  tieneFactoraje?: boolean
  search?: string
}) {
  const supabase = await createClient()

  let query = (supabase as any)
    .from('customers')
    .select('*')
    .order('nombre_cliente', { ascending: true })

  if (filters?.sociedadCliente) query = query.eq('sociedad_cliente', filters.sociedadCliente)
  if (filters?.kam) query = query.eq('kam_responsable', filters.kam)
  if (filters?.tieneFactoraje !== undefined) query = query.eq('tiene_factoraje', filters.tieneFactoraje)
  if (filters?.search) {
    // Sanitize to prevent PostgREST filter-grammar injection (see commission-math).
    const safeSearch = sanitizePostgrestValue(filters.search)
    query = query.or(
      `nombre_cliente.ilike.%${safeSearch}%,kam_responsable.ilike.%${safeSearch}%,email.ilike.%${safeSearch}%`
    )
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return data || []
}

export type AlegraSyncResult =
  | { status: 'not_applicable' }
  | { status: 'created' | 'linked'; contactId: string }
  | { status: 'error'; error: string }

// Clientes de hackÜ SAS: los datos fiscales son obligatorios porque se crean
// en Alegra (facturación electrónica). Se valida aquí además de en la UI.
function assertFiscalIfSAS(data: Record<string, any>, previous?: Record<string, any> | null) {
  if (!mustRequireFiscal(data, previous)) return
  const errors = validateFiscal(data)
  const messages = Object.values(errors)
  if (messages.length > 0) {
    throw new Error(`Datos fiscales incompletos para hackÜ SAS: ${messages.join('; ')}`)
  }
}

// Columnas agregadas en la migración 050. Mientras no esté aplicada en la DB,
// las escrituras que las incluyen fallan: se reintenta sin ellas cuando vienen
// vacías, y si traen datos se avisa que falta la migración (no se pierden datos
// en silencio).
const MIGRATION_050_COLUMNS = [
  'tipo_identificacion', 'numero_identificacion', 'dv', 'tipo_persona', 'regimen',
  'direccion', 'departamento', 'alegra_contact_id', 'alegra_sync_error',
]
const MIGRATION_050_MSG =
  'Falta aplicar la migración 050 (datos fiscales de clientes) en la base de datos. ' +
  'Pide a quien administra Supabase que ejecute supabase/migrations/050_customers_alegra_fiscal.sql.'

function isMissingColumnError(error: any): boolean {
  const msg = String(error?.message ?? '')
  return error?.code === 'PGRST204' || error?.code === '42703' || /column .* does not exist|Could not find the '.*' column/i.test(msg)
}

function splitMigration050(data: Record<string, any>) {
  const base: Record<string, any> = {}
  let hasNewData = false
  for (const [k, v] of Object.entries(data)) {
    if (MIGRATION_050_COLUMNS.includes(k)) {
      if (v !== null && v !== undefined && v !== '') hasNewData = true
    } else {
      base[k] = v
    }
  }
  return { base, hasNewData }
}

/** Ejecuta la escritura; si la DB no tiene las columnas de la 050, reintenta sin ellas. */
async function writeWithMigrationFallback<T>(
  data: Record<string, any>,
  write: (payload: Record<string, any>) => Promise<{ data: T; error: any }>,
): Promise<T> {
  const first = await write(data)
  if (!first.error) return first.data
  if (!isMissingColumnError(first.error)) throw new Error(first.error.message)
  const { base, hasNewData } = splitMigration050(data)
  if (hasNewData) throw new Error(MIGRATION_050_MSG)
  const retry = await write(base)
  if (retry.error) throw new Error(retry.error.message)
  return retry.data
}

export async function createCustomer(data: Record<string, any>): Promise<{ id: string; alegra: AlegraSyncResult }> {
  assertFiscalIfSAS(data)
  const supabase = await createClient()
  const inserted = await writeWithMigrationFallback<{ id: string }>(data, (payload) =>
    (supabase as any).from('customers').insert(payload).select('id').single()
  )

  // El cliente queda creado en la app aunque Alegra falle: el error se guarda
  // en alegra_sync_error y se puede reintentar con "Crear en Alegra".
  const alegra = await syncCustomerToAlegra(inserted.id)
  revalidatePath('/customers')
  revalidatePath('/settings/master-lists')
  return { id: inserted.id, alegra }
}

export async function updateCustomer(id: string, data: Record<string, any>): Promise<{ alegra: AlegraSyncResult }> {
  const supabase = await createClient()
  const { data: current, error: currentError } = await (supabase as any)
    .from('customers')
    .select('*')
    .eq('id', id)
    .single()
  if (currentError) throw new Error(currentError.message)

  const merged = { ...current, ...data }
  assertFiscalIfSAS(merged, current)

  await writeWithMigrationFallback(data, (payload) =>
    (supabase as any).from('customers').update(payload).eq('id', id)
  )

  // Si es de hackÜ SAS, aún no está en Alegra y tiene los datos fiscales
  // completos, crearlo. Sin datos completos no se intenta (cliente SAS antiguo).
  const alegra = current.alegra_contact_id || !requiresAlegra(merged) || Object.keys(validateFiscal(merged)).length > 0
    ? ({ status: 'not_applicable' } as AlegraSyncResult)
    : await syncCustomerToAlegra(id)
  revalidatePath('/customers')
  revalidatePath('/settings/master-lists')
  return { alegra }
}

/**
 * Crea (o enlaza, si ya existe con ese número de identificación) el contacto
 * en Alegra para un cliente de hackÜ SAS. Idempotente: si ya tiene
 * alegra_contact_id no hace nada.
 */
export async function syncCustomerToAlegra(id: string): Promise<AlegraSyncResult> {
  const supabase = await createClient()
  const { data: customer, error } = await (supabase as any)
    .from('customers')
    .select('*')
    .eq('id', id)
    .single()
  if (error) throw new Error(error.message)

  if (!requiresAlegra(customer)) return { status: 'not_applicable' }
  if (customer.alegra_contact_id) return { status: 'linked', contactId: customer.alegra_contact_id }

  const missing = Object.values(validateFiscal(customer))
  if (missing.length > 0) {
    const msg = `Datos fiscales incompletos: ${missing.join('; ')}`
    await (supabase as any).from('customers').update({ alegra_sync_error: msg }).eq('id', id)
    revalidatePath('/customers')
    return { status: 'error', error: msg }
  }

  try {
    const result = await createAlegraContact(customer)
    await (supabase as any)
      .from('customers')
      .update({ alegra_contact_id: result.id, alegra_sync_error: null })
      .eq('id', id)
    revalidatePath('/customers')
    return { status: result.existing ? 'linked' : 'created', contactId: result.id }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error desconocido al crear en Alegra'
    console.error('[Alegra] createContact failed for customer', id, msg)
    await (supabase as any).from('customers').update({ alegra_sync_error: msg.slice(0, 1000) }).eq('id', id)
    revalidatePath('/customers')
    return { status: 'error', error: msg }
  }
}

export async function deleteCustomer(id: string) {
  const supabase = await createClient()
  const { error } = await (supabase as any).from('customers').delete().eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/customers')
  revalidatePath('/settings/master-lists')
}

// Get customer by razón social (for auto-filling in forms)
export async function getCustomerByRazonSocial(razonSocial: string) {
  const supabase = await createClient()
  // Sanitize razonSocial before PostgREST interpolation.
  // includeBraces: quotes/braces are especially dangerous inside the .cs.{...}
  // JSON-contains clause below (filter-grammar injection).
  const safe = sanitizePostgrestValue(razonSocial, true)
  // Search in nombre_cliente or razones_sociales array
  const { data } = await (supabase as any)
    .from('customers')
    .select('*')
    .or(`nombre_cliente.ilike.${safe},razones_sociales.cs.{"${safe}"}`)
    .limit(1)
    .single()
  return data || null
}

// Sync customers from Alegra
export async function syncAlegraCustomers(): Promise<{
  synced: number
  created: number
  updated: number
}> {
  const supabase = await createClient()
  const contacts = await getAllAlegraContacts()

  const { data: existing, error: fetchError } = await (supabase as any)
    .from('customers')
    .select('id, nombre_cliente')
  if (fetchError) throw new Error(fetchError.message)

  const existingMap = new Map(
    (existing ?? []).map((c: any) => [c.nombre_cliente.toLowerCase(), c.id])
  )

  let created = 0
  let updated = 0

  for (const contact of contacts) {
    const name: string = contact.name?.trim()
    if (!name) continue

    const existingId = existingMap.get(name.toLowerCase())

    if (existingId) {
      await (supabase as any)
        .from('customers')
        .update({ sociedad_cliente: 'hackÜ SAS' })
        .eq('id', existingId)
        .is('sociedad_cliente', null)
      // Enlazar con el contacto de Alegra (evita que se intente crear de nuevo)
      await (supabase as any)
        .from('customers')
        .update({ alegra_contact_id: String(contact.id), alegra_sync_error: null })
        .eq('id', existingId)
        .is('alegra_contact_id', null)
      updated++
    } else {
      const row = { nombre_cliente: name, sociedad_cliente: 'hackÜ SAS' }
      let { error } = await (supabase as any)
        .from('customers')
        .insert({ ...row, alegra_contact_id: String(contact.id) })
      // Sin la migración 050 no existe alegra_contact_id: insertar sin el enlace
      if (error && isMissingColumnError(error)) {
        ({ error } = await (supabase as any).from('customers').insert(row))
      }
      if (!error) created++
    }
  }

  revalidatePath('/customers')
  revalidatePath('/settings/master-lists')
  return { synced: contacts.length, created, updated }
}
