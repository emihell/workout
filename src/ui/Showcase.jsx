// req-13 — the #/components showcase. Renders every library component in its
// states so Emilio can see and iterate on the look. This is the iteration
// surface; it is not part of the app's real flow.
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
  SectionHeader,
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

function Block({ heading, children }) {
  return (
    <div className="ui-showcase__block">
      <SectionHeader>{heading}</SectionHeader>
      {children}
    </div>
  )
}

export function Showcase() {
  const [effort, setEffort] = useState(3)
  const [feel, setFeel] = useState('Good')
  const [checked, setChecked] = useState(true)
  const [text, setText] = useState('')
  const [num, setNum] = useState('60')
  const [note, setNote] = useState('')

  return (
    <Screen className="ui-showcase">
      <Title>Components</Title>

      <Block heading="Buttons">
        <div className="ui-showcase__row">
          <Button variant="primary">Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="quiet">Quiet</Button>
          <Button variant="secondary" disabled>
            Disabled
          </Button>
        </div>
        <div style={{ marginTop: 8 }}>
          <Button variant="primary" block>
            Full-width
          </Button>
        </div>
      </Block>

      <Block heading="Nav links">
        <div className="ui-showcase__row">
          <NavLink to="/">Today</NavLink>
          <NavLink to="/components" chevron="back">
            Back
          </NavLink>
          <NavLink to="/settings" chevron="forward">
            Settings
          </NavLink>
        </div>
      </Block>

      <Block heading="Segmented control">
        <SegmentedControl options={EFFORT} value={effort} onChange={setEffort} ariaLabel="Effort" />
        <div style={{ height: 8 }} />
        <SegmentedControl
          options={['Easy', 'Good', 'Hard', 'Exhausting']}
          value={feel}
          onChange={setFeel}
          ariaLabel="Feel"
        />
      </Block>

      <Block heading="Checkbox">
        <Checkbox label="Assistant prompt" checked={checked} onChange={setChecked} />
      </Block>

      <Block heading="File button">
        <FileButton label="Import" accept="application/json,.json" onFiles={() => {}} />
      </Block>

      <Block heading="Fields">
        <Field label="Name" value={text} onChange={(e) => setText(e.target.value)} placeholder="Bench press" />
        <NumberField label="kg" value={num} onChange={(e) => setNum(e.target.value)} />
        <Textarea label="Note" value={note} onChange={(e) => setNote(e.target.value)} />
      </Block>

      <Block heading="Grouped list + rows">
        <List>
          <Row to="/exercises">Exercises</Row>
          <Row to="/history">History</Row>
          <Row value="82.5 kg">Last top set</Row>
          <Row value="12">Sets logged</Row>
        </List>
      </Block>

      <Block heading="Banner">
        <Banner role="alert">Couldn't save your last change — export a backup from Settings.</Banner>
        <Banner>Downloaded.</Banner>
      </Block>

      <Block heading="Rest bar">
        <RestBar seconds={72} paused={false} onPauseResume={() => {}} onAddTime={() => {}} onNext={() => {}} />
        <div style={{ height: 8 }} />
        <RestBar seconds={45} paused onPauseResume={() => {}} onAddTime={() => {}} onNext={() => {}} />
      </Block>

      <Block heading="Set-log form">
        <SetLogForm weighted onComplete={() => {}} onSkip={() => {}} onPrevious={() => {}} />
      </Block>
    </Screen>
  )
}
