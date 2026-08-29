import { back } from '../route'

export function Back() {
  return (
    <p>
      <button type="button" onClick={() => back()}>
        Back
      </button>
    </p>
  )
}
