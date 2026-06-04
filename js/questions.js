// ===========================================================================
//  DCSA C++ Arena — Question Bank
//
//  Public API: generateQuestion() returns a fresh random question each call.
//
//  Mix of:
//    - generators (functions that synthesize a new question every time, with
//      randomized operands / variable names / messages / templates); each one
//      can produce dozens to thousands of distinct questions.
//    - static questions (hand-written, mostly theory and edge-cases).
//
//  Each question: { type, code?, prompt?, options[4], correctIndex }.
//  The correct answer is always at correctIndex 0 in the returned options —
//  the consumer (app.js) shuffles them before rendering, so the visible
//  A/B/C/D position varies per play.
//
//  Question types:
//    - "output"   "What does this program print?"  (📝)
//    - "mistake"  "Where is the mistake?"          (🐞)
//    - "behavior" "What does this program do?"     (🤔)
//    - "theory"   carries its own prompt           (💡)
// ===========================================================================

// ---------------------------------------------------------------------------
//  Small random helpers
// ---------------------------------------------------------------------------
function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}
function pickN(arr, n) {
  const pool = arr.slice();
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, n);
}
// Produce `count` distinct numeric distractors around `correct`.
function offsets(correct, count, maxRange) {
  const out = new Set();
  const range = maxRange || Math.max(5, Math.floor(Math.abs(correct) * 0.5) + 3);
  let attempts = 0;
  while (out.size < count && attempts < 200) {
    const off = rand(1, range) * (Math.random() < 0.5 ? -1 : 1);
    const cand = correct + off;
    if (cand !== correct && !out.has(cand)) out.add(cand);
    attempts++;
  }
  for (let k = 1; out.size < count; k++) {
    if (!out.has(correct + k)) out.add(correct + k);
    if (!out.has(correct - k)) out.add(correct - k);
  }
  return Array.from(out).slice(0, count);
}

// ---------------------------------------------------------------------------
//  OUTPUT GENERATORS  (📝 "What does this program print?")
// ---------------------------------------------------------------------------
const HW_MESSAGES = [
  "Hello Dragons!", "Hello, World!", "Greetings, mortals!", "C++ is awesome!",
  "Welcome to the Arena!", "Dragons rule!", "Code or perish!", "Long live C++!",
  "May the code be with you", "Beware of segfaults", "DCSA forever!", "Quiz time!",
  "Hello from C++!", "Hi there!", "Welcome, hero!", "Greetings, programmer!",
  "Code is magic", "Bits and bytes", "Compile and conquer", "Hello, future!",
  "Adventure awaits", "The arena calls", "Sharpen your skills", "Practice makes perfect",
  "Master the basics", "Onward and upward", "Keep coding!", "Stay curious",
  "Trust the compiler", "Read the docs", "Embrace the bug",
];

function genHelloWorld() {
  const correct = pick(HW_MESSAGES);
  const distractors = pickN(HW_MESSAGES.filter((m) => m !== correct), 3);
  return {
    type: "output",
    code:
`#include <iostream>
using namespace std;

int main() {
    cout << "${correct}" << endl;
}`,
    options: [correct, ...distractors],
    correctIndex: 0,
  };
}

function genSimpleArithmetic() {
  const op = pick(["+", "-", "*"]);
  const a = rand(1, 20);
  const b = rand(1, 20);
  const correct = op === "+" ? a + b : op === "-" ? a - b : a * b;
  return {
    type: "output",
    code:
`#include <iostream>
using namespace std;

int main() {
    cout << ${a} ${op} ${b} << endl;
}`,
    options: [String(correct), ...offsets(correct, 3).map(String)],
    correctIndex: 0,
  };
}

function genVariableArith() {
  const namePairs = [["x", "y"], ["a", "b"], ["p", "q"], ["m", "n"], ["count", "total"]];
  const [v1, v2] = pick(namePairs);
  const op = pick(["+", "-", "*"]);
  const a = rand(2, 30);
  const b = rand(2, 30);
  const correct = op === "+" ? a + b : op === "-" ? a - b : a * b;
  return {
    type: "output",
    code:
`#include <iostream>
using namespace std;

int main() {
    int ${v1} = ${a};
    int ${v2} = ${b};
    cout << ${v1} ${op} ${v2} << endl;
}`,
    options: [String(correct), ...offsets(correct, 3).map(String)],
    correctIndex: 0,
  };
}

function genPrecedence() {
  const a = rand(2, 9);
  const b = rand(2, 9);
  const c = rand(2, 9);
  const cases = [
    { expr: `${a} + ${b} * ${c}`, correct: a + b * c, wrong: (a + b) * c },
    { expr: `${a} * ${b} + ${c}`, correct: a * b + c, wrong: a * (b + c) },
    { expr: `${a} - ${b} * ${c}`, correct: a - b * c, wrong: (a - b) * c },
    { expr: `${a} * ${b} - ${c}`, correct: a * b - c, wrong: a * (b - c) },
  ];
  const cs = pick(cases);
  const distractors = new Set();
  if (cs.wrong !== cs.correct) distractors.add(cs.wrong);
  for (const o of offsets(cs.correct, 6)) {
    if (o !== cs.wrong && o !== cs.correct) distractors.add(o);
    if (distractors.size >= 3) break;
  }
  return {
    type: "output",
    code:
`#include <iostream>
using namespace std;

int main() {
    cout << ${cs.expr} << endl;
}`,
    options: [String(cs.correct), ...Array.from(distractors).slice(0, 3).map(String)],
    correctIndex: 0,
  };
}

function genIntDivision() {
  const divisor = rand(2, 9);
  const quot = rand(2, 9);
  const remainder = rand(1, divisor - 1);
  const dividend = quot * divisor + remainder;
  const decimal = (dividend / divisor).toFixed(2);
  return {
    type: "output",
    code:
`#include <iostream>
using namespace std;

int main() {
    int x = ${dividend};
    int y = ${divisor};
    cout << x / y << endl;
}`,
    options: [String(quot), decimal, String(quot + 1), String(remainder)],
    correctIndex: 0,
  };
}

function genModulo() {
  const x = rand(7, 60);
  const y = rand(2, 9);
  const correct = x % y;
  const quot = Math.floor(x / y);
  // build 3 distinct distractors
  const set = new Set([String(quot), String(correct + 1 > y - 1 ? 0 : correct + 1), String(y)]);
  set.delete(String(correct));
  while (set.size < 3) set.add(String(rand(0, y - 1) === correct ? y : rand(0, y - 1)));
  return {
    type: "output",
    code:
`#include <iostream>
using namespace std;

int main() {
    cout << ${x} % ${y} << endl;
}`,
    options: [String(correct), ...Array.from(set).slice(0, 3)],
    correctIndex: 0,
  };
}

function genBoolCompare() {
  const a = rand(1, 20);
  let b = rand(1, 20);
  if (a === b) b = a + rand(1, 3);
  const ops = [
    { code: "<",  fn: () => a <  b },
    { code: ">",  fn: () => a >  b },
    { code: "<=", fn: () => a <= b },
    { code: ">=", fn: () => a >= b },
    { code: "!=", fn: () => a !== b },
  ];
  const op = pick(ops);
  const correct = op.fn() ? "1" : "0";
  const wrong   = correct === "1" ? "0" : "1";
  return {
    type: "output",
    code:
`#include <iostream>
using namespace std;

int main() {
    bool r = (${a} ${op.code} ${b});
    cout << r << endl;
}`,
    options: [correct, wrong, "true", "false"],
    correctIndex: 0,
  };
}

function genForLoopSum() {
  const start = rand(1, 3);
  const end = rand(start + 2, start + 7);
  let sum = 0;
  for (let i = start; i <= end; i++) sum += i;
  return {
    type: "output",
    code:
`#include <iostream>
using namespace std;

int main() {
    int sum = 0;
    for (int i = ${start}; i <= ${end}; i++) {
        sum += i;
    }
    cout << sum << endl;
}`,
    options: [String(sum), ...offsets(sum, 3).map(String)],
    correctIndex: 0,
  };
}

function genForLoopConcat() {
  const start = rand(1, 3);
  const end = rand(start + 1, start + 5);
  let concat = "";
  for (let i = start; i <= end; i++) concat += i;
  let reversed = "";
  for (let i = end; i >= start; i--) reversed += i;
  let off1 = "";
  for (let i = start; i < end; i++) off1 += i;
  let off2 = "";
  for (let i = start + 1; i <= end + 1; i++) off2 += i;
  const opts = [concat, reversed, off1, off2].filter((v, i, a) => a.indexOf(v) === i);
  while (opts.length < 4) opts.push(opts[0] + opts.length);
  return {
    type: "output",
    code:
`#include <iostream>
using namespace std;

int main() {
    for (int i = ${start}; i <= ${end}; i++) {
        cout << i;
    }
}`,
    options: opts.slice(0, 4),
    correctIndex: 0,
  };
}

function genArrayIndex() {
  const arr = Array.from({ length: 5 }, () => rand(1, 99));
  const idx = rand(0, 4);
  const correct = arr[idx];
  const distractors = [];
  for (const v of arr) if (v !== correct && !distractors.includes(v)) distractors.push(v);
  while (distractors.length < 3) {
    const cand = correct + rand(1, 9) * (Math.random() < 0.5 ? -1 : 1);
    if (cand !== correct && !distractors.includes(cand)) distractors.push(cand);
  }
  return {
    type: "output",
    code:
`#include <iostream>
using namespace std;

int main() {
    int arr[5] = {${arr.join(", ")}};
    cout << arr[${idx}] << endl;
}`,
    options: [String(correct), ...distractors.slice(0, 3).map(String)],
    correctIndex: 0,
  };
}

function genIfElseOutput() {
  const a = rand(1, 30);
  const b = rand(1, 30);
  const cond = a > b ? "big" : a < b ? "small" : "equal";
  const condCode = `a > b`;
  const correct = a > b ? "big" : "small-or-equal";
  return {
    type: "output",
    code:
`#include <iostream>
using namespace std;

int main() {
    int a = ${a};
    int b = ${b};
    if (a > b) {
        cout << "big" << endl;
    } else {
        cout << "small-or-equal" << endl;
    }
}`,
    options: [
      correct,
      correct === "big" ? "small-or-equal" : "big",
      "Nothing — the program does not compile",
      "Both lines are printed",
    ],
    correctIndex: 0,
  };
}

function genWhileLoopSum() {
  const n = pick([5, 6, 7, 8, 9, 10]);
  let sum = 0;
  for (let i = 1; i <= n; i++) sum += i;
  return {
    type: "output",
    code:
`#include <iostream>
using namespace std;

int main() {
    int i = 1;
    int sum = 0;
    while (i <= ${n}) {
        sum += i;
        i++;
    }
    cout << sum << endl;
}`,
    options: [String(sum), ...offsets(sum, 3).map(String)],
    correctIndex: 0,
  };
}

function genCharOutput() {
  // Integer-as-char trick: cout << char(N) prints the ASCII char.
  const charCode = rand(65, 90); // A..Z
  const correct = String.fromCharCode(charCode);
  const distractors = [];
  const used = new Set([charCode]);
  while (distractors.length < 3) {
    const c = rand(65, 90);
    if (!used.has(c)) {
      used.add(c);
      distractors.push(String.fromCharCode(c));
    }
  }
  return {
    type: "output",
    code:
`#include <iostream>
using namespace std;

int main() {
    char c = ${charCode};
    cout << c << endl;
}`,
    options: [correct, ...distractors],
    correctIndex: 0,
  };
}

// ---------------------------------------------------------------------------
//  MISTAKE GENERATORS  (🐞 "Where is the mistake?")
// ---------------------------------------------------------------------------
const COMMON_MISTAKE_DISTRACTORS = [
  "'cout' should be 'cin'",
  "'#include <stdio.h>' is missing",
  "'main' should return 'void'",
  "'return 0;' is missing",
  "'using namespace std;' is missing",
  "'main' is misspelled",
  "'endl' should be 'end'",
  "The curly braces are missing",
  "There is no mistake",
];

const SEMI_TEMPLATES = [
  { buggy:
`#include <iostream>
using namespace std;

int main() {
    int x = 5
    cout << x << endl;
}`, desc: "';' missing after 'int x = 5'" },
  { buggy:
`#include <iostream>
using namespace std;

int main() {
    int a = 3, b = 4
    cout << a + b << endl;
}`, desc: "';' missing after 'int a = 3, b = 4'" },
  { buggy:
`#include <iostream>
using namespace std;

int main() {
    int n = 10
    for (int i = 0; i < n; i++) {
        cout << i;
    }
}`, desc: "';' missing after 'int n = 10'" },
  { buggy:
`#include <iostream>
using namespace std;

int main() {
    cout << "Hello" << endl
    return 0;
}`, desc: "';' missing after 'cout << \"Hello\" << endl'" },
  { buggy:
`#include <iostream>
using namespace std;

int main() {
    bool flag = true
    if (flag) cout << "Yes" << endl;
}`, desc: "';' missing after 'bool flag = true'" },
];
function genMissingSemicolon() {
  const t = pick(SEMI_TEMPLATES);
  return {
    type: "mistake",
    code: t.buggy,
    options: [t.desc, ...pickN(COMMON_MISTAKE_DISTRACTORS, 3)],
    correctIndex: 0,
  };
}

const EQUALS_TEMPLATES = [
  { buggy:
`#include <iostream>
using namespace std;

int main() {
    int x = 5;
    if (x = 10) {
        cout << "Big" << endl;
    }
}`, desc: "'=' should be '==' in 'if (x = 10)'" },
  { buggy:
`#include <iostream>
using namespace std;

int main() {
    int n;
    cin >> n;
    if (n = 0) {
        cout << "Zero" << endl;
    }
}`, desc: "'=' should be '==' in 'if (n = 0)'" },
  { buggy:
`#include <iostream>
using namespace std;

int main() {
    int age;
    cin >> age;
    if (age = 18) {
        cout << "Adult" << endl;
    }
}`, desc: "'=' should be '==' in 'if (age = 18)'" },
  { buggy:
`#include <iostream>
using namespace std;

int main() {
    int a = 5, b = 10;
    while (a = b) {
        cout << a << endl;
    }
}`, desc: "'=' should be '==' in 'while (a = b)'" },
];
function genEqualsMistake() {
  const t = pick(EQUALS_TEMPLATES);
  return {
    type: "mistake",
    code: t.buggy,
    options: [t.desc, ...pickN(COMMON_MISTAKE_DISTRACTORS, 3)],
    correctIndex: 0,
  };
}

const CIN_TEMPLATES = [
  { buggy:
`#include <iostream>
using namespace std;

int main() {
    int age;
    cin << age;
    cout << age << endl;
}`, desc: "'cin << age' should be 'cin >> age'" },
  { buggy:
`#include <iostream>
using namespace std;

int main() {
    int x;
    cin << x;
    cout << x * 2 << endl;
}`, desc: "'cin << x' should be 'cin >> x'" },
  { buggy:
`#include <iostream>
using namespace std;

int main() {
    int a, b;
    cin << a << b;
    cout << a + b << endl;
}`, desc: "'cin <<' should be 'cin >>'" },
  { buggy:
`#include <iostream>
using namespace std;

int main() {
    string name;
    cin << name;
    cout << "Hi " << name << endl;
}`, desc: "'cin << name' should be 'cin >> name'" },
];
function genCinMistake() {
  const t = pick(CIN_TEMPLATES);
  return {
    type: "mistake",
    code: t.buggy,
    options: [t.desc, ...pickN(COMMON_MISTAKE_DISTRACTORS, 3)],
    correctIndex: 0,
  };
}

const INCLUDE_TEMPLATES = [
`using namespace std;

int main() {
    cout << "Hi" << endl;
}`,
`using namespace std;

int main() {
    int x;
    cin >> x;
    cout << x << endl;
}`,
`using namespace std;

int main() {
    for (int i = 1; i <= 5; i++) {
        cout << i << " ";
    }
}`,
];
function genMissingInclude() {
  return {
    type: "mistake",
    code: pick(INCLUDE_TEMPLATES),
    options: [
      "'#include <iostream>' is missing",
      ...pickN(COMMON_MISTAKE_DISTRACTORS, 3),
    ],
    correctIndex: 0,
  };
}

function genOutOfBounds() {
  const size = rand(3, 6);
  const badIdx = size + rand(0, 2);
  const values = Array.from({ length: size }, () => rand(1, 99));
  return {
    type: "mistake",
    code:
`#include <iostream>
using namespace std;

int main() {
    int arr[${size}] = {${values.join(", ")}};
    cout << arr[${badIdx}] << endl;
}`,
    options: [
      `'arr[${badIdx}]' is out of bounds — valid indexes are 0..${size - 1}`,
      ...pickN(COMMON_MISTAKE_DISTRACTORS, 3),
    ],
    correctIndex: 0,
  };
}

function genUninitVar() {
  const v = pick(["x", "n", "value", "result"]);
  return {
    type: "mistake",
    code:
`#include <iostream>
using namespace std;

int main() {
    int ${v};
    cout << ${v} * 2 << endl;
}`,
    options: [
      `'${v}' is used before being initialized`,
      ...pickN(COMMON_MISTAKE_DISTRACTORS, 3),
    ],
    correctIndex: 0,
  };
}

// ---------------------------------------------------------------------------
//  BEHAVIOR GENERATORS  (🤔 "What does this program do?")
// ---------------------------------------------------------------------------
function genBehaviorSum() {
  const n = pick([5, 10, 15, 20, 25, 50, 100]);
  return {
    type: "behavior",
    code:
`#include <iostream>
using namespace std;

int main() {
    int sum = 0;
    for (int i = 1; i <= ${n}; i++) {
        sum += i;
    }
    cout << sum << endl;
}`,
    options: [
      `Prints the sum of the numbers from 1 to ${n}`,
      `Prints the numbers from 1 to ${n} on separate lines`,
      `Prints the number ${n}`,
      `Counts down from ${n} to 1`,
    ],
    correctIndex: 0,
  };
}

function genBehaviorCountdown() {
  const n = pick([5, 7, 10, 12, 15, 20]);
  return {
    type: "behavior",
    code:
`#include <iostream>
using namespace std;

int main() {
    for (int i = ${n}; i >= 1; i--) {
        cout << i << " ";
    }
}`,
    options: [
      `Counts down from ${n} to 1, separated by spaces`,
      `Counts up from 1 to ${n}`,
      `Prints only the number ${n}`,
      `Prints the number ${n} ${n} times`,
    ],
    correctIndex: 0,
  };
}

function genBehaviorEvenOdd() {
  return {
    type: "behavior",
    code:
`#include <iostream>
using namespace std;

int main() {
    int n;
    cin >> n;
    if (n % 2 == 0) {
        cout << "even" << endl;
    } else {
        cout << "odd" << endl;
    }
}`,
    options: [
      `Reads a number and prints "even" or "odd"`,
      `Reads two numbers and adds them`,
      `Reads a number and prints it back`,
      `Prints "even" in an infinite loop`,
    ],
    correctIndex: 0,
  };
}

function genBehaviorSwap() {
  const namePairs = [["a", "b"], ["x", "y"], ["p", "q"], ["first", "second"]];
  const [v1, v2] = pick(namePairs);
  const a = rand(1, 20);
  let b = rand(1, 20);
  if (a === b) b = a + rand(1, 5);
  return {
    type: "behavior",
    code:
`#include <iostream>
using namespace std;

int main() {
    int ${v1} = ${a}, ${v2} = ${b};
    int temp = ${v1};
    ${v1} = ${v2};
    ${v2} = temp;
    cout << ${v1} << " " << ${v2} << endl;
}`,
    options: [
      `Swaps the values of ${v1} and ${v2} — prints "${b} ${a}"`,
      `Prints "${a} ${b}" — the original values`,
      `Adds ${v1} and ${v2} — prints "${a + b}"`,
      `Prints "0 0"`,
    ],
    correctIndex: 0,
  };
}

function genBehaviorMax() {
  const a = rand(2, 50);
  let b = rand(2, 50);
  if (a === b) b = a + rand(1, 5);
  const max = Math.max(a, b);
  const min = Math.min(a, b);
  return {
    type: "behavior",
    code:
`#include <iostream>
using namespace std;

int findMax(int x, int y) {
    if (x > y) return x;
    return y;
}

int main() {
    cout << findMax(${a}, ${b}) << endl;
}`,
    options: [
      `Prints ${max} — the larger of the two numbers`,
      `Prints ${min} — the smaller of the two numbers`,
      `Prints ${a + b} — the sum of the two numbers`,
      `Does not compile`,
    ],
    correctIndex: 0,
  };
}

function genBehaviorArraySum() {
  const arr = Array.from({ length: 5 }, () => rand(1, 10));
  const sum = arr.reduce((s, v) => s + v, 0);
  const max = Math.max(...arr);
  return {
    type: "behavior",
    code:
`#include <iostream>
using namespace std;

int main() {
    int arr[5] = {${arr.join(", ")}};
    int total = 0;
    for (int i = 0; i < 5; i++) {
        total += arr[i];
    }
    cout << total << endl;
}`,
    options: [
      `Sums all values in the array — prints ${sum}`,
      `Prints each value: "${arr.join(" ")}"`,
      `Prints the largest value: ${max}`,
      `Prints the array size: 5`,
    ],
    correctIndex: 0,
  };
}

function genBehaviorMultiply() {
  const factor = pick([2, 3, 4, 5, 10]);
  const start = rand(1, 5);
  const count = pick([3, 4, 5]);
  return {
    type: "behavior",
    code:
`#include <iostream>
using namespace std;

int main() {
    int x = ${start};
    for (int i = 0; i < ${count}; i++) {
        x = x * ${factor};
    }
    cout << x << endl;
}`,
    options: [
      `Multiplies x by ${factor}, ${count} times — prints ${start * Math.pow(factor, count)}`,
      `Prints ${start} (no change)`,
      `Multiplies x by ${factor} once — prints ${start * factor}`,
      `Crashes`,
    ],
    correctIndex: 0,
  };
}

// ---------------------------------------------------------------------------
//  STATIC QUESTIONS  (mostly theory — 💡 — plus a few hand-picked extras)
// ---------------------------------------------------------------------------
const STATIC_QUESTIONS = [
  // -- Theory: I/O and includes ---------------------------------------------
  { type: "theory", prompt: "What does the line `#include <iostream>` do?",
    options: [
      "Makes input/output features like `cout` and `cin` available",
      "Tells the compiler the program is written in English",
      "Includes a user file called iostream.cpp",
      "Disables all output until the program turns it back on",
    ], correctIndex: 0 },
  { type: "theory", prompt: "What is the purpose of `using namespace std;`?",
    options: [
      "Lets you write `cout` instead of `std::cout`",
      "Includes the entire C++ standard library",
      "Creates a new namespace named `std`",
      "Sets the language standard to C++17",
    ], correctIndex: 0 },
  { type: "theory", prompt: "Which stream do you use to print to the screen?",
    options: ["`cout`", "`cin`", "`cerr` always", "`print`"], correctIndex: 0 },
  { type: "theory", prompt: "Which stream do you use to read input from the keyboard?",
    options: ["`cin`", "`cout`", "`scanf`", "`input`"], correctIndex: 0 },
  { type: "theory", prompt: "What does `endl` do at the end of a `cout` line?",
    options: [
      "Ends the current output line (moves to a new line)",
      "Ends the program",
      "Ends the current statement",
      "Erases everything that was printed so far",
    ], correctIndex: 0 },
  { type: "theory", prompt: "What is the difference between `cout` and `cin`?",
    options: [
      "`cout` writes to the screen; `cin` reads from the keyboard",
      "`cout` reads input; `cin` writes output",
      "They are the same thing",
      "`cout` is for files; `cin` is for the screen",
    ], correctIndex: 0 },
  { type: "theory", prompt: "Which operator is used with `cout` to send data to the screen?",
    options: ["`<<`", "`>>`", "`->`", "`=`"], correctIndex: 0 },
  { type: "theory", prompt: "Which operator is used with `cin` to read data from the keyboard?",
    options: ["`>>`", "`<<`", "`->`", "`=`"], correctIndex: 0 },

  // -- Theory: Operators ----------------------------------------------------
  { type: "theory", prompt: "How do you write an \"is equal to\" comparison in C++?",
    options: [
      "Use `==` (two equals signs)",
      "Use `=` (one equals sign)",
      "Use `eq()`",
      "Use `===` (three equals signs)",
    ], correctIndex: 0 },
  { type: "theory", prompt: "What does the `%` operator compute?",
    options: [
      "The remainder of an integer division",
      "A percentage from 0 to 100",
      "A floating-point division",
      "A bitwise XOR",
    ], correctIndex: 0 },
  { type: "theory", prompt: "What does `x++` do to the variable x?",
    options: [
      "Increases x by 1",
      "Multiplies x by 2",
      "Sets x to 1",
      "Compares x to 0",
    ], correctIndex: 0 },
  { type: "theory", prompt: "Which operator is logical AND in C++?",
    options: ["`&&`", "`&`", "`AND`", "`and1`"], correctIndex: 0 },
  { type: "theory", prompt: "Which operator is logical OR in C++?",
    options: ["`||`", "`|`", "`OR`", "`+`"], correctIndex: 0 },
  { type: "theory", prompt: "What does the boolean `true` produce when printed as an `int`?",
    options: ["`1`", "`0`", "`-1`", "The word \"true\""], correctIndex: 0 },
  { type: "theory", prompt: "What does the boolean `false` produce when printed as an `int`?",
    options: ["`0`", "`1`", "`-1`", "The word \"false\""], correctIndex: 0 },

  // -- Theory: Types --------------------------------------------------------
  { type: "theory", prompt: "Which type stores whole numbers like 5 or -42?",
    options: ["`int`", "`bool`", "`string`", "`char`"], correctIndex: 0 },
  { type: "theory", prompt: "Which type stores a single character like `'A'`?",
    options: ["`char`", "`string`", "`int`", "`bool`"], correctIndex: 0 },
  { type: "theory", prompt: "Which type stores `true` / `false` values?",
    options: ["`bool`", "`int`", "`char`", "`flag`"], correctIndex: 0 },
  { type: "theory", prompt: "What is the result of `10 / 3` when both operands are `int`?",
    options: [
      "`3` — fractional part is discarded",
      "`3.33`",
      "`3.5`",
      "A compile error",
    ], correctIndex: 0 },

  // -- Theory: Control flow -------------------------------------------------
  { type: "theory", prompt: "What does `break;` do inside a `for` loop?",
    options: [
      "Exits the loop immediately",
      "Skips the rest of this iteration and continues",
      "Pauses the program until a key is pressed",
      "Restarts the loop from the beginning",
    ], correctIndex: 0 },
  { type: "theory", prompt: "What does `continue;` do inside a `for` loop?",
    options: [
      "Skips the rest of this iteration and goes to the next",
      "Exits the loop immediately",
      "Re-runs the same iteration",
      "Restarts the program",
    ], correctIndex: 0 },
  { type: "theory", prompt: "Which loop is best when you know exactly how many times to run?",
    options: ["`for` loop", "`while` loop", "`do-while` loop", "Any of the above; only `for` works"], correctIndex: 0 },

  // -- Theory: Arrays & functions -------------------------------------------
  { type: "theory", prompt: "If you declare `int arr[5];`, which is the LAST valid index?",
    options: ["`4`", "`5`", "`0`", "`-1`"], correctIndex: 0 },
  { type: "theory", prompt: "What does a `return` statement do in a function?",
    options: [
      "Sends a value back to the caller and exits the function",
      "Restarts the function from the top",
      "Prints the value to the screen",
      "Pauses the function until called again",
    ], correctIndex: 0 },
  { type: "theory", prompt: "What does the `void` return type mean for a function?",
    options: [
      "The function does not return a value",
      "The function can only return zero",
      "The function returns garbage",
      "The function is empty",
    ], correctIndex: 0 },

  // -- Static special cases -------------------------------------------------
  { type: "output",
    code:
`#include <iostream>
using namespace std;

int main() {
    int a = 7, b = 2;
    cout << a / b << " " << a % b << endl;
}`,
    options: ["3 1", "3.5 1", "3 0", "1 3"],
    correctIndex: 0 },
  { type: "output",
    code:
`#include <iostream>
using namespace std;

int main() {
    int n = 5;
    cout << (n > 0 ? "positive" : "not positive") << endl;
}`,
    options: ["positive", "not positive", "1", "5"],
    correctIndex: 0 },
];

// ---------------------------------------------------------------------------
//  Source pool — weights roughly track how many visibly-distinct outputs
//  each source can produce, so over a long session every individual variant
//  appears roughly the same number of times.
// ---------------------------------------------------------------------------
// Weights are tuned so each category gets roughly equal share of picks.
// Target: ~250 per category, ~1000 total weighted variants.
const SOURCES = [
  // ---- Output (~250 total) ----
  { weight: 25, fn: genHelloWorld },
  { weight: 30, fn: genSimpleArithmetic },
  { weight: 30, fn: genVariableArith },
  { weight: 20, fn: genPrecedence },
  { weight: 18, fn: genIntDivision },
  { weight: 18, fn: genModulo },
  { weight: 20, fn: genBoolCompare },
  { weight: 15, fn: genForLoopSum },
  { weight: 15, fn: genForLoopConcat },
  { weight: 18, fn: genArrayIndex },
  { weight: 15, fn: genIfElseOutput },
  { weight: 15, fn: genWhileLoopSum },
  { weight: 12, fn: genCharOutput },

  // ---- Mistake (~250 total) ----
  { weight: 50, fn: genMissingSemicolon },
  { weight: 40, fn: genEqualsMistake },
  { weight: 40, fn: genCinMistake },
  { weight: 30, fn: genMissingInclude },
  { weight: 50, fn: genOutOfBounds },
  { weight: 40, fn: genUninitVar },

  // ---- Behavior (~250 total) ----
  { weight: 40, fn: genBehaviorSum },
  { weight: 35, fn: genBehaviorCountdown },
  { weight: 30, fn: genBehaviorEvenOdd },
  { weight: 35, fn: genBehaviorSwap },
  { weight: 35, fn: genBehaviorMax },
  { weight: 35, fn: genBehaviorArraySum },
  { weight: 35, fn: genBehaviorMultiply },

  // ---- Theory / static specials (~250 total) ----
  // Single source that uniformly picks from the static bank.
  { weight: 250, fn: () => pick(STATIC_QUESTIONS) },
];
const TOTAL_WEIGHT = SOURCES.reduce((s, x) => s + x.weight, 0);

function pickSource() {
  let r = Math.random() * TOTAL_WEIGHT;
  for (const src of SOURCES) {
    r -= src.weight;
    if (r <= 0) return src.fn;
  }
  return SOURCES[0].fn;
}

// Internal repeat guard — sign by question shape and skip if it matches
// what we just returned.
let lastSig = null;
function signature(q) {
  return `${q.type}|${q.code || ""}|${q.prompt || ""}|${q.options[q.correctIndex]}`;
}

/**
 * Returns a fresh random question. Avoids repeating the previous one back-to-back.
 */
export function generateQuestion() {
  for (let i = 0; i < 5; i++) {
    const q = pickSource()();
    const sig = signature(q);
    if (sig !== lastSig) {
      lastSig = sig;
      return q;
    }
  }
  // Fallback after 5 collisions — accept whatever we got.
  const q = pickSource()();
  lastSig = signature(q);
  return q;
}

/**
 * Approximate count of visibly-distinct questions the bank can produce.
 * Useful for telemetry / debug.
 */
export const QUESTION_VARIANT_COUNT = TOTAL_WEIGHT;
