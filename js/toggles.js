export function setupToggles(stringsG, brassG, windsG, formalEnergyG) {
  const toggleStrings = document.getElementById('toggle-strings');
  const toggleBrass = document.getElementById('toggle-brass');
  const toggleWinds = document.getElementById('toggle-winds');
  const toggleFormal = document.getElementById('toggle-formal');

  if (toggleStrings) {
    toggleStrings.addEventListener('click', () => {
      const isActive = toggleStrings.classList.toggle('active');
      if (stringsG) stringsG.style('display', isActive ? 'inline' : 'none');
    });
  }
  if (toggleBrass) {
    toggleBrass.addEventListener('click', () => {
      const isActive = toggleBrass.classList.toggle('active');
      if (brassG) brassG.style('display', isActive ? 'inline' : 'none');
    });
  }
  if (toggleWinds) {
    toggleWinds.addEventListener('click', () => {
      const isActive = toggleWinds.classList.toggle('active');
      if (windsG) windsG.style('display', isActive ? 'inline' : 'none');
    });
  }
  if (toggleFormal) {
    toggleFormal.addEventListener('click', () => {
      const isActive = toggleFormal.classList.toggle('active');
      if (formalEnergyG) {
        formalEnergyG.style('display', isActive ? 'inline' : 'none');
      }
    });
  }
}
