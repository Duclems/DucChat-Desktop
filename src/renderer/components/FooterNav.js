function makeLink({ label, href }) {
  const a = document.createElement('a');
  a.className = 'navLink';
  a.href = href;
  a.textContent = label;
  return a;
}

export function FooterNav({ router }) {
  const footer = document.createElement('footer');
  footer.className = 'footerNav';

  const inner = document.createElement('div');
  inner.className = 'footerNav__inner';

  const home = makeLink({ label: 'Accueil', href: '#/' });
  const iface = makeLink({ label: 'Interface', href: '#/interface' });
  const style = makeLink({ label: 'Style', href: '#/style' });
  const settings = makeLink({ label: 'Settings', href: '#/settings' });

  function updateActive() {
    const current = router.getPath();
    home.classList.toggle('navLink--active', current === '/');
    iface.classList.toggle('navLink--active', current === '/interface');
    style.classList.toggle('navLink--active', current === '/style');
    settings.classList.toggle('navLink--active', current === '/settings');
  }

  window.addEventListener('app:navigated', updateActive);
  updateActive();

  // Order: left -> right
  inner.append(home, iface, style, settings);
  footer.append(inner);
  return footer;
}


