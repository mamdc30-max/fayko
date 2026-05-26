import { createClient } from '@supabase/supabase-js'

export async function logAutomation(params: {
  task_name: string
  status: 'success' | 'error' | 'partial'
  summary: string
}) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    await supabase.from('automation_logs').insert({
      ...params,
      user_id: process.env.ADMIN_USER_ID!,
    })
  } catch {
    // Ne pas casser le flux principal si le log échoue
  }
}
