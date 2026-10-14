function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let index = 0; index < rawData.length; index += 1) {
    outputArray[index] = rawData.charCodeAt(index);
  }

  return outputArray;
}

export function isPushSupported() {
  return (
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export function getNotificationPermission() {
  if (!("Notification" in window)) return "unsupported";
  return Notification.permission;
}

export async function subscribeToPushNotifications({ familyId, classId }) {
  if (!isPushSupported()) {
    return {
      success: false,
      error: "NOT_SUPPORTED",
    };
  }

  const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;

  if (!vapidPublicKey) {
    return {
      success: false,
      error: "MISSING_VAPID_PUBLIC_KEY",
    };
  }

  const permission = await Notification.requestPermission();

  if (permission !== "granted") {
    return {
      success: false,
      error: "PERMISSION_DENIED",
    };
  }

  const registration = await navigator.serviceWorker.ready;

  const existingSubscription = await registration.pushManager.getSubscription();

  const subscription =
    existingSubscription ||
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    }));

  const response = await fetch("/api/save-push-subscription", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      familyId,
      classId,
      subscription,
    }),
  });

  if (!response.ok) {
    return {
      success: false,
      error: "SAVE_FAILED",
    };
  }

  return {
    success: true,
    subscription,
  };
}
