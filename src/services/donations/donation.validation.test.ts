import { describe, expect, it } from 'vitest'
import { validateDonation } from './donation.validation'
import type { DonationInput } from './donation.types'

const valid: DonationInput = {
  foodType: 'Cooked Food', otherFoodType: '', quantity: 12.5, mealPortions: 25,
  location: 'Main Street, Lahore', latitude: null, longitude: null, availableFrom: '2026-09-27T12:00',
  collectionDeadline: '2026-09-27T15:00', safetyInformation: 'Kept covered.', description: '',
}

describe('donation validation', () => {
  it('rejects incomplete or invalid map coordinates', () => {
    expect(validateDonation({ ...valid, latitude: 31, longitude: null }).latitude).toBeTruthy()
    expect(validateDonation({ ...valid, latitude: 91, longitude: 0 }).latitude).toBeTruthy()
    expect(validateDonation({ ...valid, latitude: 31, longitude: 74 })).toEqual({})
  })
  it('accepts valid donation information', () => expect(validateDonation(valid)).toEqual({}))
  it('rejects a non-positive quantity', () => expect(validateDonation({ ...valid, quantity: -1 }).quantity).toBeTruthy())
  it('rejects zero or fractional meal portions', () => {
    expect(validateDonation({ ...valid, mealPortions: 0 }).mealPortions).toBeTruthy()
    expect(validateDonation({ ...valid, mealPortions: 1.5 }).mealPortions).toBeTruthy()
  })
  it('rejects an invalid food type and an undescribed Other option', () => {
    expect(validateDonation({ ...valid, foodType: 'Unknown' as DonationInput['foodType'] }).foodType).toBeTruthy()
    expect(validateDonation({ ...valid, foodType: 'Other', otherFoodType: ' ' }).otherFoodType).toBeTruthy()
  })
  it('requires the deadline to follow availability', () => {
    expect(validateDonation({ ...valid, collectionDeadline: valid.availableFrom }).collectionDeadline).toBeTruthy()
  })
  it('rejects values larger than the database text limits', () => {
    expect(validateDonation({ ...valid, location: 'x'.repeat(1001) }).location).toBeTruthy()
    expect(validateDonation({ ...valid, description: 'x'.repeat(10001) }).description).toBeTruthy()
    expect(validateDonation({ ...valid, safetyInformation: 'x'.repeat(10001) }).safetyInformation).toBeTruthy()
    expect(validateDonation({ ...valid, foodType: 'Other', otherFoodType: 'x'.repeat(201) }).otherFoodType).toBeTruthy()
  })
})
