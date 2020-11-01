import { AnyAction, AsyncThunk, Middleware, ThunkDispatch } from '@reduxjs/toolkit';
import { batch } from 'react-redux';
import { QueryState, QueryStatus, RootState } from './apiState';
import { InternalState, InvalidateQueryResult } from './buildSlice';
import { MutationThunkArg, QueryThunkArg } from './buildThunks';
import { calculateProvidedBy, EndpointDefinitions } from './endpointDefinitions';

export function buildMiddleware<Definitions extends EndpointDefinitions, ReducerPath extends string>({
  reducerPath,
  endpointDefinitions,
  queryThunk,
  mutationThunk,
  removeQueryResult,
}: {
  reducerPath: ReducerPath;
  endpointDefinitions: EndpointDefinitions;
  queryThunk: AsyncThunk<unknown, QueryThunkArg<any>, {}>;
  mutationThunk: AsyncThunk<unknown, MutationThunkArg<any>, {}>;
  removeQueryResult: InvalidateQueryResult;
}) {
  const middleware: Middleware<{}, RootState<Definitions, string, ReducerPath>, ThunkDispatch<any, any, AnyAction>> = (
    api
  ) => (next) => (action) => {
    const result = next(action);

    if (mutationThunk.fulfilled.match(action)) {
      const state = api.getState()[reducerPath] as InternalState;

      const invalidateEntities = calculateProvidedBy(
        endpointDefinitions[action.meta.arg.endpoint].invalidates,
        action.payload,
        state.mutations[action.meta.arg.endpoint]?.[action.meta.requestId]?.arg
      );
      const toInvalidate: { [endpoint: string]: Set<string> } = {};
      for (const entity of invalidateEntities) {
        const provided = state.provided[entity.type];
        if (!provided) {
          continue;
        }

        let invalidateSubscriptions =
          (entity.id !== undefined
            ? // id given: invalidate all queries that provide this type & id
              provided[entity.id]
            : // no id: invalidate all queries that provide this type
              Object.values(provided).flat(1)) ?? [];

        for (const invalidate of invalidateSubscriptions) {
          (toInvalidate[invalidate.endpoint] ??= new Set()).add(invalidate.serializedQueryArgs);
        }
      }
      batch(() => {
        for (const [endpoint, collectedArgs] of Object.entries(toInvalidate)) {
          for (const serializedQueryArgs of collectedArgs) {
            const querySubState = (state.queries as QueryState<any>)[endpoint]?.[serializedQueryArgs];
            if (querySubState) {
              if (querySubState.subscribers.length === 0) {
                api.dispatch(removeQueryResult({ endpoint, serializedQueryArgs }));
              } else if (querySubState.status !== QueryStatus.uninitialized) {
                const arg = querySubState.arg;
                const internalQueryArgs = endpointDefinitions[endpoint].query(arg);
                api.dispatch(
                  queryThunk({
                    endpoint,
                    serializedQueryArgs,
                    arg,
                    internalQueryArgs,
                  })
                );
              } else {
              }
            }
          }
        }
      });
    }

    return result;
  };

  return { middleware };
}
