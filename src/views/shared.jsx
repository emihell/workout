import { go } from '../route'

export function Back({ to }) {
  return (
    <p>
      <button type="button" onClick={() => go(to)}>
        Back
      </button>
    </p>
  )
}
