<p align="center">
  <svg src="src/components/Wordmark/WordmarkLight" alt="CalcCanvas" height="64" />
</p>

<p align="center">
  <em>A keyboard-first calculator notebook for iOS & Android</em><br/>
  Live math, currency/FX conversions, and a delightful bottom-sheet editor.
</p>

<p align="center">
  <a href="https://expo.dev/"><img alt="Expo" src="https://img.shields.io/badge/Expo-51%2B-000?logo=expo" /></a>
  <a href="#"><img alt="React Native" src="https://img.shields.io/badge/React%20Native-0.74%2B-61DAFB?logo=react" /></a>
  <a href="#"><img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript" /></a>
  <a href="#"><img alt="EAS" src="https://img.shields.io/badge/EAS%20Build-ready-4630EB?logo=expo" /></a>
  <a href="#"><img alt="License" src="https://img.shields.io/badge/License-MIT-black" /></a>
</p>

---

## Table of contents
- [Overview](#overview)
- [Features](#features)
- [Screenshots](#screenshots)
- [Architecture](#architecture)
- [Tech stack](#tech-stack)

---

## Overview

**CalcCanvas** is a minimalist calculator notebook. Each sheet contains up to three cards; tap a card to open a full-height bottom sheet where you type calculations and see results/conversions in real time. It’s fast, feels native, and handles currency math out of the box.

- **Keyboard-first UX** — focus jumps straight to the editor; “Done” floats above the keyboard with correct insets on iOS/Android.
- **Evaluator** — typed math, variables, and unit/currency conversions with live results.
- **FX data** — base currency switching, stale-data detection, and friendly “~ approximate” markers when past TTL.
- **Thoughtful defaults** — works offline with graceful degradation; safe storage via AsyncStorage.

---

## Features

- 🧮 **Live evaluation** with formatted results and conversion chips  
- 💱 **FX support** (base currency persisted; stale badge when past TTL)  
- 🗒️ **Sheets & cards** (3 per sheet), swipe-to-delete, premium gating hooks  
- ⌨️ **Bottom-sheet editor** ([@gorhom/bottom-sheet]) with real-time preview  
- 🧭 **Consistent theming** (light/dark “Blueprint Tech” palette) via a custom theme + `react-native-paper`  
- 🧷 **Clipboard** support (long-press conversion chips)  
- ⚡ **Performance**: memoized evaluation, debounced input, batched updates  
- ♿ **A11y**: semantic actions, large text friendly styles

---

## Screenshots

> Replace the placeholders with your real captures.

| Main | Editor | Conversions |
|------|--------|-------------|
| ![Main](assets/screens/main.png) | ![Editor](assets/screens/editor.png) | ![Chips](assets/screens/chips.png) |

---

## Architecture

- **UI**: React Native + Expo + `react-native-paper`  
- **Editor**: `@gorhom/bottom-sheet` + `react-native-reanimated` + `react-native-gesture-handler`  
- **State**: Local component state + AsyncStorage for persistence  
- **Evaluator**: A pure function (`utils/evaluator`) returning structured results `{ value, formatted, unit, conversions, error }`  
- **FX/Market data**: `hooks/useMarketData` + `services/marketData` with TTL cache and base-currency conversions

---

## Tech stack

- **Expo** (dev client ready), **EAS Build**  
- **React Native** 0.74+, **TypeScript** 5+  
- **react-native-paper** (Buttons, Chips, Dialogs, Snackbar)  
- **@gorhom/bottom-sheet** (bottom sheet editor)  
- **react-native-reanimated** & **react-native-gesture-handler**  
- **react-native-safe-area-context**  
- **@react-native-async-storage/async-storage**  
- **expo-clipboard**
