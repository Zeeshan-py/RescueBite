import { useEffect, useState } from 'react'
import { arrangeCollection, getCollectionDetails, type CollectionDetails } from '../../services/recipients/recipient.service'
import { confirmReceipt } from '../../services/delivery/delivery.service'
import type { Donation } from '../../types/domain'
import { useNotifications } from '../../services/notifications/useNotifications'
import { CoordinationContact } from './CoordinationContact'

const toLocal = (value: string) => { const d=new Date(value); return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16) }
export function DirectCollection({ donation, canConfirm = false, onDonationChange }: { donation: Donation; canConfirm?: boolean; onDonationChange?: (updated: Donation) => void }) {
  const { notifications } = useNotifications(), newestNotification = notifications[0]?.id
  const [details,setDetails]=useState<CollectionDetails|null>(null),[pickupAt,setPickupAt]=useState(''),[instructions,setInstructions]=useState('')
  const [loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[error,setError]=useState<string|null>(null),[message,setMessage]=useState<string|null>(null)
  useEffect(()=>{ if (!['ACCEPTED','PICKUP_ASSIGNED','COLLECTED','DELIVERED','COMPLETED'].includes(donation.status)) return
    let active=true;void getCollectionDetails(donation.id).then(result=>{if(active){setDetails(result);setPickupAt(result.collection_time?toLocal(result.collection_time):'');setInstructions(result.instructions)}}).catch(caught=>{if(active)setError(caught.message)}).finally(()=>{if(active)setLoading(false)})
    return ()=>{active=false}
  },[donation.id,donation.status,newestNotification])
  if (!['ACCEPTED','PICKUP_ASSIGNED','COLLECTED','DELIVERED','COMPLETED'].includes(donation.status) || loading || (!details && !error)) return null
  return <section className="mt-6 rounded-xl border border-line bg-white p-5 sm:p-6"><h2 className="text-lg font-semibold">Direct collection</h2><p className="mt-2 text-sm text-muted">Pickup is arranged with the accepted recipient. No volunteer or free delivery is assumed.</p>
    {error && <p role="alert" className="mt-4 text-sm text-red-800">{error}</p>}{message && <p role="status" className="mt-4 text-sm text-forest">{message}</p>}
    {details && <><CoordinationContact title={canConfirm ? 'Donor contact' : 'Recipient contact'} name={canConfirm ? details.business_name || details.donor_name : details.recipient_name} phone={canConfirm ? details.contact_phone : details.recipient_phone} email={canConfirm ? details.contact_email : details.recipient_email} /><p className="mt-4 text-sm">Pickup address: <strong>{details.pickup_address}</strong></p><p className="mt-2 text-sm">{details.collection_time?`Scheduled: ${new Date(details.collection_time).toLocaleString()}`:'Collection time not arranged yet.'}</p>{details.instructions&&<p className="mt-2 text-sm">{details.instructions}</p>}
      {!canConfirm && donation.status==='ACCEPTED' && <form className="mt-5 grid gap-4 sm:grid-cols-2" onSubmit={event=>{event.preventDefault();setSaving(true);setError(null);void arrangeCollection(donation.id,pickupAt,instructions).then(()=>getCollectionDetails(donation.id)).then(next=>{setDetails(next);setMessage('Collection details sent securely.')}).catch(caught=>setError(caught.message)).finally(()=>setSaving(false))}}><label className="text-sm font-medium">Collection time<input type="datetime-local" required value={pickupAt} onChange={event=>setPickupAt(event.target.value)} className="mt-2 w-full rounded-lg border border-line p-3" /></label><label className="text-sm font-medium">Private pickup instructions<textarea required maxLength={2000} value={instructions} onChange={event=>setInstructions(event.target.value)} className="mt-2 w-full rounded-lg border border-line p-3" /></label><button disabled={saving} className="min-h-11 rounded-lg bg-forest px-5 text-white sm:col-span-2">Save collection details</button></form>}
      {canConfirm && donation.status!=='COMPLETED' && details.collection_time && new Date(details.collection_time)<=new Date() && <button disabled={saving} onClick={()=>{setSaving(true);setError(null);void confirmReceipt(donation.id).then(next=>{onDonationChange?.(next);setMessage('Collection confirmed.')}).catch(caught=>setError(caught.message)).finally(()=>setSaving(false))}} className="mt-5 min-h-11 rounded-lg bg-forest px-5 text-white">Confirm receipt and complete donation</button>}</>}
  </section>
}
