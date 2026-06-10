export function SectionTitle({ children }) {
  return (
    <h2>
      {children}
      <span aria-hidden="true">_</span>
    </h2>
  )
}
