// OpenUI 1.0.0 checks this flag before mounting its development inspector.
// Set it before importing the renderer so the floating widget stays out of the care UI.
if (import.meta.env?.DEV) {
  Reflect.set(globalThis, Symbol.for('openui.devtools.autoMount'), true);
}
