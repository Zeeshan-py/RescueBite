import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
const env=Object.fromEntries(fs.readFileSync('.env','utf8').split(/\r?\n/).filter(x=>x && !x.trim().startsWith('#') && x.includes('=')).map(x=>{const i=x.indexOf('=');return [x.slice(0,i).trim(),x.slice(i+1).trim().replace(/^['\"]|['\"]$/g,'')]}));
const url=env.VITE_SUPABASE_URL, anon=env.VITE_SUPABASE_ANON_KEY, secret=env.SUPABASE_SECRET_KEY;
const admin=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
const ids={users:[],donation:null,ngo:null,match:null,pickup:null}; const results={};
const stamp=Date.now(); const password='Phase10-Test-'+stamp+'!Aa';
const roles=['DONOR','NGO','VOLUNTEER']; const clients={};
const fail=(m,e)=>{throw new Error(m+(e?': '+e.message:''))};
async function authClient(email){const c=createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false}});const {error}=await c.auth.signInWithPassword({email,password});if(error)fail('sign in',error);return c}
async function count(c,type){let q=c.from('notifications').select('*',{count:'exact',head:true});if(type)q=q.eq('type',type);const {count,error}=await q;if(error)fail('count notifications',error);return count??0}
try {
 for(const role of roles){const email=`phase10-${role.toLowerCase()}-${stamp}@example.com`; const {data,error}=await admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{name:`Phase 10 ${role}`,role,phone:null}});if(error)fail('create '+role,error);ids.users.push(data.user.id);clients[role]=await authClient(email)}
 console.log('Test users signed in'); const donor=ids.users[0], ngoUser=ids.users[1], volunteer=ids.users[2];
 const {data:ngo,error:ngoErr}=await admin.from('ngos').insert({user_id:ngoUser,organization_name:'Phase 10 Test NGO',location:'Lahore',capacity:100,accepted_food_types:['Prepared meals'],contact_information:'test'}).select().single();if(ngoErr)fail('create ngo',ngoErr);ids.ngo=ngo.id;
 const donorRealtime=[]; let realtimeResolve; const realtimeReceived=new Promise(r=>realtimeResolve=r);
 const channel=clients.DONOR.channel('phase10-live-'+stamp).on('postgres_changes',{event:'INSERT',schema:'public',table:'notifications',filter:`user_id=eq.${donor}`},p=>{donorRealtime.push(p.new);realtimeResolve()});
 await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('subscription timed out')),20000);channel.subscribe(s=>{if(s==='SUBSCRIBED'){clearTimeout(timer);resolve()}})});
 // Validate nullable coordinates and donor/NGO ownership through authenticated clients.
 const ownNgo=await clients.NGO.from('ngos').update({latitude:31.5204,longitude:74.3587}).eq('id',ngo.id).select().single(); if(ownNgo.error)fail('own NGO coordinates',ownNgo.error);
 const foreignNgo=await clients.DONOR.from('ngos').update({latitude:0,longitude:0}).eq('id',ngo.id).select();results.foreignNgoUpdateBlocked=!!foreignNgo.error||foreignNgo.data.length===0;
 const from=new Date(Date.now()+60000).toISOString(), deadline=new Date(Date.now()+86400000).toISOString();
 const {data:donation,error:donErr}=await clients.DONOR.from('donations').insert({donor_id:donor,food_type:'Prepared meals',quantity:10,meal_portions:20,location:'Lahore',available_from:from,collection_deadline:deadline,safety_information:'Keep covered',description:'Phase 10 live test'}).select().single();if(donErr)fail('create donation',donErr);ids.donation=donation.id;
 const realtimeResult=await Promise.race([realtimeReceived.then(()=>true),new Promise(resolve=>setTimeout(()=>resolve(false),20000))]);
 results.realtimeDelivery=realtimeResult && donorRealtime.length>0 && donorRealtime.every(n=>n.user_id===donor);
 let edit=await clients.DONOR.from('donations').update({latitude:31.5204,longitude:74.3587}).eq('id',donation.id).select().single();if(edit.error)fail('own donation coordinates',edit.error);results.ownLocationPersistence=edit.data.latitude===31.5204 && ownNgo.data.longitude===74.3587;
 const invalid=await clients.DONOR.from('donations').update({latitude:91,longitude:0}).eq('id',donation.id);results.rangeConstraint=!!invalid.error;
 const half=await clients.DONOR.from('donations').update({latitude:null,longitude:0}).eq('id',donation.id);results.pairConstraint=!!half.error;
 const foreign=await clients.NGO.from('donations').update({latitude:0,longitude:0}).eq('id',donation.id).select();results.foreignDonationUpdateBlocked=!!foreign.error||foreign.data.length===0;
 const privateRows=await clients.VOLUNTEER.from('donations').select('latitude,longitude').eq('id',donation.id);results.unrelatedLocationHidden=!privateRows.error&&privateRows.data.length===0;

 const candidate={ngo_id:ngo.id,matching_score:97.5,distance_score:100,urgency_score:95,compatibility_score:100,capacity_score:95,availability_score:95};
 const {data:matches,error:matchErr}=await clients.DONOR.rpc('store_donation_matches',{target_donation_id:donation.id,match_candidates:[candidate]});if(matchErr)fail('store match',matchErr);ids.match=matches[0].id;results.realDistance=matches[0].distance_km===0&&matches[0].distance_score===100;
 await clients.NGO.from('ngos').update({latitude:null,longitude:null}).eq('id',ngo.id);
 const fallback=await clients.DONOR.rpc('store_donation_matches',{target_donation_id:donation.id,match_candidates:[candidate]});if(fallback.error)fail('fallback matching',fallback.error);results.missingCoordinatesFallback=fallback.data[0].distance_km===null;
 await clients.NGO.from('ngos').update({latitude:31.5204,longitude:74.3587}).eq('id',ngo.id);

 const {error:acceptErr}=await clients.NGO.rpc('respond_to_donation_match',{target_match_id:ids.match,decision:'ACCEPT'});if(acceptErr)fail('accept',acceptErr);
 const {data:pickup,error:pickupErr}=await admin.from('pickup_tasks').select('*').eq('donation_id',donation.id).single();if(pickupErr)fail('pickup lookup',pickupErr);ids.pickup=pickup.id;
 const beforeFailed=await count(clients.VOLUNTEER,'FOOD_DELIVERED'); const {error:earlyDelivery}=await clients.VOLUNTEER.rpc('mark_pickup_delivered',{target_task_id:pickup.id}); const afterFailed=await count(clients.VOLUNTEER,'FOOD_DELIVERED'); results.failedTransitionNoNotification=Boolean(earlyDelivery)&&beforeFailed===afterFailed;
 const claims=await Promise.all([clients.VOLUNTEER.rpc('claim_pickup_task',{target_task_id:pickup.id}),clients.VOLUNTEER.rpc('claim_pickup_task',{target_task_id:pickup.id})]); results.concurrentClaimGuard=claims.filter(x=>!x.error).length===1 && claims.filter(x=>x.error).length===1;
 const destination=await clients.VOLUNTEER.rpc('get_pickup_destination',{target_donation_id:donation.id});if(destination.error)fail('destination',destination.error);results.assignedDestination=destination.data[0]?.latitude===31.5204;
 const deniedDestination=await clients.DONOR.rpc('get_pickup_destination',{target_donation_id:donation.id});results.destinationScope=deniedDestination.data?.length===0;
 const assignedCount=await count(clients.VOLUNTEER,'PICKUP_ASSIGNED'); results.duplicateProtection=assignedCount===1;
 let x=await clients.VOLUNTEER.rpc('mark_pickup_collected',{target_task_id:pickup.id});if(x.error)fail('collect',x.error);x=await clients.VOLUNTEER.rpc('mark_pickup_delivered',{target_task_id:pickup.id});if(x.error)fail('deliver',x.error);x=await clients.NGO.rpc('confirm_donation_receipt',{target_donation_id:donation.id});if(x.error)fail('complete',x.error);
 const repeated=await clients.NGO.rpc('respond_to_donation_match',{target_match_id:ids.match,decision:'ACCEPT'});results.repeatedRequestRejected=Boolean(repeated.error);
 const donorRows=await clients.DONOR.from('notifications').select('*').order('created_at'); const ngoRows=await clients.NGO.from('notifications').select('*').order('created_at'); const volunteerRows=await clients.VOLUNTEER.from('notifications').select('*').order('created_at'); if(donorRows.error||ngoRows.error||volunteerRows.error)fail('notification retrieval',donorRows.error||ngoRows.error||volunteerRows.error);
 results.notificationCounts={donor:donorRows.data.length,ngo:ngoRows.data.length,volunteer:volunteerRows.data.length};
 results.workflowTypes={donor:[...new Set(donorRows.data.map(n=>n.type))],ngo:[...new Set(ngoRows.data.map(n=>n.type))],volunteer:[...new Set(volunteerRows.data.map(n=>n.type))]};
 const ngoNotification=ngoRows.data[0]; const isolation=await clients.DONOR.from('notifications').select('*').eq('id',ngoNotification.id); results.rlsIsolation=!isolation.error&&isolation.data.length===0;
 const arbitraryInsert=await clients.DONOR.from('notifications').insert({user_id:donor,title:'bad',message:'bad',type:'MATCH_FOUND'});results.arbitraryInsertBlocked=Boolean(arbitraryInsert.error);
 const foreignUpdate=await clients.DONOR.from('notifications').update({is_read:true}).eq('id',ngoNotification.id).select();results.foreignUpdateBlocked=!foreignUpdate.error&&foreignUpdate.data.length===0;
 const firstDonor=donorRows.data.find(n=>!n.is_read); let read=await clients.DONOR.from('notifications').update({is_read:true}).eq('id',firstDonor.id).select().single();if(read.error)fail('mark read',read.error);results.markRead=read.data.is_read===true;
 let all=await clients.DONOR.from('notifications').update({is_read:true}).eq('is_read',false);if(all.error)fail('mark all',all.error);results.markAllRead=(await count(clients.DONOR))>0 && (await countUnread(clients.DONOR))===0;
 const refreshClient=await authClient(`phase10-donor-${stamp}@example.com`); results.refreshPersistence=(await count(refreshClient))===donorRows.data.length;
 results.eventKeysUnique=new Set([...donorRows.data,...ngoRows.data,...volunteerRows.data].map(n=>n.event_key)).size===donorRows.data.length+ngoRows.data.length+volunteerRows.data.length;
 await clients.DONOR.removeChannel(channel);
 console.log(JSON.stringify(results,null,2)); if(Object.values(results).some(v=>v===false))throw new Error('A live check failed');
} finally {
 if(ids.users.length) await admin.from('activity_logs').delete().in('user_id',ids.users);

 if(ids.donation){await admin.from('activity_logs').delete().in('entity_id',[ids.donation,ids.pickup].filter(Boolean));await admin.from('notifications').delete().in('user_id',ids.users);await admin.from('pickup_tasks').delete().eq('donation_id',ids.donation);await admin.from('matches').delete().eq('donation_id',ids.donation);await admin.from('donations').delete().eq('id',ids.donation)}
 if(ids.ngo)await admin.from('ngos').delete().eq('id',ids.ngo); for(const id of ids.users.reverse())await admin.auth.admin.deleteUser(id);
}
async function countUnread(c){const {count,error}=await c.from('notifications').select('*',{count:'exact',head:true}).eq('is_read',false);if(error)fail('count unread',error);return count??0}
