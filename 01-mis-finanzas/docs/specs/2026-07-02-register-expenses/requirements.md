# Requirements — Register expenses (with AI-suggested category)

**Status:** Draft
**Date:** 2026-07-02
**Author:** Juan Sebastian Henao Parra

## Introduction

This feature lets a user record personal expenses in a web app. Each expense
captures how much was spent, when, a free-text description, and a category
chosen from a fixed list. To reduce manual effort, the app can suggest the
category automatically from the description using an AI model; the user always
keeps final control and can override the suggestion.

This is the foundational feature of the personal-finance app: without recorded
expenses, later features (budgets, reports, rule-based auto-categorization)
have no data to work with. Expenses are stored locally in the browser
(`localStorage`), so the app works per-device without a database or user
accounts.

## Glossary

- **Expense** — a single recorded spending entry with an amount, date,
  description, and category.
- **Category** — a label grouping expenses, chosen from a fixed predefined
  list. The list for this feature is: `Comida`, `Transporte`, `Vivienda`,
  `Ocio`, `Salud`, `Otros`.
- **Suggestion** — a category proposed by the AI model based on an expense
  description; not yet committed until the user submits the expense.

## Requirements

### Requirement 1 — Register a new expense

**User story:** As a user, I want to record an expense with its amount, date,
description, and category, so that I keep a history of my spending.

**Acceptance criteria:**

1.1. WHEN a user submits an expense with a positive amount, a valid date, a
     non-empty description, and a category from the fixed list THE SYSTEM SHALL
     create the expense with a unique identifier and store it.
1.2. IF the amount is missing, not a number, zero, or negative THEN THE SYSTEM
     SHALL reject the submission and report an amount validation error.
1.3. IF the description is empty or contains only whitespace THEN THE SYSTEM
     SHALL reject the submission and report a description validation error.
1.4. IF the date is missing or not a valid calendar date THEN THE SYSTEM SHALL
     reject the submission and report a date validation error.
1.5. IF the category is missing or not one of the fixed list values THEN THE
     SYSTEM SHALL reject the submission and report a category validation error.
1.6. WHEN an expense is rejected for any validation error THE SYSTEM SHALL NOT
     store it and SHALL preserve the user's entered values for correction.
1.7. THE SYSTEM SHALL store every amount as a positive number and every date in
     a normalized `YYYY-MM-DD` form.

### Requirement 2 — Choose a category from a fixed list

**User story:** As a user, I want to pick the category from a predefined list,
so that my expenses stay consistent and comparable.

**Acceptance criteria:**

2.1. THE SYSTEM SHALL offer exactly these categories for selection: `Comida`,
     `Transporte`, `Vivienda`, `Ocio`, `Salud`, `Otros`.
2.2. WHEN the registration form is shown THE SYSTEM SHALL present the fixed
     category list as the only selectable category values.
2.3. IF a category value outside the fixed list is submitted THEN THE SYSTEM
     SHALL reject it (per 1.5).

### Requirement 3 — Suggest a category from the description using AI

**User story:** As a user, I want the app to suggest a category from what I
typed, so that I spend less time classifying each expense.

**Acceptance criteria:**

3.1. WHEN a user requests a category suggestion for a non-empty description THE
     SYSTEM SHALL send the description to a server-side endpoint and return one
     category from the fixed list.
3.2. WHEN a suggestion is returned THE SYSTEM SHALL prefill the category
     selection with the suggested value without submitting the expense.
3.3. THE SYSTEM SHALL allow the user to change the category after a suggestion
     is applied, and the submitted category SHALL be whatever the user finally
     selected.
3.4. IF the AI model returns a value that is not in the fixed list THEN THE
     SYSTEM SHALL fall back to `Otros`.
3.5. IF the description is empty or contains only whitespace THEN THE SYSTEM
     SHALL NOT call the AI endpoint and SHALL leave category selection to the
     user.
3.6. IF the AI request fails, errors, or times out THEN THE SYSTEM SHALL
     degrade gracefully: it SHALL NOT block registration and SHALL let the user
     select a category manually.
3.7. THE SYSTEM SHALL keep the AI provider API key server-side only and SHALL
     NOT expose it to the browser.

### Requirement 4 — Persist and view registered expenses

**User story:** As a user, I want my recorded expenses to remain after I add
them and reload the app, so that I can review my spending history.

**Acceptance criteria:**

4.1. WHEN an expense is created (per 1.1) THE SYSTEM SHALL persist it to the
     browser's `localStorage`.
4.2. WHEN the app is opened THE SYSTEM SHALL load previously stored expenses
     and display them in a list.
4.3. WHEN a new expense is stored THE SYSTEM SHALL add it to the displayed list
     without requiring a manual page reload.
4.4. THE SYSTEM SHALL display, for each expense, its amount, date, description,
     and category.
4.5. IF stored expense data is missing, unreadable, or corrupt THEN THE SYSTEM
     SHALL treat it as an empty list and SHALL NOT crash.
4.6. IF writing to `localStorage` fails THEN THE SYSTEM SHALL report the failure
     to the user and SHALL NOT lose the values the user just entered.

## Out of scope

- Editing or deleting existing expenses.
- Budgets and budget-versus-actual comparison.
- Reports, summaries, and totals by category or period.
- Rule-based or automatic categorization beyond the single AI suggestion.
- Multi-device sync, user accounts, and server-side persistence of expenses.
- Currency selection and multi-currency handling (amount is a plain number).

## Open questions

- Currency is treated as a plain number with no currency symbol/locale in this
  feature; confirm this is acceptable for the first version.
- Suggestion trigger UX (explicit "Suggest" button vs. on-blur of the
  description) is a design-level choice; behavior in 3.1–3.6 holds either way.
