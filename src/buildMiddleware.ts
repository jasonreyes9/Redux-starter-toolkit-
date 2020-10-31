import { AnyAction, AsyncThunk, Middleware, ThunkDispatch } from '@reduxjs/toolkit';
import { batch } from 'react-redux';
import { QueryState, RootState } from './apiState';
import { MutationThunkArg, QueryThunkArg } from './buildThunks';
import { calculateProvidedBy, EndpointDefinitions } from './endpointDefinitions';

export function buildMiddleware<Definitions extends EndpointDefinitions, ReducerPath extends string>({
  reducerPath,
  endpointDefinitions,
  queryThunk,
  mutationThunk,
}: {
  reducerPath: ReducerPath;
  endpointDefinitions: EndpointDefinitions;
  queryThunk: AsyncThunk<unknown, QueryThunkArg<any>, {}>;
  mutationThunk: AsyncThunk<unknown, MutationThunkArg<any>, {}>;
}) {
  const middleware: Middleware<{}, RootState<Definitions, string, ReducerPath>, ThunkDispatch<any, any, AnyAction>> = (
    api
  ) => (next) => (action) => {
    const result = next(action);

    if (mutationThunk.fulfilled.match(action)) {
      const state = api.getState()[reducerPath];

      const invalidateEntities = calculateProvidedBy(
        endpointDefinitions[action.meta.arg.endpoint].invalidates || [],
        action.payload
      );
      const toInvalidate: { [endpoint: string]: Set<string> } = {};
      for (const entity of invalidateEntities) {
        for (const invalidate of state.provided[entity.type]?.[entity.id || '*']) {
          (toInvalidate[invalidate.endpoint] ??= new Set()).add(invalidate.serializedQueryArgs);
        }
      }
      batch(() => {
        for (const [endpoint, collectedArgs] of Object.entries(toInvalidate)) {
          for (const serializedQueryArgs of collectedArgs) {
            const internalQueryArgs = (state.queries as QueryState<any>)[endpoint]?.[serializedQueryArgs]?.arg;
            if (internalQueryArgs) {
              api.dispatch(
                queryThunk({
                  endpoint,
                  serializedQueryArgs,
                  internalQueryArgs,
                })
              );
            }
          }
        }
      });
    }

    return result;
  };

  return { middleware };
}
