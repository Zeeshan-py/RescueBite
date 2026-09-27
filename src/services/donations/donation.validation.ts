import { FOOD_TYPES, type DonationFieldErrors, type DonationInput } from './donation.types'

export function validateDonation(input: DonationInput): DonationFieldErrors {
  const errors: DonationFieldErrors = {}
  if (!input.foodType || !FOOD_TYPES.includes(input.foodType)) errors.foodType = 'Choose a valid food type.'
  if (input.foodType === 'Other' && !input.otherFoodType.trim()) errors.otherFoodType = 'Describe the food type.'
  if (!Number.isFinite(input.quantity) || input.quantity <= 0) errors.quantity = 'Quantity must be greater than zero.'
  if (!Number.isInteger(input.mealPortions) || input.mealPortions <= 0) errors.mealPortions = 'Meal portions must be a whole number greater than zero.'
  if (!input.location.trim()) errors.location = 'Enter the pickup address or location.'

  const available = new Date(input.availableFrom)
  const deadline = new Date(input.collectionDeadline)
  if (!input.availableFrom || Number.isNaN(available.getTime())) errors.availableFrom = 'Enter a valid availability date and time.'
  if (!input.collectionDeadline || Number.isNaN(deadline.getTime())) errors.collectionDeadline = 'Enter a valid collection deadline.'
  if (!errors.availableFrom && !errors.collectionDeadline && deadline <= available) {
    errors.collectionDeadline = 'The collection deadline must be after the available time.'
  }
  return errors
}

export function resolvedFoodType(input: DonationInput): string {
  return input.foodType === 'Other' ? `Other: ${input.otherFoodType.trim()}` : input.foodType
}

export function hasDonationErrors(errors: DonationFieldErrors): boolean {
  return Object.keys(errors).length > 0
}

