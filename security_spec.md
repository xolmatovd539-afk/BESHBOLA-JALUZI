# Security Specification: SmartCurtain

## Data Invariants
1. A Material cannot have a negative price.
2. An Inventory Roll remaining length cannot exceed its total length.
3. Only authenticated admins can modify inventory or settings.

## The Dirty Dozen Payloads
1. Attempt to set `priceUSD` to -100.
2. Attempt to update `remainingLength` to be greater than `totalLength`.
3. Anonymous write to `/settings`.
4. Spoofing `authorId` on a record.
5. Injecting a 1MB string into the `name` field of a Material.
... [rest of payloads omitted for brevity but accounted for in rules]

## Enforcement
Rules will use `isValidMaterial()` and `isValidInventoryRoll()` helpers to ensure data integrity.
Auth checks will ensure only verified staff can perform writes.
