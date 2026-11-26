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
        const image = coverDialog.querySelector('img');
        const title = link.dataset.coverTitle || 'Das Licht von Bethlehem';
        image.src = link.href;
        image.alt = 'Vergrößertes Buchcover: ' + title;
        coverDialog.setAttribute('aria-label', 'Buchcover: ' + title);
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

async function loadBookDetails() {
  const response = await fetch('/api/books?catalog=1');
  if (!response.ok) return;
  for (const book of (await response.json()).books) {
    if (book.added) {
      const section = document.getElementById('weitere-buecher');
      if (section) {
        section.querySelector('.catalog-list').append(bookCard(book));
        section.hidden = false;
      }
      continue;
    }
    const grid = document.getElementById(book.id === 'bethlehem' ? 'book-title' : 'maggie-title')?.closest('.book-grid');
    if (!grid) continue;
    for (const key of ['subtitle','description']) grid.querySelector('.book-'+key).textContent = book[key];
    grid.querySelector('.status').textContent = book.status;
    for (const link of grid.querySelectorAll('[data-open-cover]')) link.href = book.cover;
    if (book.cover.startsWith('/api/')) {
      grid.querySelector('.cover-link img').src = book.cover;
      if (book.id === 'bethlehem') {
        const hero = document.querySelector('a[href="#buecher"] img[src$="book-cover.webp"]');
        if (hero) hero.src = book.cover;
      }
    }
  }
}
loadBookDetails().catch(() => {});

function bookCard(book) {
  const card = document.createElement('article');
  card.className = 'catalog-card';
  const art = document.createElement(book.cover ? 'a' : 'div');
  art.className = 'catalog-art';
  if (book.cover) {
    art.href = book.cover;
    const image = document.createElement('img');
    image.src = book.cover;
    image.alt = 'Cover von '+book.title+' in Großansicht';
    image.loading = 'lazy';
    art.append(image);
  } else {
    art.classList.add('typographic-cover');
    art.textContent = book.title;
    art.setAttribute('aria-hidden','true');
  }
  const copy = document.createElement('div');
  for (const [tag,text,style] of [['span',book.status,'eyebrow'],['h3',book.title,''],['p',book.subtitle,'catalog-subtitle'],['p',book.description,'']]) {
    if (!text) continue;
    const element = document.createElement(tag);
    element.className = style;
    element.textContent = text;
    copy.append(element);
  }
  card.append(art,copy);
  return card;
}
