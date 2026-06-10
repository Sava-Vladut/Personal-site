import { useDecodedText } from '../../hooks/useDecodedText.js'

export function SectionTitle({ children }) {
  const label = typeof children === 'string' ? children : String(children)
  const decoded = useDecodedText(label, 620)

  return (
    <h2 aria-label={label}>
      <span aria-hidden="true">{decoded}</span>
      <span aria-hidden="true" className="title-cursor">_</span>
    </h2>
  )
}
