import { useState } from "react";

// Inline text edit; saves on blur or Enter
export function EditText({ value, placeholder, onSave, className = "", ariaLabel }) {
  return (
    <input
      key={value ?? ""}
      className={`edit ${className}`}
      defaultValue={value ?? ""}
      placeholder={placeholder}
      aria-label={ariaLabel || placeholder}
      onClick={(e) => e.stopPropagation()}
      onBlur={(e) => e.target.value.trim() !== (value ?? "") && onSave(e.target.value.trim())}
      onKeyDown={(e) => e.key === "Enter" && e.target.blur()}
    />
  );
}

// Inline number edit; saves on blur or Enter
export function EditNum({ value, onSave, step = 0.1, min, ariaLabel }) {
  return (
    <input
      key={value}
      className="edit num"
      type="number"
      step={step}
      min={min}
      aria-label={ariaLabel}
      defaultValue={value}
      onBlur={(e) => {
        const v = parseFloat(e.target.value);
        if (!Number.isNaN(v) && v !== value && (min === undefined || v >= min)) onSave(v);
      }}
      onKeyDown={(e) => e.key === "Enter" && e.target.blur()}
    />
  );
}

export function Status({ ok, children }) {
  return <span className={`status ${ok ? "ok" : "bad"}`}>{children}</span>;
}

// Two-step destructive button: first click asks, second click does it
export function ConfirmButton({ children, confirmText, onConfirm }) {
  const [armed, setArmed] = useState(false);
  return armed ? (
    <span className="confirm">
      <button className="btn danger" onClick={() => { onConfirm(); setArmed(false); }}>{confirmText}</button>
      <button className="btn quiet" onClick={() => setArmed(false)}>Cancel</button>
    </span>
  ) : (
    <button className="btn quiet" onClick={() => setArmed(true)}>{children}</button>
  );
}

// Ruled module: red tab head, optional sub-label and right-hand meta/actions
export function Module({ title, sub, meta, className = "", children, ...rest }) {
  return (
    <section className={`m ${className}`} {...rest}>
      <header className="mh">
        <h2>{title}{sub != null && <small>{sub}</small>}</h2>
        {meta && <div className="meta">{meta}</div>}
      </header>
      <div className="mb">{children}</div>
    </section>
  );
}
