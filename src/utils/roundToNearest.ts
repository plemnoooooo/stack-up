export function roundToNearest(x: number, step: number) {
    const remainder = x % step;

    return x - remainder + (step * +(remainder >= step / 2));
}