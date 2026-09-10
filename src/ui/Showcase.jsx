// req-13 — the #/components showcase. One example of each library component so
// Emilio can see and iterate on the look. This is the iteration surface, not part
// of the app's real flow.
import { useState } from 'react'
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

export function Showcase() {
  const [effort, setEffort] = useState(3)
  const [checked, setChecked] = useState(true)
  const [text, setText] = useState('')
  const [num, setNum] = useState('60')
  const [note, setNote] = useState('')

  return (
    <Screen className="ui-showcase">
      <Title>Components</Title>

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
