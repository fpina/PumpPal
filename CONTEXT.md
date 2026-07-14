# PumpPal

PumpPal helps an Athlete prescribe workouts, perform training, and retain an accurate record of what was planned and what occurred.

## Language

**Athlete**:
A person who plans and performs training in PumpPal.
_Avoid_: User, account holder

**Workout Prescription**:
The exercises, Set Targets, ordering, and rest guidance an Athlete intends to perform.
_Avoid_: Template, routine, workout plan

**Training Session**:
One Athlete's performance of a Workout Prescription, including lifecycle, timing, and Set Results.
_Avoid_: Workout log, live workout

**Set Target**:
The prescribed reps, load, load unit, and rest guidance for one set.
_Avoid_: Planned set, expected set

**Prescription Exercise**:
One ordered Catalog Exercise or Custom Exercise selection inside a Workout Prescription, including exercise-specific notes and its Set Targets.
_Avoid_: Workout exercise, junction entry

**Set Result**:
The reps and load an Athlete actually performs for a Set Target.
_Avoid_: Actual set, completed set

**Training Segment**:
One continuous timed interval within a Training Session. Reopening a finished Training Session begins another segment without rewriting earlier segments.
_Avoid_: Timer interval, resume period

**Workout Date**:
The calendar day an Athlete assigns to a Workout Prescription, independent of timezone or time of day.
_Avoid_: Workout timestamp, session date

**Session Instant**:
A precise moment when a Training Session event occurred, such as starting, completing a set, or finishing.
_Avoid_: Session date, calendar time

**Elapsed Duration**:
The amount of active time accumulated during a Training Session.
_Avoid_: Duration timestamp, elapsed date

**Transition Outcome**:
A typed result from a Training Session command: either a named successful transition or a meaningful `not_found`/`invalid_transition` rejection.
_Avoid_: Generic domain exception, form error

**Workout Builder**:
The server module that owns Workout Prescription creation, editing, repetition, Prescription Exercise and Set Target management, ownership checks, editability, and transaction boundaries.
_Avoid_: Workout service, route action service

**Builder Command Outcome**:
A typed result from a Workout Builder command: either a named success or a meaningful `not_found`, `invalid_transition`, or `conflict` rejection. Unexpected infrastructure failures remain operational errors.
_Avoid_: Generic domain exception, form error

**Session Capability**:
A stable statement from the Training Session module describing an action currently available to an Athlete, such as starting, finishing, reopening, or completing a Set Target.
_Avoid_: UI state guess, route permission

**Exercise Catalog**:
The combined collection of shared Catalog Exercises and an Athlete's private Custom Exercises that may be added to a Workout Prescription.
_Avoid_: Exercise library, master list

**Catalog Exercise**:
A curated exercise visible to every Athlete and owned by PumpPal rather than an individual Athlete.
_Avoid_: Global exercise, system exercise

**Custom Exercise**:
An exercise owned by one Athlete and visible only to that Athlete. Its normalized name is unique among that Athlete's Custom Exercises.
_Avoid_: Personal exercise, user exercise
