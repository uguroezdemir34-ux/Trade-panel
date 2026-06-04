/**
 * Minimal JSX type scaffolding for when @types/react is not installed.
 *
 * Fixes three categories of TypeScript errors:
 *   TS2882 — side-effect CSS import not recognised
 *   TS2741 — `children` missing because JSX.ElementChildrenAttribute not declared
 *   TS2322 — `key` treated as a component prop instead of a JSX intrinsic attribute
 */

/** Allow CSS side-effect imports (e.g. import "./globals.css"). */
declare module "*.css" {
  const content: Record<string, string>;
  export default content;
}

/** Allow @testing-library/jest-dom vitest setup import. */
declare module "@testing-library/jest-dom/vitest" {}

/** Node.js globals used in vitest.config.ts and scripts. */
declare const __dirname: string;
declare const __filename: string;

declare namespace JSX {
  /**
   * Maps nested JSX content to the `children` prop.
   * Without this, TypeScript ignores children when building the props object,
   * causing TS2741 "Property 'children' is missing".
   */
  interface ElementChildrenAttribute {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    children: any;
  }

  /**
   * Attributes that apply to every JSX element but are NOT forwarded to
   * the component's own prop type.  Declaring `key` here prevents TS2322
   * "Property 'key' does not exist on type '{ ... }'" errors in list renders.
   */
  interface IntrinsicAttributes {
    key?: string | number | bigint | null | undefined;
  }
}
