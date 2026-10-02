import { beforeEach, expect, it, vi } from 'vitest'
const { rpc, abortSignal, result } = vi.hoisted(()=>{
  const result:{data:{role:string}|null;error:{code:string}|null}={data:{role:'DONOR'},error:null}
  const abortSignal=vi.fn(async()=>result)
  return {rpc:vi.fn(()=>({abortSignal})),abortSignal,result}
})
vi.mock('../../lib/supabase',()=>({getSupabaseClient:()=>({rpc})}))
import { getImpact } from './analytics.service'
beforeEach(()=>{vi.clearAllMocks();result.data={role:'DONOR'};result.error=null})
it.each(['DONOR','NGO','VOLUNTEER'] as const)('requests %s own analytics without an owner identifier',async role=>{
  result.data={role};await getImpact(role,{from_date:null,to_date:null})
  expect(rpc).toHaveBeenCalledWith('get_my_impact',{from_date:null,to_date:null});expect(abortSignal).toHaveBeenCalled()
})
it('requests the admin-guarded platform function',async()=>{result.data={role:'ADMIN'};await getImpact('ADMIN',{from_date:null,to_date:null});expect(rpc).toHaveBeenCalledWith('get_platform_impact',{from_date:null,to_date:null})})
it('rejects mismatched roles',async()=>{await expect(getImpact('ADMIN',{from_date:null,to_date:null})).rejects.toThrow('permission')})
it('shows authorization errors clearly',async()=>{result.error={code:'42501'};await expect(getImpact('ADMIN',{from_date:null,to_date:null})).rejects.toThrow('permission')})
it('shows retryable errors without server internals',async()=>{result.error={code:'NETWORK'};await expect(getImpact('DONOR',{from_date:null,to_date:null})).rejects.toThrow('connection')})
