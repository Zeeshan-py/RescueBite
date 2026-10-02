import { describe, expect, it } from 'vitest'
import { analyticsRange, percentage, workflowRates } from './analytics.utils'
import type { ImpactReport } from './analytics.types'
describe('analytics dates and rate definitions', () => {
  it.each([['7','2026-09-27'],['30','2026-09-04'],['90','2026-07-06']] as const)('includes today in last %s UTC days', (preset, first) => {
    expect(analyticsRange(preset,'','',new Date('2026-10-03T23:59:00Z'))).toEqual({from_date:first,to_date:'2026-10-03'})
  })
  it('uses no arbitrary starting date for all time',()=>expect(analyticsRange('all')).toEqual({from_date:null,to_date:null}))
  it('validates inclusive custom days',()=>expect(analyticsRange('custom','2026-10-01','2026-10-03',new Date('2026-10-03'))).toEqual({from_date:'2026-10-01',to_date:'2026-10-03'}))
  it.each([['2026-02-30','2026-03-01'],['2026-10-03','2026-10-02'],['','2026-10-03'],['2026-10-01','2026-10-04'],['2000-01-01','2026-10-03']])('rejects invalid range %s to %s',(from,to)=>expect(()=>analyticsRange('custom',from,to,new Date('2026-10-03'))).toThrow())
  it('does not misrepresent an empty denominator as zero success',()=>expect(percentage(0,0)).toBe('N/A'))
  it.each([[1,4,'25.0%'],[1,3,'33.3%'],[0,2,'0.0%']])('formats %s/%s',(n,d,expected)=>expect(percentage(Number(n),Number(d))).toBe(expected))
  it('uses documented cohort/task denominators for every rate',()=>{
    const report = {donations:{total:10,matched:8,accepted:4,completed:3,cancelled:2,expired:1},tasks:{total:4,collected:3,delivered:2}} as ImpactReport
    expect(workflowRates(report).map(r=>[r.n,r.d])).toEqual([[8,10],[4,8],[3,4],[2,4],[3,10],[2,10],[1,10]])
    expect(workflowRates(report).every(r=>r.definition.includes('/'))).toBe(true)
  })
})
