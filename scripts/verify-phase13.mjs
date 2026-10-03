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
const prefix = `phase13-${Date.now()}`, password = `Temporary-${crypto.randomUUID()}!Aa`
const users = [], donations = [], ngos = [], clients = {}, checks = []
function unwrap(r) { if(r.error) throw Error(r.error.message); return r.data }
function ok(condition,name) { assert.ok(condition,name); checks.push(name); console.log('PASS '+name) }
const impact = async (client,dates={}) => unwrap(await client.rpc('get_my_impact',dates))
try {
  for (const [key, role] of [['donor','DONOR'],['otherDonor','DONOR'],['ngo','NGO'],['otherNgo','NGO'],['volunteer','VOLUNTEER'],['otherVolunteer','VOLUNTEER'],['administrator','ADMIN']]) {
    const email = `${prefix}-${key.toLowerCase()}@example.com`
    const u = unwrap(await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { name: prefix+' '+key, role: role === 'ADMIN' ? 'DONOR' : role } })).user
    users.push(u.id)
    if (role === 'ADMIN') unwrap(await admin.from('users').update({ role }).eq('id',u.id))
    const client = createClient(env.VITE_SUPABASE_URL,env.VITE_SUPABASE_ANON_KEY,options)
    unwrap(await client.auth.signInWithPassword({email,password})); clients[key] = {id:u.id,client,email}
    ok(unwrap(await client.auth.getUser()).user.id === u.id, key+' authenticated identity')
  }
  const donor=clients.donor.client, otherDonor=clients.otherDonor.client, ngo=clients.ngo.client, otherNgo=clients.otherNgo.client
  const volunteer=clients.volunteer.client, otherVolunteer=clients.otherVolunteer.client, administrator=clients.administrator.client
  const anon=createClient(env.VITE_SUPABASE_URL,env.VITE_SUPABASE_ANON_KEY,options)
  const denied=async (request,name) => { const r=await request; ok(Boolean(r.error),name) }
  const hidden=async (request,name) => { const r=await request; ok(!r.error && r.data.length===0,name) }
  const singleWinner=async (requests,name) => { const r=await Promise.all(requests); ok(r.filter(x=>!x.error).length===1 && r.filter(x=>x.error).length===r.length-1,name); return r.findIndex(x=>!x.error) }
  const received=[], leaked=[]
  async function subscribe(client,name,onInsert) {
    const channel=client.channel(prefix+name).on('postgres_changes',{event:'INSERT',schema:'public',table:'notifications',filter:`user_id=eq.${clients.donor.id}`},p=>onInsert(p.new))
    await new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>reject(Error('Realtime subscription timeout')),20000)
      channel.subscribe(status=>{if(status==='SUBSCRIBED'){clearTimeout(timer);resolve()} else if(status==='CHANNEL_ERROR'){clearTimeout(timer);reject(Error('Realtime channel failed'))}})
    })
    return channel
  }
  let ownChannel=await subscribe(donor,'own',n=>received.push(n))
  await subscribe(otherDonor,'foreign',n=>leaked.push(n))
  await subscribe(administrator,'admin-foreign',n=>leaked.push(n))
  for (const key of ['ngo','otherNgo']) {
    const n=unwrap(await clients[key].client.from('ngos').insert({user_id:clients[key].id,organization_name:prefix+' '+key,location:prefix,capacity:100,accepted_food_types:['Cooked Food'],contact_information:'Private test contact'}).select().single())
    ngos.push(n.id)
  }
  const template={food_type:'Cooked Food',quantity:10,meal_portions:10,location:prefix,available_from:new Date().toISOString(),collection_deadline:new Date(Date.now()+86400000).toISOString()}
  async function create(client=donor, owner=clients.donor.id, extras={}) {
    const d=unwrap(await client.from('donations').insert({...template,donor_id:owner,...extras}).select().single()); donations.push(d.id); return d
  }
  const d=await create(), foreign=await create(otherDonor,clients.otherDonor.id)
  await hidden(donor.from('donations').select('*').eq('id',foreign.id),'donor cannot read another donation or coordinates')
  await hidden(donor.from('donations').update({location:'unauthorized'}).eq('id',foreign.id).select(),'donor cannot edit another donation')
  await denied(donor.rpc('cancel_my_donation',{target_donation_id:foreign.id}),'donor cannot cancel another donation')
  await hidden(ngo.from('ngos').select('*').eq('id',ngos[1]),'NGO cannot read another NGO private profile')
  await hidden(ngo.from('ngos').update({location:'unauthorized'}).eq('id',ngos[1]).select(),'NGO cannot modify another NGO')
  await hidden(donor.from('ngos').select('*').in('id',ngos),'unmatched donor cannot read private NGO rows')
  const projection=unwrap(await donor.rpc('get_matching_ngos',{target_donation_id:d.id}))
  ok(ngos.every(id=>projection.some(n=>n.id===id)) && projection.every(n=>!('contact_information' in n)&&!('description' in n)),'matching projection preserves discovery without private contact fields')
  await denied(otherDonor.rpc('get_matching_ngos',{target_donation_id:d.id}),'matching discovery checks donation ownership')
  await denied(ngo.rpc('get_matching_ngos',{target_donation_id:d.id}),'NGO cannot call donor discovery')
  for (const [name,client] of [['anonymous',anon],['donor',donor],['NGO',ngo],['volunteer',volunteer]]) {
    for (const rpc of ['get_admin_dashboard','get_platform_impact']) await denied(client.rpc(rpc),name+' denied '+rpc)
    await denied(client.rpc('get_admin_records',{view_name:'users',search_text:'%',page_number:1}),name+' denied admin user search')
    if(name!=='anonymous') {
      await hidden(client.from('activity_logs').select('id'),name+' cannot read administrative audit')
      await hidden(client.from('users').select('id').neq('id',name==='donor'?clients.donor.id:name==='NGO'?clients.ngo.id:clients.volunteer.id),name+' cannot enumerate other profiles')
    }
  }
  await denied(anon.from('donations').select('latitude,longitude'),'anonymous cannot read donor coordinates')
  await hidden(ngo.from('donations').select('latitude,longitude').eq('id',d.id),'unmatched NGO cannot read donor coordinates')
  await hidden(volunteer.from('donations').select('latitude,longitude').eq('id',d.id),'unrelated volunteer cannot read donor coordinates')
  await denied(donor.from('users').update({role:'ADMIN'}).eq('id',clients.donor.id),'client cannot promote its role')
  unwrap(await donor.auth.updateUser({data:{role:'ADMIN'}}))
  await denied(donor.rpc('get_admin_dashboard'),'forged Auth metadata cannot grant admin')
  unwrap(await donor.auth.updateUser({data:{role:'DONOR'}}))
  for(const [field,value] of [['created_at','2000-01-01'],['updated_at','2000-01-01'],['completed_at','2000-01-01'],['id',crypto.randomUUID()],['status','CANCELLED']]) {
    await denied(donor.from('donations').update({[field]:value}).eq('id',d.id),'protected donation '+field+' cannot be changed')
  }
  await denied(donor.from('donations').insert({...template,donor_id:clients.donor.id,created_at:'2000-01-01'}),'donor cannot forge creation timestamp')
  await denied(administrator.from('donations').insert({...template,donor_id:clients.donor.id,status:'DELIVERED'}),'admin cannot insert a donation beyond its initial state')
  await denied(ngo.from('ngos').update({created_at:'2000-01-01'}).eq('id',ngos[0]),'NGO cannot forge historical timestamp')
  for(const [name,extras] of [['blank food',{food_type:' '}],['negative quantity',{quantity:-1}],['NaN quantity',{quantity:'NaN'}],['zero portions',{meal_portions:0}],['fractional portions',{meal_portions:1.5}],['excess quantity',{quantity:1e20}],['infinite deadline',{collection_deadline:'infinity'}],['invalid date',{available_from:'bad-date'}],['reversed window',{collection_deadline:'2000-01-01'}],['unsupported status',{status:'BOGUS'}],['advanced status',{status:'COMPLETED'}],['invalid coordinates',{latitude:91,longitude:0}],['half coordinates',{latitude:1}],['oversized text',{description:'a'.repeat(10001)}]]) {
    await denied(donor.from('donations').insert({...template,donor_id:clients.donor.id,...extras}),'reject '+name)
  }
  await denied(donor.rpc('cancel_my_donation',{target_donation_id:'malformed'}),'malformed UUID rejected')
  await denied(ngo.from('ngos').update({capacity:-1}).eq('id',ngos[0]),'negative capacity rejected')
  await denied(ngo.from('ngos').update({accepted_food_types:[]}).eq('id',ngos[0]),'empty accepted food list rejected')
  const candidates=ngos.map(ngo_id=>({ngo_id,matching_score:100,distance_score:100,urgency_score:100,compatibility_score:100,capacity_score:100,availability_score:100}))
  const matches=unwrap(await donor.rpc('store_donation_matches',{target_donation_id:d.id,match_candidates:candidates}))
  await denied(donor.rpc('store_donation_matches',{target_donation_id:d.id,match_candidates:null}),'null matching payload rejected without deleting suggestions')
  ok(unwrap(await donor.from('matches').select('id').eq('donation_id',d.id)).length===2,'invalid matching payload preserves stored candidates')
  await denied(donor.rpc('store_donation_matches',{target_donation_id:d.id,match_candidates:[{...candidates[0],distance_score:null}]}),'missing score rejected')
  const first=matches.find(m=>m.ngo_id===ngos[0]), second=matches.find(m=>m.ngo_id===ngos[1])
  await denied(ngo.rpc('respond_to_donation_match',{target_match_id:first.id,decision:null}),'null decision cannot decline a match')
  await denied(ngo.rpc('respond_to_donation_match',{target_match_id:second.id,decision:'ACCEPT'}),'NGO cannot accept another NGO match')
  const winner=await singleWinner([ngo.rpc('respond_to_donation_match',{target_match_id:first.id,decision:'ACCEPT'}),otherNgo.rpc('respond_to_donation_match',{target_match_id:second.id,decision:'ACCEPT'})],'concurrent NGO acceptance has exactly one winner')
  const receiving=winner===0?ngo:otherNgo, losing=winner===0?otherNgo:ngo, acceptedMatch=winner===0?first:second
  await denied(receiving.rpc('respond_to_donation_match',{target_match_id:acceptedMatch.id,decision:'ACCEPT'}),'repeat acceptance rejected')
  ok(unwrap(await admin.from('matches').select('id').eq('donation_id',d.id).eq('status','ACCEPTED')).length===1,'one accepted match remains')
  const tasks=unwrap(await admin.from('pickup_tasks').select('*').eq('donation_id',d.id))
  ok(tasks.length===1 && tasks[0].status==='AVAILABLE','acceptance creates exactly one available task')
  const task=tasks[0]
  await denied(donor.rpc('claim_pickup_task',{target_task_id:task.id}),'donor cannot claim a pickup')
  await denied(volunteer.rpc('mark_pickup_delivered',{target_task_id:task.id}),'delivery before collection rejected')
  await denied(receiving.rpc('confirm_donation_receipt',{target_donation_id:d.id}),'receipt before delivery rejected')
  const assigned=await singleWinner([volunteer.rpc('claim_pickup_task',{target_task_id:task.id}),otherVolunteer.rpc('claim_pickup_task',{target_task_id:task.id})],'two volunteers claiming has exactly one winner')
  const worker=assigned===0?volunteer:otherVolunteer, stranger=assigned===0?otherVolunteer:volunteer
  await denied(stranger.rpc('claim_pickup_task',{target_task_id:task.id}),'already claimed pickup cannot be claimed again')
  await denied(stranger.rpc('mark_pickup_collected',{target_task_id:task.id}),'other volunteer cannot collect assigned pickup')
  await hidden(stranger.from('pickup_tasks').update({notes:'unauthorized'}).eq('id',task.id).select(),'other volunteer cannot modify pickup notes')
  await hidden(stranger.from('donations').select('latitude,longitude').eq('id',d.id),'unassigned volunteer loses exact pickup location access')
  ok(unwrap(await worker.rpc('get_pickup_destination',{target_donation_id:d.id})).length===1,'assigned volunteer can get delivery destination')
  await hidden(stranger.rpc('get_pickup_destination',{target_donation_id:d.id}),'unassigned volunteer cannot get delivery destination')
  await denied(worker.from('pickup_tasks').update({status:'DELIVERED'}).eq('id',task.id),'raw pickup status manipulation blocked')
  await denied(worker.from('pickup_tasks').update({collected_at:'2000-01-01'}).eq('id',task.id),'raw pickup timestamp manipulation blocked')
  // Trusted fixture mutation checks constraints, independent of client privileges.
  await denied(admin.from('pickup_tasks').update({status:'COLLECTED',collected_at:null}).eq('id',task.id),'COLLECTED requires collection timestamp')
  await denied(admin.from('pickup_tasks').update({pickup_time:null}).eq('id',task.id),'ASSIGNED requires assignment timestamp')
  await denied(admin.from('pickup_tasks').update({status:'DELIVERED',delivered_at:null}).eq('id',task.id),'DELIVERED requires timestamp')
  unwrap(await worker.rpc('mark_pickup_collected',{target_task_id:task.id}))
  await singleWinner([worker.rpc('mark_pickup_delivered',{target_task_id:task.id}),worker.rpc('mark_pickup_delivered',{target_task_id:task.id})],'concurrent delivery has exactly one winner')
  await denied(losing.rpc('confirm_donation_receipt',{target_donation_id:d.id}),'other NGO cannot confirm receipt')
  await singleWinner([receiving.rpc('confirm_donation_receipt',{target_donation_id:d.id}),receiving.rpc('confirm_donation_receipt',{target_donation_id:d.id})],'concurrent completion has exactly one winner')
  await denied(receiving.rpc('confirm_donation_receipt',{target_donation_id:d.id}),'repeat completion rejected')
  await denied(worker.rpc('mark_pickup_collected',{target_task_id:task.id}),'completed rescue cannot move backwards')
  await denied(donor.rpc('cancel_my_donation',{target_donation_id:d.id}),'completed rescue cannot be cancelled')
  const final=unwrap(await admin.from('donations').select('*').eq('id',d.id).single())
  const finalTask=unwrap(await admin.from('pickup_tasks').select('*').eq('id',task.id).single())
  ok(final.status==='COMPLETED'&&Boolean(final.completed_at)&&finalTask.status==='DELIVERED'&&finalTask.delivered_at>=finalTask.collected_at&&finalTask.collected_at>=finalTask.pickup_time,'final workflow state and timestamp order consistent')
  const cancel=await create()
  const declined=await create()
  const declinedMatch=unwrap(await donor.rpc('store_donation_matches',{target_donation_id:declined.id,match_candidates:[candidates[0]]}))[0]
  unwrap(await ngo.rpc('respond_to_donation_match',{target_match_id:declinedMatch.id,decision:'DECLINE'}))
  ok(unwrap(await admin.from('matches').select('status').eq('id',declinedMatch.id).single()).status==='REJECTED'&&unwrap(await donor.from('donations').select('status').eq('id',declined.id).single()).status==='POSTED','valid decline retains history and reopens unmatched donation')
  await singleWinner([donor.rpc('cancel_my_donation',{target_donation_id:cancel.id}),donor.rpc('cancel_my_donation',{target_donation_id:cancel.id})],'repeated cancellation has exactly one winner')
  await denied(donor.rpc('store_donation_matches',{target_donation_id:cancel.id,match_candidates:candidates}),'cancelled donation cannot be reused')
  const expired=await create(donor,clients.donor.id,{available_from:'2000-01-01',collection_deadline:'2000-01-02'})
  await denied(donor.rpc('store_donation_matches',{target_donation_id:expired.id,match_candidates:candidates}),'past deadline cannot enter matching')
  unwrap(await donor.rpc('expire_overdue_donations'))
  ok(unwrap(await admin.from('donations').select('status').eq('id',expired.id).single()).status==='EXPIRED','overdue donation expires')
  const ownNotifications=unwrap(await donor.from('notifications').select('*'))
  ok(received.length>0&&received.every(n=>n.user_id===clients.donor.id),'realtime positive control delivers only own notifications')
  ok(leaked.length===0,'cross-user and admin realtime subscriptions do not leak donor notifications')
  await donor.removeChannel(ownChannel)
  const missed=await create()
  ok(unwrap(await donor.from('notifications').select('id').eq('entity_id',missed.id)).length>0,'notification created while disconnected is available for reconciliation')
  ownChannel=await subscribe(donor,'reconnected',n=>received.push(n))
  const reconnected=await create()
  const realtimeDeadline=Date.now()+20000
  while(!received.some(n=>n.entity_id===reconnected.id)&&Date.now()<realtimeDeadline) await new Promise(resolve=>setTimeout(resolve,100))
  ok(received.some(n=>n.entity_id===reconnected.id),'realtime insertion resumes after reconnect')
  const notification=ownNotifications[0]
  ok(ownNotifications.length>0&&ownNotifications.every(n=>n.user_id===clients.donor.id),'own notification history available')
  for(const [name,client] of [['other donor',otherDonor],['admin',administrator]]) {
    await hidden(client.from('notifications').select('*').eq('id',notification.id),name+' cannot read another notification')
    await hidden(client.from('notifications').update({is_read:true}).eq('id',notification.id).select(),name+' cannot mark another notification read')
  }
  await denied(donor.from('notifications').insert({user_id:clients.otherDonor.id,title:'bad',message:'bad',type:'MATCH_FOUND'}),'arbitrary notification insertion blocked')
  await denied(donor.from('notifications').delete().eq('id',notification.id),'notification history deletion blocked')
  unwrap(await donor.from('notifications').update({is_read:true}).eq('id',notification.id))
  ok(unwrap(await donor.from('notifications').select('is_read').eq('id',notification.id).single()).is_read,'own mark read works')
  const alerts=unwrap(await admin.from('notifications').select('*').in('user_id',users))
  ok(new Set(alerts.map(n=>n.event_key)).size===alerts.length,'duplicate workflow requests create no duplicate notification events')
  ok(alerts.filter(n=>n.user_id===clients.donor.id&&n.type==='DONATION_COMPLETED'&&n.entity_id===d.id).length===1,'completion emits one donor notification')
  for(const action of ['NGO_CONFIRMED_DELIVERY','DONATION_COMPLETED']) ok(unwrap(await administrator.from('activity_logs').select('id').eq('entity_id',d.id).eq('action',action)).length===1,'one audit event for '+action)
  for(const key of ['donor','ngo','volunteer']) {
    await denied(clients[key].client.rpc('get_my_impact',{user_id:clients.otherDonor.id}),key+' analytics cannot accept foreign owner parameter')
    await denied(clients[key].client.rpc('get_my_impact',{from_date:'2026-10-03',to_date:'2000-01-01'}),key+' invalid analytics range rejected')
  }
  ok((await impact(otherDonor)).donations.total===1,'other donor analytics remain isolated')
  unwrap(await donor.auth.refreshSession())
  ok(unwrap(await donor.auth.getUser()).user.id===clients.donor.id,'session refresh retains identity')
  unwrap(await donor.auth.signOut())
  ok(unwrap(await donor.auth.getSession()).session===null,'logout clears Supabase session')
  await denied(donor.rpc('get_my_impact'),'signed out client cannot call protected analytics')
  unwrap(await donor.auth.signInWithPassword({email:clients.donor.email,password}))
  ok(unwrap(await donor.from('notifications').select('is_read').eq('id',notification.id).single()).is_read,'notification read state survives sign-in refresh')
  console.log(`Completed ${checks.length} live Phase 13 security checks.`)
} finally {
  // Inventory by this run's prefix also catches an API timeout after a successful write.
  const listed=unwrap(await admin.auth.admin.listUsers({perPage:1000})).users.filter(u=>u.email?.startsWith(prefix+'-'))
  const allUsers=[...new Set([...users,...listed.map(u=>u.id)])]
  const allDonations=allUsers.length?unwrap(await admin.from('donations').select('id').in('donor_id',allUsers)).map(d=>d.id):[]
  const allTasks=allDonations.length?unwrap(await admin.from('pickup_tasks').select('id').in('donation_id',allDonations)).map(t=>t.id):[]
  const allMatches=allDonations.length?unwrap(await admin.from('matches').select('id').in('donation_id',allDonations)).map(m=>m.id):[]
  const entities=[...allDonations,...allTasks,...allMatches]
  if(entities.length) {
    unwrap(await admin.from('notifications').delete().in('entity_id',entities))
    unwrap(await admin.from('activity_logs').delete().in('entity_id',entities))
  }
  if(allDonations.length) unwrap(await admin.from('activity_logs').delete().in('entity_id',allDonations))
  if(allUsers.length) {
    unwrap(await admin.from('activity_logs').delete().in('user_id',allUsers))
    unwrap(await admin.from('notifications').delete().in('user_id',allUsers))
  }
  if(allDonations.length) {
    unwrap(await admin.from('pickup_tasks').delete().in('donation_id',allDonations))
    unwrap(await admin.from('matches').delete().in('donation_id',allDonations))
    unwrap(await admin.from('donations').delete().in('id',allDonations))
  }
  if(allUsers.length) unwrap(await admin.from('ngos').delete().in('user_id',allUsers))
  for(const id of allUsers) unwrap(await admin.auth.admin.deleteUser(id))
  assert.equal(unwrap(await admin.auth.admin.listUsers({perPage:1000})).users.filter(u=>u.email?.startsWith(prefix+'-')).length,0)
  for(const {client} of Object.values(clients)) await client.removeAllChannels()
  console.log('Temporary Phase 13 accounts and records cleaned and verified.')
}
