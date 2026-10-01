# CW Parks on the Air Practice

A lightweight web app for practicing CW callsign copy using configurable WPM, Farnsworth spacing, and a practice call database.

## Features

- Practice copying calls from a built-in POTA-inspired call list
- Adjustable CW speed from 5-30 WPM
- Optional Farnsworth spacing
- Repeat key to replay the Morse transmission
- First-copy and repeat tracking during a session
- Basic local web app interface for fast testing

## Tech stack

- Next.js
- TypeScript
- React
- Web Audio API for Morse generation

## Quick start

```bash
npm install
npm run dev
```

Then open http://localhost:3000

## Notes

This initial version is a front-end prototype. The call database is stored in `lib/callDatabase.ts`, and it is designed to be extended later with a persistent database and user session logging.
