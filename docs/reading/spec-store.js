// Spec store — seed SPECS와 사용자 수정본을 머지.
// localStorage 키: reading-canvas:specs:v1

(function () {
  const LS = "reading-canvas:specs:v1";

  function loadUser() {
    try { return JSON.parse(localStorage.getItem(LS) || "{}"); }
    catch (_) { return {}; }
  }
  function saveUser(map) {
    try { localStorage.setItem(LS, JSON.stringify(map)); } catch (_) {}
  }

  let userSpecs = loadUser();
  const listeners = new Set();

  // 효과적인 spec = seed + user override (user가 우선).
  // user가 빈 배열/빈 문자열로 설정하면 그것도 존중.
  function getSpec(id) {
    const seed = (window.SPECS && window.SPECS[id]) || null;
    const user = userSpecs[id] || null;
    if (!seed && !user) return null;
    if (!user) return seed;
    if (!seed) return user;
    return { ...seed, ...user };
  }

  // user override만 반환 (에디터 init에 사용 가능)
  function getUserSpec(id) { return userSpecs[id] || null; }

  function saveSpec(id, patch) {
    // patch는 부분 수정. 전체 spec을 저장하려면 그대로 넘기면 됨.
    const next = { ...(userSpecs[id] || {}), ...patch };
    userSpecs = { ...userSpecs, [id]: next };
    saveUser(userSpecs);
    listeners.forEach((fn) => fn());
  }

  function clearSpec(id) {
    if (!userSpecs[id]) return;
    const { [id]: _, ...rest } = userSpecs;
    userSpecs = rest;
    saveUser(userSpecs);
    listeners.forEach((fn) => fn());
  }

  function hasSpec(id) {
    const s = getSpec(id);
    if (!s) return false;
    return !!(
      s.core?.length || s.algorithm?.length || s.inputs ||
      s.outputs || s.hyperparams?.length || s.pitfalls?.length ||
      s.verify?.length || s.depends_on?.length || s.code_refs?.length ||
      s.when_to_use || s.description || s.name
    );
  }

  function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }

  window.SpecStore = { getSpec, getUserSpec, saveSpec, clearSpec, hasSpec, subscribe };
})();
