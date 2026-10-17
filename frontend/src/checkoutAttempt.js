export function resumeCheckout(saved, result, now = Date.now()) {
  return ['success', 'error'].includes(result) && Number.isFinite(saved.loginStartedAt) && now >= saved.loginStartedAt && now - saved.loginStartedAt < 600000;
}

export function validCustomer(name, phone) {
  return typeof name === 'string' && !!name.trim() && name.length <= 120 && typeof phone === 'string' && /^[+\d ()-]{8,30}$/.test(phone) && phone.replace(/\D/g, '').length >= 8;
}

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
