let pending = Promise.resolve();
module.exports = function serialize(work) {
  const next = pending.then(work);
  pending = next.catch(() => {});
  return next;
};
