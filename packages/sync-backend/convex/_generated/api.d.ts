/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth from "../auth.js";
import type * as authIdentity from "../authIdentity.js";
import type * as crons from "../crons.js";
import type * as documents from "../documents.js";
import type * as http from "../http.js";
import type * as orphanAssets from "../orphanAssets.js";
import type * as permissions from "../permissions.js";
import type * as pocIdentity from "../pocIdentity.js";
import type * as prosemirror from "../prosemirror.js";
import type * as sync from "../sync.js";
import type * as viewer from "../viewer.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  authIdentity: typeof authIdentity;
  crons: typeof crons;
  documents: typeof documents;
  http: typeof http;
  orphanAssets: typeof orphanAssets;
  permissions: typeof permissions;
  pocIdentity: typeof pocIdentity;
  prosemirror: typeof prosemirror;
  sync: typeof sync;
  viewer: typeof viewer;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  prosemirrorSync: import("@convex-dev/prosemirror-sync/_generated/component.js").ComponentApi<"prosemirrorSync">;
};
