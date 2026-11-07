/* ---------------------------------------
    Shuts a built-in function for good: it is swapped for a stand-in that can be neither written over nor redefined.
    The three guards use it. The sandboxed child loads them with --import, before any of its own code.
    Ported from Kinetic Markdown's security/seal.mjs, same logic.
--------------------------------------- */

export type AnyFunction = (...args: never[]) => unknown;
export type RefusalFactory = (label: string) => AnyFunction;

export function sealFunction(target: object, name: string, standIn: AnyFunction): void {
  const enumerable = Object.getOwnPropertyDescriptor(target, name)?.enumerable ?? false;
  Object.defineProperty(target, name, { value: standIn, writable: false, configurable: false, enumerable });
}

/* -- Seals each named function that exists. refusalFor(label) makes its stand-in; the label names the call, like "dns.resolveTxt" -- */
export function sealFunctions(target: object, names: readonly string[], prefix: string, refusalFor: RefusalFactory): void {
  for (const name of names) {
    if (Object.hasOwn(target, name) && typeof (target as Record<string, unknown>)[name] === 'function') sealFunction(target, name, refusalFor(`${prefix}.${name}`));
  }
}

/* -- Every function stored directly on target, except the names in `except` -- */
export function sealEveryFunction(target: object, prefix: string, refusalFor: RefusalFactory, { except = [] }: { except?: readonly string[] } = {}): void {
  const names = Object.getOwnPropertyNames(target).filter(
    (name) => name !== 'constructor' && !except.includes(name) && typeof Object.getOwnPropertyDescriptor(target, name)?.value === 'function',
  );
  sealFunctions(target, names, prefix, refusalFor);
}
