// On-screen keyboard: expose its height and keep the caret of an auto-growing textarea above it.
import { useEffect, type FocusEvent, type FormEvent, type SyntheticEvent } from 'react';

/** Exposes the keyboard height as the CSS var --kb on <html>. */
export function useKeyboardInset() {
  useEffect(() => {
    const vv = window.visualViewport; if (!vv) return;
    const set = () => document.documentElement.style.setProperty('--kb', Math.max(0, window.innerHeight - vv.height - vv.offsetTop) + 'px');
    set(); vv.addEventListener('resize', set); vv.addEventListener('scroll', set);
    return () => { vv.removeEventListener('resize', set); vv.removeEventListener('scroll', set); };
  }, []);
}

const MIRRORED = ['font-family', 'font-size', 'font-weight', 'font-style', 'line-height', 'letter-spacing', 'white-space', 'overflow-wrap', 'word-break', 'padding', 'border', 'box-sizing'];

/** Scrolls `scroller` so the caret of `ta` (an auto-growing textarea) stays visible. Pass `document.scrollingElement` for the page. */
export function keepCaretVisible(ta: HTMLTextAreaElement, scroller: Element, margin = 48) {
  const cs = getComputedStyle(ta), lh = parseFloat(cs.lineHeight) || 28;
  // Measure the caret's y with a hidden copy of the text up to the caret, wrapped like the textarea.
  const mirror = document.createElement('div');
  MIRRORED.forEach(p => mirror.style.setProperty(p, cs.getPropertyValue(p)));
  Object.assign(mirror.style, { position: 'absolute', top: '0', left: '-9999px', visibility: 'hidden', width: ta.clientWidth + 'px', whiteSpace: 'pre-wrap' });
  mirror.textContent = ta.value.slice(0, ta.selectionEnd) + '​';
  document.body.appendChild(mirror); const caretY = mirror.scrollHeight; mirror.remove();
  const page = scroller === document.scrollingElement; // the page's box is the viewport, not the whole document
  const taTop = ta.getBoundingClientRect().top, box = page ? { top: 0, bottom: window.innerHeight } : scroller.getBoundingClientRect();
  const kb = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--kb')) || 0;
  const visibleBottom = Math.min(box.bottom, window.innerHeight - kb) - margin;
  const caretBottom = taTop + caretY;
  if (caretBottom > visibleBottom) scroller.scrollTop += caretBottom - visibleBottom;
  else if (caretBottom - lh < box.top + margin) scroller.scrollTop -= box.top + margin - (caretBottom - lh);
}

/** The three textarea handlers that keep its caret above the keyboard. Input waits a frame for the textarea to grow;
 *  focus waits 300 ms for the keyboard to finish opening. */
export function caretHandlers(scroller: () => Element | null) {
  const run = (t: HTMLTextAreaElement) => { const s = scroller(); if (s) keepCaretVisible(t, s); };
  return {
    onInput: (e: FormEvent<HTMLTextAreaElement>) => { const t = e.currentTarget; requestAnimationFrame(() => run(t)); },
    onSelect: (e: SyntheticEvent<HTMLTextAreaElement>) => run(e.currentTarget),
    onFocus: (e: FocusEvent<HTMLTextAreaElement>) => { const t = e.currentTarget; setTimeout(() => run(t), 300); },
  };
}
