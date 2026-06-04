// ===========================================================================
//  DCSA C++ Arena — Question Bank
//
//  Four categories:
//    - output   : "What does this program print?"
//    - mistake  : "Where is the mistake?"
//    - behavior : "What does this program do?"
//    - theory   : short conceptual questions (each with its own prompt)
//
//  Each entry: { type, code?, prompt?, options[4], correctIndex }
//  The options are shuffled at render time so the correct answer's position
//  in the A/B/C/D buttons varies per play.
// ===========================================================================

export const QUESTIONS = [
  // =========================================================================
  //  OUTPUT
  // =========================================================================
  {
    type: "output",
    code:
`#include <iostream>
using namespace std;

int main() {
    cout << "Hello Dragons!" << endl;
}`,
    options: [
      "Hello Dragons!",
      "Hello, World!",
      "Dragons rule!",
      "Hello DCSA!",
    ],
    correctIndex: 0,
  },
  {
    type: "output",
    code:
`#include <iostream>
using namespace std;

int main() {
    cout << 5 + 3 * 2 << endl;
}`,
    options: ["11", "16", "13", "10"],
    correctIndex: 0,
  },
  {
    type: "output",
    code:
`#include <iostream>
using namespace std;

int main() {
    int x = 10;
    int y = 4;
    cout << x / y << endl;
}`,
    options: ["2", "2.5", "3", "2.0"],
    correctIndex: 0,
  },
  {
    type: "output",
    code:
`#include <iostream>
using namespace std;

int main() {
    bool b = (5 > 3);
    cout << b << endl;
}`,
    options: ["1", "true", "0", "false"],
    correctIndex: 0,
  },
  {
    type: "output",
    code:
`#include <iostream>
using namespace std;

int main() {
    for (int i = 1; i <= 3; i++) {
        cout << i;
    }
}`,
    options: ["123", "1 2 3", "0123", "321"],
    correctIndex: 0,
  },
  {
    type: "output",
    code:
`#include <iostream>
using namespace std;

int main() {
    int arr[5] = {1, 2, 3, 4, 5};
    cout << arr[2] << endl;
}`,
    options: ["3", "2", "4", "1, 2, 3, 4, 5"],
    correctIndex: 0,
  },

  // =========================================================================
  //  MISTAKE
  // =========================================================================
  {
    type: "mistake",
    code:
`#include <iostream>
using namespace std;

int main() {
    int x = 5
    cout << x << endl;
}`,
    options: [
      "';' missing after 'int x = 5'",
      "'#include <stdio.h>' is missing",
      "'cout' should be 'cin'",
      "'main' should return a value",
    ],
    correctIndex: 0,
  },
  {
    type: "mistake",
    code:
`#include <iostream>
using namespace std;

int main() {
    int x = 5;
    if (x = 10) {
        cout << "Big" << endl;
    }
}`,
    options: [
      "'=' should be '==' in the if condition",
      "'cout' should be 'cin'",
      "'#include <stdio.h>' is missing",
      "There is no mistake",
    ],
    correctIndex: 0,
  },
  {
    type: "mistake",
    code:
`using namespace std;

int main() {
    cout << "Hi" << endl;
}`,
    options: [
      "'#include <iostream>' is missing",
      "'main' should return 'void'",
      "'cout' should be 'cin'",
      "';' missing after 'main()'",
    ],
    correctIndex: 0,
  },
  {
    type: "mistake",
    code:
`#include <iostream>
using namespace std;

int main() {
    int age;
    cin << age;
    cout << age << endl;
}`,
    options: [
      "'cin << age' should be 'cin >> age'",
      "'cin' should be 'cout'",
      "'age' must be initialized to 0",
      "There is no mistake",
    ],
    correctIndex: 0,
  },
  {
    type: "mistake",
    code:
`#include <iostream>
using namespace std;

int main() {
    int arr[3] = {1, 2, 3};
    cout << arr[3] << endl;
}`,
    options: [
      "'arr[3]' is out of bounds — valid indexes are 0..2",
      "'int arr[3]' should be 'int arr(3)'",
      "Missing ';' after the array",
      "'cout' should be 'cin'",
    ],
    correctIndex: 0,
  },

  // =========================================================================
  //  BEHAVIOR
  // =========================================================================
  {
    type: "behavior",
    code:
`#include <iostream>
using namespace std;

int main() {
    int sum = 0;
    for (int i = 1; i <= 10; i++) {
        sum = sum + i;
    }
    cout << sum << endl;
}`,
    options: [
      "Prints the sum of the numbers from 1 to 10",
      "Prints the numbers from 1 to 10 on separate lines",
      "Prints the number 10",
      "Counts down from 10 to 1",
    ],
    correctIndex: 0,
  },
  {
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
      "Reads a number and prints \"even\" or \"odd\"",
      "Reads two numbers and adds them",
      "Reads a number and prints it back",
      "Prints \"even\" in an infinite loop",
    ],
    correctIndex: 0,
  },
  {
    type: "behavior",
    code:
`#include <iostream>
using namespace std;

int main() {
    for (int i = 10; i >= 1; i--) {
        cout << i << " ";
    }
}`,
    options: [
      "Counts down from 10 to 1, separated by spaces",
      "Counts up from 1 to 10",
      "Prints only the number 10",
      "Prints the number 10 ten times",
    ],
    correctIndex: 0,
  },
  {
    type: "behavior",
    code:
`#include <iostream>
using namespace std;

int main() {
    int a = 7, b = 3;
    int temp = a;
    a = b;
    b = temp;
    cout << a << " " << b << endl;
}`,
    options: [
      "Swaps the values of a and b — prints \"3 7\"",
      "Prints \"7 3\"",
      "Adds a and b — prints \"10\"",
      "Prints \"0 0\"",
    ],
    correctIndex: 0,
  },
  {
    type: "behavior",
    code:
`#include <iostream>
using namespace std;

int findMax(int a, int b) {
    if (a > b) return a;
    return b;
}

int main() {
    cout << findMax(7, 3) << endl;
}`,
    options: [
      "Prints 7 — the larger of the two numbers",
      "Prints 3 — the smaller of the two numbers",
      "Prints 10 — the sum of the two numbers",
      "Does not compile",
    ],
    correctIndex: 0,
  },

  // =========================================================================
  //  THEORY
  // =========================================================================
  {
    type: "theory",
    prompt: "What does the line `#include <iostream>` do?",
    options: [
      "Makes input/output features like `cout` and `cin` available",
      "Tells the compiler the program is written in English",
      "Includes a user file called iostream.cpp",
      "Disables all output until the program turns it back on",
    ],
    correctIndex: 0,
  },
  {
    type: "theory",
    prompt: "What is the purpose of `using namespace std;`?",
    options: [
      "Lets you write `cout` instead of `std::cout`",
      "Includes the entire C++ standard library",
      "Creates a new namespace named `std`",
      "Sets the language standard to C++17",
    ],
    correctIndex: 0,
  },
  {
    type: "theory",
    prompt: "How do you write an \"is equal to\" comparison in C++?",
    options: [
      "Use `==` (two equals signs)",
      "Use `=` (one equals sign)",
      "Use `eq()`",
      "Use `===` (three equals signs)",
    ],
    correctIndex: 0,
  },
  {
    type: "theory",
    prompt: "What value does the boolean `true` produce when printed as an `int`?",
    options: [
      "1",
      "0",
      "-1",
      "The word \"true\"",
    ],
    correctIndex: 0,
  },
  {
    type: "theory",
    prompt: "What is the difference between `cout` and `cin`?",
    options: [
      "`cout` writes to the screen; `cin` reads from the keyboard",
      "`cout` reads input; `cin` writes output",
      "They are the same thing",
      "`cout` is for files; `cin` is for the screen",
    ],
    correctIndex: 0,
  },
];
