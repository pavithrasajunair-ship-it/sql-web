# LearnLoop

> Don't just learn. Understand. Practice. Master.

Open `index.html` (or `/learnloop/` on the deployed site). No build step.

## Features
- **Dashboard**: daily goal, streak, weak concepts, recommendations, revision suggestions. Empty until you answer questions; no fake numbers.
- **AI Tutor (built-in lessons)**: 8 Python/SQL topics in 4 explanation styles, a check question after every lesson, and a different style offered when you get it wrong.
- **Code Detective**: Find the Bug, Predict the Output, Fix the Code (Python and SQL, with tests, hints and solution after 3 tries) and an adaptive Challenge Mode.
- **QuickLearn**: 5/10/15/30 minute sessions, saved and resumable.
- **My Progress**: levels from answered questions only, tracked misconceptions, learning history.
- Every wrong answer explains *why* it is wrong and names the misconception.

## Coming next (clearly labelled in the app)
- AI-written answers, story/visual styles, follow-up questions, Notes Studio (PDF), AI Examiner: need a backend holding an AI key. SkillMap, accounts/sync, payments: later phases.
- Progress is stored in the browser only (no accounts). The free plan's daily question limit is counted in the browser; Premium payments are not live.

## Code execution safety
Python runs with Pyodide in a Web Worker in the student's own browser (no server execution, 5 s timeout). SQL runs on an in-memory practice database. The Python sandbox downloads from jsDelivr on first use and could not be exercised in the build environment; tests use real Python as a stand-in.

## Tests
`node tests/unit.js` and `python3 tests/e2e.py`.
