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

**Set Result**:
The reps and load an Athlete actually performs for a Set Target.
_Avoid_: Actual set, completed set

**Training Segment**:
One continuous timed interval within a Training Session. Reopening a finished Training Session begins another segment without rewriting earlier segments.
_Avoid_: Timer interval, resume period

**Exercise Catalog**:
The combined collection of shared Catalog Exercises and an Athlete's private Custom Exercises that may be added to a Workout Prescription.
_Avoid_: Exercise library, master list

**Catalog Exercise**:
A curated exercise visible to every Athlete and owned by PumpPal rather than an individual Athlete.
_Avoid_: Global exercise, system exercise

**Custom Exercise**:
An exercise owned by one Athlete and visible only to that Athlete. Its normalized name is unique among that Athlete's Custom Exercises.
_Avoid_: Personal exercise, user exercise
