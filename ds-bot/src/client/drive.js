// Driving the Bot's browser: open, click, type, scroll, back, forward, reload.
//
// `read-page.js` stamps every control it numbers with `data-dshbot-item="<n>"`, so a click
// reaches the element the Bot actually read rather than the nth element of a fresh walk that
// one re-render has already moved. Each script below is built here as one expression and runs
// inside the guest page: it may reach the page's own globals, and nothing else.
import { BLOCKED_NAME } from '../shared/guard.js'
import { ITEM_ATTR } from './read-page.js'

// Shared by every script: find the stamped control (or one whose visible name matches), read
// its name, and reach through open shadow roots and same-origin frames to do it.
const PRELUDE = `
  const ATTR = ${JSON.stringify(ITEM_ATTR)};
  const BLOCKED = new RegExp(${JSON.stringify(BLOCKED_NAME.source)}, ${JSON.stringify(BLOCKED_NAME.flags)});
  const seen = new Set();
  const collect = (root, out) => {
    if (root === null || root === undefined || seen.has(root)) return out;
    seen.add(root);
    let nodes = [];
    try { nodes = root.querySelectorAll('*') } catch (error) { return out }
    for (const el of nodes) {
      if (el.hasAttribute(ATTR)) out.push(el);
      if (el.shadowRoot) collect(el.shadowRoot, out);
      if (el.localName === 'iframe') {
        let doc = null;
        try { doc = el.contentDocument } catch (error) { doc = null }
        if (doc) collect(doc, out);
      }
    }
    return out;
  };
  const nameOf = (el) => String(
    el.getAttribute('aria-label') || el.innerText || el.value || el.getAttribute('title') || el.getAttribute('name') || ''
  ).replace(/\\s+/g, ' ').trim().slice(0, 120);
  const boxed = (el) => { const box = el.getBoundingClientRect(); return box.width > 0 && box.height > 0 };
  const find = (number, text) => {
    const nodes = collect(document, []);
    if (number !== null && number !== undefined) {
      for (const el of nodes) if (el.getAttribute(ATTR) === String(number)) return el;
      return null;
    }
    const want = String(text === null || text === undefined ? '' : text).replace(/\\s+/g, ' ').trim().toLowerCase();
    if (want === '') return null;
    const exact = nodes.find((el) => nameOf(el).toLowerCase() === want);
    return exact || nodes.find((el) => nameOf(el).toLowerCase().includes(want)) || null;
  };
`

const script = (body) => `(() => {${PRELUDE}${body}})()`

/** Press a control: by its number from the last read, or by the name it shows. */
export const clickScript = ({ number = null, text = '' } = {}) => script(`
  const el = find(${JSON.stringify(number ?? null)}, ${JSON.stringify(String(text ?? ''))});
  if (el === null) return { ok: false, error: 'No control on the page matches that.' };
  if (el.disabled === true) return { ok: false, error: 'That control is disabled.' };
  if (!boxed(el)) return { ok: false, error: 'That control is not visible on the page.' };
  const name = nameOf(el);
  if (BLOCKED.test(name)) return { ok: false, blocked: true, name: name };
  try { el.scrollIntoView({ block: 'center', inline: 'center' }) } catch (error) { el.scrollIntoView() }
  const box = el.getBoundingClientRect();
  const at = {
    bubbles: true, cancelable: true, view: window, button: 0,
    clientX: box.left + Math.min(box.width / 2, 40),
    clientY: box.top + Math.min(box.height / 2, 20),
  };
  try { el.focus({ preventScroll: true }) } catch (error) {}
  for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup']) {
    const pointer = type.slice(0, 7) === 'pointer' && typeof window.PointerEvent === 'function';
    el.dispatchEvent(new (pointer ? window.PointerEvent : window.MouseEvent)(type, at));
  }
  el.click();
  return { ok: true, name: name, tag: el.localName };
`)

/** Put text into a field, the way a person typing would, never echoing it back. */
export const typeScript = ({ number = null, text = '', value = '', enter = false } = {}) => script(`
  const el = find(${JSON.stringify(number ?? null)}, ${JSON.stringify(String(text ?? ''))});
  if (el === null) return { ok: false, error: 'No field on the page matches that.' };
  if (el.disabled === true || el.readOnly === true) return { ok: false, error: 'That field cannot be typed into.' };
  const typing = ${JSON.stringify(String(value ?? ''))};
  try { el.scrollIntoView({ block: 'center', inline: 'center' }) } catch (error) { el.scrollIntoView() }
  try { el.focus({ preventScroll: true }) } catch (error) {}
  if (el.isContentEditable === true) {
    el.textContent = typing;
  } else {
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value');
    if (setter && setter.set) setter.set.call(el, typing); else el.value = typing;
  }
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
  const submitted = ${enter === true};
  if (submitted) {
    const key = { bubbles: true, cancelable: true, key: 'Enter', code: 'Enter', keyCode: 13, which: 13 };
    el.dispatchEvent(new KeyboardEvent('keydown', key));
    el.dispatchEvent(new KeyboardEvent('keypress', key));
    el.dispatchEvent(new KeyboardEvent('keyup', key));
  }
  return { ok: true, name: nameOf(el), typed: typing.length, submitted: submitted };
`)

/** Move down the page; a negative amount moves back up. */
export const scrollScript = ({ amount = 600 } = {}) => script(`
  const before = Math.round(window.scrollY);
  window.scrollBy(0, ${Number(amount) || 0});
  return { ok: true, from: before, to: Math.round(window.scrollY) };
`)
