export function bindInputLifecycle({ target, documentObject, form, canvas, session }) {
  function focusIn(event) {
    const element = event.target;
    const editable = /^(INPUT|TEXTAREA|SELECT)$/.test(element?.tagName ?? '')
      || element?.isContentEditable;
    if ((form?.contains?.(element) || editable) && element !== canvas) session.suspend('form');
    else if (element === canvas || element?.closest?.('#touch-controls')) session.restore('form');
  }
  function blur() { session.suspend('blur'); }
  function focus() { session.restore('blur'); }
  function visibility() {
    if (documentObject?.hidden) session.suspend('visibility');
    else session.restore('visibility');
  }
  session.setBeforeSample?.(() => focusIn({ target: documentObject?.activeElement }));
  target?.addEventListener?.('focusin', focusIn);
  target?.addEventListener?.('blur', blur);
  target?.addEventListener?.('focus', focus);
  documentObject?.addEventListener?.('visibilitychange', visibility);
  return { dispose() {
    session.setBeforeSample?.(null);
    target?.removeEventListener?.('focusin', focusIn);
    target?.removeEventListener?.('blur', blur);
    target?.removeEventListener?.('focus', focus);
    documentObject?.removeEventListener?.('visibilitychange', visibility);
  } };
}
