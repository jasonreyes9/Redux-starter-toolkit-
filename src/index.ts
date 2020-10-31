import type { AnyAction, Reducer } from '@reduxjs/toolkit';
import { buildThunks } from './buildThunks';
import { buildSlice } from './buildSlice';
import { buildActionMaps } from './buildActionMaps';
import { buildSelectors } from './buildSelectors';
import { buildHooks } from './buildHooks';
import { buildMiddleware } from './buildMiddleware';
import type { EndpointDefinitions, EndpointBuilder } from './endpointDefinitions';
import type { CombinedState, QueryStatePhantomType } from './apiState';

function defaultSerializeQueryArgs(args: any) {
  return JSON.stringify(args);
}

export function createApi<
  InternalQueryArgs,
  Definitions extends EndpointDefinitions,
  ReducerPath extends string,
  EntityTypes extends string
>({
  baseQuery,
  reducerPath,
  serializeQueryArgs = defaultSerializeQueryArgs,
  endpoints,
}: {
  baseQuery(args: InternalQueryArgs): any;
  entityTypes: readonly EntityTypes[];
  reducerPath: ReducerPath;
  serializeQueryArgs?(args: InternalQueryArgs): string;
  endpoints(build: EndpointBuilder<InternalQueryArgs, EntityTypes>): Definitions;
}) {
  type State = CombinedState<Definitions, EntityTypes>;

  const endpointDefinitions = endpoints({
    query: (x) => x,
    mutation: (x) => x,
  });

  const { queryThunk, mutationThunk } = buildThunks({ baseQuery, reducerPath });

  const {
    reducer: _reducer,
    actions: { unsubscribeQueryResult, unsubscribeMutationResult },
  } = buildSlice({ endpointDefinitions, queryThunk, mutationThunk, reducerPath });

  const reducer = (_reducer as any) as Reducer<State & QueryStatePhantomType<ReducerPath>, AnyAction>;

  const { mutationActions, queryActions } = buildActionMaps({
    queryThunk,
    mutationThunk,
    serializeQueryArgs,
    endpointDefinitions,
  });

  const { querySelectors, mutationSelectors } = buildSelectors({
    serializeQueryArgs,
    endpointDefinitions,
    reducerPath,
  });

  const { middleware } = buildMiddleware({ reducerPath, endpointDefinitions, queryThunk, mutationThunk });

  const { hooks } = buildHooks({
    endpointDefinitions,
    querySelectors,
    queryActions,
    unsubscribeQueryResult,
    mutationSelectors,
    mutationActions,
    unsubscribeMutationResult,
  });

  return {
    queryActions,
    mutationActions,
    reducer,
    selectors: {
      query: querySelectors,
      mutation: mutationSelectors,
    },
    unsubscribeQueryResult,
    unsubscribeMutationResult,
    middleware,
    hooks,
  };
}
