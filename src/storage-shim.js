/**
 * localStorage-based polyfill of window.storage
 * (window.storage มีให้ใช้ฟรีเฉพาะใน Claude.ai artifact เท่านั้น)
 * ข้อมูลจะถูกเก็บไว้ในเบราว์เซอร์ของแต่ละเครื่อง ไม่ซิงค์ข้ามอุปกรณ์
 */
const PREFIX = "vital-protocol::";

function keyFor(key, shared) {
  return `${PREFIX}${shared ? "shared::" : "private::"}${key}`;
}

window.storage = {
  async get(key, shared = false) {
    const raw = localStorage.getItem(keyFor(key, shared));
    if (raw === null) throw new Error(`key not found: ${key}`);
    return { key, value: raw, shared };
  },
  async set(key, value, shared = false) {
    localStorage.setItem(keyFor(key, shared), value);
    return { key, value, shared };
  },
  async delete(key, shared = false) {
    const existed = localStorage.getItem(keyFor(key, shared)) !== null;
    localStorage.removeItem(keyFor(key, shared));
    return { key, deleted: existed, shared };
  },
  async list(prefix = "", shared = false) {
    const fullPrefix = keyFor(prefix, shared);
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(fullPrefix)) keys.push(k.slice(keyFor("", shared).length));
    }
    return { keys, prefix, shared };
  },
};
