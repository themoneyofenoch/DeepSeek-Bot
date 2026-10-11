// The one rule the Bot browsers never break: a click may not carry out an irreversible or
// outward action. The client enforces it inside the page, where the control's own label is
// readable, and the host enforces it again before a request is ever sent, so a Bot that
// phrases its way past one layer still meets the other. The user presses those buttons.

/**
 * Names that always refuse a click: `submit` and `publish` cover the app stores, the rest
 * are the actions nobody can undo. Matched against the whole visible name of the control,
 * so a word such as "buyer" does not trip it.
 */
export const BLOCKED_NAME = /(^|[^a-z])(submit|send for review|submit for review|publish|purchase|buy|pay|place order|checkout|delete|destroy|erase|transfer|close account|unsubscribe|cancel subscription|revoke|deactivate)([^a-z]|$)/i

/** Whether a control whose visible name is `name` reads as one of those actions. */
export const blockedName = (name) => BLOCKED_NAME.test(String(name ?? '').replace(/\s+/g, ' ').trim())

export const BLOCKED_MESSAGE = 'Refused: that control reads as an action that is never taken automatically — submit, publish, buy, pay, delete. Ask the user to press it themselves.'
