(() => {
  'use strict';
  document.documentElement.classList.add('js');
  const toggle = document.querySelector('.menu-toggle');
  const navigation = document.querySelector('.site-nav');
  const closeMenu = () => {
    if (!toggle || !navigation) return;
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', 'Menü öffnen');
    navigation.classList.remove('is-open');
  };
  if (toggle && navigation) {
    toggle.addEventListener('click', () => {
      const expanded = toggle.getAttribute('aria-expanded') !== 'true';
      toggle.setAttribute('aria-expanded', String(expanded));
      toggle.setAttribute('aria-label', expanded ? 'Menü schließen' : 'Menü öffnen');
      navigation.classList.toggle('is-open', expanded);
    });
    navigation.querySelectorAll('a').forEach(link => link.addEventListener('click', closeMenu));
    document.addEventListener('click', event => {
      if (toggle.getAttribute('aria-expanded') === 'true' && !navigation.contains(event.target) && !toggle.contains(event.target)) closeMenu();
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
        closeMenu();
        toggle.focus();
      }
    });
    window.matchMedia('(min-width: 721px)').addEventListener('change', event => { if (event.matches) closeMenu(); });
  }

  const coverDialog = document.querySelector('.cover-dialog');
  let coverTrigger = null;
  if (coverDialog && typeof coverDialog.showModal === 'function') {
    document.querySelectorAll('[data-open-cover]').forEach(link => {
      link.addEventListener('click', event => {
        if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        coverTrigger = link;
        coverDialog.showModal();
        document.body.classList.add('dialog-open');
      });
    });
    coverDialog.querySelector('.dialog-close')?.addEventListener('click', () => coverDialog.close());
    coverDialog.addEventListener('click', event => {
      if (event.target !== coverDialog) return;
      const box = coverDialog.getBoundingClientRect();
      if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) coverDialog.close();
    });
    coverDialog.addEventListener('close', () => {
      document.body.classList.remove('dialog-open');
      coverTrigger?.focus({ preventScroll: true });
    });
  }

  if ('IntersectionObserver' in window && navigation) {
    const links = [...navigation.querySelectorAll('a[href^="#"]')];
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        links.forEach(link => {
          if (link.getAttribute('href') === '#' + entry.target.id) link.setAttribute('aria-current', 'location');
          else link.removeAttribute('aria-current');
        });
      }
    }, { rootMargin: '-15% 0px -55% 0px', threshold: 0 });
    document.querySelectorAll('main section[id]').forEach(section => observer.observe(section));
  }
  document.querySelectorAll('[data-year]').forEach(element => { element.textContent = String(new Date().getFullYear()); });
  // Contact submission is intentionally disabled. No form, submission
  // endpoint, request handler or third-party form script is included.
})();
