export const FOOD_TYPES = ['Cooked Food', 'Bakery', 'Fruits', 'Vegetables', 'Packaged Food', 'Other'] as const

export type FoodTypeOption = (typeof FOOD_TYPES)[number]

export interface DonationInput {
  foodType: FoodTypeOption | ''
  otherFoodType: string
  quantity: number
  mealPortions: number
  location: string
  availableFrom: string
  collectionDeadline: string
  safetyInformation: string
  description: string
}

export type DonationFieldErrors = Partial<Record<keyof DonationInput, string>>

export const EMPTY_DONATION_INPUT: DonationInput = {
  foodType: '', otherFoodType: '', quantity: 0, mealPortions: 0, location: '',
  availableFrom: '', collectionDeadline: '', safetyInformation: '', description: '',
}
