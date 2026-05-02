export type Awaitable<T> = T | Promise<T>;

export type BivariantFn<TArgs extends readonly unknown[], TResult> = {
    bivarianceHack(...args: TArgs): TResult;
}["bivarianceHack"];

export type UnionToIntersection<TUnion> = (
    TUnion extends unknown
        ? (value: TUnion) => void
        : never
) extends (value: infer TIntersection) => void
    ? TIntersection
    : never;

export type TupleValues<TValue> = TValue extends readonly unknown[] ? TValue[number] : never;

export type RemoveIndexSignature<T> = {
    [K in keyof T as string extends K
        ? never
        : number extends K
          ? never
          : symbol extends K
            ? never
            : K]: T[K];
};
