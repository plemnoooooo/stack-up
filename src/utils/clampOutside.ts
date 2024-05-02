export function clampOutside(value: number, min: number, max: number, clampToMin?: boolean) {
    return ((value <= min) || (value >= max))
        ? value
        : clampToMin
            ? Math.min(value, min)
            : Math.max(value, max);
}
