export function sortByKey<T>(key: keyof T, array: T[]) {
    array.sort((a, b) => +a[key] - +b[key]);
}