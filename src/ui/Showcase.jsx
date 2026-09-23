// req-13 — the #/components showcase. One example of each library component so
// Emilio can see and iterate on the look. This is the iteration surface, not part
// of the app's real flow.
import { useEffect, useState } from 'react'
import {
  Actions,
  Banner,
  Button,
  Checkbox,
  Field,
  FileButton,
  List,
  NavLink,
  NumberField,
  RestPill,
  Row,
  Screen,
  SectionHeader,
  SegmentedControl,
  Select,
  SetLogForm,
  Textarea,
  Title,
} from './index.jsx'

const EFFORT = [
  { value: 2, label: 'Easy' },
  { value: 3, label: 'Moderate' },
  { value: 4, label: 'Hard' },
  { value: 5, label: 'Failure' },
]

// The block label is a small eyebrow caption (e.g. "BUTTON"), not a section
// header — SectionHeader is the 22px h2 tier, shown in its own block (req-123).
function Block({ heading, children }) {
  return (
    <div className="ui-showcase__block">
      <p className="ui-eyebrow">{heading}</p>
      {children}
    </div>
  )
}

// The whole type scale at a glance. Samples render at the var(--ui-text-*) size
// (never a hardcoded px), and the px in each label is read back from the token at
// runtime — so this always matches the scale, whatever the tokens become.
const SCALE = [
  { token: '--ui-text-caption', name: 'caption' },
  { token: '--ui-text-body', name: 'body' },
  { token: '--ui-text-section', name: 'section' },
  { token: '--ui-text-title', name: 'title' },
  { token: '--ui-text-display', name: 'display' },
]

function TypeScale() {
  const [px, setPx] = useState({})
  useEffect(() => {
    const cs = getComputedStyle(document.documentElement)
    setPx(Object.fromEntries(SCALE.map(({ token }) => [token, cs.getPropertyValue(token).trim()])))
  }, [])
  return (
    <ul className="ui-typescale">
      {SCALE.map(({ token, name }) => (
        <li key={token} className="ui-typescale__row">
          <span className="ui-typescale__label">
            {name} · {px[token] || ''}
          </span>
          <span className="ui-typescale__sample" style={{ fontSize: `var(${token})` }}>
            Aa 123
          </span>
        </li>
      ))}
    </ul>
  )
}

export function Showcase() {
  const [effort, setEffort] = useState(3)
  const [checked, setChecked] = useState(true)
  const [text, setText] = useState('')
  const [num, setNum] = useState('60')
  const [note, setNote] = useState('')

  return (
    <Screen className="ui-showcase">
      <Title>Components</Title>

      <Block heading="Type scale">
        <TypeScale />
      </Block>

      <Block heading="Title + subtitle">
        <Title subtitle="A muted caption bound to the title">Title with subtitle</Title>
        <Title>Title, no subtitle</Title>
      </Block>

      {/* req-123 — every variant, plus `block` (full width) and disabled. */}
      <Block heading="Button">
        <Actions
          lateral={
            <>
              <Button variant="primary">Primary</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="quiet">Quiet</Button>
              <Button disabled>Disabled</Button>
            </>
          }
        />
        <Actions forward={<Button variant="primary" block>Primary, block</Button>} />
        <Actions forward={<Button variant="quiet" block>Quiet, block</Button>} />
        <p className="ui-field__label">variant: primary / secondary (default) / quiet · block · disabled</p>
      </Block>

      <Block heading="Section header">
        <SectionHeader>Section header</SectionHeader>
      </Block>

      {/* req-123 — the default link look with each chevron. */}
      <Block heading="Nav link">
        <NavLink to="/settings" chevron="back">
          Back
        </NavLink>
        <NavLink to="/settings" chevron="forward">
          Settings
        </NavLink>
        <p className="ui-field__label">chevron: back ‹ / forward ›</p>
      </Block>

      {/* req-122 — a NavLink wearing the Button look: it navigates, never writes (DEC-040). */}
      <Block heading="Nav link — button looks">
        <NavLink to="/settings" look="primary">
          Primary
        </NavLink>
        <NavLink to="/settings" look="secondary">
          Secondary
        </NavLink>
        <NavLink to="/settings" look="quiet">
          Quiet
        </NavLink>
        <NavLink to="/settings" look="primary" block>
          Primary, block
        </NavLink>
        <p className="ui-field__label">look: link (default) / primary / secondary / quiet / plain · block</p>
      </Block>

      {/* req-122 — DESIGN §4 order is the component's: retreat left, lateral between,
          forward right. */}
      <Block heading="Actions">
        <Actions
          retreat={<NavLink to="/settings" look="quiet">Cancel</NavLink>}
          lateral={<Button>Skip</Button>}
          forward={<Button variant="primary">Save</Button>}
        />
      </Block>

      <Block heading="Segmented control">
        <SegmentedControl options={EFFORT} value={effort} onChange={setEffort} ariaLabel="Effort" />
      </Block>

      <Block heading="Segmented control (clearable)">
        <SegmentedControl
          clearable
          options={EFFORT}
          value={effort}
          onChange={setEffort}
          ariaLabel="Effort (clearable)"
        />
      </Block>

      <Block heading="Checkbox">
        <Checkbox label="Assistant prompt" checked={checked} onChange={setChecked} />
      </Block>

      <Block heading="File button">
        <FileButton label="Import" accept="application/json,.json" onFiles={() => {}} />
      </Block>

      <Block heading="Field">
        <Field label="Name" value={text} onChange={(e) => setText(e.target.value)} placeholder="Bench press" />
      </Block>

      <Block heading="Number field">
        <NumberField label="kg" value={num} onChange={(e) => setNum(e.target.value)} />
      </Block>

      <Block heading="Textarea">
        <Textarea label="Note" value={note} onChange={(e) => setNote(e.target.value)} />
      </Block>

      <Block heading="Select">
        <Select label="Focus" options={['Machines', 'Free weights', 'Bodyweight', 'Cardio']} defaultValue="Machines" />
      </Block>

      <Block heading="Grouped list + row">
        <List>
          <Row to="/exercises">Exercises</Row>
          <Row to="/exercises" value="12">Exercises</Row>
          <Row value="82.5 kg">Last top set</Row>
          <Row action={<Button>Start</Button>}>Push day — Chest</Row>
          <Row
            action={
              <>
                <Button>Up</Button>
                <Button>Down</Button>
              </>
            }
          >
            Bench press — Work · 3 sets
          </Row>
          {/* req-123 — a completed exercise in the workout overview (req-79). */}
          <Row to="/exercises" className="ui-row--done">
            Chest press · done
          </Row>
        </List>
        <p className="ui-field__label">last row: ui-row--done (a completed exercise)</p>
      </Block>

      <Block heading="Banner">
        <Banner role="alert">Couldn't save your last change — export a backup from Settings.</Banner>
      </Block>

      <Block heading="Rest pill">
        <RestPill seconds={72} onSkip={() => {}} />
      </Block>

      <Block heading="Set-log form">
        <SetLogForm weighted onComplete={() => {}} onSkip={() => {}} onPrevious={() => {}} />
      </Block>
    </Screen>
  )
}
