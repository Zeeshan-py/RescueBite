export const FOOD_TYPES = ['Cooked Food', 'Bakery', 'Fruits', 'Vegetables', 'Packaged Food', 'Other'] as const

export type FoodTypeOption = (typeof FOOD_TYPES)[number]

export interface DonationInput {
  foodType: FoodTypeOption | ''
  otherFoodType: string
  quantity: number
  mealPortions: number
  location: string
  latitude: number | null
  longitude: number | null
  availableFrom: string
  collectionDeadline: string
  safetyInformation: string
  description: string
}

export type DonationFieldErrors = Partial<Record<keyof DonationInput, string>>

export const EMPTY_DONATION_INPUT: DonationInput = {
  foodType: '', otherFoodType: '', quantity: 0, mealPortions: 0, location: '', latitude: null, longitude: null,
  availableFrom: '', collectionDeadline: '', safetyInformation: '', description: '',
}
