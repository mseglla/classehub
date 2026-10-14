export function getPublicClassSlug() {
  const parts = window.location.pathname.split("/").filter(Boolean);
  const classIndex = parts.indexOf("classe");

  if (classIndex >= 0 && parts[classIndex + 1]) {
    return parts[classIndex + 1];
  }

  return "orenetes";
}

export function getFamilyAccessPin(slug) {
  const storageKey = `classehub-family-pin-${slug}`;
  const params = new URLSearchParams(window.location.search);
  const urlPin = params.get("pin")?.trim();

  if (urlPin) {
    window.localStorage.setItem(storageKey, urlPin);
    return urlPin;
  }

  return window.localStorage.getItem(storageKey) || "";
}

export function saveFamilyAccessPin(slug, pin) {
  const storageKey = `classehub-family-pin-${slug}`;
  window.localStorage.setItem(storageKey, pin);
}

export function clearFamilyAccessPin(slug) {
  window.localStorage.removeItem(`classehub-family-pin-${slug}`);
}
