import { FooterNav } from '../components/FooterNav';
import { assetUrl } from '../utils/assetUrl';

function iconImg(iconUrl, alt = '') {
  const img = document.createElement('img');
  img.className = 'iconBtn__img';
  img.src = iconUrl;
  img.alt = alt;
  img.draggable = false;
  return img;
}

function iconButton({ title, iconUrl, className, onClick }) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = className;
  btn.title = title;
  btn.setAttribute('aria-label', title);
  btn.append(iconImg(iconUrl, title));
  btn.addEventListener('click', onClick);
  return btn;
}

export function AppShell({ outlet, router, isOverlay = false }) {
  const shell = document.createElement('div');
  shell.className = 'appShell';

  let header = null;
  if (!isOverlay) {
    header = document.createElement('header');
    header.className = 'appHeader';

    const headerRow = document.createElement('div');
    headerRow.className = 'appHeader__row';

    const actions = document.createElement('div');
    actions.className = 'appHeader__actions';

    const brand = document.createElement('div');
    brand.className = 'appBrand';

    const brandLogo = document.createElement('img');
    brandLogo.className = 'appBrand__logo';
    brandLogo.src = assetUrl('icons/logo/DucVoice.svg');
    brandLogo.alt = 'DucChat';
    brandLogo.draggable = false;

    const brandName = document.createElement('div');
    brandName.className = 'appBrand__name';
    brandName.textContent = 'DucChat';

    brand.append(brandLogo, brandName);

    const trayBtn = iconButton({
      title: 'Réduire dans la zone de notification (en bas à droite)',
      iconUrl: assetUrl('icons/topbar/tray.svg'),
      className: 'iconBtn',
      onClick: async () => {
        if (window.app?.minimizeToTray) await window.app.minimizeToTray();
      },
    });

    const minBtn = iconButton({
      title: 'Réduire',
      iconUrl: assetUrl('icons/topbar/minus.svg'),
      className: 'iconBtn iconBtn--win',
      onClick: async () => {
        if (window.windowControls?.minimize) await window.windowControls.minimize();
      },
    });

    const closeBtn = document.createElement('button');
    closeBtn.className = 'iconBtn iconBtn--win iconBtn--danger';
    closeBtn.type = 'button';
    closeBtn.title = 'Fermer';
    closeBtn.setAttribute('aria-label', 'Fermer');
    closeBtn.replaceChildren(iconImg(assetUrl('icons/topbar/close.svg'), 'Fermer'));
    closeBtn.addEventListener('click', async () => {
      if (window.windowControls?.close) await window.windowControls.close();
    });

    actions.append(minBtn, trayBtn, closeBtn);
    headerRow.append(brand, actions);
    header.append(headerRow);
  }

  const main = document.createElement('main');
  main.className = 'appMain';
  main.append(outlet);

  const footer = isOverlay ? null : FooterNav({ router });

  if (header) shell.append(header);
  shell.append(main);
  if (footer) shell.append(footer);
  return shell;
}


