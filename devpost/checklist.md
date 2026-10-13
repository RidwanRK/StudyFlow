---
doc: checklist
status: approved
---

# Build Checklist

Build mode: fast (from saved preference; switch any time)

## Slices

- [x] **1. Your keys work: the server reaches MongoDB and Gemini, and Gemini returns checkable JSON**
  Becomes usable: A runnable proof (`npm run check:services`) that your MongoDB connection and Gemini key/model work, and that Gemini returns a structured JSON reply in the shape the spec expects.
  Why now: This is the single biggest unknown behind the kernel (an AI that plans and replans). If the model name, the key's access or the structured-output options are wrong, we learn it in the first step, before any screen depends on it. This is the one "technical layer" slice, allowed because it proves a critical risk and leaves runnable evidence. The project scaffold, git hygiene and `.env.example` ride inside it.
  PRD ref: `prd.md > Plan generation`
  Spec ref: `spec.md > Stack` (Not verified list), `spec.md > External Services and Dependencies`, `spec.md > Where It Runs and How Someone Tries It`, `spec.md > File Structure`
  Build: Create root `package.json` (`install:all`, `dev`, `check:services`), `.gitignore` additions (`node_modules`, `.next`), the `server/` skeleton (`config.js` validating env variables, `.env.example`, `ai/gemini.js` and `ai/schema.js` for a tiny schedule-shaped test), and a check script that connects to MongoDB and makes one structured Gemini call, validated with zod.
  Verify (mechanical): Run `npm run check:services` and confirm it prints a successful MongoDB connection and a Gemini reply that parses and matches the schema. Record the working model name and the `@google/genai` options that worked under Revisions if they differ from the spec.
  Learner check: Put your MongoDB string and Gemini key into `server/.env`, run `npm run check:services`, and tell me whether you see two green lines (database connected, Gemini replied with valid JSON).
  Commit: `Scaffold server and verify MongoDB and Gemini connections`

- [x] **2. You can register, sign in, see the Welcome message, and stay signed in**
  Becomes usable: Open `localhost:3000`, register, see Welcome once, continue to an empty setup page, refresh and stay signed in, sign out and back in without seeing Welcome again. Wrong password and taken usernames show friendly messages. The website has its playful, calm look from here on.
  Why now: Every later behavior belongs to a signed-in student, and this brings up the second program (Next.js) with the `/api` proxy and the cookie, so everything after has a home to land in. It also sets the global look (palette, Fredoka and Nunito) once.
  PRD ref: `prd.md > Account`, `prd.md > The Core Journey` (steps 1-2), `prd.md > States and Boundaries` (First use, Login problems, Permissions), `prd.md > Look and Feel`
  Spec ref: `spec.md > Components` (App shell and routing, Login page, Welcome message, Auth routes), `spec.md > Data Model` (User), `spec.md > Look and Feel`
  Build: Add `User` model, `routes/auth.js`, `requireAuth`, error handler and Express app; scaffold the Next.js client with `next.config.js` rewrites, `lib/api.js`, auth context, `globals.css`, the root redirect logic, `/login` and `/welcome`, and a placeholder `/setup/hours`.
  Verify (mechanical): `npm run dev` starts both programs with no errors; with curl (cookie jar) confirm register returns a cookie, `GET /api/auth/me` works with it and returns 401 without it, a duplicate username and a wrong password return friendly errors, and the Next.js proxy forwards `/api/auth/me`.
  Learner check: Open `http://localhost:3000` on your computer (and on your phone if you can), register, read the Welcome message, continue, refresh the page, sign out, sign in again. Say whether the look feels playful and calm.
  Commit: `Add accounts, Welcome message and base look`

- [x] **3. You can save your study hours and courses with topics, and they are still there when you come back**
  Becomes usable: `/setup/hours` takes weekday hours, weekend hours and per-weekday overrides; `/setup/courses` takes courses (name, exam date) with topics (name, difficulty, hours, safe-guess hint). Both are saved and pre-filled on return. Generate plan is present but disabled until a course has a topic.
  Why now: The planner needs real inputs. This step also forces the data shape for Setup and Course, which every later slice depends on, while mistakes are cheap.
  PRD ref: `prd.md > Study hours`, `prd.md > Courses, topics and exam dates`, `prd.md > The Core Journey` (steps 3-4), `prd.md > States and Boundaries` (Topic with unknown hours)
  Spec ref: `spec.md > Components` (Setup: study hours, Setup: courses and topics, Setup and courses routes), `spec.md > Data Model` (Setup, Course)
  Build: Add `Setup` and `Course` models, `routes/setup.js` and `routes/courses.js` with zod validation (future exam date, positive hours rounded to 0.5, name required), `HoursForm`, `CourseEditor`, `TopicRow`, and the root-redirect rules for "no setup" and "no plan".
  Verify (mechanical): With curl, save hours and a course with topics and read them back; confirm a past exam date, zero hours and a blank name are rejected with a friendly message; confirm a second user cannot read the first user's courses.
  Learner check: Set weekday hours, weekend hours and a Sunday override; add two courses with three topics each; refresh and sign out and in; confirm everything is still filled in. Check the forms on a narrow window or your phone.
  Commit: `Add study hours and courses setup`

- [x] **4. You can click Generate plan and get an AI-built day-by-day timetable that the server has checked**
  Becomes usable: With hours that fit, Generate plan shows "Building your plan…", then `/plan` lists the days up to the last exam. Each day is collapsed and opens into hour blocks, today's row is open, and the plan is saved. Gemini does the planning; the server proves it respects the rules.
  Why now: This is the unique kernel (the AI timetable) and the learning question from the spec (asking an AI for structured data, then testing it with ordinary code). It is placed right after the inputs exist so the riskiest, most valuable piece gets feedback early.
  PRD ref: `prd.md > Plan generation`, `prd.md > The Core Journey` (steps 5-6), `prd.md > User stories and acceptance criteria` (day-by-day plan)
  Spec ref: `spec.md > Components` (Planner engine: capacity, remaining, priority, validate, index; Gemini client; Plan routes; Plan view), `spec.md > Data Model` (Plan), `spec.md > Important Failure Modes`
  Build: Add the `Plan` model; planner `capacity.js`, `priority.js`, `remaining.js`, `validate.js`, `index.js` (`generatePlan` with one validation retry); `ai/prompts.js`; `POST /api/plan/generate` and `GET /api/plan`; `DayList` and `DayRow`; the friendly failure message; `test/planner.test.js` covering the validator accepting a good schedule and rejecting each bad kind (day over its hours, topic after its exam, wrong total hours, unknown topic).
  Verify (mechanical): `npm test` in `server/` passes, including the reject cases; then generate a real plan through the running app/API for a course set that fits and confirm the saved plan passes the validator (no day over capacity, every topic before its exam, every topic's hours exactly covered); confirm a Gemini failure (wrong model name) shows the friendly message and leaves no plan saved.
  Learner check: Click Generate plan on your own courses, watch the loading text, then open a few days. Do the blocks look sensible (harder and earlier-exam topics first, never more than your hours)? Refresh to confirm it is still there.
  Commit: `Add AI plan generation with server-side validation`

- [x] **5. When your hours don't fit, you get kind options, or a lighter plan**
  Becomes usable: If the topics can't fit before an exam, Generate plan shows the Can't fit panel: "add x hours each day", "add y hours on one or two days" (when small enough) or "keep my hours". Accepting builds the plan with the extra hours; keeping builds a lighter plan with a consoling message naming the topics to start with.
  Why now: It is the same generate path with one more branch, and it is easiest to get right now, before check-in and replan reuse it.
  PRD ref: `prd.md > When the plan doesn't fit`, `prd.md > States and Boundaries` (Hours don't fit)
  Spec ref: `spec.md > Components` (Planner engine: fit, lighten; Can't-fit panel; Plan routes `generate` with `fitChoice`), `spec.md > Data Model` (`capacityAdjustment`)
  Build: Add `fit.js` and `lighten.js`; extend `generatePlan` and `POST /api/plan/generate` for `needs_fit_choice` and `fitChoice`; add `CantFitPanel` and the lighter-plan message; extend `planner.test.js` for fit (fits, tight by one day, impossible) and lighten.
  Verify (mechanical): `npm test` passes the new fit and lighten cases; against the running API, a deliberately squeezed course set returns `needs_fit_choice` with sensible options, and each of the three choices produces a validated plan (the lighter one scheduling fewer hours than requested, everything still before exams).
  Learner check: Add an exam in a few days with more hours than you can study, click Generate plan, read the panel, and try each choice (delete and regenerate between tries). Does the tone feel consoling rather than alarming?
  Commit: `Add Can't fit options and lighter plan`

- [x] **6. You can check in at the end of the day, move forward, and see what's still open**
  Becomes usable: In a day, each block can be marked completed, partial (hours studied, optional "still need more time on this", with hours left shown right away) or untouched. If anything is partial or untouched, Replan and Move forward appear (Replan comes alive in the next step). Move forward leaves the plan unchanged and shows the "remaining" alert. Coming back the next day opens today's row.
  Why now: Replan cannot run without real check-in data, and this is where "falling behind" first becomes real.
  PRD ref: `prd.md > Daily check-in`, `prd.md > Replan` (move-forward behavior), `prd.md > The Core Journey` (steps 7-9)
  Spec ref: `spec.md > Components` (Check-in controls, Remaining alert, Plan routes `checkin` and `move-forward`), `spec.md > Data Model` (Plan `days.blocks`, "Remaining is not stored")
  Build: Add `PUT /api/plan/checkin` and `POST /api/plan/move-forward` with validation (hours studied between 0 and the block's hours), `CheckInControls`, `RemainingAlert`, and today's-row-open logic; extend `remaining.js` with the 50% "needs more time" buffer; add tests for `remaining.js`.
  Verify (mechanical): `npm test` passes the remaining-work cases (partial credits, untouched earns nothing, buffer rounded up to 0.5h, never below 0); via the API, check in a day and confirm it persists across a fresh read, move-forward marks the day without changing any blocks, and out-of-range hours are rejected.
  Learner check: Mark one block completed, one partial with some hours, one untouched; confirm "hours left" appears; choose Move forward and look for the remaining alert; refresh and sign out and in to confirm today's row is open and your marks are kept.
  Commit: `Add daily check-in, move forward and remaining alert`

- [ ] **7. You can replan, see what moved and why, and accept or reject it**
  Becomes usable: After a partial or untouched day, Replan asks Gemini to reshuffle the days after today, and the proposal shows each real move ("Chapter 4: Tue → Thu") with Gemini's reason and a short note. Accept swaps the timetable in visibly; Reject keeps the old one and leaves the day open. A proposal survives a refresh. If the remaining work no longer fits, the Can't fit panel appears here too.
  Why now: This is the "oh, that's cool" beat the whole project is aiming for. Check-in is in place, so it now has real input.
  PRD ref: `prd.md > Replan`, `prd.md > The Core Journey` (step 8, Success), `prd.md > When the plan doesn't fit`
  Spec ref: `spec.md > Components` (Planner engine: `diff.js`, `index.js` `replanPlan`; Gemini client replan input; Replan proposal; Plan routes `replan`, `accept`, `reject`), `spec.md > Data Model` (`pendingReplan`)
  Build: Add `diff.js`, `replanPlan` (start tomorrow after a check-in, or today after an edit with no marks), replan prompt, the replan/accept/reject routes (pending proposal stored on the plan; accept marks checked-in days `replanned`), and `ReplanProposal` with softly highlighted moves; add diff tests (real moves get reasons, a reason for something that did not move is dropped, missing reasons get a generic fallback).
  Verify (mechanical): `npm test` passes the diff cases; via the running app/API, after a partial check-in, replan returns a validated proposal whose schedule conserves the remaining hours; accept changes the saved plan, reject leaves it byte-identical, and a past day's marks never change.
  Learner check: Mark a day as partly done, click Replan, read the moved lines and reasons, reject once and confirm nothing changed, then replan again and accept. Does the timetable visibly reshuffle, and do the reasons make sense to you?
  Commit: `Add replan proposal with what-moved-and-why, accept and reject`

- [ ] **8. You can edit your hours, courses and exam dates after the plan exists, and the plan adjusts**
  Becomes usable: Changing hours, a course, a topic, its difficulty or hours, or an exam date on the setup pages offers a replan proposal to accept or reject (reusing the replan screen). Removing a course or topic is handled without breaking the saved plan.
  Why now: It reuses everything built so far, so it comes last, once replan is proven. It closes the PRD's "plans change in real life" promise.
  PRD ref: `prd.md > Editing after the plan exists`, `prd.md > User stories and acceptance criteria` (change my courses, topics or hours later)
  Spec ref: `spec.md > The Core Journey Through the System` (Editing later), `spec.md > Components` (Setup: courses and topics, Plan routes `replan` with `reason: "edit"`), `spec.md > Decisions and Open Issues` (Replan-on-edit)
  Build: After a setup save, if a plan exists, call `POST /api/plan/replan { today, reason: "edit" }` and route the student to the proposal; handle deleted courses and topics (their future blocks are dropped from the proposal, past marks are kept); edit and delete controls in `CourseEditor`.
  Verify (mechanical): Via the API, with an existing plan, change an exam date, a topic's hours, and the weekday hours, and confirm each produces a validated proposal; delete a topic and confirm the proposal contains none of its future blocks and past days are unchanged.
  Learner check: With a plan in place, change an exam date and a topic's hours, and delete a topic, and look at each proposal. Accept one and reject another. Does the plan stay consistent with your edits?
  Commit: `Replan after editing hours, courses and topics`

## Hands-on Checkpoints

- [x] Early usable behavior explored — after slice 4 (first AI-built plan on your own courses; your feedback can still shape the replan and the rest)
- [ ] Final kick-the-tires exploration and feedback completed

## Final Review

- [ ] Final review complete — feedback resolved and learner confirms ready to ship

## Code Tour and App Map

- [ ] Learning activity complete — guided route, focused alternative, prior practice connected, or brief recap
- [ ] Optional edit and transfer reflection addressed — offered/declined/already covered/not applicable as appropriate
- [ ] `devpost/app-map.html` generated from finished code, checked, and shown, including a project-grounded practice to reuse

Activity and evidence: [what actually happened; real document/test/code references; unfinished work if interrupted]
Route and stops: [actual paths and symbols; guided stops completed, or reference-only route]
Edit outcome: [tried/kept/reverted/declined/not applicable; verification if changed]
Reflection: [offered/answered/declined/already covered — personal answer belongs only in the ignored profile]
Activity mode: [live app and editor, explicit static fallback, focused alternative, prior practice, or recap]

## Revisions

- Default Gemini model changed from `gemini-3.6-flash` to `gemini-3.5-flash-lite` (`spec.md` updated) — `gemini-3.6-flash` returned 503 "high demand" on every retry during slice 1; `gemini-3.5-flash-lite` passed. The spec's structured-output options (`responseMimeType: "application/json"` plus `responseJsonSchema`, with a zod-generated JSON Schema) were confirmed to work with `@google/genai`.
- The Gemini client retries busy and rate-limit errors (429, 500, 503) up to 4 times with a growing wait — Gemini returned temporary 503s, which would otherwise break a live demo. This is in addition to the one validation retry in the spec.
- Added `MONGODB_DB` (default `studyflow`) to the env settings — the connection string has no database name, so MongoDB would have silently used its default database `test`.
- Added `server/scripts/check-services.js` (not in the spec's file tree) as the slice 1 proof.
- Added `POST /api/auth/welcome-seen` (the spec only said "Continue marks hasSeenWelcome") and `AppHeader` with Sign out — the Welcome screen needed a route to save the flag, and signing out needed a visible control. `client/next.config.js` also sets `turbopack.root` and `agentRules: false` to silence a lockfile warning and keep generated agent files out of the repo.
- Slice 4 also builds `fit.js` (`checkFit`, the arithmetic fit check) and `lib/dates.js` helpers early, so Generate never asks Gemini for an impossible plan. Until slice 5 adds the options panel, an unfit set returns a plain "needs about N more hours" message (HTTP 422) — a stand-in that slice 5 replaces with `needs_fit_choice`.
- Plan days carry an `exams` list (names of courses with an exam that date) and the plan stores Gemini's short `note` — both for display only, added to the spec's Plan data model. The day list runs from today to the last exam day itself (shown as an "Exam day" row); blocks can only use days before that.
- Gemini answers that are not valid JSON or break the shape are signalled with `InvalidAnswerError` so only unusable answers get the one validation retry; API failures (bad key, 404 model, rate limit) go straight to the friendly message and are logged on the server.
- Desktop layout is full-width, not a centered column — learner feedback at the first checkpoint ("full screen for web"), matching `prd.md > Screens and Layout` (full-screen, responsive). `spec.md > Look and Feel` said "centered column with a maximum width on desktop"; that line is superseded. Login and Welcome are a split screen, Hours is two panels, Courses is a card grid, and Plan has a summary sidebar beside the days; phones keep a single column.
- Topic ids stay the same when a course is edited (the course save accepts each topic's existing id), because saved plan blocks refer to topics by id — the spec said saving "replaces its topics list", which would have orphaned blocks.

- Course cards show "Save changes" and "Discard changes" only when something was edited, and "✓ All changes saved" otherwise — learner feedback at the first checkpoint: a "Save course" button on a course that had just been added looked like it still needed saving. The new-course card still says "Add course".
- Generate plan now saves anything still pending first — a filled-in new-course form, or unsaved edits on a course card — before building. The button also enables as soon as the new-course form has content. If a pending course is incomplete (for example, no exam date), nothing is built and that course's card shows what is missing. Learner feedback at the first checkpoint: a second course typed but not yet added was silently left out of the plan.
- Clicking Generate plan now shows a full-screen "Building your plan…" overlay, and the new-course box has its own "Remove course" button (it clears what was typed) — learner feedback: while building, a typed course was saved into a new card and an empty "Add a course" box appeared, which looked like a duplicate; and the box being filled in had no remove option, unlike saved courses.
- The "Add a course" form is no longer a permanent empty box: once a course exists it appears only after clicking "+ Add another course", and its "Remove course" button (always enabled) closes it; with no courses yet the form stays open and Remove clears it — learner feedback: an empty course box could not be removed.
- The new-course form's button now reads "Save changes" (was "Add course"); after it is clicked the course appears as a saved card showing "✓ All changes saved" and the dashed "+ Add another course" tile returns — learner feedback, for consistency with the saved cards.
- Slice 5 added `planner/repair.js` (not in the spec) and raised Gemini attempts from two to three — Gemini's `gemini-3.5-flash-lite` often put a half hour too many on a day when days were almost full (the lighter plan), and retries alone failed about one run in three. The server now repairs small slips deterministically (move half-hours to the nearest day with room before the topic's deadline, trim or top up topics) and re-validates; retries show Gemini its previous answer and the problems, and the schema asks it for each day's `totalHours`. Stronger models were tried and rejected: `gemini-3.5-flash` took 9-26 s and still failed 1 run in 6, `gemini-3.7-flash` failed twice in two. After the change, 12 of 12 live runs (ten lighter plans) passed in about 2 s each.
- The plan stores `targets` (hours scheduled per topic) and `lighterMessage`, and the "can't fit" answer is `{ status: "needs_fit_choice", shortfall, options: { daily, extraDays } }`; the browser only names its choice (`daily`, `extra_days`, `keep`) and the server recomputes the amounts. Slices 6-7 must measure "remaining" against `targets`, not the topic's full hours, or a lighter plan would look permanently behind.
- Slice 6 check-in rules the spec left open: you can check in only on today or an earlier day; a partial block needs between 0.5 hours and just under the whole block (all of it means "completed"; none means "untouched"); the "still need more time" tick applies to partial blocks only; changing a day's marks after choosing Move forward reopens the choice for that day. The pure rules live in `planner/checkin.js` (new file) with `remaining.js` holding `hoursLeft`, `hoursCredited`, `extraTimeBuffer` and `remainingPerTopic` (measured against the plan's `targets`), all covered by `test/checkin.test.js`.
- The Replan button on a checked-in day is a placeholder until slice 7 ("Replanning arrives in the next step of the build").
