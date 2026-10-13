---
doc: scope
status: approved
---

# StudyFlow (working name)

An AI study planner for university students that builds a day-by-day timetable before exams, then replans automatically when the student falls behind.

## The Unique Kernel
The AI does the planning and the replanning. The student enters their courses, topics, difficulty, exam dates and required hours, and gets a detailed timetable of what to study, when, and how much. When something isn't finished, the plan adjusts itself. After each replan it shows a short "what moved and why" note (e.g. "Chapter 4 moved to Thursday because Tuesday's session was only half done"), so the student can see and trust the AI's reasoning.

## Who It's For
University students with a lot of material to cover before exams. Today, it's hard for them to keep a timetable going, and a plan made once falls apart the first time a day goes wrong.

## The Core Loop
1. The student logs in and enters their courses, what to cover, difficulty level, exam dates and required hours.
2. The AI builds a detailed timetable: what to study, when, and how much.
3. At the end of each day, the student marks each item **completed**, **partially completed** or **untouched**.
4. For partial items, the system asks only how many hours they actually studied and works out what's left. An optional "still need more time on this" tick covers cases where the hours don't tell the whole story.
5. The AI replans the remaining schedule and shows what moved and why.

They come back each day because the plan is always current, and falling behind doesn't mean starting over.

## Inspiration & Identity
None volunteered yet. It must work on both phone and desktop browsers.

## Why This Matters to the Learner
They want to build something for students, and to master AI agents "so that I can build whatever I want later on efficiently."

## What "Working" Looks Like
A student logs in with a username and password, enters their courses and exam details, and gets a timetable. They mark a day as partly done and enter the hours studied. The plan changes in front of them, with a clear note on what moved and why. It all works on a phone and on a desktop. The "oh, that's cool" beat is the replan: the timetable visibly reshuffles itself and explains why.

## The POC Boundary
- Simple login with username and password
- Entering courses, topics to cover, difficulty, exam dates and required hours
- AI-generated detailed timetable
- Daily check-in: completed / partially completed (hours studied, optional "needs more time") / untouched
- Automatic replanning, with a "what moved and why" explanation
- Responsive layout that works on mobile and web

## Later
- Calendar sync
- Notifications and reminders
- Sharing or studying with classmates

## Explicitly Cut
Nothing is formally cut yet. The learner said the scope may change and will say so if it does.
