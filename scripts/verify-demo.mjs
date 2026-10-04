// Read-only verification of the synthetic live demonstration dataset.
import fs from 'node:fs'
import assert from 'node:assert/strict'
import { createClient } from '@supabase/supabase-js'

const env = Object.fromEntries(fs.readFileSync('.env', 'utf8').split(/\r?\n/)
  .filter((line) => line.includes('=') && !line.startsWith('#'))
  .map((line) => { const at = line.indexOf('='); return [line.slice(0, at).trim(), line.slice(at + 1).trim().replace(/^['"]|['"]$/g, '')] }))
const state = JSON.parse(fs.readFileSync('.demo-seed-state.json.local', 'utf8'))
assert.equal(new URL(env.VITE_SUPABASE_URL).hostname, 'yqzuddkeycrvkzqcchmv.supabase.co')
const options = { auth: { persistSession: false, autoRefreshToken: false } }
const service = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SECRET_KEY, options)
const anon = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, options)
function ok(result, label) { if (result.error) throw new Error(`${label}: ${result.error.message}`); return result.data }
async function login(key) {
  const c = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, options)
  const user = state.users[key]
  ok(await c.auth.signInWithPassword({ email: user.email, password: user.password }), `Sign in ${key}`)
  return c
}
const ids = Object.values(state.donations).map((row) => row.id)
assert.equal(ids.length, 63)
assert.ok(Object.values(state.donations).every((row) => row.done), 'Incomplete seed manifest')
const rows = {}
for (const table of ['users', 'ngos', 'donations', 'matches', 'pickup_tasks', 'notifications', 'activity_logs']) {
  rows[table] = []
  for (let from = 0; ; from += 1000) {
    const page = ok(await service.from(table).select('*').order('id').range(from, from + 999), `Read ${table}`)
    rows[table].push(...page)
    if (page.length < 1000) break
  }
  console.log(`${table}: ${rows[table].length}`)
}
const donations = rows.donations.filter((d) => ids.includes(d.id))
assert.equal(donations.length, 63)
const users = new Set(rows.users.map((u) => u.id))
const ngos = new Map(rows.ngos.map((n) => [n.id, n]))
const allMatches = rows.matches.filter((m) => ids.includes(m.donation_id))
const allTasks = rows.pickup_tasks.filter((p) => ids.includes(p.donation_id))
const allNotifications = rows.notifications.filter((n) => n.entity_id && [...ids, ...allMatches.map((m) => m.id), ...allTasks.map((p) => p.id)].includes(n.entity_id))
const allLogs = rows.activity_logs.filter((l) => [...ids, ...allMatches.map((m) => m.id), ...allTasks.map((p) => p.id)].includes(l.entity_id))
assert.equal(new Set(rows.notifications.map((n) => n.event_key).filter(Boolean)).size, rows.notifications.filter((n) => n.event_key).length)
for (const d of donations) {
  assert.ok(users.has(d.donor_id))
  assert.ok(d.description.includes('DEMO/SYNTHETIC'))
  assert.ok(Number.isFinite(Number(d.latitude)) && Number.isFinite(Number(d.longitude)))
  assert.ok(new Date(d.collection_deadline) > new Date(d.available_from))
  const matches = allMatches.filter((m) => m.donation_id === d.id)
  assert.ok(matches.every((m) => ngos.has(m.ngo_id)))
  const tasks = allTasks.filter((p) => p.donation_id === d.id)
  if (d.status === 'COMPLETED') {
    assert.equal(matches.filter((m) => m.status === 'ACCEPTED').length, 1)
    assert.equal(tasks.length, 1)
    assert.equal(tasks[0].status, 'DELIVERED')
    assert.ok(tasks[0].volunteer_id && users.has(tasks[0].volunteer_id))
    assert.ok(new Date(d.created_at) < new Date(tasks[0].pickup_time))
    assert.ok(new Date(tasks[0].pickup_time) <= new Date(tasks[0].collected_at))
    assert.ok(new Date(tasks[0].collected_at) <= new Date(tasks[0].delivered_at))
    assert.ok(new Date(tasks[0].delivered_at) <= new Date(d.completed_at))
    assert.ok(allNotifications.some((n) => n.entity_id === d.id && n.type === 'DONATION_COMPLETED'))
    assert.ok(allLogs.some((l) => l.entity_id === d.id && l.action === 'DONATION_COMPLETED'))
  }
  if (d.status === 'EXPIRED') {
    assert.ok(new Date(d.collection_deadline) < new Date())
    const expiryNotice = allNotifications.find((n) => n.entity_id === d.id && n.type === 'DONATION_EXPIRED')
    assert.ok(expiryNotice && new Date(expiryNotice.created_at) > new Date(d.collection_deadline))
  }
  if (d.status === 'CANCELLED') assert.ok(new Date(d.created_at) < new Date())
}
assert.ok(new Set(allMatches.map((m) => m.matching_score)).size >= 8, 'Matching scores need useful variety')
assert.ok(new Set(donations.map((d) => d.created_at.slice(0, 7))).size >= 3, 'Need historical months')
assert.ok(allNotifications.length >= 100 && allLogs.length >= 100)
assert.equal(new Set(donations.map((d) => d.donor_id)).size, 8, 'All demo donors should participate')
assert.equal(new Set(allMatches.map((m) => m.ngo_id)).size, 10, 'All demo NGOs should receive candidate matches')
for (const ngoId of Object.values(state.ngos)) assert.ok(allMatches.some((m) => m.ngo_id === ngoId
  && (m.status === 'ACCEPTED' || ['SUGGESTED', 'VIEWED'].includes(m.status)
    && donations.some((d) => d.id === m.donation_id && d.status === 'MATCHED'))), 'NGO dashboard should be populated')
assert.equal(new Set(allTasks.map((t) => t.volunteer_id).filter(Boolean)).size, 5, 'All demo volunteers should participate')
assert.ok(rows.ngos.every((ngo) => Number.isFinite(Number(ngo.latitude)) && Number.isFinite(Number(ngo.longitude))))
console.log('Demo statuses:', Object.fromEntries([...new Set(donations.map((d) => d.status))].map((s) => [s, donations.filter((d) => d.status === s).length])))
console.log('Demo relationships:', { matches: allMatches.length, tasks: allTasks.length, notifications: allNotifications.length, logs: allLogs.length })
console.log('Match score range:', Math.min(...allMatches.map((m) => m.matching_score)), Math.max(...allMatches.map((m) => m.matching_score)))
console.log('NGO match coverage:', Object.entries(state.ngos).map(([key, id]) => ({ key,
  accepted: allMatches.filter((m) => m.ngo_id === id && m.status === 'ACCEPTED').length,
  pending: allMatches.filter((m) => m.ngo_id === id && ['SUGGESTED', 'VIEWED'].includes(m.status)).length,
})))

const donor = await login('donor0')
const ngo = await login('ngo0')
const volunteer = await login('volunteer0')
const admin = await login('admin')
for (const [role, c] of [['DONOR', donor], ['NGO', ngo], ['VOLUNTEER', volunteer], ['ADMIN', admin]]) {
  const dashboard = ok(await c.rpc('get_dashboard_summary'), `${role} dashboard`)
  assert.equal(dashboard.role, role)
  assert.ok(dashboard.counts)
  const impact = ok(await c.rpc('get_my_impact'), `${role} impact`)
  assert.equal(impact.role, role)
  assert.ok(Array.isArray(impact.trends))
  assert.ok(Object.values(dashboard.counts).some((value) => Number(value) > 0), `${role} dashboard is empty`)
  console.log(`${role} dashboard and impact: OK`, dashboard.counts)
}
const adminDashboard = ok(await admin.rpc('get_admin_dashboard'), 'Admin dashboard')
assert.ok(adminDashboard.counts.total_donations >= 63)
const platformImpact = ok(await admin.rpc('get_platform_impact'), 'Platform impact')
assert.ok(platformImpact.donations.completed >= 36)
assert.ok(platformImpact.impact.portions > 0)
assert.ok(platformImpact.trends.filter((bucket) => bucket.posted > 0).length >= 3)
assert.ok((await donor.rpc('get_admin_dashboard')).error, 'Donor must not access admin RPC')
const anonymousRead = await anon.from('donations').select('id')
assert.ok(anonymousRead.error || anonymousRead.data?.length === 0, 'Anonymous donations access must be denied')
const otherDonation = donations.find((d) => d.donor_id !== state.users.donor0.id)
assert.equal(ok(await donor.from('donations').select('id').eq('id', otherDonation.id), 'Donor RLS').length, 0)
assert.equal(ok(await donor.from('notifications').select('id').eq('user_id', state.users.donor1.id), 'Notification RLS').length, 0)
console.log('Admin analytics, cross-user RLS and anonymous access: OK')
