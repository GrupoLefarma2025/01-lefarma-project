# Delta for caratulas-proveedor

> Greenfield capability — `openspec/specs/caratulas-proveedor/spec.md` does not exist yet.
> All requirements below are ADDED. On archive they become the base spec.
> Authoritative scope source: `proposal.md` §2 (caps 3 & 4) + §4 rule 5 (thumbnail→badge).

## ADDED Requirements

### Requirement: Carátula count badge per supplier row

The supplier list table MUST show, per row, a badge counting how many of the supplier's
accounts currently hold a carátula (e.g., "3 carátulas"). A supplier with zero
carátulas MUST render no badge. Activating the badge MUST open the carátula preview
modal (see "Ver carátulas" action).

#### Scenario: Multiple carátulas show a count badge

- GIVEN "FARMACIA SA" has 3 accounts and all 3 have a carátula
- WHEN its row renders in ProveedoresList
- THEN the row shows a "3 carátulas" badge in place of the old single thumbnail

#### Scenario: Zero carátulas show no badge

- GIVEN "FARMACIA NUEVA" has 2 accounts and neither has a carátula
- WHEN its row renders
- THEN no carátula badge is shown

#### Scenario: Badge opens the preview modal

- GIVEN the "FARMACIA SA" row shows the "3 carátulas" badge
- WHEN the user clicks the badge
- THEN the carátula preview modal opens for that supplier

### Requirement: "Ver carátulas" action and preview modal

Each supplier row MUST expose a "Ver carátulas" action that opens a modal listing every
account that holds a carátula, one entry per account. Each entry MUST show an account
identifier (last 4 digits) and a preview affordance that reuses the existing fullscreen
viewer. A supplier with no carátulas MUST show an empty-state message in the modal.

#### Scenario: Modal lists one entry per carátula

- GIVEN "FARMACIA SA" has carátulas on accounts ••1234 and ••5678
- WHEN the user opens "Ver carátulas"
- THEN the modal shows two entries, each with its account's last 4 digits and a preview button

#### Scenario: Empty state when supplier has no carátulas

- GIVEN "FARMACIA NUEVA" has no carátulas
- WHEN the user opens "Ver carátulas"
- THEN the modal shows an empty-state message and no entries

#### Scenario: Preview reuses the fullscreen viewer

- GIVEN the "Ver carátulas" modal lists account ••1234 with a carátula
- WHEN the user selects its preview
- THEN the carátula opens in the existing fullscreen viewer

### Requirement: Carátula UI inside each account card

The carátula upload and preview controls MUST render inside each account card in the
supplier edit form. The carátula controls MUST NOT appear in the "Datos de Contacto"
section. Each account card MUST show an upload slot when its account has no carátula,
and a preview/replace control when it does.

#### Scenario: Account card shows upload slot when empty

- GIVEN the edit form for "FARMACIA SA" account ••1234 has no carátula
- WHEN the account card renders
- THEN it shows an upload control and no preview thumbnail

#### Scenario: Account card shows preview/replace when a carátula exists

- GIVEN account ••1234 has a carátula
- WHEN its account card renders
- THEN it shows a preview thumbnail and a replace control

#### Scenario: "Datos de Contacto" has no carátula field

- GIVEN the supplier edit modal is open
- WHEN the "Datos de Contacto" section renders
- THEN it contains no carátula upload, preview, or label

### Requirement: Removal of the legacy single-thumbnail

The legacy single carátula thumbnail that previously rendered in the supplier row MUST
be removed. The count badge is its sole replacement. No supplier-row code path MAY
render a single carátula thumbnail.

#### Scenario: Row renders the badge instead of a thumbnail

- GIVEN "FARMACIA SA" has one or more carátulas
- WHEN its row renders
- THEN the row shows the count badge and no single-thumbnail element

#### Scenario: Legacy thumbnail render path is gone

- GIVEN any supplier in any state
- WHEN the ProveedoresList table renders
- THEN no single-thumbnail carátula cell appears in any row
