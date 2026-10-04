// Synthetic university demonstration data. Run only against the intended Supabase project.
// Credentials and the resumable manifest stay in ignored local files.
import fs from 'node:fs'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { createServer } from 'vite'

const stateFile = '.demo-seed-state.json.local'
const env = Object.fromEntries(fs.readFileSync('.env', 'utf8').split(/\r?\n/)
  .filter((line) => line.includes('=') && !line.startsWith('#'))
  .map((line) => { const at = line.indexOf('='); return [line.slice(0, at).trim(), line.slice(at + 1).trim().replace(/^['"]|['"]$/g, '')] }))
assert.equal(new URL(env.VITE_SUPABASE_URL).hostname, 'yqzuddkeycrvkzqcchmv.supabase.co', 'Unexpected Supabase project')
assert.ok(env.VITE_SUPABASE_ANON_KEY && env.SUPABASE_SECRET_KEY, 'Missing Supabase keys in ignored .env')
const options = { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: (url, init) => fetch(url, { ...init, signal: AbortSignal.timeout(45000) }) } }
const admin = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SECRET_KEY, options)
const client = () => createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, options)
function ok(result, context) { if (result.error) throw new Error(`${context}: ${result.error.message}`); return result.data }
const state = fs.existsSync(stateFile) ? JSON.parse(fs.readFileSync(stateFile, 'utf8')) : {
  version: 1, started_at: new Date().toISOString(), users: {}, ngos: {}, donations: {},
}
function save() { fs.writeFileSync(stateFile, JSON.stringify(state, null, 2), { mode: 0o600 }) }
save()

// OSM Nominatim feature centroids (public landmarks, not private addresses).
const places = [
  ['Liberty Market', 31.5103226, 74.3447061, 'way/905333178'],
  ['Lahore Museum', 31.5682508, 74.3082276, 'way/792447292'],
  ['Badshahi Mosque', 31.5881260, 74.3093528, 'relation/12271286'],
  ['Minar-e-Pakistan', 31.5925559, 74.3094848, 'way/232401426'],
  ['Lahore Cantt Railway Station', 31.5305468, 74.3611247, 'node/2433364441'],
  ['Model Town Park', 31.4844876, 74.3262296, 'way/173961470'],
  ['Jilani Park', 31.5438807, 74.3365616, 'way/246128683'],
  ['Gaddafi Stadium', 31.5133615, 74.3334644, 'way/172700971'],
  ['Shalimar Gardens', 31.5871289, 74.3821585, 'way/232344024'],
  ['Punjab University', 31.4886984, 74.2926335, 'way/380521517'],
]
const categories = ['Cooked Food', 'Bakery', 'Fruits', 'Vegetables', 'Packaged Food', 'Rice', 'Bread', 'Dairy', 'Groceries']
const foodNames = ['cooked meal trays', 'bakery parcels', 'fruit crates', 'vegetable bundles', 'packaged meal kits', 'rice portions', 'bread packs', 'dairy cartons', 'grocery parcels']
const donorNames = ['Demo Donor Ahsan', 'Demo Donor Hira', 'Demo Donor Bilal', 'Demo Donor Sana', 'Demo Donor Omar', 'Demo Donor Maham', 'Demo Donor Farhan', 'Demo Donor Zara']
const volunteerNames = ['Demo Volunteer Ali', 'Demo Volunteer Ayesha', 'Demo Volunteer Hamza', 'Demo Volunteer Mariam', 'Demo Volunteer Raza']
const ngoNames = ['DEMO Liberty Community Pantry', 'DEMO Museum District Food Circle', 'DEMO Walled City Relief Kitchen', 'DEMO Iqbal Park Food Network', 'DEMO Station Neighbourhood Pantry', 'DEMO Model Town Food Share', 'DEMO Jilani Community Kitchen', 'DEMO Stadium Area Food Share', 'DEMO Shalimar Community Pantry', 'DEMO Campus Food Circle']
const accounts = [
  ...donorNames.map((name, i) => [`donor${i}`, 'DONOR', name]),
  ...ngoNames.map((_, i) => [`ngo${i}`, 'NGO', `Demo NGO Representative ${i + 1}`]),
  ...volunteerNames.map((name, i) => [`volunteer${i}`, 'VOLUNTEER', name]),
  ['admin', 'ADMIN', 'Demo Platform Administrator'],
]
const base = Date.parse(state.started_at)
assert.ok(Number.isFinite(base), 'Invalid seed start time in local manifest')
const date = (ms) => new Date(ms).toISOString()
const day = 86400000
const timeline = (i, historical) => {
  const start = historical ? (i >= 58 ? base - (8 + (i % 3) * 4) * day
    : base - (115 - i * 2.25) * day + (i % 7) * 3600000) : base - (i % 3) * day
  return {
    posted: date(start), matched: date(start + 22 * 60000), accepted: date(start + 48 * 60000),
    assigned: date(start + 70 * 60000), collected: date(start + 120 * 60000),
    delivered: date(start + 165 * 60000), completed: date(start + 195 * 60000),
    deadline: date(historical ? start + 5 * 3600000 : base + (2 + i % 3) * day),
  }
}
const stages = [
  ...Array(36).fill('COMPLETED'), ...Array(5).fill('DELIVERED'),
  ...Array(4).fill('COLLECTED'), ...Array(4).fill('PICKUP_ASSIGNED'),
  ...Array(4).fill('ACCEPTED'), ...Array(3).fill('MATCHED'),
  ...Array(2).fill('POSTED'), 'CANCELLED', 'EXPIRED',
]
assert.equal(stages.length, 60)

async function login(accountKey) {
  const record = state.users[accountKey]
  const c = client()
  ok(await c.auth.signInWithPassword({ email: record.email, password: record.password }), `Sign in ${accountKey}`)
  return c
}
async function ensureAccounts() {
  const existing = ok(await admin.auth.admin.listUsers({ perPage: 1000 }), 'List auth users').users
  for (const [key, role, name] of accounts) {
    if (state.users[key]) continue
    const email = `rescuebite-demo-${key}@example.com`
    assert.ok(!existing.some((user) => user.email === email), `Demo auth account ${email} exists without local manifest; preserve it and resolve manually`)
    const password = `Demo-${crypto.randomBytes(24).toString('base64url')}!A1`
    const user = ok(await admin.auth.admin.createUser({ email, password, email_confirm: true,
      user_metadata: { name, role: role === 'ADMIN' ? 'DONOR' : role, demo_synthetic: true } }), `Create ${key}`).user
    state.users[key] = { id: user.id, email, password, role }; save()
    if (role === 'ADMIN') ok(await admin.from('users').update({ role }).eq('id', user.id), 'Grant demo admin role')
    console.log(`Account ${key} created`)
  }
}
async function ensureNgos() {
  for (let i = 0; i < ngoNames.length; i++) {
    const key = `ngo${i}`
    if (state.ngos[key]) continue
    const c = await login(key)
    const p = places[i]
    const foodTypes = i % 3 === 0 ? ['All'] : categories.filter((_, j) => (j + i) % 3 !== 0)
    const row = ok(await c.from('ngos').insert({ user_id: state.users[key].id,
      organization_name: ngoNames[i], description: 'SYNTHETIC DEMO organization near a public Lahore landmark; no real organization affiliation or food service.',
      location: `Demo service area near ${p[0]}, Lahore`, latitude: p[1], longitude: p[2],
      capacity: 80 + 15 * i, accepted_food_types: foodTypes,
      contact_information: `Synthetic demonstration profile: rescuebite-demo-${key}@example.com`,
    }).select().single(), `Create NGO ${key}`)
    state.ngos[key] = row.id; save()
    console.log(`NGO ${key} created`)
  }
}
async function backdate(i, stage, donationId, matchIds, taskId) {
  const t = timeline(i, true)
  const deadline = stage === 'COMPLETED' || stage === 'CANCELLED' || stage === 'EXPIRED' ? t.deadline : date(base + (2 + i % 3) * day)
  const dPatch = { created_at: t.posted, available_from: t.posted, collection_deadline: deadline }
  if (stage === 'COMPLETED') dPatch.completed_at = t.completed
  ok(await admin.from('donations').update(dPatch).eq('id', donationId), `Backdate donation ${i}`)
  if (matchIds.length) ok(await admin.from('matches').update({ created_at: t.matched }).in('id', matchIds), `Backdate matches ${i}`)
  if (taskId) {
    const patch = { created_at: t.accepted }
    if (['PICKUP_ASSIGNED', 'COLLECTED', 'DELIVERED', 'COMPLETED'].includes(stage)) patch.pickup_time = t.assigned
    if (['COLLECTED', 'DELIVERED', 'COMPLETED'].includes(stage)) patch.collected_at = t.collected
    if (['DELIVERED', 'COMPLETED'].includes(stage)) patch.delivered_at = t.delivered
    ok(await admin.from('pickup_tasks').update(patch).eq('id', taskId), `Backdate pickup ${i}`)
  }
  const ids = [donationId, ...matchIds, ...(taskId ? [taskId] : [])]
  const notifications = ok(await admin.from('notifications').select('id,type,entity_id').in('entity_id', ids), `Read notifications ${i}`)
  const expiryAt = date(new Date(t.deadline).getTime() + 10 * 60000)
  const eventTimes = { DONATION_CREATED: t.posted, MATCH_FOUND: t.matched, DONATION_ACCEPTED: t.accepted,
    PICKUP_AVAILABLE: t.accepted, PICKUP_ASSIGNED: t.assigned, FOOD_COLLECTED: t.collected,
    FOOD_DELIVERED: t.delivered, RECEIPT_CONFIRMED: t.completed, DONATION_COMPLETED: t.completed,
    DONATION_CANCELLED: t.matched, DONATION_EXPIRED: expiryAt, DONATION_REJECTED: t.matched }
  for (let at = 0; at < notifications.length; at += 4) {
    await Promise.all(notifications.slice(at, at + 4).map(async (n) => ok(await admin.from('notifications')
      .update({ created_at: eventTimes[n.type] || t.matched }).eq('id', n.id), `Backdate notification ${i}`)))
  }
  const logs = ok(await admin.from('activity_logs').select('id,action,entity_id').in('entity_id', ids), `Read logs ${i}`)
  for (let at = 0; at < logs.length; at += 4) await Promise.all(logs.slice(at, at + 4).map(async (log) => {
    const action = log.action
    const eventAt = action.includes('EXPIRED') ? expiryAt
      : action.includes('COMPLETED') || action.includes('CONFIRMED') ? t.completed
      : action.includes('DELIVERED') ? t.delivered : action.includes('COLLECTED') ? t.collected
        : action.includes('CLAIMED') || action.includes('ASSIGNED') ? t.assigned
          : action.includes('ACCEPTED') || action.includes('TASK_CREATED') ? t.accepted
            : action.includes('MATCH') || action.includes('DECLINED') ? t.matched : t.posted
    ok(await admin.from('activity_logs').update({ created_at: eventAt }).eq('id', log.id), `Backdate log ${i}`)
  }))
}
async function main() {
  for (const table of ['users', 'ngos', 'donations', 'matches', 'pickup_tasks', 'notifications', 'activity_logs']) {
    const { count, error } = await admin.from(table).select('id', { count: 'exact', head: true })
    if (error) throw new Error(`Schema preflight ${table}: ${error.message}`)
    console.log(`Before ${table}: ${count}`)
  }
  await ensureAccounts(); await ensureNgos()
  const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom' })
  try {
    const { rankEligibleNgos } = await vite.ssrLoadModule('/src/services/matching/matching.utils.ts')
    const sessions = {}
    for (let i = 0; i < stages.length; i++) {
      const stage = stages[i], key = String(i).padStart(2, '0')
      if (state.donations[key]?.done) continue
      const donorKey = `donor${i % donorNames.length}`
      const donor = sessions[donorKey] ||= await login(donorKey)
      const p = places[(i * 7) % places.length]
      const category = categories[i % categories.length]
      const portions = 12 + (i % 8) * 6
      const t = timeline(i, stage === 'COMPLETED')
      let rec = state.donations[key]
      if (rec?.volKey && !sessions[rec.volKey]) sessions[rec.volKey] = await login(rec.volKey)
      if (!rec) {
        const row = ok(await donor.from('donations').insert({ donor_id: state.users[donorKey].id,
          food_type: category, quantity: 5 + (i % 10) * 2.5, meal_portions: portions,
          location: `Demo pickup near ${p[0]}, Lahore`, latitude: p[1], longitude: p[2],
          available_from: date(base - 3600000), collection_deadline: date(base + (2 + i % 3) * day),
          safety_information: 'SYNTHETIC DEMO RECORD. No actual food is offered. In a real rescue, verify packaging, temperature, allergens, and safe collection.',
          description: `DEMO/SYNTHETIC #${key}: ${foodNames[i % foodNames.length]}; illustrative food rescue scenario only.`,
        }).select().single(), `Create donation ${i}`)
        rec = state.donations[key] = { id: row.id, step: 'created' }; save()
      }
      if (stage !== 'POSTED' && stage !== 'CANCELLED' && stage !== 'EXPIRED' && rec.step === 'created') {
        const donation = ok(await admin.from('donations').select('*').eq('id', rec.id).single(), `Read donation ${i}`)
        const candidates = ok(await donor.rpc('get_matching_ngos', { target_donation_id: rec.id }), `Eligible NGOs ${i}`)
        const ranked = rankEligibleNgos(donation, candidates).slice(0, 3)
        assert.ok(ranked.length >= 2, `Need multiple NGO candidates for donation ${i}`)
        const payload = ranked.map((m) => ({ ngo_id: m.ngoId, matching_score: m.matchingScore,
          distance_score: m.distanceScore, urgency_score: m.urgencyScore,
          compatibility_score: m.compatibilityScore, capacity_score: m.capacityScore,
          availability_score: m.availabilityScore }))
        const matches = ok(await donor.rpc('store_donation_matches', { target_donation_id: rec.id, match_candidates: payload }), `Match donation ${i}`)
        rec.matchIds = matches.map((m) => m.id); rec.primaryNgoId = matches[0].ngo_id; rec.step = 'matched'; save()
      }
      if (stage === 'MATCHED' && rec.step === 'matched') {
        const second = ok(await admin.from('matches').select('id,ngo_id').eq('donation_id', rec.id).order('matching_score', { ascending: false }), `Read matches ${i}`)[1]
        const ngoKey = Object.keys(state.ngos).find((k) => state.ngos[k] === second.ngo_id)
        const ngo = sessions[ngoKey] ||= await login(ngoKey)
        ok(await ngo.rpc('respond_to_donation_match', { target_match_id: second.id, decision: 'DECLINE' }), `Decline ${i}`)
        rec.step = 'declined'; save()
      }
      if (!['POSTED', 'MATCHED', 'CANCELLED', 'EXPIRED'].includes(stage) && rec.step === 'matched') {
        const ngoKey = Object.keys(state.ngos).find((k) => state.ngos[k] === rec.primaryNgoId)
        const ngo = sessions[ngoKey] ||= await login(ngoKey)
        const match = ok(await admin.from('matches').select('id').eq('donation_id', rec.id).eq('ngo_id', rec.primaryNgoId).single(), `Primary match ${i}`)
        ok(await ngo.rpc('respond_to_donation_match', { target_match_id: match.id, decision: 'ACCEPT' }), `Accept ${i}`)
        rec.taskId = ok(await admin.from('pickup_tasks').select('id').eq('donation_id', rec.id).single(), `Pickup ${i}`).id
        rec.step = 'accepted'; save()
      }
      if (['PICKUP_ASSIGNED', 'COLLECTED', 'DELIVERED', 'COMPLETED'].includes(stage) && rec.step === 'accepted') {
        const volKey = `volunteer${i % volunteerNames.length}`
        const volunteer = sessions[volKey] ||= await login(volKey)
        ok(await volunteer.rpc('claim_pickup_task', { target_task_id: rec.taskId }), `Claim ${i}`)
        rec.volKey = volKey; rec.step = 'assigned'; save()
      }
      if (['COLLECTED', 'DELIVERED', 'COMPLETED'].includes(stage) && rec.step === 'assigned') {
        ok(await sessions[rec.volKey].rpc('mark_pickup_collected', { target_task_id: rec.taskId }), `Collect ${i}`)
        rec.step = 'collected'; save()
      }
      if (['DELIVERED', 'COMPLETED'].includes(stage) && rec.step === 'collected') {
        ok(await sessions[rec.volKey].rpc('mark_pickup_delivered', { target_task_id: rec.taskId }), `Deliver ${i}`)
        rec.step = 'delivered'; save()
      }
      if (stage === 'COMPLETED' && rec.step === 'delivered') {
        const ngoKey = Object.keys(state.ngos).find((k) => state.ngos[k] === rec.primaryNgoId)
        const ngo = sessions[ngoKey] ||= await login(ngoKey)
        ok(await ngo.rpc('confirm_donation_receipt', { target_donation_id: rec.id }), `Confirm ${i}`)
        rec.step = 'completed'; save()
      }
      if (stage === 'CANCELLED' && rec.step === 'created') {
        ok(await donor.rpc('cancel_my_donation', { target_donation_id: rec.id }), `Cancel ${i}`)
        rec.step = 'cancelled'; save()
      }
      if (stage === 'EXPIRED' && rec.step === 'created') {
        // Scoped service update avoids the global expiry RPC touching unrelated production donations.
        ok(await admin.from('donations').update({ status: 'EXPIRED' }).eq('id', rec.id).eq('status', 'POSTED'), `Expire demo donation ${i}`)
        rec.step = 'expired'; save()
      }
      if (!rec.backdated && ['COMPLETED', 'CANCELLED', 'EXPIRED'].includes(stage)) {
        await backdate(i, stage, rec.id, rec.matchIds || [], rec.taskId)
        rec.backdated = true; save()
      }
      rec.done = true; save()
      console.log(`Donation ${key}/59 ${stage} complete`)
    }
    // Keep three otherwise empty NGO dashboards actionable with genuine scored matches.
    for (const ngoIndex of [0, 3, 9]) {
      const key = `ngo-followup-${ngoIndex}`
      if (state.donations[key]?.done) continue
      const donorKey = `donor${ngoIndex % donorNames.length}`
      const donor = sessions[donorKey] ||= await login(donorKey)
      const p = places[ngoIndex]
      let rec = state.donations[key]
      if (!rec) {
        const row = ok(await donor.from('donations').insert({ donor_id: state.users[donorKey].id,
          food_type: 'Cooked Food', quantity: 12, meal_portions: 24,
          location: `Demo pickup near ${p[0]}, Lahore`, latitude: p[1], longitude: p[2],
          available_from: date(base - 3600000), collection_deadline: date(base + 3 * day),
          safety_information: 'SYNTHETIC DEMO RECORD. No actual food is offered. Verify safety and allergens for real rescues.',
          description: `DEMO/SYNTHETIC follow-up for ${ngoNames[ngoIndex]}; illustrative only.`,
        }).select().single(), `Create NGO follow-up ${ngoIndex}`)
        rec = state.donations[key] = { id: row.id, step: 'created' }; save()
      }
      if (rec.step === 'created') {
        const donation = ok(await admin.from('donations').select('*').eq('id', rec.id).single(), `Read follow-up ${ngoIndex}`)
        const candidates = ok(await donor.rpc('get_matching_ngos', { target_donation_id: rec.id }), `Follow-up NGOs ${ngoIndex}`)
        const ranked = rankEligibleNgos(donation, candidates)
        const target = ranked.find((m) => m.ngoId === state.ngos[`ngo${ngoIndex}`])
        assert.ok(target, `Target NGO ${ngoIndex} must be eligible`)
        const selected = [...ranked.slice(0, 2).filter((m) => m.ngoId !== target.ngoId), target]
        const payload = selected.map((m) => ({ ngo_id: m.ngoId, matching_score: m.matchingScore,
          distance_score: m.distanceScore, urgency_score: m.urgencyScore,
          compatibility_score: m.compatibilityScore, capacity_score: m.capacityScore,
          availability_score: m.availabilityScore }))
        const matches = ok(await donor.rpc('store_donation_matches', { target_donation_id: rec.id,
          match_candidates: payload }), `Match NGO follow-up ${ngoIndex}`)
        rec.matchIds = matches.map((m) => m.id); rec.step = 'matched'; save()
      }
      rec.done = true; save()
      console.log(`Actionable NGO follow-up ${ngoIndex} complete`)
    }
    // Two additional supported demonstration states, scoped strictly to owned seed IDs.
    const viewedId = state.donations['54'].id
    const viewedMatches = ok(await admin.from('matches').select('id,status').eq('donation_id', viewedId), 'Find demo viewed match')
    if (!viewedMatches.some((match) => match.status === 'VIEWED')) {
      const viewedMatch = viewedMatches.find((match) => match.status === 'SUGGESTED')
      assert.ok(viewedMatch)
      ok(await admin.from('matches').update({ status: 'VIEWED' }).eq('id', viewedMatch.id), 'Mark scoped demo match viewed')
    }
    const exceptionId = state.donations['55'].id
    const exception = ok(await admin.from('donations').select('status').eq('id', exceptionId).single(), 'Read demo exception')
    if (exception.status === 'MATCHED') {
      ok(await admin.from('donations').update({ status: 'EXCEPTION' }).eq('id', exceptionId), 'Mark scoped demo exception')
      ok(await admin.from('matches').update({ status: 'EXPIRED' }).eq('donation_id', exceptionId)
        .in('status', ['SUGGESTED', 'VIEWED']), 'Close exception matches')
    } else assert.equal(exception.status, 'EXCEPTION')
    // Nominatim's station feature is Lahore Cantt, not the central station.
    if (!state.station_corrected) {
      const correctedStation = 'Demo service area near Lahore Cantt Railway Station, Lahore'
      ok(await admin.from('ngos').update({ location: correctedStation }).eq('id', state.ngos.ngo4), 'Correct demo station NGO label')
      const seededIds = Object.values(state.donations).map((record) => record.id)
      const oldPickup = 'Demo pickup near Lahore Railway Station, Lahore'
      const newPickup = 'Demo pickup near Lahore Cantt Railway Station, Lahore'
      ok(await admin.from('donations').update({ location: newPickup }).in('id', seededIds)
        .eq('location', oldPickup), 'Correct demo station pickup label')
      ok(await admin.from('pickup_tasks').update({ pickup_location: newPickup }).in('donation_id', seededIds)
        .eq('pickup_location', oldPickup), 'Correct task pickup label')
      ok(await admin.from('pickup_tasks').update({ delivery_location: correctedStation }).in('donation_id', seededIds)
        .eq('delivery_location', 'Demo service area near Lahore Railway Station, Lahore'), 'Correct task delivery label')
      state.station_corrected = true; save()
    }
    if (!state.special_backdated) {
      await backdate(58, 'CANCELLED', state.donations['58'].id, [], null)
      await backdate(59, 'EXPIRED', state.donations['59'].id, [], null)
      state.special_backdated = true; save()
    }
  } finally { await vite.close() }
  console.log('Seed completed. Verify with node scripts/verify-demo.mjs; passwords remain only in the ignored local manifest.')
}
main().catch((error) => { console.error(error.message); process.exitCode = 1 })
