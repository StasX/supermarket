export function productSearchFields(name: string) {
  const searchName = name.toLowerCase();
  const characters = Array.from(searchName);
  const grams = new Set<string>();
  for (let start = 0; start < characters.length; start++) {
    for (let length = 1; length <= 3 && start + length <= characters.length; length++) {
      grams.add(characters.slice(start, start + length).join(''));
    }
  }
  return { searchName, searchGrams: [...grams] };
}
