// req-180 (DEC-097) — add exercises to a routine from one screen: your exercises (most
// recently done first), then the bundled library (staples by muscle when the search is
// empty), multi-select, "Add N". Values per item come from routine-picker.js (history, or a
// starting plan shown on the selected row). A library pick creates your own record only at
// Add N — backing out creates nothing. req-181 (a plan slot) reuses it:
//   ownFilter(exercise) / libraryFilter(entry) — optional predicates narrowing the EMPTY-search
//     view (a filtered library shows its staples, then "Show N more"); typing searches everything.
//   onAdd([{ exerciseId, item }]) — called once, in tap order, after the records exist.
//   onPick([pick]) — instead of onAdd: nothing is written; each pick is { kind: 'own', exerciseId,
//     restore, item, name } or { kind: 'library', data (catalogItemToExercise), item, name }.
//   max — 1 makes a tap replace the selection; addLabel(n) — the primary button's text;
//   lateral — an extra control between Cancel and the primary (a plan slot's Skip).
//   req-188 (DEC-104) — each onPick pick also carries `source` ('history' | 'starting');
//   startingLabel — shown on a selected no-history row instead of the starting plan (the
//   workout's pickers don't use that plan: they ask for sets and rest next).
//   req-190 — onPick's second argument is the picker's own selection; passing it back as
//   `initialSelection` reopens the picker with the same rows ticked (machines-first Back).
//   req-216 (DEC-119 §5) — an "Added: …" strip above the bar names the picks in tap order (a
//   tap on a name unticks it); `inWorkout` (a Set of exercise ids, the routine picker's) marks
//   those rows "In this workout" — marked, still pickable.
import { useEffect, useState } from 'react'
import { catalogItemToExercise, loadExerciseCatalog, searchCommonFirst, shownName } from '../exerciseCatalog.js'
import { libraryItemMatch } from '../exercise-names.js'
import { equipmentLabel } from '../equipment-label.js'
import { addedStrip } from '../exercise-use.js'
import { filteredBrowse, looseOwnMatch, ownRecentFirst, pickerItem, staplesByMuscle } from '../routine-picker.js'
import { useStore } from '../store-context'
import { Actions, Button, Checkbox, List, NavLink, Row, SearchField, SectionHeader } from '../ui/index.jsx'

function PickRow({ name, checked, plan, inWorkout = false, onToggle }) {
  const meta = [inWorkout ? 'In this workout' : '', checked ? plan : ''].filter(Boolean).join(' · ')
  return (
    <Row>
      <Checkbox
        checked={checked}
        onChange={onToggle}
        label={
          <span className="ui-row__stack">
            <span>{name}</span>
            {meta ? <span className="ui-row__meta">{meta}</span> : null}
          </span>
        }
      />
    </Row>
  )
}

// `loadCatalog` is injectable for tests only (a failing load → "Could not load.").
export function ExercisePicker({
  onAdd,
  onPick = null,
  max = Infinity,
  // req-191 §7 — "Add" (disabled) with nothing ticked, "Add N" otherwise (was "Add 0").
  addLabel = (n) => (n ? `Add ${n}` : 'Add'),
  lateral = null,
  cancelTo,
  createTo = null,
  ownFilter = null,
  libraryFilter = null,
  startingLabel = null,
  initialSelection = null,
  inWorkout = null,
  loadCatalog = loadExerciseCatalog,
}) {
  const store = useStore()
  const [query, setQuery] = useState('')
  const [showRest, setShowRest] = useState(false)
  const [catalog, setCatalog] = useState(null)
  const [error, setError] = useState('')
  // In tap order: { key, kind: 'own', exercise, restore?, fromLibrary? } | { key, kind: 'library', entry }.
  const [picks, setPicks] = useState(() => initialSelection || [])
  // The near-duplicate question open under a library row: { entry, match } (req-180 §6).
  const [ask, setAsk] = useState(null)
  // req-216 — the strip's "+N" shows every pick.
  const [stripOpen, setStripOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    loadCatalog()
      .then((list) => {
        if (!cancelled) setCatalog(list)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load.')
      })
    return () => {
      cancelled = true
    }
  }, [loadCatalog])

  const workouts = store.workouts
  const q = query.trim().toLowerCase()
  // Own list: the filter narrows the empty search only; typing uses today's substring rule
  // on name / equipment / muscles over all of them.
  const own = ownRecentFirst(store.exercises, workouts).filter((ex) =>
    q ? `${ex.name} ${ex.equipment} ${ex.muscles}`.toLowerCase().includes(q) : !ownFilter || ownFilter(ex),
  )
  // Library minus the rows you already have (a live match shows in your list above).
  const shown = (entry) => libraryItemMatch(store.exercises, entry)?.kind !== 'live'
  const groups =
    catalog && !q && !libraryFilter ? staplesByMuscle(catalog).map((g) => ({ ...g, items: g.items.filter(shown) })) : []
  // Empty search + a filter (a plan slot): its staples, the rest on request.
  const browse = catalog && !q && libraryFilter ? filteredBrowse(catalog, libraryFilter) : null
  const found = catalog && q ? searchCommonFirst(catalog, query, 25, { exercises: store.exercises }) : browse
    ? { common: browse.staples, rest: browse.rest, restCount: browse.rest.length }
    : null
  const restDirect = found ? found.common.length === 0 : false
  const hits = found ? (restDirect || showRest ? [...found.common, ...found.rest] : found.common).filter(shown) : []

  const pickPlan = (pick) => {
    const plan = pickerItem(workouts, pick.kind === 'own' ? pick.exercise : catalogItemToExercise(pick.entry))
    return startingLabel && plan.source === 'starting' ? { ...plan, label: startingLabel } : plan
  }
  const ownPicked = (exercise) => picks.find((pick) => pick.kind === 'own' && pick.exercise.id === exercise.id)
  const libraryPicked = (entry) =>
    picks.find((pick) => pick.key === `lib:${entry.id}` || (pick.fromLibrary && pick.fromLibrary === entry.id))
  const drop = (pick) => setPicks((list) => list.filter((candidate) => candidate !== pick))
  const push = (pick) =>
    setPicks((list) => {
      if (list.some((candidate) => candidate.key === pick.key)) return list
      return max === 1 ? [pick] : [...list, pick]
    })

  const toggleOwn = (exercise) => {
    const picked = ownPicked(exercise)
    if (picked) drop(picked)
    else push({ key: `own:${exercise.id}`, kind: 'own', exercise })
  }
  const toggleLibrary = (entry) => {
    const picked = libraryPicked(entry)
    if (picked) return drop(picked)
    const match = looseOwnMatch(store.exercises, entry, workouts)
    if (match) return setAsk({ entry, match })
    push({ key: `lib:${entry.id}`, kind: 'library', entry })
  }
  const answer = (choice) => {
    const { entry, match } = ask
    setAsk(null)
    if (choice === 'mine') {
      push({ key: `own:${match.exercise.id}`, kind: 'own', exercise: match.exercise, restore: match.kind === 'archived', fromLibrary: entry.id })
    } else if (choice === 'new') {
      push({ key: `lib:${entry.id}`, kind: 'library', entry })
    }
  }

  const libraryRow = (entry) => {
    const picked = libraryPicked(entry)
    const rows = [
      <PickRow
        key={entry.id || entry.name}
        name={`${shownName(entry)} — ${equipmentLabel(entry.equipment, 'Bodyweight')}`}
        checked={Boolean(picked)}
        plan={picked ? pickPlan(picked).label : ''}
        onToggle={() => toggleLibrary(entry)}
      />,
    ]
    if (ask?.entry === entry) {
      const archived = ask.match.kind === 'archived'
      rows.push(
        <Row key={`${entry.id}-ask`}>
          <span className="ui-row__stack" role="group" aria-label="Near-duplicate">
            <span>Use your &lsquo;{ask.match.exercise.name}&rsquo;?</span>
            {archived ? <span className="ui-row__meta">It&rsquo;s archived; using it restores it.</span> : null}
            <Actions
              retreat={<Button variant="quiet" onClick={() => answer('back')}>Cancel</Button>}
              lateral={<Button onClick={() => answer('new')}>Add as new</Button>}
              forward={<Button variant="primary" onClick={() => answer('mine')}>Use mine</Button>}
            />
          </span>
        </Row>,
      )
    }
    return rows
  }

  const add = () => {
    if (onPick) {
      onPick(
        picks.map((pick) => {
          const { item, label, source } = pickPlan(pick)
          return pick.kind === 'library'
            ? { kind: 'library', data: catalogItemToExercise(pick.entry), item, label, source, name: shownName(pick.entry) }
            : { kind: 'own', exerciseId: pick.exercise.id, restore: Boolean(pick.restore), item, label, source, name: pick.exercise.name }
        }),
        picks,
      )
      return
    }
    const added = picks.map((pick) => {
      const { item } = pickPlan(pick)
      let exerciseId
      if (pick.kind === 'library') exerciseId = store.addExercise(catalogItemToExercise(pick.entry))
      else if (pick.restore) exerciseId = store.restoreExercise(pick.exercise.id)
      else exerciseId = pick.exercise.id
      return { exerciseId, item }
    })
    onAdd(added)
  }

  const pickName = (pick) => (pick.kind === 'library' ? shownName(pick.entry) : pick.exercise.name)
  // max 1 replaces on tap — the tick is the whole preview, so no strip.
  const strip = max !== 1 && picks.length ? addedStrip(picks, stripOpen) : null

  const nothing = q && own.length === 0 && catalog && hits.length === 0

  return (
    <>
      {createTo ? (
        <p>
          <NavLink to={createTo} chevron="forward">Create exercise</NavLink>
        </p>
      ) : null}
      <SearchField
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setShowRest(false)
        }}
        onClear={() => {
          setQuery('')
          setShowRest(false)
        }}
      />
      {nothing ? <p className="ui-sub">No matches.</p> : null}
      {own.length ? (
        <>
          <SectionHeader>Your exercises</SectionHeader>
          <List>
            {own.map((ex) => {
              const picked = ownPicked(ex)
              return (
                <PickRow
                  key={ex.id}
                  name={[ex.name, equipmentLabel(ex.equipment)].filter(Boolean).join(' — ')}
                  checked={Boolean(picked)}
                  plan={picked ? pickPlan(picked).label : ''}
                  inWorkout={Boolean(inWorkout?.has(ex.id))}
                  onToggle={() => toggleOwn(ex)}
                />
              )
            })}
          </List>
        </>
      ) : null}
      {error ? <p className="ui-sub" role="alert">{error}</p> : null}
      {catalog === null && !error ? <p className="ui-sub">Loading…</p> : null}
      {groups.map((group) =>
        group.items.length ? (
          <section key={group.group}>
            <SectionHeader>{group.group}</SectionHeader>
            <List>{group.items.flatMap(libraryRow)}</List>
          </section>
        ) : null,
      )}
      {hits.length ? (
        <>
          <SectionHeader>Library</SectionHeader>
          <List>{hits.flatMap(libraryRow)}</List>
        </>
      ) : null}
      {found && !restDirect && !showRest && found.restCount > 0 ? (
        <Button variant="quiet" block onClick={() => setShowRest(true)}>
          Show {found.restCount} more from the full library
        </Button>
      ) : null}
      {/* DESIGN §4 — retreat left, primary right; kept in reach over a long list. req-216: the
          strip rides in the same stuck block, on the page background. */}
      <div className="ui-picker-dock">
        {strip ? (
          <p className={stripOpen ? 'ui-picker-strip is-open' : 'ui-picker-strip'} aria-label="Added">
            Added:{' '}
            {strip.shown.map((pick, i) => (
              <span key={pick.key}>
                <button type="button" className="ui-picker-strip__name" aria-label={`Remove ${pickName(pick)}`} onClick={() => drop(pick)}>
                  {pickName(pick)}
                </button>
                {i < strip.shown.length - 1 || strip.more ? ', ' : ''}
              </span>
            ))}
            {strip.more ? (
              <button type="button" className="ui-picker-strip__name" aria-label={`Show all ${picks.length}`} onClick={() => setStripOpen(true)}>
                +{strip.more}
              </button>
            ) : null}
          </p>
        ) : null}
        <Actions
          className="ui-picker-bar"
          retreat={<NavLink to={cancelTo} look="secondary">Cancel</NavLink>}
          lateral={lateral}
          forward={
            <Button variant="primary" disabled={picks.length === 0} onClick={add}>
              {addLabel(picks.length)}
            </Button>
          }
        />
      </div>
    </>
  )
}
