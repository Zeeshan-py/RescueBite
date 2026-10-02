// Live development integration checks. Reads ignored .env; never expose its keys.
import fs from 'node:fs'
import assert from 'node:assert/strict'
import { createClient } from '@supabase/supabase-js'

const env = Object.fromEntries(fs.readFileSync('.env', 'utf8').split(/\r?\n/)
  .filter((line) => line && !line.startsWith('#') && line.includes('='))
  .map((line) => { const i = line.indexOf('='); return [line.slice(0, i).trim(), line.slice(i + 1).trim().replace(/^['"]|['"]$/g, '')] }))
const options = { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: async (input, init) => {
  const readOnly = (!init?.method || init.method === 'GET' || init.method === 'DELETE') || /\/rpc\/(get_dashboard_summary|get_admin_dashboard|get_admin_records|get_my_impact|get_platform_impact)$/.test(String(input))
  for (let attempt = 0; ; attempt++) {
    try { return await fetch(input, { ...init, signal: AbortSignal.timeout(20000) }) }
    catch (error) { if (!readOnly || attempt >= 2) throw error }
  }
} } }
const admin = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SECRET_KEY, options)
const prefix = `phase12-${Date.now()}`, password = `Temporary-${crypto.randomUUID()}!Aa`
const users = [], donations = [], ngos = [], clients = {}, checks = []
function unwrap(r) { if(r.error) throw Error(r.error.message); return r.data }
function ok(condition,name) { assert.ok(condition,name); checks.push(name); console.log('PASS '+name) }
const impact = async (client,dates={}) => unwrap(await client.rpc('get_my_impact',dates))
try {
  for(const [key,role] of [['donor','DONOR'],['otherDonor','DONOR'],['ngo','NGO'],['otherNgo','NGO'],['volunteer','VOLUNTEER'],['otherVolunteer','VOLUNTEER'],['administrator','ADMIN']]) {
    const email=`${prefix}-${key.toLowerCase()}@example.com`
    const u=unwrap(await admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{name:prefix+' '+key,role:role==='ADMIN'?'DONOR':role}})).user
    users.push(u.id)
    if(role==='ADMIN') unwrap(await admin.from('users').update({role}).eq('id',u.id))
    const client=createClient(env.VITE_SUPABASE_URL,env.VITE_SUPABASE_ANON_KEY,options)
    unwrap(await client.auth.signInWithPassword({email,password}));clients[key]={id:u.id,client}
  }
  const donor=clients.donor.client, ngo=clients.ngo.client, volunteer=clients.volunteer.client, administrator=clients.administrator.client
  for(const key of ['ngo','otherNgo']) {
    const n=unwrap(await clients[key].client.from('ngos').insert({user_id:clients[key].id,organization_name:prefix+' '+key,location:prefix,capacity:100,accepted_food_types:['Cooked Food']}).select().single());ngos.push(n.id)
  }
  for(const key of ['donor','ngo','volunteer']) {
    const empty=await impact(clients[key].client)
    ok(empty.donations.total===0 && empty.impact.portions===0 && empty.tasks.total===0,key+' empty analytics')
    ok(Boolean((await clients[key].client.rpc('get_platform_impact')).error),key+' rejected platform analytics')
    ok(Object.keys(empty.participation).length===0,key+' cannot access user participation totals')
  }
  const anon=createClient(env.VITE_SUPABASE_URL,env.VITE_SUPABASE_ANON_KEY,options)
  ok(Boolean((await anon.rpc('get_my_impact')).error)&&Boolean((await anon.rpc('get_platform_impact')).error),'anonymous access denied')
  const today=new Date().toISOString().slice(0,10), old=new Date(Date.now()-12*86400000).toISOString()
  const dates={from_date:today,to_date:today}
  const template={food_type:'Cooked Food',quantity:10,location:prefix,available_from:new Date().toISOString(),collection_deadline:new Date(Date.now()+86400000).toISOString()}
  for(const portions of [20,10,5,7]) {
    const d=unwrap(await donor.from('donations').insert({...template,donor_id:clients.donor.id,meal_portions:portions}).select().single());donations.push(d.id)
  }
  const foreign=unwrap(await clients.otherDonor.client.from('donations').insert({...template,donor_id:clients.otherDonor.id,meal_portions:999}).select().single());donations.push(foreign.id)
  ok((await impact(donor)).donations.portions_donated===42,'total portions and donor ownership')
  ok((await impact(donor)).impact.portions===0,'POSTED records do not count as rescued')
  const invalid=await donor.from('donations').insert({...template,donor_id:clients.donor.id,meal_portions:null,quantity:null})
  ok(Boolean(invalid.error),'null quantity/portions rejected by existing constraints')
  const matches=unwrap(await donor.rpc('store_donation_matches',{target_donation_id:donations[0],match_candidates:ngos.map(ngo_id=>({ngo_id,matching_score:100,distance_score:100,urgency_score:100,compatibility_score:100,capacity_score:100,availability_score:100}))}))
  ok((await impact(ngo)).pending_matches===1,'NGO pending candidate is separate from received donations')
  ok((await impact(donor)).donations.matched===1,'multiple matches count one matched donation')
  unwrap(await ngo.rpc('respond_to_donation_match',{target_match_id:matches.find(m=>m.ngo_id===ngos[0]).id,decision:'ACCEPT'}))
  ok((await impact(ngo)).impact.portions===0,'ACCEPTED records do not count as rescued')
  const task=unwrap(await admin.from('pickup_tasks').select('*').eq('donation_id',donations[0]).single())
  ok((await impact(volunteer)).tasks.total===0,'available tasks excluded from personal analytics')
  unwrap(await volunteer.rpc('claim_pickup_task',{target_task_id:task.id}))
  ok((await impact(volunteer)).tasks.claimed===1 && (await impact(volunteer)).tasks.active===1,'own claimed and active task metrics')
  unwrap(await volunteer.rpc('mark_pickup_collected',{target_task_id:task.id}))
  ok((await impact(volunteer)).tasks.collected===1,'collection timestamp metric')
  unwrap(await volunteer.rpc('mark_pickup_delivered',{target_task_id:task.id}))
  ok((await impact(donor)).impact.portions===0,'DELIVERED before NGO confirmation is not redistributed')
  unwrap(await ngo.rpc('confirm_donation_receipt',{target_donation_id:donations[0]}))
  unwrap(await donor.rpc('cancel_my_donation',{target_donation_id:donations[1]}))
  // Trusted test setup backdates only this run's donation to test cross-period completion.
  unwrap(await admin.from('donations').update({created_at:old}).eq('id',donations[0]))
  unwrap(await admin.from('donations').update({status:'EXPIRED'}).eq('id',donations[2]))
  const own=await impact(donor), receiving=await impact(ngo), work=await impact(volunteer)
  ok(own.donations.total===4 && own.donations.active===1,'total and active donation counts')
  ok(own.donations.completed===1 && own.donations.cancelled===1 && own.donations.expired===1,'completed/cancelled/expired counts')
  ok(own.donations.portions_redistributed===20 && own.impact.portions===20,'only COMPLETED portions redistributed')
  ok(own.donations.completed/own.donations.total===0.25,'completion denominator')
  ok(own.donations.cancelled/own.donations.total===0.25,'cancellation denominator')
  ok(own.donations.expired/own.donations.total===0.25,'expiry denominator')
  ok(own.donations.matched===1 && own.donations.accepted===1,'match and acceptance numerator')
  ok(receiving.donations.total===1 && receiving.impact.portions===20,'NGO accepted association and received portions')
  ok((await impact(clients.otherNgo.client)).donations.total===0,'unaccepted candidate NGO cannot see received impact')
  ok(work.tasks.total===1 && work.tasks.collected===1 && work.tasks.delivered===1 && work.tasks.active===0,'volunteer completion metrics')
  ok((await impact(clients.otherVolunteer.client)).tasks.total===0,'other volunteer isolated')
  ok((await impact(clients.otherDonor.client)).donations.portions_donated===999,'other donor isolated')
  const period=await impact(donor,dates)
  ok(period.donations.total===3 && period.donations.completed===0 && period.donations.portions_donated===22,'UTC creation date cohort')
  ok(period.impact.completed===1 && period.impact.portions===20,'completion date includes older donation')
  ok(period.trends.length===1 && period.trends[0].posted===3 && period.trends[0].completed===1 && period.trends[0].portions===20,'real trend aggregation without date fabrication')
  ok(own.trends.reduce((n,t)=>n+t.posted,0)===4 && own.trends.reduce((n,t)=>n+t.portions,0)===20,'all-time trend sums')
  const future=new Date(Date.now()+86400000).toISOString().slice(0,10)
  for(const bad of [{from_date:today},{from_date:future,to_date:today},{from_date:today,to_date:future}]) ok(Boolean((await donor.rpc('get_my_impact',bad)).error),'invalid dates rejected by database')
  const platform=unwrap(await administrator.rpc('get_platform_impact'))
  const dbDonations=unwrap(await admin.from('donations').select('status,meal_portions,donor_id'))
  const completed=dbDonations.filter(d=>d.status==='COMPLETED')
  ok(platform.donations.total===dbDonations.length,'admin total equals actual platform records')
  ok(platform.impact.portions===completed.reduce((n,d)=>n+d.meal_portions,0),'admin completed-only portion sum')
  ok(platform.donations.portions_donated===dbDonations.reduce((n,d)=>n+d.meal_portions,0),'admin donated portion sum')
  ok(platform.participation.participating_donors===new Set(dbDonations.map(d=>d.donor_id)).size,'distinct participating donors')
  const actualMatches=unwrap(await admin.from('matches').select('ngo_id,donation_id').eq('status','ACCEPTED')); const actualCompleted=unwrap(await admin.from('donations').select('id').eq('status','COMPLETED')); const completedSet=new Set(actualCompleted.map(d=>d.id)); const actualTasks=unwrap(await admin.from('pickup_tasks').select('volunteer_id').eq('status','DELIVERED')); ok(platform.participation.receiving_ngos===new Set(actualMatches.filter(m=>completedSet.has(m.donation_id)).map(m=>m.ngo_id)).size && platform.participation.delivering_volunteers===new Set(actualTasks.map(t=>t.volunteer_id).filter(Boolean)).size,'distinct actual receiving/delivering participation')
  ok(platform.participation.ngos===unwrap(await admin.from('ngos').select('id')).length,'NGO profiles counted without duplicate candidate matches')
  ok(Object.values(platform.statuses).reduce((a,b)=>a+b,0)===platform.donations.total,'all status distribution counts')
  const early=await impact(donor,{from_date:'2000-01-01',to_date:'2000-01-02'})
  ok(early.donations.total===0&&early.impact.portions===0&&early.trends.every(t=>t.posted===0),'empty date range and zero buckets')
  const fresh=createClient(env.VITE_SUPABASE_URL,env.VITE_SUPABASE_ANON_KEY,options)
  unwrap(await fresh.auth.signInWithPassword({email:`${prefix}-donor@example.com`,password}))
  ok((await impact(fresh)).impact.portions===20,'analytics persist after sign-in refresh')
  console.log(`Completed ${checks.length} live Phase 12 analytics checks.`)
} finally {
  if(donations.length) unwrap(await admin.from('activity_logs').delete().in('entity_id',donations))
  if(users.length){unwrap(await admin.from('activity_logs').delete().in('user_id',users));unwrap(await admin.from('notifications').delete().in('user_id',users))}
  if(donations.length){
    unwrap(await admin.from('pickup_tasks').delete().in('donation_id',donations));unwrap(await admin.from('matches').delete().in('donation_id',donations));unwrap(await admin.from('donations').delete().in('id',donations))
  }
  if(ngos.length) unwrap(await admin.from('ngos').delete().in('id',ngos))
  for(const id of users) unwrap(await admin.auth.admin.deleteUser(id))
  console.log('Temporary Phase 12 records cleaned.')
}
