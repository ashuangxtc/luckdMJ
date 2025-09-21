const KEY = "dm_lottery_cid";

function gen(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
    const r = (crypto.getRandomValues(new Uint8Array(1))[0] & 0xf);
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function getClientId(): string {
  try {
    let id = localStorage.getItem(KEY);
    if (!id) { id = gen(); localStorage.setItem(KEY, id); }
    return id!;
  } catch {
    // @ts-ignore
    if (!window.__DM_CID__) window.__DM_CID__ = gen();
    // @ts-ignore
    return window.__DM_CID__ as string;
  }
}

export function shortId(id: string): string { if (!id) return '000'; const t=id.slice(-3); return t.padStart(3,'0'); }
export function maskId(id: string): string { if (!id) return ''; return id.slice(0,4)+"•".repeat(3)+id.slice(-4); }


