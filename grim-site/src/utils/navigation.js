export function scrollToSection(target) {
  document.getElementById(target)?.scrollIntoView({
    behavior: 'smooth',
    block: 'start',
  })
}
