export function createCheckoutAttempt(initial = null) {
  let pending = initial;
  return {
    get pending() { return pending; },
    begin(payload, items) {
      if (!pending) pending = structuredClone({ payload, items });
      return pending;
    },
    finish() { pending = null; },
    reject(error) {
      if ([400, 409].includes(error.status)) pending = null;
    }
  };
}
