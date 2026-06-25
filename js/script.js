/* ═══════════════════════════════════════════════════════
   js/script.js  —  Modern Professional Calculator
   ═══════════════════════════════════════════════════════ */

/* ────────────────────────────────────────────────────────
   STATE
   Holds the entire calculator's data at any point in time.
   ──────────────────────────────────────────────────────── */
const state = {
  current:     '0',   // the number currently shown / being typed
  prev:        '',    // the number entered before an operator was pressed
  operator:    null,  // pending operator  (+  −  ×  ÷  Mod  xʸ)
  justEvaled:  false, // true right after "=" so next digit starts fresh
  history:     []     // array of { expr, result } objects (session only)
};

/* ────────────────────────────────────────────────────────
   DOM REFERENCES
   Cache all elements we touch so we don't query the DOM
   repeatedly on every keystroke.
   ──────────────────────────────────────────────────────── */
const mainDisplay = document.getElementById('mainDisplay');
const exprDisplay = document.getElementById('expr');
const histList    = document.getElementById('histList');
const histPanel   = document.getElementById('histPanel');
const histBtn     = document.getElementById('histBtn');
const clearHist   = document.getElementById('clearHist');
const themeBtn    = document.getElementById('themeBtn');

/* ════════════════════════════════════════════════════════
   THEME  —  dark / light toggle with localStorage
   ════════════════════════════════════════════════════════ */

// Read saved preference; fall back to 'dark' if not set or unavailable
let theme = 'dark';
try { theme = localStorage.getItem('calc-theme') || 'dark'; } catch (e) { /* private browsing */ }
applyTheme(theme);

// Toggle on button click
themeBtn.addEventListener('click', () => {
  theme = (theme === 'dark') ? 'light' : 'dark';
  applyTheme(theme);
  try { localStorage.setItem('calc-theme', theme); } catch (e) { /* ignore */ }
});

/**
 * applyTheme(t)
 * Sets the data-theme attribute on <html> and swaps the icon.
 * The CSS variables in style.css do the rest automatically.
 */
function applyTheme(t) {
  document.documentElement.setAttribute('data-theme', t);

  // Sun icon  → shown in dark mode (click to go light)
  const sunSVG = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="12" cy="12" r="5"/>
    <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42
             M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
  </svg>`;

  // Moon icon → shown in light mode (click to go dark)
  const moonSVG = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/>
  </svg>`;

  themeBtn.innerHTML = (t === 'dark') ? sunSVG : moonSVG;
}

/* ════════════════════════════════════════════════════════
   HISTORY PANEL  —  show / hide
   ════════════════════════════════════════════════════════ */

histBtn.addEventListener('click', () => {
  const isHidden = histPanel.style.display === 'none';
  histPanel.style.display = isHidden ? 'flex' : 'none';
  if (isHidden) histPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
});

// "Clear All" button wipes the history array and re-renders
clearHist.addEventListener('click', () => {
  state.history = [];
  renderHistory();
});

/* ════════════════════════════════════════════════════════
   DISPLAY HELPERS
   ════════════════════════════════════════════════════════ */

/**
 * updateDisplay(value, error)
 * Writes a formatted value to the main display.
 * Pass error=true to apply the red error style.
 */
function updateDisplay(value, error = false) {
  mainDisplay.textContent = formatNumber(value);
  mainDisplay.className = 'main-display' + (error ? ' error' : '');
}

/**
 * formatNumber(val)
 * - Adds thousand-separator commas to the integer part.
 * - Switches to exponential notation for very large / very small numbers.
 * - Preserves a trailing decimal point while the user is still typing.
 */
function formatNumber(val) {
  if (typeof val !== 'string') val = String(val);

  // Pass through special string results unchanged
  const specials = ['Error', 'Infinity', '-Infinity', 'NaN'];
  if (specials.includes(val)) return val;

  // Preserve trailing '.' so the user can type decimals naturally
  if (val.endsWith('.')) return val;

  const num = parseFloat(val);
  if (isNaN(num)) return val;

  // Exponential for very large or very small values
  if (Math.abs(num) > 1e12 || (Math.abs(num) < 1e-6 && num !== 0)) {
    return num.toExponential(4);
  }

  // Round to 12 significant figures to remove floating-point noise
  const str = parseFloat(num.toPrecision(12)).toString();
  const [intPart, decPart] = str.split('.');

  // Add commas every 3 digits in the integer part
  const formatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return decPart !== undefined ? `${formatted}.${decPart}` : formatted;
}

/** setExpr(txt) — updates the smaller expression line above the main display */
function setExpr(txt) {
  exprDisplay.textContent = txt;
}

/* ════════════════════════════════════════════════════════
   CORE INPUT LOGIC
   ════════════════════════════════════════════════════════ */

/**
 * inputDigit(digit)
 * Appends a digit to the current number.
 * If we just finished a calculation, start a brand new number.
 */
function inputDigit(digit) {
  if (state.justEvaled) {
    state.current    = digit;
    state.justEvaled = false;
  } else {
    // Replace leading '0' with the digit; otherwise append
    state.current = (state.current === '0') ? digit : state.current + digit;
  }
  updateDisplay(state.current);
}

/**
 * inputDecimal()
 * Adds a decimal point if one isn't already present.
 */
function inputDecimal() {
  if (state.justEvaled) {
    state.current    = '0.';
    state.justEvaled = false;
  }
  if (!state.current.includes('.')) {
    state.current += '.';
  }
  updateDisplay(state.current);
}

/**
 * deleteLast()
 * Backspace: removes the last character, or resets to '0'.
 */
function deleteLast() {
  if (state.justEvaled) return; // nothing to delete after a result
  state.current = (state.current.length > 1)
    ? state.current.slice(0, -1)
    : '0';
  updateDisplay(state.current);
}

/**
 * clearAll()
 * Resets everything to the initial state.
 */
function clearAll() {
  state.current    = '0';
  state.prev       = '';
  state.operator   = null;
  state.justEvaled = false;
  setExpr('');
  updateDisplay('0');
}

/**
 * toggleSign()
 * Flips the sign of the current number (positive ↔ negative).
 */
function toggleSign() {
  const n = parseFloat(state.current);
  if (!isNaN(n) && n !== 0) {
    state.current = String(-n);
    updateDisplay(state.current);
  }
}

/**
 * applyPercent()
 * Divides the current number by 100.
 */
function applyPercent() {
  const n = parseFloat(state.current);
  if (!isNaN(n)) {
    state.current = String(n / 100);
    updateDisplay(state.current);
  }
}

/* ════════════════════════════════════════════════════════
   OPERATOR & EQUALS LOGIC
   ════════════════════════════════════════════════════════ */

/**
 * handleOperator(op)
 * Records which operator was pressed.
 * If an operator was already pending AND the user typed a new
 * number, we chain: evaluate first, then set the new operator.
 */
function handleOperator(op) {
  // Chain: if there's a pending op and a new number, evaluate first
  if (state.operator && !state.justEvaled) {
    calculate(false); // evaluate silently (don't add to history yet)
  }
  state.prev       = state.current;
  state.operator   = op;
  state.justEvaled = false;
  setExpr(`${formatNumber(state.prev)} ${op}`);
  state.current = '0'; // next digit starts a new number
}

/**
 * handleEquals()
 * Triggered by "=" button or Enter key.
 * Builds the full expression string and calls calculate().
 */
function handleEquals() {
  if (!state.operator || state.prev === '') return;
  const expr = `${formatNumber(state.prev)} ${state.operator} ${formatNumber(state.current)}`;
  calculate(true, expr);
}

/**
 * calculate(addToHistory, expr)
 * Performs the arithmetic for the pending operation.
 *
 * @param {boolean} addToHistory  - whether to save this result to history
 * @param {string}  expr          - human-readable expression for the history entry
 */
function calculate(addToHistory = true, expr = '') {
  const a = parseFloat(state.prev);
  const b = parseFloat(state.current);
  let result;

  try {
    switch (state.operator) {
      case '+':            result = a + b;             break;
      case '−':            result = a - b;             break;
      case '×':            result = a * b;             break;
      case '÷':
        if (b === 0) { showError('Cannot divide by zero'); return; }
        result = a / b;
        break;
      case 'Mod':
        if (b === 0) { showError('Cannot mod by zero'); return; }
        result = a % b;
        break;
      case 'xʸ':
      case 'xʸ (pow)':
        result = Math.pow(a, b);
        break;
      default:
        return; // unknown operator — do nothing
    }

    // Guard: Infinity / NaN can occur with extreme inputs
    if (!isFinite(result)) { showError('Result out of range'); return; }

    // Round to 12 significant figures to clean up floating-point artifacts
    result = parseFloat(result.toPrecision(12));

    // Update state
    state.current    = String(result);
    state.justEvaled = addToHistory;
    setExpr(addToHistory ? `${expr} =` : `${formatNumber(state.prev)} ${state.operator}`);
    updateDisplay(state.current);

    // Save to history only when "=" was pressed
    if (addToHistory && expr) {
      addHistory(expr, String(result));
    }

    // After a final evaluation, clear prev & operator
    if (addToHistory) {
      state.prev     = '';
      state.operator = null;
    } else {
      // Chaining: the result becomes the new "previous" number
      state.prev = String(result);
    }

  } catch (err) {
    showError('Error');
  }
}

/* ════════════════════════════════════════════════════════
   SCIENTIFIC FUNCTIONS  (instant — no second operand needed)
   ════════════════════════════════════════════════════════ */

/**
 * handleScientific(action)
 * Handles x², √x, 1/x, and xʸ (which routes to handleOperator).
 */
function handleScientific(action) {
  const n = parseFloat(state.current);
  let result, expr;

  if (isNaN(n)) { showError('Invalid input'); return; }

  switch (action) {
    case 'square':
      result = Math.pow(n, 2);
      expr   = `(${formatNumber(state.current)})²`;
      break;

    case 'sqrt':
      if (n < 0) { showError('Invalid: √ of negative'); return; }
      result = Math.sqrt(n);
      expr   = `√(${formatNumber(state.current)})`;
      break;

    case 'reciprocal':
      if (n === 0) { showError('Cannot divide by zero'); return; }
      result = 1 / n;
      expr   = `1/(${formatNumber(state.current)})`;
      break;

    case 'power':
      // xʸ needs a second operand — set it up as a normal operator
      handleOperator('xʸ');
      return;

    default: return;
  }

  if (!isFinite(result)) { showError('Result out of range'); return; }

  result = parseFloat(result.toPrecision(12));
  setExpr(`${expr} =`);
  addHistory(expr, String(result));

  state.current    = String(result);
  state.justEvaled = true;
  state.prev       = '';
  state.operator   = null;

  updateDisplay(state.current);
}

/* ════════════════════════════════════════════════════════
   ERROR DISPLAY
   ════════════════════════════════════════════════════════ */

/**
 * showError(msg)
 * Displays a user-friendly error message in red for 2 seconds,
 * then resets the display to '0'.
 */
function showError(msg) {
  updateDisplay(msg, true);
  setExpr('');

  // Reset state so the user can start over immediately
  state.current    = '0';
  state.prev       = '';
  state.operator   = null;
  state.justEvaled = false;

  setTimeout(() => {
    // Only clear if the error is still showing (user may have typed already)
    if (mainDisplay.classList.contains('error')) {
      updateDisplay('0');
    }
  }, 2000);
}

/* ════════════════════════════════════════════════════════
   HISTORY
   ════════════════════════════════════════════════════════ */

/**
 * addHistory(expr, result)
 * Prepends a new entry to the history array and re-renders the list.
 * Caps the history at 50 entries to avoid memory issues.
 */
function addHistory(expr, result) {
  state.history.unshift({ expr, result }); // newest first
  if (state.history.length > 50) state.history.pop();
  renderHistory();
}

/**
 * renderHistory()
 * Rebuilds the history list HTML from state.history.
 * Clicking an entry recalls its result into the display.
 */
function renderHistory() {
  if (state.history.length === 0) {
    histList.innerHTML = '<div class="hist-empty">No calculations yet.<br>Results will appear here.</div>';
    return;
  }

  histList.innerHTML = state.history.map((item, i) => `
    <div class="hist-item" data-index="${i}">
      <div class="hist-expr">${item.expr}</div>
      <div class="hist-result">${formatNumber(item.result)}</div>
    </div>
  `).join('');

  // Attach click listeners to each history row
  histList.querySelectorAll('.hist-item').forEach(el => {
    el.addEventListener('click', () => {
      const idx = parseInt(el.dataset.index, 10);
      state.current    = state.history[idx].result;
      state.justEvaled = true;
      updateDisplay(state.current);
      setExpr('Recalled from history');
    });
  });
}

/* ════════════════════════════════════════════════════════
   BUTTON CLICK EVENTS  —  event delegation on the grid
   ════════════════════════════════════════════════════════ */

/**
 * Using a single listener on the parent grid (event delegation)
 * is more efficient than attaching one listener per button.
 */
document.getElementById('grid').addEventListener('click', e => {
  const btn = e.target.closest('.btn');
  if (!btn) return;

  const action = btn.dataset.action;
  const val    = btn.dataset.val;
  const op     = btn.dataset.op;

  switch (action) {
    case 'digit':       inputDigit(val);        break;
    case 'decimal':     inputDecimal();          break;
    case 'delete':      deleteLast();            break;
    case 'clear':       clearAll();              break;
    case 'toggleSign':  toggleSign();            break;
    case 'percent':     applyPercent();          break;
    case 'operator':    handleOperator(op);      break;
    case 'equals':      handleEquals();          break;
    // Scientific actions share the same handler
    case 'square':
    case 'sqrt':
    case 'reciprocal':
    case 'power':       handleScientific(action); break;
  }
});

/* ════════════════════════════════════════════════════════
   KEYBOARD SUPPORT
   ════════════════════════════════════════════════════════ */

/**
 * Maps physical keyboard keys to calculator actions.
 * Prevents browser defaults (e.g., "/" opening Quick Find in Firefox).
 */
document.addEventListener('keydown', e => {
  const handled = ['Enter','Backspace','Delete','Escape','/',
                   '*','-','+','%','.'];
  if (handled.includes(e.key) || /^\d$/.test(e.key)) {
    e.preventDefault();
  }

  if (/^\d$/.test(e.key))                       { inputDigit(e.key);        return; }
  if (e.key === '.')                             { inputDecimal();            return; }
  if (e.key === 'Backspace')                     { deleteLast();              return; }
  if (e.key === 'Delete' || e.key === 'Escape')  { clearAll();                return; }
  if (e.key === 'Enter'  || e.key === '=')       { handleEquals();            return; }
  if (e.key === '+')                             { handleOperator('+');       return; }
  if (e.key === '-')                             { handleOperator('−');       return; }
  if (e.key === '*')                             { handleOperator('×');       return; }
  if (e.key === '/')                             { handleOperator('÷');       return; }
  if (e.key === '%')                             { applyPercent();            return; }
});
