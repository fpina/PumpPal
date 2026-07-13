# Store Workout Dates as calendar values

PumpPal stores a Workout Date as an ISO calendar value backed by PostgreSQL `date`, while Session Instants use timezone-aware timestamps and Elapsed Duration remains a number of seconds. Creation, editing, and repetition submit the intended calendar value directly, and display formats its components without passing through the browser or server timezone; this avoids the accidental day shifts caused by the previous local-noon and UTC-noon timestamp conventions.

Existing timezone-less workout timestamps are converted to `date` using their stored calendar components, preserving the day athletes previously entered. Existing timezone-less Training Session values are interpreted as UTC when converted to timezone-aware instants, matching the database convention under which PumpPal wrote them. Repetition asks for a Workout Date rather than inferring “today” on the server, because only the Athlete's browser knows the intended local calendar day.
