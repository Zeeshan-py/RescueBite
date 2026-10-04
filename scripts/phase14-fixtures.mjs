// Temporary real Supabase records for manual UI regression. Never prints credentials.
// Run: node scripts/phase14-fixtures.mjs create | cleanup
import fs from 'node:fs'
import assert from 'node:assert/strict'
import { createClient } from '@supabase/supabase-js'
const file = '.phase14-fixtures.json.local'
const env = Object.fromEntries(fs.readFileSync('.env', 'utf8').split(/\r?\n/).filter(line => line && !line.startsWith('#') && line.includes('=')).map(line => { const i = line.indexOf('='); return [line.slice(0,i).trim(), line.slice(i+1).trim().replace(/^['"]|['"]$/g,'')] }))
const options = { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: (url, init) => fetch(url, { ...init, signal: AbortSignal.timeout(30000) }) } }
const admin = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SECRET_KEY, options)
function unwrap(result) { if (result.error) throw new Error(result.error.message); return result.data }
const mode = process.argv[2]
if (!['create','cleanup'].includes(mode)) throw new Error('Specify create or cleanup')
if (mode === 'cleanup') {
  const state = JSON.parse(fs.readFileSync(file, 'utf8'))
  assert.match(state.prefix, /^phase14-\d+$/)
  // Inventory by this run's unique prefix also catches a timed-out creation.
  const users = unwrap(await admin.auth.admin.listUsers({ perPage:1000 })).users.filter(user => user.email?.startsWith(state.prefix+'-')).map(user=>user.id)
  const donations = users.length ? unwrap(await admin.from('donations').select('id').in('donor_id',users)).map(row=>row.id) : []
  const tasks = donations.length ? unwrap(await admin.from('pickup_tasks').select('id').in('donation_id',donations)).map(row=>row.id) : []
  const matches = donations.length ? unwrap(await admin.from('matches').select('id').in('donation_id',donations)).map(row=>row.id) : []
  const entities = [...donations,...tasks,...matches]
  for (const table of ['notifications','activity_logs']) {
    if (entities.length) unwrap(await admin.from(table).delete().in('entity_id',entities))
    if (users.length) unwrap(await admin.from(table).delete().in('user_id',users))
  }
  if (donations.length) {
    unwrap(await admin.from('pickup_tasks').delete().in('donation_id',donations))
    unwrap(await admin.from('matches').delete().in('donation_id',donations))
    unwrap(await admin.from('donations').delete().in('id',donations))
  }
  if (users.length) unwrap(await admin.from('ngos').delete().in('user_id',users))
  for (const id of users) unwrap(await admin.auth.admin.deleteUser(id))
  assert.equal(unwrap(await admin.auth.admin.listUsers({perPage:1000})).users.filter(user=>user.email?.startsWith(state.prefix+'-')).length,0)
  fs.unlinkSync(file)
  console.log('Temporary Phase 14 records and accounts removed; cleanup verified.')
} else {
  if (fs.existsSync(file)) throw new Error('Clean up the previous fixture run first')
  const state = {prefix:`phase14-${Date.now()}`, password:`Temporary-${crypto.randomUUID()}!Aa`, users:{}, records:{}}
  const save = () => fs.writeFileSync(file, JSON.stringify(state,null,2))
  save()
  const clients={}
  for (const [key,role] of [['donor','DONOR'],['ngo','NGO'],['volunteer','VOLUNTEER'],['admin','ADMIN']]) {
    const email = `${state.prefix}-${key}@example.com`
    const user=unwrap(await admin.auth.admin.createUser({email,password:state.password,email_confirm:true,user_metadata:{name:`UI Test ${key}`,role:role==='ADMIN'?'DONOR':role}})).user
    state.users[key]={id:user.id,email}; save()
    if(role==='ADMIN') unwrap(await admin.from('users').update({role}).eq('id',user.id))
    clients[key]=createClient(env.VITE_SUPABASE_URL,env.VITE_SUPABASE_ANON_KEY,options)
    unwrap(await clients[key].auth.signInWithPassword({email,password:state.password}))
  }
  const ngo = unwrap(await clients.ngo.from('ngos').insert({user_id:state.users.ngo.id,organization_name:'UI Test Community Kitchen',location:'Lahore community kitchen',latitude:31.52,longitude:74.35,capacity:100,accepted_food_types:['Cooked Food'],contact_information:'UI test contact only'}).select().single())
  for(const stage of ['posted','suggested','available','assigned','delivered']) {
    const donation=unwrap(await clients.donor.from('donations').insert({donor_id:state.users.donor.id,food_type:'Cooked Food',quantity:12,meal_portions:24,location:'Lahore test collection point',latitude:31.5204,longitude:74.3587,available_from:new Date().toISOString(),collection_deadline:new Date(Date.now()+2*86400000).toISOString(),description:`Temporary UI regression: ${stage}`,safety_information:'UI fixture only; no real food offered.'}).select().single())
    const record={donation:donation.id}; state.records[stage]=record; save()
    if(stage==='posted') continue
    const matches=unwrap(await clients.donor.rpc('store_donation_matches',{target_donation_id:donation.id,match_candidates:[{ngo_id:ngo.id,matching_score:98.5,distance_score:100,urgency_score:100,compatibility_score:100,capacity_score:100,availability_score:85}]}))
    record.match=matches[0].id; save()
    if(stage==='suggested') continue
    unwrap(await clients.ngo.rpc('respond_to_donation_match',{target_match_id:record.match,decision:'ACCEPT'}))
    record.task=unwrap(await admin.from('pickup_tasks').select('id').eq('donation_id',donation.id).single()).id; save()
    if(stage==='available') continue
    unwrap(await clients.volunteer.rpc('claim_pickup_task',{target_task_id:record.task}))
    if(stage==='assigned') continue
    unwrap(await clients.volunteer.rpc('mark_pickup_collected',{target_task_id:record.task}))
    unwrap(await clients.volunteer.rpc('mark_pickup_delivered',{target_task_id:record.task}))
  }
  console.log('Created four temporary role accounts and five workflow records. Credentials are in the ignored local manifest.')
}
