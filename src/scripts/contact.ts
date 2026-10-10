/**
 * The contact window. The letter bubble, or anything with data-contact-open, opens it: on a phone
 * it rises from the bottom of the screen to the middle, on a computer it appears in the middle.
 * Its form goes to his inbox through FormSubmit without leaving the page. A link to #contact
 * opens it too.
 */
const dialog = document.querySelector<HTMLDialogElement>('[data-contact]');
if (dialog) setup(dialog);

function setup(dialog: HTMLDialogElement) {
  const form = dialog.querySelector<HTMLFormElement>('[data-contact-form]')!;
  const sent = dialog.querySelector<HTMLElement>('[data-contact-sent]')!;
  const error = dialog.querySelector<HTMLElement>('[data-contact-error]')!;
  const send = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
  const sendLabel = send.querySelector<HTMLElement>('[data-contact-label]')!;
  const closeButton = dialog.querySelector<HTMLElement>('.contact__close')!;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let opener: HTMLElement | null = null;
  let closing = 0;

  function open(from: HTMLElement | null) {
    window.clearTimeout(closing);
    opener = from;
    if (!dialog.open) {
      dialog.showModal();
      // the window starts below the screen: focusing it must not scroll it there
      dialog.scrollTop = 0;
      closeButton.focus({ preventScroll: true });
    }
    // two frames later, so the window moves in from where it starts
    requestAnimationFrame(() => requestAnimationFrame(() => dialog.classList.add('is-open')));
  }
  function close() {
    if (!dialog.open) return;
    dialog.classList.remove('is-open');
    window.clearTimeout(closing);
    closing = window.setTimeout(() => dialog.close(), reduced.matches ? 250 : 450);
  }
  dialog.addEventListener('close', () => {
    window.clearTimeout(closing);
    dialog.classList.remove('is-open');
    // once a message has gone, the form is empty and ready for the next time
    if (!sent.hidden) {
      form.reset();
      form.hidden = false;
      sent.hidden = true;
    }
    error.hidden = true;
    opener?.focus({ preventScroll: true });
    opener = null;
  });
  // Escape: the window leaves the way it came
  dialog.addEventListener('cancel', (e) => {
    e.preventDefault();
    close();
  });
  // a tap outside the window closes it (but not a text selection that ends outside)
  let downOutside = false;
  dialog.addEventListener('pointerdown', (e) => (downOutside = e.target === dialog));
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog && downOutside) close();
  });
  dialog.querySelectorAll('[data-contact-close]').forEach((b) => b.addEventListener('click', close));
  document.addEventListener('click', (e) => {
    const trigger = (e.target as Element).closest<HTMLElement>('[data-contact-open]');
    if (!trigger) return;
    e.preventDefault();
    open(trigger);
  });
  if (location.hash === '#contact') open(null);

  const busy = (on: boolean) => {
    send.disabled = on;
    sendLabel.textContent = on ? 'Sending…' : 'Send message';
    form.setAttribute('aria-busy', String(on));
  };
  const done = () => {
    form.hidden = true;
    sent.hidden = false;
    sent.focus();
  };
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    error.hidden = true;
    const fields = Object.fromEntries(new FormData(form)) as Record<string, string>;
    // the hidden field only a robot fills in: it is thanked, and nothing is sent
    if (fields._honey) return done();
    fields._subject = `Website message from ${fields.name}${fields.topic ? ` (${fields.topic})` : ''}`;
    fields._replyto = fields.email;
    busy(true);
    try {
      const res = await fetch(form.dataset.ajax!, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(fields),
      });
      const reply = (await res.json().catch(() => ({}))) as { success?: string | boolean; message?: string };
      // FormSubmit answers {"success": "true"}; until the form is activated it says "false" and why
      if (!res.ok || String(reply.success) !== 'true') throw new Error(reply.message ?? `HTTP ${res.status}`);
      done();
    } catch (err) {
      console.warn('The message was not sent:', err);
      error.hidden = false;
    } finally {
      busy(false);
    }
  });

  // on a phone, the carousel's arrows sit in the bubble's corner of the first screen:
  // the bubble waits until they have scrolled away
  const bubble = document.querySelector<HTMLElement>('[data-contact-bubble]');
  const arrow = document.querySelector<HTMLElement>('[data-work-next]');
  if (bubble && arrow) {
    new IntersectionObserver(
      ([entry]) => {
        const inTheCorner = entry.isIntersecting && entry.boundingClientRect.right > window.innerWidth - 90;
        bubble.classList.toggle('is-tucked', inTheCorner);
      },
      // the bottom 22% of the screen
      { rootMargin: '-78% 0px 0px 0px', threshold: [0, 1] },
    ).observe(arrow);
  }
}

export {};
