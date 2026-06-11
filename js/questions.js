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

function genSingleNumber() {
  const n = rand(0, 99);
  const v = pick(["x", "n", "num", "value", "a", "score"]);
  // Two variations: print the literal directly, or through a variable.
  const direct = Math.random() < 0.5;
  const code = direct
    ? `#include <iostream>
using namespace std;

int main() {
    cout << ${n} << endl;
}`
    : `#include <iostream>
using namespace std;

int main() {
    int ${v} = ${n};
    cout << ${v} << endl;
}`;
  // For the variable form, the classic beginner trap — "it prints the
  // variable's name" — replaces one numeric distractor.
  const distractors = direct
    ? offsets(n, 3).map(String)
    : [v, ...offsets(n, 2).map(String)];
  return {
    type: "output",
    code,
    options: [String(n), ...distractors],
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

// Reads one number and echoes it. The input value is given in the prompt.
function genCinEcho() {
  const v = pick(["a", "x", "n", "num", "value"]);
  const n = rand(1, 99);
  return {
    type: "output",
    prompt: `What does this program print if the user enters ${n}?`,
    code:
`#include <iostream>
using namespace std;

int main() {
    int ${v};
    cin >> ${v};
    cout << ${v} << endl;
}`,
    // Name trap ("it prints the variable's name") + numeric near-misses.
    options: [String(n), v, ...offsets(n, 2).map(String)],
    correctIndex: 0,
  };
}

// Like genVariableArith, but the result flows through a third variable first.
function genVariableArithThirdVar() {
  const [v1, v2, v3] = pick([["a", "b", "c"], ["x", "y", "z"], ["p", "q", "r"], ["m", "n", "k"]]);
  const op = pick(["+", "-", "*"]);
  const a = rand(2, 50);
  const b = rand(2, 50);
  const correct = op === "+" ? a + b : op === "-" ? a - b : a * b;
  // One distractor is the "wrong operation" result when it differs.
  const wrongOp = op === "+" ? a - b : op === "-" ? a + b : a + b;
  const distractors = new Set();
  if (wrongOp !== correct) distractors.add(wrongOp);
  for (const o of offsets(correct, 6)) {
    if (o !== correct && !distractors.has(o)) distractors.add(o);
    if (distractors.size >= 3) break;
  }
  return {
    type: "output",
    code:
`#include <iostream>
using namespace std;

int main() {
    int ${v1} = ${a};
    int ${v2} = ${b};
    int ${v3} = ${v1} ${op} ${v2};

    cout << ${v3} << endl;
}`,
    options: [String(correct), ...Array.from(distractors).slice(0, 3).map(String)],
    correctIndex: 0,
  };
}

// Reads two numbers, computes their sum and difference, prints all four
// values on separate lines. Multi-line answer options.
function genCinArithMultiline() {
  const [v1, v2, v3, v4] = pick([["a", "b", "c", "d"], ["x", "y", "s", "d"], ["p", "q", "r", "t"]]);
  const a = rand(3, 20);
  const b = rand(1, a - 1); // keep the difference positive
  const sum = a + b;
  const diff = a - b;
  return {
    type: "output",
    prompt: `What does this program print if the user enters ${a} and ${b}?`,
    code:
`#include <iostream>
using namespace std;

int main() {
    int ${v1};
    int ${v2};

    cin >> ${v1};
    cin >> ${v2};

    int ${v3} = ${v1} + ${v2};
    int ${v4} = ${v1} - ${v2};

    cout << ${v1} << endl;
    cout << ${v2} << endl;
    cout << ${v3} << endl;
    cout << ${v4} << endl;
}`,
    options: [
      `${a}\n${b}\n${sum}\n${diff}`,          // correct
      `${a}\n${b}\n${diff}\n${sum}`,          // sum and difference swapped
      `${v1}\n${v2}\n${v3}\n${v4}`,           // misconception: prints the names
      `${a} ${b} ${sum} ${diff}`,             // misconception: all on one line
    ],
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
  // Correct = quot (integer division truncates). Build 3 distinct distractors:
  // the "real" decimal result, and a couple of near-misses. Guard against
  // collisions (e.g. remainder == quot) so no option is duplicated.
  const opts = [String(quot)];
  const seen = new Set(opts);
  for (const cand of [decimal, String(quot + 1), String(remainder), String(quot - 1), String(quot + 2)]) {
    if (!seen.has(cand)) { seen.add(cand); opts.push(cand); }
    if (opts.length === 4) break;
  }
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
    options: opts,
    correctIndex: 0,
  };
}

function genModulo() {
  const x = rand(7, 60);
  const y = rand(2, 9);
  const correct = x % y;
  const quot = Math.floor(x / y);
  // Correct = remainder. Distractors: the quotient (a common mix-up), the
  // divisor itself, and a couple of near-miss remainders. Build a distinct
  // set, then pad from small integers as a final safety net.
  const opts = [String(correct)];
  const seen = new Set(opts);
  for (const cand of [String(quot), String(y), String((correct + 1) % y), String((correct + 2) % y), String(correct + 1)]) {
    if (!seen.has(cand)) { seen.add(cand); opts.push(cand); }
    if (opts.length === 4) break;
  }
  for (let pad = 0; opts.length < 4; pad++) {
    const s = String(pad);
    if (!seen.has(s)) { seen.add(s); opts.push(s); }
  }
  return {
    type: "output",
    code:
`#include <iostream>
using namespace std;

int main() {
    cout << ${x} % ${y} << endl;
}`,
    options: opts,
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

// The same variable declared twice — a guaranteed compile error.
function genRedeclareMistake() {
  const v = pick(["a", "x", "n", "value", "score"]);
  const n1 = rand(2, 15);
  let n2 = rand(2, 15);
  if (n2 === n1) n2 = n1 + 1;
  // Half the time use binary literals (ties into the binary lessons).
  const binary = Math.random() < 0.5;
  const lit = (n) => (binary ? `0b${n.toString(2).padStart(4, "0")}` : String(n));
  return {
    type: "mistake",
    code:
`#include <iostream>
using namespace std;

int main() {
    int ${v} = ${lit(n1)};
    int ${v} = ${lit(n2)};
    cout << ${v} << endl;
}`,
    options: [
      `'${v}' is declared twice`,
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
//  MULTILINE & FORMATTING OUTPUT  (📝 — endl vs no-endl vs "\n")
// ---------------------------------------------------------------------------
function genMultilineEndl() {
  const [l1, l2, l3] = pickN(HW_MESSAGES, 3);
  return {
    type: "output",
    code:
`#include <iostream>
using namespace std;

int main() {
    cout << "${l1}" << endl;
    cout << "${l2}" << endl;
    cout << "${l3}" << endl;
}`,
    options: [
      `${l1}\n${l2}\n${l3}`, // correct — each endl starts a new line
      `${l3}\n${l2}\n${l1}`, // reversed order
      `${l1} ${l2} ${l3}`,   // misconception: all on one line
      `${l1}\n${l2}`,        // missing the last line
    ],
    correctIndex: 0,
  };
}

function genCoutSameLine() {
  const [a, b, c] = pickN(["Hi", "Yo", "Go", "C++", "Win", "Run", "Fun", "Dev", "Bit", "Pro"], 3);
  return {
    type: "output",
    code:
`#include <iostream>
using namespace std;

int main() {
    cout << "${a}";
    cout << "${b}";
    cout << "${c}";
}`,
    options: [
      `${a}${b}${c}`,     // correct — no endl, so everything is on one line
      `${a}\n${b}\n${c}`, // misconception: separate lines
      `${a} ${b} ${c}`,   // misconception: spaces in between
      `${c}${b}${a}`,     // reversed
    ],
    correctIndex: 0,
  };
}

function genNewlineEscape() {
  const [x, y] = pick([
    ["Hello", "World"], ["Game", "Over"], ["Good", "Job"],
    ["Win", "Lose"], ["Up", "Down"], ["Left", "Right"],
  ]);
  return {
    type: "output",
    code:
`#include <iostream>
using namespace std;

int main() {
    cout << "${x}\\n${y}" << endl;
}`,
    options: [
      `${x}\n${y}`,  // correct — \n is a new line
      `${x}\\n${y}`, // misconception: prints the \n characters literally
      `${x}${y}`,    // joined with nothing
      `${x} ${y}`,   // a space instead of a new line
    ],
    correctIndex: 0,
  };
}

// ---------------------------------------------------------------------------
//  NEGATIVE NUMBERS  (📝)
// ---------------------------------------------------------------------------
function genNegativeArith() {
  const a = rand(-15, -1);
  const b = rand(1, 15);
  const op = pick(["+", "-", "*"]);
  const correct = op === "+" ? a + b : op === "-" ? a - b : a * b;
  return {
    type: "output",
    code:
`#include <iostream>
using namespace std;

int main() {
    int a = ${a};
    int b = ${b};
    cout << a ${op} b << endl;
}`,
    options: [String(correct), ...offsets(correct, 3).map(String)],
    correctIndex: 0,
  };
}

// ---------------------------------------------------------------------------
//  BINARY  (💡 theory — beginner conversions, small numbers 2..15)
// ---------------------------------------------------------------------------
// A 0b binary literal assigned to an int prints as decimal.
function genBinaryLiteralOutput() {
  const v = pick(["a", "x", "n", "value"]);
  const n = rand(2, 15);
  const bits = n.toString(2).padStart(4, "0");
  const distractors = new Set();
  distractors.add(bits);            // misconception: prints the binary digits
  for (const o of offsets(n, 6)) {
    if (o > 0 && String(o) !== bits) distractors.add(String(o));
    if (distractors.size >= 3) break;
  }
  // offsets() can yield mostly non-positive candidates for small n; top up.
  for (let k = 1; distractors.size < 3; k++) {
    distractors.add(String(n + k));
  }
  return {
    type: "output",
    code:
`#include <iostream>
using namespace std;

int main() {
    int ${v} = 0b${bits};
    cout << ${v} << endl;
}`,
    options: [String(n), ...Array.from(distractors).slice(0, 3)],
    correctIndex: 0,
  };
}

function genDecimalToBinary() {
  const n = rand(2, 15);
  const correct = n.toString(2);
  const set = new Set();
  while (set.size < 3) {
    const cand = rand(2, 15).toString(2);
    if (cand !== correct) set.add(cand);
  }
  return {
    type: "theory",
    prompt: `What is the number ${n} written in binary?`,
    options: [correct, ...set],
    correctIndex: 0,
  };
}

function genBinaryToDecimal() {
  const n = rand(2, 15);
  const set = new Set();
  while (set.size < 3) {
    const cand = rand(0, 15);
    if (cand !== n) set.add(String(cand));
  }
  return {
    type: "theory",
    prompt: `What is the binary number ${n.toString(2)} in decimal (base 10)?`,
    options: [String(n), ...set],
    correctIndex: 0,
  };
}

// ---------------------------------------------------------------------------
//  SCOPES & BLOCKS  (📝 — variables living inside { } blocks)
//  Values are 0b literals half the time, tying into the binary lessons.
// ---------------------------------------------------------------------------
function scopeValue() {
  const n = rand(2, 15);
  const binary = Math.random() < 0.5;
  return { n, lit: binary ? `0b${n.toString(2).padStart(4, "0")}` : String(n) };
}

// One block: either the variable is declared inside it, or it's declared in
// main and only printed inside the block (outer variables are visible).
function genScopeBlockOutput() {
  const v = pick(["a", "x", "n", "value"]);
  const { n, lit } = scopeValue();
  const declaredInside = Math.random() < 0.5;
  const code = declaredInside
    ? `#include <iostream>
using namespace std;

int main() {
    {
        int ${v} = ${lit};
        cout << ${v} << endl;
    }
}`
    : `#include <iostream>
using namespace std;

int main() {
    int ${v} = ${lit};

    {
        cout << ${v} << endl;
    }
}`;
  const distractors = new Set([
    `Nothing — '${v}' is not visible inside the block`,
  ]);
  for (let k = 1; distractors.size < 3; k++) {
    distractors.add(String(n + k));
  }
  return {
    type: "output",
    code,
    options: [String(n), ...distractors],
    correctIndex: 0,
  };
}

// Two sibling blocks may each declare their own variable with the SAME name —
// unlike two declarations in one scope, this is perfectly legal.
function genScopeSiblingBlocks() {
  const v = pick(["a", "x", "n", "value"]);
  const first = scopeValue();
  let second = scopeValue();
  while (second.n === first.n) second = scopeValue();
  return {
    type: "output",
    code:
`#include <iostream>
using namespace std;

int main() {
    {
        int ${v} = ${first.lit};
        cout << ${v} << endl;
    }

    {
        int ${v} = ${second.lit};
        cout << ${v} << endl;
    }
}`,
    options: [
      `${first.n}\n${second.n}`,                                   // correct
      `Nothing — '${v}' is declared twice, the program does not compile`, // the redeclare trap
      `${second.n}\n${first.n}`,                                   // reversed
      `${first.n}\n${first.n}`,                                    // first value twice
    ],
    correctIndex: 0,
  };
}

// A variable declared in main is visible in nested blocks, however deep.
function genScopeNestedBlocks() {
  const v = pick(["a", "x", "n", "value"]);
  const { n, lit } = scopeValue();
  return {
    type: "output",
    code:
`#include <iostream>
using namespace std;

int main() {
    int ${v} = ${lit};

    {
        cout << ${v} << endl;

        {
            cout << ${v} << endl;
        }
    }
}`,
    options: [
      `${n}\n${n}`,                                              // correct
      `${n}`,                                                    // only once
      `Nothing — '${v}' is not visible inside the blocks`,       // visibility trap
      `${v}\n${v}`,                                              // prints the name
    ],
    correctIndex: 0,
  };
}

// ---------------------------------------------------------------------------
//  POWERS OF TWO  (💡 theory — 2^n, and how many values fit in n bits)
// ---------------------------------------------------------------------------
function genPowerOfTwo() {
  const n = rand(0, 10);
  const correct = 2 ** n;
  const distractors = new Set();
  // Classic confusions first: 2*n and n^2; then the neighbor powers.
  for (const cand of [2 * n, n * n, 2 ** (n + 1), n >= 1 ? 2 ** (n - 1) : -1, correct + 1]) {
    if (cand >= 0 && cand !== correct) distractors.add(cand);
    if (distractors.size >= 3) break;
  }
  for (let k = 2; distractors.size < 3; k++) distractors.add(correct + k);
  return {
    type: "theory",
    prompt: `What is 2 to the power of ${n} (2^${n})?`,
    options: [String(correct), ...Array.from(distractors).slice(0, 3).map(String)],
    correctIndex: 0,
  };
}

function genPowerOfTwoReverse() {
  const n = rand(2, 10);
  const distractors = new Set([n - 1, n + 1]);
  distractors.add(n === 2 ? 4 : 2 ** n); // the value itself as a trap exponent
  return {
    type: "theory",
    prompt: `2 to the power of WHAT equals ${2 ** n}?`,
    options: [String(n), ...Array.from(distractors).slice(0, 3).map(String)],
    correctIndex: 0,
  };
}

// How many values fit in n bits, and the largest unsigned value — straight
// from the lesson table (e.g. 3 bits: 8 values, maximum 7).
function genBitsCapacity() {
  const n = rand(2, 8);
  const howMany = Math.random() < 0.5;
  const correct = howMany ? 2 ** n : 2 ** n - 1;
  const distractors = new Set();
  for (const cand of [howMany ? 2 ** n - 1 : 2 ** n, 2 * n, 2 ** (n - 1), correct + 1]) {
    if (cand >= 0 && cand !== correct) distractors.add(cand);
    if (distractors.size >= 3) break;
  }
  for (let k = 2; distractors.size < 3; k++) distractors.add(correct + k);
  return {
    type: "theory",
    prompt: howMany
      ? `How many different values can ${n} bits represent?`
      : `What is the LARGEST number that fits in ${n} bits (unsigned, no two's complement)?`,
    options: [String(correct), ...Array.from(distractors).slice(0, 3).map(String)],
    correctIndex: 0,
  };
}

// ---------------------------------------------------------------------------
//  ASCII TABLE  (💡 theory + 📝 output — chars are small numbers)
// ---------------------------------------------------------------------------
const ASCII_ANCHORS = [
  { ch: "A", code: 65, alphabet: "ABCDEFGH" },
  { ch: "a", code: 97, alphabet: "abcdefgh" },
  { ch: "0", code: 48, alphabet: "01234567" },
];

const ASCII_FACTS = [
  { prompt: "What is the ASCII code of the character 'A'?",
    correct: "65", distractors: ["97", "64", "66"] },
  { prompt: "What is the ASCII code of the character 'a'?",
    correct: "97", distractors: ["65", "96", "98"] },
  { prompt: "What is the ASCII code of the character '0' (the digit zero)?",
    correct: "48", distractors: ["0", "47", "49"] },
  { prompt: "Which character has ASCII code 32?",
    correct: "The space character ' '",
    distractors: ["The digit '2'", "The letter 'a'", "The newline character"] },
  { prompt: "In the ASCII table, which of these comes FIRST (has the smallest code)?",
    correct: "The digits '0'-'9'",
    distractors: ["The uppercase letters 'A'-'Z'", "The lowercase letters 'a'-'z'", "They are all mixed together"] },
];

function genAsciiFact() {
  const f = pick(ASCII_FACTS);
  return {
    type: "theory",
    prompt: f.prompt,
    options: [f.correct, ...f.distractors],
    correctIndex: 0,
  };
}

// "'A' is 65 — what is 'E'?" Counting forward from a known anchor.
function genAsciiOffset() {
  const a = pick(ASCII_ANCHORS);
  const off = rand(1, 7);
  const target = a.alphabet[off];
  const correct = a.code + off;
  return {
    type: "theory",
    prompt: `The ASCII code of '${a.ch}' is ${a.code}. What is the ASCII code of '${target}'?`,
    options: [String(correct), ...offsets(correct, 3, 3).map(String)],
    correctIndex: 0,
  };
}

// Storing a char in an int prints its ASCII code.
function genAsciiCharToInt() {
  const a = pick(ASCII_ANCHORS);
  const off = rand(0, 7);
  const ch = a.alphabet[off];
  const correct = a.code + off;
  const distractors = new Set([ch]); // trap: "it prints the character"
  for (const o of offsets(correct, 4, 3)) {
    if (distractors.size >= 3) break;
    distractors.add(String(o));
  }
  return {
    type: "output",
    prompt: `What does this program print? (The ASCII code of '${a.ch}' is ${a.code}.)`,
    code:
`#include <iostream>
using namespace std;

int main() {
    int code = '${ch}';
    cout << code << endl;
}`,
    options: [String(correct), ...distractors],
    correctIndex: 0,
  };
}

// Storing a number in a char prints the character with that ASCII code.
function genAsciiCodeToChar() {
  const a = pick(ASCII_ANCHORS);
  const off = rand(0, 7);
  const correct = a.alphabet[off];
  const code = a.code + off;
  const distractors = new Set([String(code)]); // trap: "it prints the number"
  for (const c of pickN(a.alphabet.split("").filter((c) => c !== correct), 4)) {
    if (distractors.size >= 3) break;
    distractors.add(c);
  }
  return {
    type: "output",
    prompt: `What does this program print? (The ASCII code of '${a.ch}' is ${a.code}.)`,
    code:
`#include <iostream>
using namespace std;

int main() {
    char c = ${code};
    cout << c << endl;
}`,
    options: [correct, ...distractors],
    correctIndex: 0,
  };
}

// ---------------------------------------------------------------------------
//  STRINGS & CHAR  (📝)
// ---------------------------------------------------------------------------
function genStringConcat() {
  const [a, b] = pick([
    ["Hello", "World"], ["Dragon", "Fire"], ["Code", "Master"],
    ["Game", "Over"], ["Super", "Star"], ["Pixel", "Art"],
  ]);
  const withSpace = Math.random() < 0.5;
  const expr = withSpace ? `a + " " + b` : `a + b`;
  const correct = withSpace ? `${a} ${b}` : `${a}${b}`;
  const otherJoin = withSpace ? `${a}${b}` : `${a} ${b}`;
  return {
    type: "output",
    code:
`#include <iostream>
#include <string>
using namespace std;

int main() {
    string a = "${a}";
    string b = "${b}";
    cout << ${expr} << endl;
}`,
    options: [correct, otherJoin, `${b}${a}`, "a + b"],
    correctIndex: 0,
  };
}

function genStringGreeting() {
  const name = pick(["Sam", "Mia", "Leo", "Ava", "Max", "Zoe", "Ben", "Nia"]);
  return {
    type: "output",
    code:
`#include <iostream>
#include <string>
using namespace std;

int main() {
    string name = "${name}";
    cout << "Hi " << name << "!" << endl;
}`,
    options: [`Hi ${name}!`, "Hi name!", `${name}`, `Hi ${name}`],
    correctIndex: 0,
  };
}

function genStringLength() {
  const word = pick(["Dragon", "Code", "Arena", "Loop", "Array", "Binary", "Pixel", "Score", "Level", "Game"]);
  const n = word.length;
  return {
    type: "output",
    code:
`#include <iostream>
#include <string>
using namespace std;

int main() {
    string word = "${word}";
    cout << word.length() << endl;
}`,
    options: [String(n), String(n + 1), String(n - 1), String(n + 2)],
    correctIndex: 0,
  };
}

function genCharLiteral() {
  const pool = ["A", "B", "C", "X", "Y", "Z", "Q", "M", "K", "R", "D", "E"];
  const ch = pick(pool);
  const others = pickN(pool.filter((c) => c !== ch), 3);
  return {
    type: "output",
    code:
`#include <iostream>
using namespace std;

int main() {
    char letter = '${ch}';
    cout << letter << endl;
}`,
    options: [ch, ...others],
    correctIndex: 0,
  };
}

// ---------------------------------------------------------------------------
//  BOOL & LOGIC  (📝)
// ---------------------------------------------------------------------------
function genBoolLogic() {
  const av = pick([true, false]);
  const bv = pick([true, false]);
  const op = pick(["&&", "||"]);
  const res = op === "&&" ? (av && bv) : (av || bv);
  const correct = res ? "1" : "0";
  return {
    type: "output",
    code:
`#include <iostream>
using namespace std;

int main() {
    bool a = ${av};
    bool b = ${bv};
    cout << (a ${op} b) << endl;
}`,
    options: [correct, correct === "1" ? "0" : "1", "true", "false"],
    correctIndex: 0,
  };
}

// ---------------------------------------------------------------------------
//  IF / ELSE IF  (📝)
// ---------------------------------------------------------------------------
function genElseIfSign() {
  const n = pick([rand(1, 20), rand(-20, -1), 0, rand(1, 20), rand(-20, -1)]);
  const word = n > 0 ? "positive" : n < 0 ? "negative" : "zero";
  const others = ["positive", "negative", "zero"].filter((w) => w !== word);
  return {
    type: "output",
    code:
`#include <iostream>
using namespace std;

int main() {
    int n = ${n};
    if (n > 0) {
        cout << "positive" << endl;
    } else if (n < 0) {
        cout << "negative" << endl;
    } else {
        cout << "zero" << endl;
    }
}`,
    options: [word, ...others, "Nothing is printed"],
    correctIndex: 0,
  };
}

// ---------------------------------------------------------------------------
//  LOOP VARIATIONS  (📝)
// ---------------------------------------------------------------------------
function genWhileCountdown() {
  const n = rand(3, 7);
  let down = "", up = "", toZero = "";
  for (let i = n; i >= 1; i--) down += i + " ";
  for (let i = 1; i <= n; i++) up += i + " ";
  for (let i = n; i >= 0; i--) toZero += i + " ";
  return {
    type: "output",
    code:
`#include <iostream>
using namespace std;

int main() {
    int n = ${n};
    while (n > 0) {
        cout << n << " ";
        n--;
    }
}`,
    options: [down.trim(), up.trim(), toZero.trim(), String(n)],
    correctIndex: 0,
  };
}

function genForStep() {
  const step = pick([2, 3, 5]);
  const end = step * pick([3, 4, 5]);
  let correct = "", by1 = "", fromStep = "";
  for (let i = 0; i <= end; i += step) correct += i + " ";
  for (let i = 0; i <= end; i++) by1 += i + " ";
  for (let i = step; i <= end; i += step) fromStep += i + " ";
  const opts = [correct.trim(), by1.trim(), fromStep.trim(), String(end)]
    .filter((v, i, a) => a.indexOf(v) === i);
  while (opts.length < 4) opts.push(opts[0] + " " + (end + step * opts.length));
  return {
    type: "output",
    code:
`#include <iostream>
using namespace std;

int main() {
    for (int i = 0; i <= ${end}; i += ${step}) {
        cout << i << " ";
    }
}`,
    options: opts.slice(0, 4),
    correctIndex: 0,
  };
}

function genMultiplicationTable() {
  const k = rand(2, 9);
  const count = pick([3, 4, 5]);
  let correct = "", plus = "", idx = "";
  for (let i = 1; i <= count; i++) correct += (k * i) + " ";
  for (let i = 1; i <= count; i++) plus += (k + i) + " ";
  for (let i = 1; i <= count; i++) idx += i + " ";
  const opts = [correct.trim(), plus.trim(), idx.trim(), String(k * count + k)]
    .filter((v, i, a) => a.indexOf(v) === i);
  while (opts.length < 4) opts.push(opts[0] + " " + (k * (count + opts.length)));
  return {
    type: "output",
    code:
`#include <iostream>
using namespace std;

int main() {
    int k = ${k};
    for (int i = 1; i <= ${count}; i++) {
        cout << k * i << " ";
    }
}`,
    options: opts.slice(0, 4),
    correctIndex: 0,
  };
}

// ---------------------------------------------------------------------------
//  ARRAYS & FUNCTIONS — extra variations  (📝)
// ---------------------------------------------------------------------------
function genArrayMaxOutput() {
  const arr = Array.from({ length: 5 }, () => rand(1, 50));
  const max = Math.max(...arr);
  const min = Math.min(...arr);
  const sum = arr.reduce((s, v) => s + v, 0);
  const seen = new Set();
  const opts = [];
  for (const c of [String(max), String(min), String(arr[0]), String(sum)]) {
    if (!seen.has(c)) { seen.add(c); opts.push(c); }
  }
  for (const o of offsets(max, 4)) {
    if (opts.length >= 4) break;
    const s = String(o);
    if (!seen.has(s)) { seen.add(s); opts.push(s); }
  }
  return {
    type: "output",
    code:
`#include <iostream>
using namespace std;

int main() {
    int arr[5] = {${arr.join(", ")}};
    int best = arr[0];
    for (int i = 1; i < 5; i++) {
        if (arr[i] > best) {
            best = arr[i];
        }
    }
    cout << best << endl;
}`,
    options: opts.slice(0, 4),
    correctIndex: 0,
  };
}

function genFunctionSquare() {
  const n = rand(2, 12);
  const correct = n * n;
  const set = new Set();
  for (const d of [n * 2, n, correct + n, correct - 1, correct + 2]) {
    if (d !== correct) set.add(String(d));
    if (set.size >= 3) break;
  }
  return {
    type: "output",
    code:
`#include <iostream>
using namespace std;

int square(int n) {
    return n * n;
}

int main() {
    cout << square(${n}) << endl;
}`,
    options: [String(correct), ...set],
    correctIndex: 0,
  };
}

function genFunctionAdd() {
  const a = rand(2, 20);
  const b = rand(2, 20);
  const correct = a + b;
  return {
    type: "output",
    code:
`#include <iostream>
using namespace std;

int add(int a, int b) {
    return a + b;
}

int main() {
    cout << add(${a}, ${b}) << endl;
}`,
    options: [String(correct), ...offsets(correct, 3).map(String)],
    correctIndex: 0,
  };
}

// ---------------------------------------------------------------------------
//  GAME DEV — game-loop flavored  (📝)
// ---------------------------------------------------------------------------
function genGameLoopLives() {
  const lives = rand(2, 4);
  let correct = "", tooMany = "", noOver = "";
  for (let i = 0; i < lives; i++) correct += "Playing...\n";
  correct += "Game Over";
  for (let i = 0; i < lives + 1; i++) tooMany += "Playing...\n";
  tooMany += "Game Over";
  for (let i = 0; i < lives; i++) noOver += "Playing...\n";
  noOver = noOver.trim();
  return {
    type: "output",
    code:
`#include <iostream>
using namespace std;

int main() {
    int lives = ${lives};
    while (lives > 0) {
        cout << "Playing..." << endl;
        lives--;
    }
    cout << "Game Over" << endl;
}`,
    options: [correct, tooMany, noOver, "Playing...\nGame Over"],
    correctIndex: 0,
  };
}

function genGameScore() {
  const per = pick([5, 10, 20, 50, 100]);
  const rounds = pick([3, 4, 5]);
  const total = per * rounds;
  return {
    type: "output",
    code:
`#include <iostream>
using namespace std;

int main() {
    int score = 0;
    for (int i = 0; i < ${rounds}; i++) {
        score += ${per};
    }
    cout << "Score: " << score << endl;
}`,
    options: [`Score: ${total}`, `Score: ${per}`, `Score: ${total + per}`, "Score: 0"],
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

  // -- Theory: computer parts & basics --------------------------------------
  { type: "theory", prompt: "What does the CPU do in a computer?",
    options: [
      "It runs the program and does the calculations",
      "It stores your files permanently",
      "It shows the pictures on the screen",
      "It connects the computer to the internet",
    ], correctIndex: 0 },
  { type: "theory", prompt: "What does \"CPU\" stand for?",
    options: ["Central Processing Unit", "Computer Power Unit", "Central Picture Unit", "Control Program Utility"], correctIndex: 0 },
  { type: "theory", prompt: "Which part of the computer stores data temporarily while a program is running?",
    options: ["RAM (memory)", "The hard drive", "The monitor", "The keyboard"], correctIndex: 0 },
  { type: "theory", prompt: "Where are your files kept even after the computer is turned off?",
    options: ["On the hard drive / SSD", "In the RAM", "On the screen", "Inside the CPU"], correctIndex: 0 },
  { type: "theory", prompt: "Which of these is an INPUT device?",
    options: ["Keyboard", "Monitor", "Printer", "Speakers"], correctIndex: 0 },
  { type: "theory", prompt: "Which of these is an OUTPUT device?",
    options: ["Monitor", "Keyboard", "Mouse", "Microphone"], correctIndex: 0 },
  { type: "theory", prompt: "Which two digits does the binary system use?",
    options: ["0 and 1", "1 and 2", "0 through 9", "Only 1"], correctIndex: 0 },
  { type: "theory", prompt: "What is the difference between hardware and software?",
    options: [
      "Hardware is the physical parts; software is the programs",
      "Hardware is the programs; software is the physical parts",
      "They are exactly the same thing",
      "Hardware is for games; software is for school",
    ], correctIndex: 0 },

  // -- Theory: types, strings, negatives ------------------------------------
  { type: "theory", prompt: "Which type would you use to store a word like \"Dragon\"?",
    options: ["`string`", "`int`", "`bool`", "`char`"], correctIndex: 0 },
  { type: "theory", prompt: "How do you write a single character value in C++?",
    options: [
      "With single quotes, like `'A'`",
      "With double quotes, like `\"A\"`",
      "With no quotes, like `A`",
      "With angle brackets, like `<A>`",
    ], correctIndex: 0 },
  { type: "theory", prompt: "How do you write a text value (a string) in C++?",
    options: [
      "With double quotes, like `\"Hello\"`",
      "With single quotes, like `'Hello'`",
      "With no quotes, like `Hello`",
      "With square brackets, like `[Hello]`",
    ], correctIndex: 0 },
  { type: "theory", prompt: "Can an `int` variable store the value 3.5?",
    options: [
      "No — an `int` only stores whole numbers",
      "Yes — it stores 3.5 exactly",
      "Yes — and it rounds up to 4",
      "No — the program will not compile",
    ], correctIndex: 0 },
  { type: "theory", prompt: "Can an `int` hold a negative number like -8?",
    options: ["Yes, an `int` can be negative or positive", "No, an `int` is only positive", "Only if you use a `bool`", "Only numbers up to 0"], correctIndex: 0 },

  // -- Theory: game development ---------------------------------------------
  { type: "theory", prompt: "In game programming, what is the \"game loop\"?",
    options: [
      "A loop that repeats to update and redraw the game until it ends",
      "A bug that makes the game freeze",
      "The menu you see before the game starts",
      "The list of all the players' scores",
    ], correctIndex: 0 },
  { type: "theory", prompt: "A game should keep running while the player still has lives. Which loop fits best?",
    options: [
      "A `while` loop, like `while (lives > 0)`",
      "A single `if` statement",
      "One `cout` line",
      "A `return` statement",
    ], correctIndex: 0 },
];

// ---------------------------------------------------------------------------
//  Source pool — weights roughly track how many visibly-distinct outputs
//  each source can produce, so over a long session every individual variant
//  appears roughly the same number of times.
// ---------------------------------------------------------------------------
// Weights are tuned so each category gets a roughly even share of picks.
// ~1400 total weighted variants across the categories below.
const SOURCES = [
  // ---- Output: basics ----
  { weight: 25, fn: genHelloWorld },
  { weight: 20, fn: genSingleNumber },
  { weight: 30, fn: genSimpleArithmetic },
  { weight: 30, fn: genVariableArith },
  { weight: 25, fn: genVariableArithThirdVar },
  { weight: 20, fn: genCinEcho },
  { weight: 20, fn: genCinArithMultiline },
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

  // ---- Output: multiline & formatting (cout / endl / "\n") ----
  { weight: 20, fn: genMultilineEndl },
  { weight: 15, fn: genCoutSameLine },
  { weight: 15, fn: genNewlineEscape },

  // ---- Output: negative numbers ----
  { weight: 25, fn: genNegativeArith },

  // ---- Output: strings & char ----
  { weight: 18, fn: genStringConcat },
  { weight: 12, fn: genStringGreeting },
  { weight: 12, fn: genStringLength },
  { weight: 12, fn: genCharLiteral },

  // ---- Output: bool & logic ----
  { weight: 18, fn: genBoolLogic },

  // ---- Output: if / else if ----
  { weight: 20, fn: genElseIfSign },

  // ---- Output: loop variations (while / for) ----
  { weight: 15, fn: genWhileCountdown },
  { weight: 15, fn: genForStep },
  { weight: 15, fn: genMultiplicationTable },

  // ---- Output: arrays & functions ----
  { weight: 15, fn: genArrayMaxOutput },
  { weight: 15, fn: genFunctionSquare },
  { weight: 15, fn: genFunctionAdd },

  // ---- Output: game-dev (game loop) ----
  { weight: 18, fn: genGameLoopLives },
  { weight: 15, fn: genGameScore },

  // ---- Mistake ----
  { weight: 50, fn: genMissingSemicolon },
  { weight: 40, fn: genEqualsMistake },
  { weight: 40, fn: genCinMistake },
  { weight: 30, fn: genMissingInclude },
  { weight: 50, fn: genOutOfBounds },
  { weight: 40, fn: genRedeclareMistake },

  // ---- Behavior ----
  { weight: 40, fn: genBehaviorSum },
  { weight: 35, fn: genBehaviorCountdown },
  { weight: 30, fn: genBehaviorEvenOdd },
  { weight: 35, fn: genBehaviorSwap },
  { weight: 35, fn: genBehaviorMax },
  { weight: 35, fn: genBehaviorArraySum },
  { weight: 35, fn: genBehaviorMultiply },

  // ---- Binary (theory generators) ----
  { weight: 18, fn: genDecimalToBinary },
  { weight: 18, fn: genBinaryToDecimal },
  { weight: 18, fn: genBinaryLiteralOutput },

  // ---- Output: scopes & blocks ----
  { weight: 18, fn: genScopeBlockOutput },
  { weight: 18, fn: genScopeSiblingBlocks },
  { weight: 18, fn: genScopeNestedBlocks },

  // ---- Powers of two (theory) ----
  { weight: 18, fn: genPowerOfTwo },
  { weight: 15, fn: genPowerOfTwoReverse },
  { weight: 15, fn: genBitsCapacity },

  // ---- ASCII table (theory + output) ----
  { weight: 15, fn: genAsciiFact },
  { weight: 15, fn: genAsciiOffset },
  { weight: 15, fn: genAsciiCharToInt },
  { weight: 15, fn: genAsciiCodeToChar },

  // ---- Theory / static specials (incl. computer parts, game-loop theory) ----
  // Single source that uniformly picks from the static bank.
  { weight: 320, fn: () => pick(STATIC_QUESTIONS) },
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
