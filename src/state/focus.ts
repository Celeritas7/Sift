// The composer lives at the app root; "Write something", N and /new reach it through here.
let el: HTMLTextAreaElement | null = null;
export const registerComposer = (e: HTMLTextAreaElement | null) => { el = e; };
export const focusComposer = () => setTimeout(() => { if (!el) return; el.focus(); const L = el.value.length; el.setSelectionRange(L, L); }, 30);
