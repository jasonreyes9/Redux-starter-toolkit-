import { AnyAction, AsyncThunkAction, ThunkAction, ThunkDispatch } from '@reduxjs/toolkit';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector, batch } from 'react-redux';
import { MutationSubState, QuerySubState } from './apiState';
import {
  EndpointDefinitions,
  MutationDefinition,
  QueryDefinition,
  isQueryDefinition,
  isMutationDefinition,
} from './endpointDefinitions';
import { QueryResultSelectors, MutationResultSelectors } from './buildSelectors';
import { QueryActions, MutationActions } from './buildActionMaps';
import { UnsubscribeMutationResult, UnsubscribeQueryResult } from './buildSlice';

export interface QueryHookOptions {
  skip?: boolean;
}

export type QueryHook<D extends QueryDefinition<any, any, any, any>> = D extends QueryDefinition<
  infer QueryArg,
  any,
  any,
  any
>
  ? (arg: QueryArg, options?: QueryHookOptions) => QuerySubState<D>
  : never;

export type MutationHook<D extends MutationDefinition<any, any, any, any>> = D extends MutationDefinition<
  infer QueryArg,
  any,
  any,
  infer ResultType
>
  ? () => [(arg: QueryArg) => ReturnType<AsyncThunkAction<ResultType, any, any>>, MutationSubState<D>]
  : never;

export type Hooks<Definitions extends EndpointDefinitions> = {
  [K in keyof Definitions]: Definitions[K] extends QueryDefinition<any, any, any, any>
    ? {
        useQuery: QueryHook<Definitions[K]>;
      }
    : Definitions[K] extends MutationDefinition<any, any, any, any>
    ? {
        useMutation: MutationHook<Definitions[K]>;
      }
    : never;
};

export function buildHooks<Definitions extends EndpointDefinitions>({
  endpointDefinitions,
  querySelectors,
  queryActions,
  unsubscribeQueryResult,
  mutationSelectors,
  mutationActions,
  unsubscribeMutationResult,
}: {
  endpointDefinitions: Definitions;
  querySelectors: QueryResultSelectors<Definitions, any>;
  queryActions: QueryActions<Definitions, any>;
  unsubscribeQueryResult: UnsubscribeQueryResult;
  mutationSelectors: MutationResultSelectors<Definitions, any>;
  mutationActions: MutationActions<Definitions, any>;
  unsubscribeMutationResult: UnsubscribeMutationResult;
}) {
  const hooks = Object.entries(endpointDefinitions).reduce((acc, [name, endpoint]) => {
    if (isQueryDefinition(endpoint)) {
      acc[name] = {
        useQuery: (args, options) => {
          const dispatch = useDispatch<ThunkDispatch<any, any, AnyAction>>();
          const skip = options?.skip === true;
          useEffect(() => {
            if (skip) {
              return;
            }
            const promise = dispatch(queryActions[name](args));
            assertIsNewRTKPromise(promise);
            return () =>
              void dispatch(
                unsubscribeQueryResult({
                  endpoint: name,
                  serializedQueryArgs: promise.arg.serializedQueryArgs,
                  requestId: promise.requestId,
                })
              );
          }, [args, dispatch, skip]);
          return useSelector(querySelectors[name](skip ? undefined : args));
        },
      };
    } else if (isMutationDefinition(endpoint)) {
      acc[name] = {
        useMutation: () => {
          const dispatch = useDispatch<ThunkDispatch<any, any, AnyAction>>();
          const [requestId, setRequestId] = useState<string>();

          const promiseRef = useRef<ReturnType<AsyncThunkAction<any, any, any>>>();

          useEffect(() => {
            return () => {
              if (promiseRef.current) {
                dispatch(unsubscribeMutationResult({ endpoint: name, requestId: promiseRef.current.requestId }));
              }
            };
          }, [dispatch]);

          const triggerMutation = useCallback(
            function (args) {
              let promise: ReturnType<AsyncThunkAction<any, any, any>>;
              batch(() => {
                if (promiseRef.current) {
                  dispatch(unsubscribeMutationResult({ endpoint: name, requestId: promiseRef.current.requestId }));
                }
                promise = dispatch(mutationActions[name](args));
                assertIsNewRTKPromise(promise);
                promiseRef.current = promise;
                setRequestId(promise.requestId);
              });
              return promise!;
            },
            [dispatch]
          );

          return [triggerMutation, useSelector(mutationSelectors[name](requestId))];
        },
      };
    }
    return acc;
  }, {} as Record<string, { useQuery: QueryHook<any> } | { useMutation: MutationHook<any> }>) as Hooks<Definitions>;

  return { hooks };
}

function assertIsNewRTKPromise(action: ReturnType<ThunkAction<any, any, any, any>>) {
  if (!('requestId' in action) || !('arg' in action)) {
    throw new Error(`
    You are running a version of RTK that is too old.
    Currently you need an experimental build of RTK.
    Please install it via
    yarn add "https://pkg.csb.dev/reduxjs/redux-toolkit/commit/56994225/@reduxjs/toolkit"
    `);
  }
}
