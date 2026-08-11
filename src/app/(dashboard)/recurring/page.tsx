import { getRecurringTemplates } from '@/actions/recurring-templates.actions'
import { RecurringClient } from '@/components/recurring/recurring-client'

export const dynamic = 'force-dynamic'

export default async function RecurringPage() {
  const templates = await getRecurringTemplates()
  return <RecurringClient templates={templates} />
}
