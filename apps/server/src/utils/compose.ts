type Middleware<T> = (ctx: T, next: () => Promise<void>) => Promise<void>

export const compose = <T>(...middlewares: Middleware<T>[]) => async (ctx: T): Promise<void> => {
  let index = 0
  const next = async (): Promise<void> => {
    const fn = middlewares[index++]
    if (fn) await fn(ctx, next)
  }
  await next()
}
