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
import { useEffect, useState } from 'react'
import { catalogItemToExercise, loadExerciseCatalog, searchCommonFirst, shownName } from '../exerciseCatalog.js'
import { libraryItemMatch } from '../exercise-names.js'
import { filteredBrowse, looseOwnMatch, ownRecentFirst, pickerItem, staplesByMuscle } from '../routine-picker.js'
import { useStore } from '../store-context'
import { Actions, Button, Checkbox, Field, List, NavLink, Row, SectionHeader } from '../ui/index.jsx'

function PickRow({ name, checked, plan, onToggle }) {
  return (
    <Row>
      <Checkbox
        checked={checked}
        onChange={onToggle}
        label={
          <span className="ui-row__stack">
            <span>{name}</span>
            {checked && plan ? <span className="ui-row__meta">{plan}</span> : null}
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
  addLabel = (n) => `Add ${n}`,
  lateral = null,
  cancelTo,
  createTo = null,
  ownFilter = null,
  libraryFilter = null,
  loadCatalog = loadExerciseCatalog,
}) {
  const store = useStore()
  const [query, setQuery] = useState('')
  const [showRest, setShowRest] = useState(false)
  const [catalog, setCatalog] = useState(null)
  const [error, setError] = useState('')
  // In tap order: { key, kind: 'own', exercise, restore?, fromLibrary? } | { key, kind: 'library', entry }.
  const [picks, setPicks] = useState([])
  // The near-duplicate question open under a library row: { entry, match } (req-180 §6).
  const [ask, setAsk] = useState(null)

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

  const pickPlan = (pick) =>
    pickerItem(workouts, pick.kind === 'own' ? pick.exercise : catalogItemToExercise(pick.entry))
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
        name={`${shownName(entry)} — ${entry.equipment || 'bodyweight'}`}
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
          const { item, label } = pickPlan(pick)
          return pick.kind === 'library'
            ? { kind: 'library', data: catalogItemToExercise(pick.entry), item, label, name: shownName(pick.entry) }
            : { kind: 'own', exerciseId: pick.exercise.id, restore: Boolean(pick.restore), item, label, name: pick.exercise.name }
        }),
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

  const nothing = q && own.length === 0 && catalog && hits.length === 0

  return (
    <>
      {createTo ? (
        <p>
          <NavLink to={createTo} chevron="forward">Create exercise</NavLink>
        </p>
      ) : null}
      <Field
        label="Search"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
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
                  name={`${ex.name} — ${ex.equipment}`}
                  checked={Boolean(picked)}
                  plan={picked ? pickPlan(picked).label : ''}
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
      {/* DESIGN §4 — retreat left, primary right; kept in reach over a long list. */}
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
    </>
  )
}
