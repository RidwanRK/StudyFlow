---
doc: prd
status: approved
---

# StudyFlow — Product Requirements

StudyFlow is an AI study planner for university students. It builds a day-by-day timetable before exams and, when a student falls behind, proposes a replan with a clear "what moved and why" note.
Source: `scope.md > The Unique Kernel`, `scope.md > The Core Loop`, `scope.md > The POC Boundary`.

## The Core Journey

1. **Arrive.** The student opens StudyFlow on a phone or desktop browser (full-screen layout). The first thing they see is the **Login page** with Register / Sign in.
2. **Welcome (first login only).** After registering and signing in for the first time, they see a welcoming message that explains what StudyFlow does for them.
3. **Set study hours.** They set their daily study hours: X hours for weekdays and Y hours for weekends. They can customize individual days (for example, a different number of hours on Sunday, with the rest of the weekend unchanged).
4. **Add courses.** They add a course by name and exam date, then add its chapters/topics. Each topic has a difficulty level and the study hours the student thinks it needs. A hint next to the hours field says, "if not sure, take a safe guess." They can add more courses the same way.
5. **Generate plan.** They click **Generate plan**. The AI builds a day-by-day list running to the last exam.
6. **Check the plan.** Each day is a collapsed row that expands into that day's detailed timetable.
7. **End-of-day check-in.** At the end of the day, the student ticks each item **completed**, **partially completed** (enters hours actually studied, optional "still need more time on this" tick) or **untouched**.
8. **Choose: move forward or replan.** If everything was completed, they just move forward. If anything was partial or untouched, they choose:
   - **Replan:** the AI shows proposed changes with a "what moved and why" note, and the student **accepts or rejects** them.
   - **Move forward without replanning:** the unfinished work shows as a "remaining" alert, and the plan is not changed.
9. **Come back.** The next day the student logs in and sees that day's plan expanded, with all other days collapsed.

**Success** is the replan beat: the student marks a day as partly done, clicks Replan, sees the proposed shifts with the reasons, accepts them, and sees the timetable visibly reshuffle.

## Screens and Layout

The whole app is full-screen and responsive, with the same experience on a phone and a desktop browser.

- **Login page.** Register / Sign in with a username and password. This is the first thing anyone sees.
- **Welcome message.** Shown on a new student's first login. It explains what StudyFlow does.
- **Setup: study hours.** Weekday hours (X), weekend hours (Y), and per-day customization.
- **Setup: courses.** Add a course (name, exam date), then its topics (name, difficulty, hours needed). More courses can be added. A **Generate plan** button builds the plan.
- **Plan view.** A day-by-day list from today to the last exam. Each day is a collapsed row that expands (dropdown) into the day's detailed timetable. On return, today is expanded and the rest are collapsed.
- **Check-in (inside the day).** Each study item in the day has the three marks: completed / partial / untouched. After marking, the student chooses Move forward or Replan.
- **Replan proposal.** Shows the proposed shifts and a plain "what moved and why" note, with **Accept** and **Reject**.
- **"Can't fit" suggestion.** Shown after Generate plan when the hours don't fit before an exam (see States and Boundaries).

## Look and Feel

- **Overall feel:** playful but soothing. Calm, not stressful.
- **Color:** restrained, without much coloring.
- **Typography:** playful character (the learner asked for a "playful type"), kept readable.
- **Tone of voice:** consoling, confident and well-behaved at all times, including when the syllabus won't fully fit. The system should give the student confidence, never guilt or alarm.
- **Name:** StudyFlow (final).
- No reference apps were named.

## Features and Behavior

### Account
- A student registers and signs in with a username and password.
- Each student sees only their own courses and plan.

### Study hours
- The student sets default hours for weekdays (X) and for weekends (Y).
- They can override individual days (for example, Sunday has X' hours while the rest of the weekend keeps Y).

### Courses, topics and exam dates
- A course has a name and one **exam date**. The exam date belongs to the course.
- A course has one or more **topics/chapters**. Each topic has its own **difficulty** and its own **required hours**. The hours field carries the hint "if not sure, take a safe guess."
- The student can add as many courses as they need.

### Plan generation
- Clicking **Generate plan** makes the AI produce a day-by-day plan up to the last exam, in which every topic is scheduled before its own course's exam, within the student's daily study hours.
- **Priority** is decided by exam date and difficulty: topics for earlier exams and harder topics get priority. The same rule decides which are the "important parts" when time is short.
- Each day's timetable is made of **hour blocks** (what to study and for how many hours).

### Editing after the plan exists
- The student can edit courses, topics, difficulty, hours, exam dates and daily study hours at any time.
- When they edit, the plan is adjusted accordingly.

### Daily check-in
- For each item, the student marks completed, partially completed or untouched.
- For partial items, the system asks only for the hours actually studied and works out what's left. An optional "still need more time on this" tick covers cases where the hours don't tell the whole story. (From `scope.md > The Core Loop`.)

### Replan
- If anything is partial or untouched, the student can click **Replan**.
- The AI proposes a revised remaining schedule and shows **what moved and why** (for example, "Chapter 4 moved to Thursday because Tuesday's session was only half done").
- The student **accepts** (the timetable updates) or **rejects** (the timetable stays as it was).
- If the student moves forward without replanning, unfinished items show as a **remaining** alert and the plan does not change.

### When the plan doesn't fit
- If the total hours needed can't fit into the available study hours before the exams, the system suggests a fix: either **add x hours** to each day, or **add y minutes/hours on one or two days** (whichever is needed).
- If the student **accepts**, the plan is built with that change.
- If the student **rejects**, the system builds a plan with fewer hours per course, tells the student kindly that they might not finish everything, and encourages them to cover the **important parts**.

### User stories and acceptance criteria

- As a student, I want to enter my courses, topics, difficulties, exam dates and hours so that the AI can plan for me.
  - [ ] I can add a course with a name and one exam date, and add several topics under it, each with difficulty and hours.
  - [ ] The hours field shows the "if not sure, take a safe guess" hint.
  - [ ] I can add a second and third course the same way.
- As a student, I want to set how many hours I can study per day so that the plan is realistic.
  - [ ] I can set weekday hours and weekend hours, and change a single day (for example, Sunday).
  - [ ] The generated plan never schedules more than my hours for any day.
- As a student, I want a day-by-day plan so that I know exactly what to do today.
  - [ ] After clicking Generate plan, I see a list of days running to my last exam.
  - [ ] Each day is collapsed and opens to show that day's detailed timetable.
  - [ ] Every topic is scheduled before its own course's exam date.
- As a student, I want to mark what I did at the end of the day so that the plan knows where I stand.
  - [ ] Each item can be marked completed, partial or untouched.
  - [ ] Marking partial asks only for hours studied, and shows what's left.
- As a student, I want to replan when I fall behind so that falling behind doesn't mean starting over.
  - [ ] After a partial or untouched item, I can choose Replan or Move forward.
  - [ ] Replan shows proposed changes and a "what moved and why" note before anything changes.
  - [ ] Accept updates the timetable and Reject leaves it unchanged.
  - [ ] Move forward without replanning shows a "remaining" alert and leaves the plan unchanged.
- As a student with too little time, I want to be treated kindly and given options so that I don't feel I've already failed.
  - [ ] When hours don't fit, I see a suggestion to add x hours daily or y extra time on one or two days.
  - [ ] Accepting builds the plan with that change.
  - [ ] Rejecting builds a lighter plan with a consoling message about covering the important parts.
- As a student, I want to change my courses, topics or hours later so that the plan keeps matching my real life.
  - [ ] I can edit a course, topic, difficulty, hours, exam date or daily study hours after the plan exists.
  - [ ] After an edit, the plan adjusts to match.
  - [ ] Earlier exams and harder topics are scheduled first.
  - [ ] Each day's timetable shows hour blocks.
- As a student, I want my plan waiting for me when I return so that I can pick up right away.
  - [ ] On my next login I see today's plan expanded and the other days collapsed.

## States and Boundaries

- **First use.** After first login the student sees a welcoming message explaining what StudyFlow does, then goes to setup. There is no plan until they click Generate plan.
- **Returning.** The student's hours, courses and plan are saved. They see today's day expanded and the rest collapsed.
- **Topic with unknown hours.** The student is told to take a safe guess; they never get stuck on this field.
- **Hours don't fit.** See "When the plan doesn't fit." Always consoling, never alarming.
- **Partial or untouched and moving forward.** Shows as a remaining alert; no replan happens.
- **Login problems.** *(Assumption, not discussed with the learner.)* Wrong password or a taken username shows a short, friendly message.
- **Permissions.** Each student sees only their own data.

## Product Decisions

- **Name: StudyFlow** — the learner liked it more than the playful alternatives offered.
- **Exam date belongs to the course; difficulty and hours belong to each topic** — a hard chapter can sit inside an easier course, and exams are per course.
- **Weekday/weekend default hours with per-day overrides** — the student fixes their own availability and can adjust a single day.
- **"If not sure, take a safe guess" hint for topic hours** — so a student with a brand-new chapter is never blocked.
- **Plan generated by a Generate plan button** — the student stays in control of when it is built.
- **Plan is a day-by-day list with collapsible days** — easy to scan, with detail available on demand.
- **Replan is proposed, then accepted or rejected** — the student can see and trust the AI's reasoning before anything changes. This refines `scope.md > The Core Loop`, which described replanning as automatic.
- **Moving forward without replanning keeps the plan and shows a remaining alert** — unfinished work stays visible without forcing a replan.
- **When time doesn't fit, suggest more hours; if refused, build a lighter plan and encourage the important parts** — the student always gets a plan, and the tone stays consoling.
- **Priority by exam date and difficulty** — earlier exams and harder topics come first, and these also decide the "important parts" when time is short.
- **Timetable in hour blocks** — each day shows blocks of study hours per item, kept simple.
- **Students can edit courses, topics, hours and dates later, and the plan adjusts** — plans change in real life, so setup isn't a one-time commitment.
- **Playful, soothing, lightly colored look; the system always gives the student confidence** — the product is meant for stressed students.

## What We're Building

Everything in `scope.md > The POC Boundary`, as defined above:

- Registration and sign-in with username and password
- Welcome message on first login
- Daily study hours (weekday, weekend, per-day override)
- Courses with exam date, and topics with difficulty and required hours
- Generate plan: an AI-built day-by-day list to the last exam, with collapsible detailed days
- "Can't fit" suggestion and the lighter-plan fallback
- End-of-day check-in: completed / partial (hours studied, optional "still need more time") / untouched
- Replan proposal with a "what moved and why" note and Accept/Reject
- Move forward with a remaining alert
- Editing courses, topics, hours, exam dates and daily study hours later, with the plan adjusting accordingly
- Priority by exam date and difficulty
- Saved data, so a returning student sees today's plan
- Responsive layout on phone and desktop

## Deferred From the POC

- **Calendar sync** — needs external account connections; not needed to prove the replan idea.
- **Notifications and reminders** — needs scheduling and permissions; the student checks in by opening the app.
- **Sharing or studying with classmates** — needs multi-user features beyond a simple login.

## Possible Later Enhancements

- Having the AI estimate topic hours when a student has no idea.
- Marking topics as most important, so the "important parts" are chosen by the student.

## Non-Goals

- No calendar sync, notifications, or classmate features (see Deferred From the POC).
- No password recovery, email verification or social login. The login is deliberately simple.
- Not a note-taking or content tool: it plans study time, and doesn't teach the material.

## Open Questions

- None blocking. Hour blocks (for example, "Biology Ch. 4 — 2h") rather than clock times was the agreed reading, approved with the PRD.
