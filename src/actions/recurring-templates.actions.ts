/* eslint-disable @typescript-eslint/no-explicit-any */
'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function getRecurringTemplates() {
  const supabase = await createClient()
  const { data, error } = await (supabase as any)
    .from('recurring_invoice_templates')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) { console.error('[RecurringTemplates]', error.message); return [] }
  return data || []
}

export async function toggleRecurringTemplate(id: string, activo: boolean) {
  const supabase = await createClient()
  const { error } = await (supabase as any)
    .from('recurring_invoice_templates')
    .update({ activo })
    .eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/settings/master-lists')
}

export async function deleteRecurringTemplate(id: string) {
  const supabase = await createClient()
  const { error } = await (supabase as any)
    .from('recurring_invoice_templates')
    .delete()
    .eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/settings/master-lists')
  revalidatePath('/recurring')
}

export async function updateRecurringTemplate(id: string, data: Record<string, any>) {
  const supabase = await createClient()
  const { error } = await (supabase as any)
    .from('recurring_invoice_templates')
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/settings/master-lists')
  revalidatePath('/recurring')
}
