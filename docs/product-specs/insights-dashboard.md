# Insights Dashboard

## Status

Implemented in frontend.

## Overview

The Insights page (`/insights`) provides a read-oriented view of the participant's week: weekly rhythm dimension cards, medication adherence summary, and daily reflection status.

---

## Today's Reflection Card

### Position

Appears below the hero phrase / weekly summary header area, above the weekly rhythm dimension cards.

### Logged State

When today's reflection exists:
- Show the committed dimension bucket labels inline (e.g. "Mood: Steady · Focus: Dialed In · Sleep: Fine").
- Null (uncommitted) dimensions are omitted from the label list.
- The card is tappable and navigates to `/daily-reflection` in edit mode.

### Not-Logged State

When no reflection exists for today:
- Show a prompt: "How is [participant name] doing today?"
- Show a "Log today's reflection" CTA that navigates to `/daily-reflection`.

### Data

Uses data already loaded for the weekly summary window; no additional API call is required when today falls within that window.
