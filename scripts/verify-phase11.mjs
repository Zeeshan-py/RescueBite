// Live development integration checks. Reads ignored .env; never expose its keys.
import fs from 'node:fs'
import assert from 'node:assert/strict'
import { createClient } from '@supabase/supabase-js'

const env = Object.fromEntries(fs.readFileSync('.env', 'utf8').split(/\r?\n/)
  .filter((line) => line && !line.startsWith('#') && line.includes('='))
  .map((line) => { const i = line.indexOf('='); return [line.slice(0, i).trim(), line.slice(i + 1).trim().replace(/^['"]|['"]$/g, '')] }))
const options = { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: async (input, init) => {
  const readOnly = (!init?.method || init.method === 'GET' || init.method === 'DELETE') || /\/rpc\/(get_dashboard_summary|get_admin_dashboard|get_admin_records)$/.test(String(input))
  for (let attempt = 0; ; attempt++) {
    try { return await fetch(input, { ...init, signal: AbortSignal.timeout(20000) }) }
    catch (error) { if (!readOnly || attempt >= 2) throw error }
  }
} } }
const admin = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SECRET_KEY, options)
const prefix = `phase11-${Date.now()}`
const password = `Temporary-${crypto.randomUUID()}!Aa`
const users = [], donations = [], ngos = [], clients = {}, checks = []
const ok = (condition, name) => { assert.ok(condition, name); checks.push(name); console.log('PASS ' + name) }
function unwrap(result) { if (result.error) throw new Error(result.error.message); return result.data }
async function summary(client) { return unwrap(await client.rpc('get_dashboard_summary')) }
async function records(client, view, filters = {}) { return unwrap(await client.rpc('get_admin_records', { view_name: view, search_text: prefix, ...filters })) }
async function exactCount(table, filter) {
  let query = admin.from(table).select('id', { count: 'exact', head: true })
  if (filter) query = filter(query)
  const result = await query
  if (result.error) throw new Error(result.error.message)
  return result.count
}

try {
  for (const [key, role] of [['donor', 'DONOR'], ['otherDonor', 'DONOR'], ['ngo', 'NGO'], ['otherNgo', 'NGO'], ['volunteer', 'VOLUNTEER'], ['otherVolunteer', 'VOLUNTEER'], ['administrator', 'ADMIN']]) {
    // Public signup cannot select ADMIN. A trusted server provisions only this test admin.
    const email = `${prefix}-${key.toLowerCase()}@example.com`
    const authUser = unwrap(await admin.auth.admin.createUser({ email, password, email_confirm: true,
      user_metadata: { name: `${prefix} ${key}`, role: role === 'ADMIN' ? 'DONOR' : role } })).user
    users.push(authUser.id)
    if (role === 'ADMIN') unwrap(await admin.from('users').update({ role: 'ADMIN' }).eq('id', authUser.id))
    const client = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, options)
    unwrap(await client.auth.signInWithPassword({ email, password }))
    clients[key] = { client, id: authUser.id, role }
  }
  const donor = clients.donor.client, ngoClient = clients.ngo.client, volunteer = clients.volunteer.client, administrator = clients.administrator.client
  for (const key of ['ngo', 'otherNgo']) {
    const row = unwrap(await clients[key].client.from('ngos').insert({ user_id: clients[key].id,
      organization_name: `${prefix} ${key}`, location: prefix, capacity: 100,
      accepted_food_types: ['Cooked Food'], latitude: 31.5204, longitude: 74.3587 }).select().single())
    ngos.push(row.id)
  }
  ok((await summary(donor)).counts.total_donations === 0, 'empty donor summary')
  ok((await summary(ngoClient)).counts.suggested === 0, 'empty NGO summary')
  ok((await summary(volunteer)).counts.assigned === 0, 'empty volunteer assignment summary')
  const template = { food_type: 'Cooked Food', quantity: 10, meal_portions: 20, location: prefix,
    latitude: 31.5204, longitude: 74.3587, available_from: new Date(Date.now() + 3600000).toISOString(),
    collection_deadline: new Date(Date.now() + 86400000).toISOString(), safety_information: 'Temporary integration test only.' }
  const created = unwrap(await donor.from('donations').insert(Array.from({ length: 26 }, () => ({ ...template, donor_id: clients.donor.id }))).select())
  donations.push(...created.map((row) => row.id))
  const foreign = unwrap(await clients.otherDonor.client.from('donations').insert({ ...template, donor_id: clients.otherDonor.id }).select().single())
  donations.push(foreign.id)
  const target = created[0]
  ok((await summary(donor)).counts.total_donations === 26 && (await summary(donor)).counts.awaiting_acceptance === 26, 'donor aggregates exclude foreign donations')
  for (const key of ['donor', 'ngo', 'volunteer']) {
    const client = clients[key].client
    ok(Boolean((await client.rpc('get_admin_dashboard')).error), `${key} denied admin aggregates`)
    for (const view of ['users', 'donations', 'activity', 'ngos', 'volunteers']) {
      ok(Boolean((await client.rpc('get_admin_records', { view_name: view })).error), `${key} denied admin ${view}`)
    }
    const ownUsers = unwrap(await client.from('users').select('id'))
    ok(ownUsers.length === 1 && ownUsers[0].id === clients[key].id, `${key} user RLS isolation`)
    ok(unwrap(await client.from('activity_logs').select('id')).length === 0, `${key} audit RLS isolation`)
    ok(unwrap(await client.from('donations').select('id').eq('id', foreign.id)).length === 0, `${key} foreign donation hidden`)
  }
  const anon = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, options)
  ok(Boolean((await anon.rpc('get_admin_dashboard')).error) && Boolean((await anon.rpc('get_dashboard_summary')).error), 'anonymous RPC denial')
  const userList = await records(administrator, 'users', { role_filter: 'VOLUNTEER' })
  ok(userList.total === 2 && userList.rows.every((row) => row.role === 'VOLUNTEER'), 'admin user role and search filtering')
  ok((await records(administrator, 'ngos')).total === 2, 'admin NGO visibility')
  ok((await records(administrator, 'volunteers')).total === 2, 'admin volunteer visibility')
  const first = await records(administrator, 'donations'), second = await records(administrator, 'donations', { page_number: 2 })
  ok(first.total === 27 && first.rows.length === 20 && second.rows.length === 7,
    'donation pagination returns complete bounded pages')
  ok(new Set([...first.rows, ...second.rows].map((row) => row.id)).size === 27, 'pagination has no duplicate or missing rows')
  const today = new Date().toISOString().slice(0, 10)
  ok((await records(administrator, 'donations', { food_filter: 'Cooked Food', from_date: today, to_date: today })).total === 27, 'donation food and UTC date filtering')
  ok((await records(administrator, 'users', { search_text: prefix + '-not-present' })).total === 0, 'empty admin filter result')
  ok((await records(administrator, 'donations', { search_text: '%' })).total === 0, 'search wildcards treated literally')
  ok(Boolean((await administrator.rpc('get_admin_records', { view_name: 'users', page_number: 0 })).error), 'invalid pagination rejected')
  const foreignUpdate = await clients.otherDonor.client.from('donations').update({ quantity: 900 }).eq('id', target.id).select()
  ok(!foreignUpdate.error && foreignUpdate.data.length === 0, 'donor ownership preserved')
  const foreignNgo = await clients.otherNgo.client.from('ngos').update({ capacity: 0 }).eq('id', ngos[0]).select()
  ok(!foreignNgo.error && foreignNgo.data.length === 0, 'NGO ownership preserved')
  const rawAdmin = await administrator.from('donations').update({ status: 'MATCHED' }).eq('id', target.id).select()
  ok(!rawAdmin.error && rawAdmin.data.length === 0, 'admin raw donation transitions blocked')
  ok(Boolean((await donor.rpc('mark_pickup_collected', { target_task_id: crypto.randomUUID() })).error), 'workflow role guard preserved')
  const matches = unwrap(await donor.rpc('store_donation_matches', { target_donation_id: target.id,
    match_candidates: [{ ngo_id: ngos[0], matching_score: 97.5, distance_score: 100, urgency_score: 95, compatibility_score: 100, capacity_score: 95, availability_score: 95 }] }))
  ok((await summary(ngoClient)).counts.suggested === 1 && (await summary(clients.otherNgo.client)).counts.suggested === 0, 'NGO matching aggregates isolated')
  const rawMatch = await administrator.from('matches').update({ status: 'REJECTED' }).eq('id', matches[0].id).select()
  ok(!rawMatch.error && rawMatch.data.length === 0, 'admin raw match edits blocked')
  ok((await records(administrator, 'donations', { status_filter: 'MATCHED' })).total === 1, 'donation status filtering')
  const pendingQuery = await ngoClient.from('matches').select('*, donation:donations!inner(*)').eq('ngo_id', ngos[0])
    .in('status', ['SUGGESTED', 'VIEWED']).eq('donation.status', 'MATCHED')
    .order('donation(collection_deadline)', { ascending: true }).limit(5)
  ok(unwrap(pendingQuery).length === 1, 'NGO dashboard bounded deadline query')
  unwrap(await ngoClient.rpc('respond_to_donation_match', { target_match_id: matches[0].id, decision: 'ACCEPT' }))
  const task = unwrap(await admin.from('pickup_tasks').select('*').eq('donation_id', target.id).single())
  ok((await summary(ngoClient)).counts.awaiting_pickup === 1 && (await summary(donor)).counts.awaiting_pickup === 1, 'accepted donation dashboard counts')
  const availableQuery = await volunteer.from('pickup_tasks').select('*, donation:donations!inner(*)').eq('status', 'AVAILABLE')
    .eq('donation.status', 'ACCEPTED').order('donation(collection_deadline)', { ascending: true }).limit(5)
  ok(unwrap(availableQuery).some((row) => row.id === task.id), 'volunteer available deadline query')
  unwrap(await volunteer.rpc('claim_pickup_task', { target_task_id: task.id }))
  ok((await summary(volunteer)).counts.assigned === 1 && (await summary(clients.otherVolunteer.client)).counts.assigned === 0, 'volunteer assignment aggregates isolated')
  const foreignTask = await clients.otherVolunteer.client.from('pickup_tasks').update({ notes: 'foreign' }).eq('id', task.id).select()
  ok(!foreignTask.error && foreignTask.data.length === 0, 'volunteer ownership preserved')
  ok(Boolean((await clients.otherVolunteer.client.rpc('mark_pickup_collected', { target_task_id: task.id })).error), 'unauthorized collection blocked')
  const rawTask = await administrator.from('pickup_tasks').update({ notes: 'admin edit' }).eq('id', task.id).select()
  ok(!rawTask.error && rawTask.data.length === 0, 'admin raw pickup edits blocked')
  unwrap(await volunteer.rpc('mark_pickup_collected', { target_task_id: task.id }))
  ok((await summary(volunteer)).counts.collected === 1 && (await summary(ngoClient)).counts.collected === 1, 'collection dashboard counts')
  unwrap(await volunteer.rpc('mark_pickup_delivered', { target_task_id: task.id }))
  ok((await summary(ngoClient)).counts.awaiting_confirmation === 1, 'NGO confirmation count')
  const deliveries = await ngoClient.from('matches').select('*, donation:donations!inner(*)').eq('ngo_id', ngos[0])
    .eq('status', 'ACCEPTED').in('donation.status', ['DELIVERED', 'COMPLETED']).order('donation(updated_at)', { ascending: false }).limit(5)
  ok(unwrap(deliveries).length === 1, 'NGO recent deliveries query')
  unwrap(await ngoClient.rpc('confirm_donation_receipt', { target_donation_id: target.id }))
  ok((await summary(donor)).counts.completed === 1 && (await summary(ngoClient)).counts.completed === 1 && (await summary(volunteer)).counts.completed === 1, 'completed rescue counts across roles')
  unwrap(await donor.rpc('cancel_my_donation', { target_donation_id: created[1].id }))
  ok((await summary(donor)).counts.closed === 1, 'cancelled donor count')
  const platform = unwrap(await administrator.rpc('get_admin_dashboard'))
  ok(platform.role === 'ADMIN' && platform.counts.total_users === await exactCount('users') && platform.counts.total_donations === await exactCount('donations'), 'admin aggregates equal direct database counts')
  ok(platform.counts.completed === await exactCount('donations', (q) => q.eq('status', 'COMPLETED')), 'admin completion aggregate correctness')
  ok(platform.counts.closed === await exactCount('donations', (q) => q.in('status', ['CANCELLED', 'EXPIRED']))
    && platform.counts.active === await exactCount('donations', (q) => q.in('status', ['POSTED', 'MATCHED', 'ACCEPTED', 'PICKUP_ASSIGNED', 'COLLECTED', 'DELIVERED'])), 'admin active and closed aggregate correctness')
  ok(platform.counts.donors === await exactCount('users', (q) => q.eq('role', 'DONOR'))
    && platform.counts.ngo_users === await exactCount('users', (q) => q.eq('role', 'NGO'))
    && platform.counts.volunteers === await exactCount('users', (q) => q.eq('role', 'VOLUNTEER')), 'admin role aggregate correctness')
  ok(Object.values(platform.statuses).reduce((sum, count) => sum + count, 0) === platform.counts.total_donations, 'workflow counts cover every persisted status')
  ok((await records(administrator, 'activity', { action_filter: 'DONATION_CREATED', entity_filter: 'DONATION', from_date: today, to_date: today })).total === 27, 'audit action entity and date filtering')
  ok((await records(administrator, 'activity', { action_filter: 'MATCH_CREATED' })).total === 1, 'matching audit event recorded')
  ok((await records(administrator, 'volunteers')).rows.find((row) => row.id === clients.volunteer.id).delivered_count === 1, 'volunteer oversight activity counts')
  ok(unwrap(await administrator.from('activity_logs').select('id').eq('entity_id', target.id)).length > 0, 'admin direct audit RLS access')
  const fresh = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, options)
  unwrap(await fresh.auth.signInWithPassword({ email: `${prefix}-donor@example.com`, password }))
  ok((await summary(fresh)).counts.completed === 1, 'dashboard counts persist after sign-in refresh')
  console.log(`Completed ${checks.length} live Phase 11 checks.`)
} finally {
  // Delete only IDs created in this run, including audit entries for match/task IDs.
  const entityIds = [...donations, ...ngos]
  if (donations.length) {
    for (const table of ['matches', 'pickup_tasks']) {
      const rows = unwrap(await admin.from(table).select('id').in('donation_id', donations))
      entityIds.push(...rows.map((row) => row.id))
    }
  }
  if (entityIds.length) unwrap(await admin.from('activity_logs').delete().in('entity_id', entityIds))
  if (users.length) {
    unwrap(await admin.from('activity_logs').delete().in('user_id', users))
    unwrap(await admin.from('notifications').delete().in('user_id', users))
  }
  if (donations.length) {
    unwrap(await admin.from('pickup_tasks').delete().in('donation_id', donations))
    unwrap(await admin.from('matches').delete().in('donation_id', donations))
    unwrap(await admin.from('donations').delete().in('id', donations))
  }
  if (ngos.length) unwrap(await admin.from('ngos').delete().in('id', ngos))
  for (const id of users) unwrap(await admin.auth.admin.deleteUser(id))
  console.log('Temporary Phase 11 records cleaned.')
}
