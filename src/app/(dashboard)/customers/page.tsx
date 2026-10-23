import { getCustomers } from '@/actions/customers.actions'
import { CustomersPageClient } from '@/components/customers/customers-page-client'

export const dynamic = 'force-dynamic'
// "Sincronizar Alegra" (server action de esta página) recorre todos los
// contactos de Alegra: darle más margen que el límite por defecto.
export const maxDuration = 60

export default async function CustomersPage() {
  const customers = await getCustomers()
  return <CustomersPageClient initialData={customers} />
}
