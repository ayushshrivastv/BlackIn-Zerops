---
version: "alpha"
name: "BlackIn Studio"
description: "A Web2 AI app studio for turning product prompts into working web applications."
colors:
  ink: "#0D1117"
  graphite: "#161B22"
  slate: "#697586"
  cloud: "#F7F8FA"
  linen: "#F4EFE7"
  primary: "#3E68E8"
  primary-hover: "#3457D5"
  mint: "#3DDC97"
  amber: "#F5B642"
  border: "#2A3038"
  on-dark: "#F7F8FA"
  on-light: "#14171C"
typography:
  display:
    fontFamily: "Nocturn"
    fontSize: "3.5rem"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "0px"
  body:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: "0px"
  label:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "0.08em"
rounded:
  sm: "4px"
  md: "8px"
  lg: "16px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-dark}"
    rounded: "{rounded.md}"
    padding: "12px 16px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
  app-card:
    backgroundColor: "{colors.graphite}"
    textColor: "{colors.on-dark}"
    rounded: "{rounded.lg}"
  surface-light:
    backgroundColor: "{colors.cloud}"
    textColor: "{colors.on-light}"
---

## Overview

BlackIn Studio should feel like a serious Web2 product-building workspace: calm, readable,
fast, and product-first. The UI is closer to a modern developer tool than a crypto dashboard.
The core promise is simple: describe a web product, watch the agent plan it, then review the
generated app files in the workspace.

## Colors

Use high-contrast neutral surfaces with one clear product accent. Ink and graphite carry the
workspace. Cloud and linen soften marketing surfaces. Primary blue is reserved for intent:
start building, select a mode, focus a control, or show the active path. Mint and amber are
semantic accents for success and review states, not decoration.

## Typography

Headlines are confident but not loud. Body copy should be plain, active, and specific. Avoid
crypto-native phrases such as "onchain", "mainnet", "contract", or "wallet" unless a feature
actually requires them. Prefer "project", "app", "workspace", "files", "API", and "deploy".

## Layout

The first screen is the product: prompt input, model controls, and a clear path into the
workspace. Avoid marketing-only hero panels. Keep surfaces dense enough for a tool, with generous
spacing around primary actions and compact controls in repeated workspace panels.

## Elevation & Depth

Use flat bordered panels for most workspace UI. Reserve shadows for overlays, menus, and the
central prompt input. Avoid decorative orbs and heavy gradients; any visual depth should support
focus or hierarchy.

## Shapes

Cards use 8px to 16px radius depending on scale. Buttons use 8px or full pill only when the action
is compact. Avoid mixing many radius sizes in the same panel.

## Components

Primary actions say what happens: "Start building", "Open workspace", "Generate app". Empty
states should invite a Web2 prompt such as "Build a customer portal" or "Create an analytics
dashboard". File trees should show familiar web app paths before any specialized backend code.

## Do's and Don'ts

Do make the product feel useful to SaaS builders, founders, internal-tool teams, and agencies.
Do show generated files, project plans, previews, and deploy readiness. Do not lead with Base,
Solana, Solidity, wallets, or smart-contract deployment in the default user journey.
