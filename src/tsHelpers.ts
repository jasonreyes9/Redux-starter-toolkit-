import { Middleware } from 'redux'

/**
 * return True if T is `any`, otherwise return False
 * taken from https://github.com/joonhocho/tsdef
 *
 * @internal
 */
export type IsAny<T, True, False = never> =
  // test if we are going the left AND right path in the condition
  true | false extends (T extends never ? true : false) ? True : False

/**
 * return True if T is `unknown`, otherwise return False
 * taken from https://github.com/joonhocho/tsdef
 *
 * @internal
 */
export type IsUnknown<T, True, False = never> = unknown extends T
  ? IsAny<T, False, True>
  : False

export type FallbackIfUnknown<T, Fallback> = IsUnknown<T, Fallback, T>

/**
 * @internal
 */
export type IfMaybeUndefined<P, True, False> = [undefined] extends [P]
  ? True
  : False

/**
 * @internal
 */
export type IfVoid<P, True, False> = [void] extends [P] ? True : False

/**
 * @internal
 */
export type IsEmptyObj<T, True, False = never> = T extends any
  ? keyof T extends never
    ? IsUnknown<T, False, IfMaybeUndefined<T, False, IfVoid<T, False, True>>>
    : False
  : never

/**
 * returns True if TS version is above 3.5, False if below.
 * uses feature detection to detect TS version >= 3.5
 * * versions below 3.5 will return `{}` for unresolvable interference
 * * versions above will return `unknown`
 *
 * @internal
 */
export type AtLeastTS35<True, False> = [True, False][IsUnknown<
  ReturnType<<T>() => T>,
  0,
  1
>]

/**
 * @internal
 */
export type IsUnknownOrNonInferrable<T, True, False> = AtLeastTS35<
  IsUnknown<T, True, False>,
  IsEmptyObj<T, True, IsUnknown<T, True, False>>
>

/**
 * Combines all dispatch signatures of all middlewares in the array `M` into
 * one intersected dispatch signature.
 */
export type DispatchForMiddlewares<M> = M extends ReadonlyArray<any>
  ? UnionToIntersection<
      M[number] extends infer MiddlewareValues
        ? MiddlewareValues extends Middleware<infer DispatchExt, any, any>
          ? DispatchExt extends Function
            ? DispatchExt
            : never
          : never
        : never
    >
  : never

/**
 * Convert a Union type `(A|B)` to and intersecion type `(A&B)`
 */
type UnionToIntersection<U> = (U extends any
? (k: U) => void
: never) extends (k: infer I) => void
  ? I
  : never

/**
 * Helper type. Passes T out again, but boxes it in a way that it cannot
 * "widen" the type by accident if it is a generic that should be inferred
 * from elsewhere.
 *
 * @internal
 */
export type NoInfer<T> = [T][T extends any ? 0 : never]

export type Omit<T, K extends keyof any> = Pick<T, Exclude<keyof T, K>>
