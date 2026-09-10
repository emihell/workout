// req-13 — the #/components showcase. One example of each library component so
// Emilio can see and iterate on the look. This is the iteration surface, not part
// of the app's real flow.
import { useEffect, useState } from 'react'
import {
  Banner,
  Button,
  Checkbox,
  Field,
  FileButton,
  List,
  NavLink,
  NumberField,
  RestBar,
  Row,
  Screen,
  SegmentedControl,
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
// header — SectionHeader is the 22px h2 tier, demonstrated inside the set-log form.
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
  { token: '--ui-text-rest', name: 'rest' },
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

      <Block heading="Button">
        <Button variant="primary">Primary</Button>
        <p className="ui-field__label">variants: primary / secondary / quiet</p>
      </Block>

      <Block heading="Nav link">
        <NavLink to="/settings" chevron="forward">
          Settings
        </NavLink>
      </Block>

      <Block heading="Segmented control">
        <SegmentedControl options={EFFORT} value={effort} onChange={setEffort} ariaLabel="Effort" />
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

      <Block heading="Grouped list + row">
        <List>
          <Row to="/exercises">Exercises</Row>
          <Row value="82.5 kg">Last top set</Row>
        </List>
      </Block>

      <Block heading="Banner">
        <Banner role="alert">Couldn't save your last change — export a backup from Settings.</Banner>
      </Block>

      <Block heading="Rest bar">
        <RestBar seconds={72} paused={false} onPauseResume={() => {}} onAddTime={() => {}} onNext={() => {}} />
      </Block>

      <Block heading="Set-log form">
        <SetLogForm weighted onComplete={() => {}} onSkip={() => {}} onPrevious={() => {}} />
      </Block>
    </Screen>
  )
}
