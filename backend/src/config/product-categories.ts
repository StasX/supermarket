export enum ProductCategory {
  MilkAndEggs = 'Milk & Eggs',
  VegetablesAndFruits = 'Vegetables & Fruits',
  MeatAndFish = 'Meet & Fish',
  WineAndDrinks = 'Wine & Drinks',
}

export const productCategories: readonly string[] = Object.values(ProductCategory);
