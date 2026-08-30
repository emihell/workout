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

export function Missing({ children = 'Not found.' }) {
  return (
    <section>
      <Back />
      <p>{children}</p>
    </section>
  )
}
