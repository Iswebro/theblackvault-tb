// Type overrides for ox library to fix build compatibility issues
declare module 'ox' {
  export * from 'ox/core'
}

declare module 'ox/core' {
  export const Signature: any
  export const Hex: any
  export const AbiParameters: any
}

declare module 'ox/core/Signature' {
  export function from(signature: any): any
  export function fromLegacy(signature: any): any
  export function fromRpc(signature: any): any
  export function fromBytes(signature: any): any
}

declare module 'ox/core/Hex' {
  export function from(hex: any): any
  export function toBigInt(hex: any): bigint
}

declare module 'ox/core/internal/abiParameters' {
  export function encodeArray(value: any, options: any): any
}
