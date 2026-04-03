export type Awaitable<T> = T | Promise<T>;

export type BivariantFn<TArgs extends readonly unknown[], TReturn> = {
    bivarianceHack(...args: TArgs): TReturn;
}["bivarianceHack"];

export type UnionToIntersection<U> = (U extends unknown ? (k: U) => void : never) extends (
    k: infer I,
) => void
    ? I
    : never;

export type IsAny<T> = 0 extends 1 & T ? true : false;

export type StripIndex<T> = {
    [K in keyof T as string extends K
        ? never
        : number extends K
          ? never
          : symbol extends K
            ? never
            : K]: T[K];
};
