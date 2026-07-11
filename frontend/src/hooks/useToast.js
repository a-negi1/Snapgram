
import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import React from "react";


let _toasts    = [];
let _listeners = [];
let _nextId    = 1;

function notify() {
  _listeners.forEach((fn) => fn([..._toasts]));
}

function addToast(type, message, duration) {
  const id = String(_nextId++);
  _toasts = [..._toasts, { id, type, message }];
  notify();
  if (duration > 0) setTimeout(() => dismissToast(id), duration);
  return id;
}

function updateToast(id, type, message, duration) {
  _toasts = _toasts.map((t) => (t.id === id ? { ...t, type, message } : t));
  notify();
  if (duration > 0) setTimeout(() => dismissToast(id), duration);
}

function dismissToast(id) {
  _toasts = _toasts.filter((t) => t.id !== id);
  notify();
}


export const toast = {
    loading(message) {
    return addToast("loading", message, 0);
  },
    success(id, message) {
    if (_toasts.find((t) => t.id === id)) {
      updateToast(id, "success", message, 2800);
    } else {
      addToast("success", message, 2800);
    }
  },
    error(id, message) {
    if (_toasts.find((t) => t.id === id)) {
      updateToast(id, "error", message, 4000);
    } else {
      addToast("error", message, 4000);
    }
  },
    dismiss(id) {
    dismissToast(id);
  },
};


function useToastStore() {
  const [toasts, setToasts] = useState(() => [..._toasts]);
  useEffect(() => {
    _listeners.push(setToasts);
    return () => { _listeners = _listeners.filter((fn) => fn !== setToasts); };
  }, []);
  return toasts;
}


export function ToastPortal() {
  const toasts = useToastStore();
  if (toasts.length === 0) return null;

  return createPortal(
    React.createElement(
      "div",
      { className: "toast-stack", role: "alert", "aria-live": "polite" },
      toasts.map((t) =>
        React.createElement(
          "div",
          { key: t.id, className: `toast-item toast-item--${t.type}` },
          t.type === "loading" &&
            React.createElement("span", { className: "toast-spinner", "aria-hidden": "true" }),
          t.type === "success" &&
            React.createElement("span", { className: "toast-icon", "aria-hidden": "true" }, "\u2713"),
          t.type === "error" &&
            React.createElement("span", { className: "toast-icon toast-icon--error", "aria-hidden": "true" }, "\u2715"),
          React.createElement("span", { className: "toast-message" }, t.message),
          React.createElement(
            "button",
            { className: "toast-close", onClick: () => dismissToast(t.id), "aria-label": "Dismiss" },
            "\u00d7"
          )
        )
      )
    ),
    document.body
  );
}
