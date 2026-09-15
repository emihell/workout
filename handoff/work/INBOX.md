# Inbox — raw asks, not yet reqs

Raw notes from Emilio, saved verbatim before processing. Nothing here is a
requirement yet; each becomes a `work/req-NN-name.md` once grounded and its
behaviour decisions are answered. **Rule:** raw asks land here *first*, the moment
Emilio sends them — before any processing — so they survive the session. Clear an
item from this file only once it is specced as a req (leave a pointer to the req).

---

## Batch: workout / gym-flow notes (Emilio — originally sent a prior session, lost before capture; re-sent + saved 2026-09-16)

Emilio's intent: **turn these into reqs.** Saved verbatim below. Grounding sweep
against the code was in progress at save time.

### Workout

- If nothing is Scheduled today, make start button "start new workout"

- Time for timed exercises — already a req for this? [likely backlog #6, PARKED on model decision]

- If i start a exercise in a workout, go elsewhere in the app, then press continue
  on the active workout — i should go straight in the exercise

- There should maybe be a floating button for active workout? Or a signal in the
  workout button in menu?

- When i finish last set, i see the rest timer in the exercise menu, make the rest
  timer much much smaller, in a little pill/button — floating in absolute — maybe
  remove the timer screen and move it into each following page — similar to above,
  when i do one set, and press complete, i move to next set but have the rest
  pill/button (whatever is best) on it, that way we remove a button press, a extra
  page, and make it simpler?

- In the exercise list for a workout that is active, make a bigger visual difference
  between exercises that are done and those that are not done, so your eye focuses on
  the ones that are not done, while the done are less visible (as they are done and
  will probably not be interacted with anymore)

### During an exercise

- Previous skip next should be placed at the absolute bottom of the page, and add
  note be something small beside the exercise title

- Maybe have a new button only for development, that is a button where i can add
  notes to a page — so when i am doing an exercise — and see a flaw or improvement
  possibility — i can press this little (very little and unimposing) button and add a
  note — it's saved connected to that page — so you can see what its connected to and
  see my notes and create a req from it

- If i change a set setting during workout — that should be saved for the future —
  for example, i set 4kg to 5kg during warm up — that should now be the default for
  all future workouts

- When all exercise in a routine is done, auto complete? Like a great job, finishing
  routine in 10 sec showing stats/improvements from last time — then auto complete
  the whole routine but have option to edit (ask user to intervene if needed, but
  goal should be that everything is automated and user interaction is minimal) —
  instead of having a list all done and press done

### On main page

- Remove the complete today — it becomes a duplicate? Maybe the list on the main page
  should be refactored, and become one component? I am guessing its several components
  right now and thats why we introduce these weird states? [touches req-28, just shipped]
