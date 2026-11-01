'use strict';
/* LearnLoop content: concepts, lessons in several teaching styles, and misconception-tagged questions.
   Every wrong option explains WHY it is wrong and carries a misconception id (m), so the app can remember it. */

const MIS = {
  'str-plus': 'Thinks + adds text like numbers (it joins text)',
  'input-str': 'Forgets that input() always returns text',
  'div-vs-floor': 'Mixes up / (decimal division) and // (whole-number division)',
  'precedence': 'Ignores operator precedence (division before addition)',
  'assign-eq': 'Confuses = (assign) with == (compare)',
  'if-chain': 'Thinks separate if statements exclude each other (use elif)',
  'boundary': 'Off by one at a boundary (> vs >=)',
  'range-end': 'Thinks range() includes its end value',
  'zero-index': 'Counts list positions from 1 instead of 0',
  'append-none': 'Expects append() to return the list (it returns None)',
  'slice-end': 'Thinks a slice includes its end index',
  'return-print': 'Confuses printing a value with returning it',
  'scope-copy': 'Expects a function to change the caller\'s variable',
  'sql-quotes': 'Forgets quotes around text values in SQL',
  'sql-comma': 'Leaves out the comma between columns',
  'sql-where-agg': 'Uses an aggregate (COUNT, AVG...) inside WHERE instead of HAVING',
  'sql-group': 'Forgets GROUP BY when mixing a column with an aggregate',
  'sql-and-or': 'Mixes up AND and OR',
  'sql-cross': 'Forgets the join condition (creates every possible pairing)',
  'sql-where-having': 'Mixes up WHERE (filters rows) and HAVING (filters groups)',
  'sql-strict': 'Misreads > as ">="',
};

const SQL_SEED = `CREATE TABLE student (roll INT PRIMARY KEY, name VARCHAR(20), marks INT, city VARCHAR(15));
INSERT INTO student VALUES (1,'Aarav',92,'Delhi'),(2,'Diya',85,'Mumbai'),(3,'Kabir',67,'Delhi'),(4,'Meera',78,'Pune'),(5,'Rohan',54,'Mumbai'),(6,'Sana',88,'Delhi');
CREATE TABLE club (roll INT, club VARCHAR(15));
INSERT INTO club VALUES (1,'Chess'),(1,'Coding'),(2,'Dance'),(4,'Chess');`;

const o = (t, why, m) => ({t, ok: false, why, m});          // wrong option
const ok = (t, why) => ({t, ok: true, why});                // right option

const CONCEPTS = [
  /* ============================ PYTHON ============================ */
  {id: 'py-vars', subject: 'python', title: 'Variables and data types', blurb: 'Names, values, and why "5" is not 5',
   lesson: {
     beginner: 'A variable is a name that points to a value. Writing age = 17 makes the name age point to 17. Every value has a type: int (whole numbers), float (decimals), str (text) and bool (True or False). The type decides what an operator does: + adds two numbers, but it joins two pieces of text.',
     real: 'Think of a variable as a labelled box. The label (the name) stays on the box, but you can swap what is inside. The type is the kind of thing inside. "5" in quotes is the digit written on paper, just text. 5 without quotes is a number you can calculate with. Paper digits can be stuck together ("5" + "3" makes "53"), but only numbers can be added.',
     code: 'x = 5          # int\ny = "5"        # str, the text \'5\'\nprint(x + 2)   # 7\nprint(y + "2") # 52  (text is joined)\nprint(type(x), type(y))',
     exam: 'Key points: Python is dynamically typed. int(), float() and str() convert between types. input() always returns a str, so convert it before doing maths. Operators: / true division (7/2 = 3.5), // floor division (7//2 = 3), % remainder (7%2 = 1), ** power.'},
   check: {q: 'What does print("5" + "3") display?', opts: [
     o('8', 'The quotes make these two pieces of text, not numbers. + on text joins them; it does not add.', 'str-plus'),
     ok('53', 'Both values are strings, so + joins them: "5" followed by "3".'),
     o('"5" + "3"', 'print shows the value of the expression, not the code you wrote.'),
     o('An error', 'Adding two strings is allowed in Python. Only mixing a string and a number causes an error.')]},
   bug: {lvl: 1, q: 'This program should let a user who is 18 or older vote. What goes wrong?',
     code: 'age = input("Enter your age: ")\nif age >= 18:\n    print("You can vote")', opts: [
     o('>= cannot be used in an if statement', '>= is a normal comparison operator and works fine in if.', null),
     ok('input() returns text, so Python tries to compare a string with a number and raises a TypeError', 'Fix it by converting first: age = int(input(...)).'),
     o('The colon after the if line is missing', 'The colon is there. Check line 2 again.', null),
     o('print needs two arguments', 'print works with one argument. It is not the problem.', null)]},
   predict: {lvl: 1, q: 'What does this program print?', code: 'a = 7\nb = 2\nprint(a // b, a % b)', answer: '3 1',
     wrong: [{ans: '3.5 1', why: '// is floor division: it drops the fraction, so 7 // 2 is 3. Only / gives 3.5.', m: 'div-vs-floor'}, {ans: '3.5 1.0', why: '// gives a whole number (3) and % gives the remainder (1).', m: 'div-vs-floor'}],
     explain: '7 // 2 = 3 (how many whole 2s fit in 7) and 7 % 2 = 1 (what is left over). print shows both separated by a space.'},
   fix: {lvl: 2, q: 'average(a, b) should return the average of two numbers, but average(4, 6) returns 7.0. Fix the function.',
     starter: 'def average(a, b):\n    return a + b / 2',
     tests: [{call: 'print(average(4, 6))', expect: '5.0'}, {call: 'print(average(10, 20))', expect: '15.0'}],
     solution: 'def average(a, b):\n    return (a + b) / 2',
     hints: ['Which runs first in a + b / 2: the + or the /?', 'Division happens before addition, so only b is halved.', 'Put the sum in brackets before dividing.'],
     explainErr: {m: 'precedence', text: 'Python does / before +, so b / 2 was calculated first and then a was added. Brackets force the addition to happen first.'}}},

  {id: 'py-cond', subject: 'python', title: 'Conditions (if / elif / else)', blurb: 'Making decisions, and choosing only one branch',
   lesson: {
     beginner: 'A condition is a question with a True or False answer. if runs its indented block only when the answer is True. elif ("else if") is asked only when every earlier question was False, and else runs when nothing matched. Use == to compare and = to store a value.',
     real: 'Imagine a bouncer reading a list top to bottom: "Are you on the VIP list? Come in. No? Are you on the guest list? Come in. No? Sorry." Once you are let in, the bouncer stops reading. That is if / elif / else: the first matching branch wins and the rest are skipped.',
     code: 'marks = 72\nif marks >= 90:\n    print("A")\nelif marks >= 60:\n    print("B")   # runs\nelse:\n    print("C")',
     exam: 'Key points: comparison operators ==, !=, <, >, <=, >=. Logical operators and, or, not. Only one branch of an if-elif-else chain runs. Indentation defines the block. = assigns, == compares.'},
   check: {q: 'Which line correctly checks whether x equals 5?', opts: [
     o('if x = 5:', 'A single = stores a value. Python reports a SyntaxError here. Use == to compare.', 'assign-eq'),
     ok('if x == 5:', 'Two equals signs compare the values and give True or False.'),
     o('if x === 5:', '=== belongs to JavaScript. Python only has ==.', 'assign-eq'),
     o('if (x equals 5):', 'Python has no equals keyword. Use the == operator.', null)]},
   bug: {lvl: 1, q: 'The programmer wants only ONE grade printed, but for marks = 72 this prints both B and C. Why?',
     code: 'marks = 72\nif marks >= 90:\n    print("A")\nif marks >= 60:\n    print("B")\nif marks >= 40:\n    print("C")', opts: [
     ok('Each if is checked independently. Using elif for the later checks makes Python stop after the first match', 'With elif, once "B" matches, the "C" test is never reached.'),
     o('>= is not valid in Python', '>= is valid. The comparisons are fine.', null),
     o('marks must be written in quotes', 'Quotes would turn 72 into text and break the comparison.', null),
     o('Python only runs the last if', 'Python runs every if that is True. That is exactly why two lines were printed.', 'if-chain')]},
   predict: {lvl: 1, q: 'What does this program print?', code: 'n = 15\nif n % 3 == 0:\n    print("Fizz")\nelif n % 5 == 0:\n    print("Buzz")\nelse:\n    print(n)', answer: 'Fizz',
     wrong: [{ans: 'FizzBuzz', why: 'elif is only checked when the if above it was False. 15 % 3 == 0 is True, so "Fizz" prints and the elif is skipped.', m: 'if-chain'}, {ans: 'Buzz', why: 'The first condition (15 % 3 == 0) is True, so that branch wins and the rest are skipped.', m: 'if-chain'}],
     explain: '15 % 3 is 0, so the first condition is True and "Fizz" prints. The elif and else are skipped even though 15 is also divisible by 5.'},
   fix: {lvl: 2, q: 'grade(40) should return "Pass" (40 or more passes), but it returns "Fail". Fix the function.',
     starter: 'def grade(m):\n    if m > 40:\n        return "Pass"\n    else:\n        return "Fail"',
     tests: [{call: 'print(grade(40))', expect: 'Pass'}, {call: 'print(grade(39))', expect: 'Fail'}, {call: 'print(grade(75))', expect: 'Pass'}],
     solution: 'def grade(m):\n    if m >= 40:\n        return "Pass"\n    else:\n        return "Fail"',
     hints: ['Test the exact boundary value: what happens at 40?', '> means strictly greater than, so 40 does not qualify.', 'Use >= so that 40 passes too.'],
     explainErr: {m: 'boundary', text: '40 > 40 is False, so exactly 40 fell into the else branch. Boundary values are the most common place for mistakes. Always test them.'}}},

  {id: 'py-loops', subject: 'python', title: 'Loops (for and range)', blurb: 'Repeating work, and where range() stops',
   lesson: {
     beginner: 'A for loop repeats a block once for each value in a sequence. range(n) gives the numbers 0 up to n - 1. range(a, b) gives a up to b - 1. The end value is never included.',
     real: 'range(1, 5) is like a staircase you stand on step 1 and walk up until you reach step 5, but you must stop BEFORE stepping on 5. So you visit 1, 2, 3, 4. Fence posts work the same way: the last number is the gate, not a post.',
     code: 'for i in range(3):\n    print(i)      # 0, 1, 2\n\nfor i in range(1, 4):\n    print(i)      # 1, 2, 3',
     exam: 'Key points: range(stop), range(start, stop), range(start, stop, step). The stop value is excluded. A while loop repeats while its condition is True and needs something inside that eventually makes it False. break exits a loop, continue skips to the next round.'},
   check: {q: 'What does for i in range(3): print(i) print?', opts: [
     o('1  2  3', 'range(3) starts at 0 by default, not 1.', 'range-end'),
     ok('0  1  2', 'range(3) produces 0, 1 and 2: three numbers, starting at 0, stopping before 3.'),
     o('0  1  2  3', 'The stop value (3) is never included in range().', 'range-end'),
     o('1  2', 'range(3) does not skip 0, and it produces three values, not two.', null)]},
   bug: {lvl: 1, q: 'This loop should print the numbers 1 to 5, but it stops at 4. Why?', code: 'for i in range(1, 5):\n    print(i)', opts: [
     ok('range() stops before its end value, so range(1, 5) ends at 4. Use range(1, 6)', 'The end value is excluded.'),
     o('range always starts at 0', 'range(1, 5) starts at 1 because a start value was given.', null),
     o('print inside a loop only runs once', 'print runs once per round, which is four times here.', null),
     o('i cannot hold the value 5', 'i can hold 5. range(1, 6) would give it 5.', 'range-end')]},
   predict: {lvl: 1, q: 'What does this program print?', code: 'total = 0\nfor i in range(1, 4):\n    total += i\nprint(total)', answer: '6',
     wrong: [{ans: '10', why: 'range(1, 4) gives 1, 2, 3, so 4 is never added. 1 + 2 + 3 = 6.', m: 'range-end'}, {ans: '3', why: 'total keeps growing in every round (total += i); it is not reset. 1 + 2 + 3 = 6.', m: null}],
     explain: 'range(1, 4) gives 1, 2, 3. total goes 0 → 1 → 3 → 6.'},
   fix: {lvl: 2, q: 'sum_to(n) should return 1 + 2 + ... + n, but sum_to(4) returns 6 instead of 10. Fix the function.',
     starter: 'def sum_to(n):\n    total = 0\n    for i in range(1, n):\n        total += i\n    return total',
     tests: [{call: 'print(sum_to(4))', expect: '10'}, {call: 'print(sum_to(1))', expect: '1'}, {call: 'print(sum_to(0))', expect: '0'}],
     solution: 'def sum_to(n):\n    total = 0\n    for i in range(1, n + 1):\n        total += i\n    return total',
     hints: ['Which numbers does range(1, n) produce when n is 4?', 'The stop value is excluded, so n itself is never added.', 'The stop value must be n + 1.'],
     explainErr: {m: 'range-end', text: 'range(1, n) stops at n - 1, so n was never added. To include n, the stop value has to be n + 1.'}}},

  {id: 'py-lists', subject: 'python', title: 'Lists and indexing', blurb: 'Positions start at 0, and slices stop early',
   lesson: {
     beginner: 'A list stores several values in order: nums = [10, 20, 30]. Each value has a position called an index, and the first index is 0. nums[1] is 20. A negative index counts from the end: nums[-1] is the last item. A slice nums[a:b] takes items from index a up to, but not including, index b.',
     real: 'Think of a row of lockers numbered from 0. The first locker is number 0, not 1. nums[-1] means "the last locker" without counting. A slice [1:3] is like saying "give me lockers 1 and 2, and stop when you reach 3".',
     code: 'letters = ["a", "b", "c", "d"]\nprint(letters[0])     # a\nprint(letters[-1])    # d\nprint(letters[1:3])   # [\'b\', \'c\']\nletters.append("e")   # changes the list itself',
     exam: 'Key points: indexing from 0, negative indexes, slicing [start:stop:step] with stop excluded, len(). Lists are mutable. append(), insert(), remove(), pop() change the list in place and return None (pop returns the removed item). IndexError happens when an index is out of range.'},
   check: {q: 'nums = [10, 20, 30]. What does print(nums[1]) display?', opts: [
     o('10', 'Index 0 is the first item (10). Index 1 is the second.', 'zero-index'),
     ok('20', 'Indexes start at 0, so nums[1] is the second item.'),
     o('30', 'That would be nums[2] (or nums[-1]).', 'zero-index'),
     o('An error', 'Index 1 exists in a 3-item list, so there is no error.', null)]},
   bug: {lvl: 2, q: 'What does this program print, and why?', code: 'nums = [3, 1, 2]\nnums = nums.append(4)\nprint(nums)', opts: [
     o('[3, 1, 2, 4]', 'append changes the list in place and returns None. The assignment then overwrites nums with None.', 'append-none'),
     ok('None. append() changes the list but returns None, and that None replaced nums', 'Just call nums.append(4) on its own line, without assigning it.'),
     o('An error because lists have no append method', 'Lists do have append. The program runs without an error.', null),
     o('[4]', 'append adds to the existing list; it never creates a list holding only the new item.', 'append-none')]},
   predict: {lvl: 1, q: 'What does this program print?', code: 'letters = ["a", "b", "c", "d"]\nprint(letters[1:3])', answer: "['b', 'c']",
     wrong: [{ans: "['a', 'b', 'c']", why: 'Slices start at the first index given (1), not at 0. So the slice begins at "b".', m: 'zero-index'}, {ans: "['b', 'c', 'd']", why: 'The stop index (3) is excluded, so "d" (index 3) is left out.', m: 'slice-end'}],
     explain: 'letters[1:3] takes index 1 ("b") and index 2 ("c"), and stops before index 3.'},
   fix: {lvl: 2, q: 'last_item(lst) should return the last element, but it crashes with an IndexError. Fix the function.',
     starter: 'def last_item(lst):\n    return lst[len(lst)]',
     tests: [{call: 'print(last_item([4, 5, 6]))', expect: '6'}, {call: 'print(last_item(["x"]))', expect: 'x'}],
     solution: 'def last_item(lst):\n    return lst[-1]',
     hints: ['If a list has 3 items, which indexes exist?', 'The valid indexes are 0, 1, 2. Index len(lst) is one past the end.', 'Use len(lst) - 1, or the negative index -1.'],
     explainErr: {m: 'zero-index', text: 'A list of length n has indexes 0 to n - 1. lst[len(lst)] points one position past the end, which raises IndexError. lst[-1] is the safe way to read the last item.'}}},

  {id: 'py-funcs', subject: 'python', title: 'Functions and return', blurb: 'Printing is not the same as returning',
   lesson: {
     beginner: 'A function is a named block of code you can reuse. def add(a, b): defines it, and add(2, 3) calls it. return sends a value back to the code that called the function. print only shows text on the screen. A function with no return gives back None.',
     real: 'A function is like a vending machine. You put in coins (the arguments) and the machine returns a snack. Printing is like the machine reading out "this is a cola" without actually handing it over. You can only use the snack in your hand, and that is the returned value.',
     code: 'def add(a, b):\n    return a + b\n\nresult = add(2, 3)   # result is 5\nprint(result * 2)    # 10',
     exam: 'Key points: parameters vs arguments, return values, default arguments, local vs global scope. A function without a return statement returns None. Changing a parameter inside a function does not change an int or string variable outside it.'},
   check: {q: 'Which keyword sends a value from a function back to the code that called it?', opts: [
     o('print', 'print only displays text. The calling code receives nothing from it.', 'return-print'),
     ok('return', 'return hands a value back so the caller can store or use it.'),
     o('yield', 'yield belongs to generators. It is not the basic way to give back one value.', null),
     o('output', 'Python has no output keyword.', null)]},
   bug: {lvl: 2, q: 'What happens when this program runs?', code: 'def add(a, b):\n    print(a + b)\n\nresult = add(2, 3)\nprint(result * 2)', opts: [
     o('It prints 5 and then 10', 'add prints 5, but it does not return anything, so result is None, and None * 2 is not 10.', 'return-print'),
     ok('It prints 5, then raises a TypeError, because add returns None and None * 2 is not allowed', 'Replace print(a + b) with return a + b.'),
     o('It prints nothing', 'add(2, 3) does print 5 before the error occurs.', null),
     o('NameError: result is not defined', 'result is defined. It is assigned the value None.', null)]},
   predict: {lvl: 2, q: 'What does this program print?', code: 'def double(x):\n    x = x * 2\n    return x\n\nn = 5\ndouble(n)\nprint(n)', answer: '5',
     wrong: [{ans: '10', why: 'double(n) returns 10 but the result was thrown away, and the n outside is a separate variable. n is still 5.', m: 'scope-copy'}],
     explain: 'x inside the function is a separate name. The returned 10 was not stored anywhere, so n still holds 5.'},
   fix: {lvl: 2, q: 'is_even(4) should return True, but it returns None. Fix the function.',
     starter: 'def is_even(n):\n    n % 2 == 0',
     tests: [{call: 'print(is_even(4))', expect: 'True'}, {call: 'print(is_even(7))', expect: 'False'}],
     solution: 'def is_even(n):\n    return n % 2 == 0',
     hints: ['What does a function give back when it has no return?', 'The comparison is calculated and then thrown away.', 'Put return in front of the expression.'],
     explainErr: {m: 'return-print', text: 'The comparison n % 2 == 0 was calculated but never returned, so the function gave back None. A value only leaves a function through return.'}}},

  /* ============================ SQL ============================ */
  {id: 'sql-where', subject: 'sql', title: 'SELECT and WHERE', blurb: 'Choosing columns and filtering rows',
   lesson: {
     beginner: 'SELECT chooses which columns to show, FROM names the table, and WHERE keeps only the rows that match a condition. Text values must be in quotes: WHERE city = \'Delhi\'. Several columns are separated by commas.',
     real: 'A table is like a spreadsheet. SELECT picks the columns you want to look at, like hiding the other columns. WHERE is the filter button: it hides every row that does not match. Quotes tell SQL "this is a word to match", not "this is the name of a column".',
     code: "SELECT name, marks\nFROM student\nWHERE city = 'Delhi' AND marks > 80;",
     exam: 'Key points: SELECT * for all columns, DISTINCT removes duplicates, comparison operators = != < > <= >=, logical AND OR NOT, BETWEEN, IN, LIKE with % and _, IS NULL (never = NULL). Clause order: SELECT, FROM, WHERE, GROUP BY, HAVING, ORDER BY.'},
   check: {q: 'Which query lists the names of students who live in Delhi?', opts: [
     o("SELECT name FROM student WHERE city = Delhi;", 'Without quotes, SQL reads Delhi as the name of a column and fails. Text values need quotes.', 'sql-quotes'),
     ok("SELECT name FROM student WHERE city = 'Delhi';", 'The quotes mark Delhi as a text value to match.'),
     o("SELECT name FROM student city = 'Delhi';", 'The WHERE keyword is missing, so SQL does not know this is a filter.', null),
     o("SELECT name WHERE city = 'Delhi' FROM student;", 'Clauses must come in order: FROM comes before WHERE.', null)]},
   bug: {lvl: 1, q: 'This query fails. Why?', code: 'SELECT name marks FROM student;', opts: [
     o('marks is a reserved word', 'marks is an ordinary column name here.', null),
     ok('The comma between the two column names is missing', 'Columns in SELECT are separated by commas: SELECT name, marks.'),
     o('FROM must come first', 'SELECT always comes first. FROM comes after the column list.', null),
     o('A WHERE clause is mandatory', 'WHERE is optional. Without it, you get every row.', null)]},
   predict: {lvl: 1, q: 'How many rows does this query return?', code: 'SELECT name FROM student WHERE marks > 80;', db: true, kind: 'rowcount',
     explain: 'Marks above 80 are 92 (Aarav), 85 (Diya) and 88 (Sana). > is strictly greater, so a mark of exactly 80 would not qualify.', m: 'sql-strict'},
   fix: {lvl: 2, q: 'List the names of students who live in Delhi AND scored more than 80. Right now the query returns too many rows. Fix it.', db: true,
     starter: "SELECT name FROM student WHERE city = 'Delhi' OR marks > 80;",
     solution: "SELECT name FROM student WHERE city = 'Delhi' AND marks > 80;",
     hints: ['Compare the rows you get with the rows you want: which extra students appear?', 'OR keeps a row if EITHER condition is true. You need both.', 'Replace OR with AND.'],
     explainErr: {m: 'sql-and-or', text: 'OR keeps a row when either condition is true, so Diya (85, Mumbai) and Kabir (Delhi, 67) slipped in. AND requires both conditions to hold.'}}},

  {id: 'sql-agg', subject: 'sql', title: 'Aggregates and GROUP BY', blurb: 'COUNT, AVG and summarising groups',
   lesson: {
     beginner: 'Aggregate functions (COUNT, SUM, AVG, MIN, MAX) squash many rows into one value. GROUP BY makes one result row for each distinct value of a column. WHERE filters rows BEFORE grouping. HAVING filters the groups AFTER they are formed.',
     real: 'Imagine sorting class results into piles, one pile per city. GROUP BY makes the piles. COUNT(*) counts the papers in each pile. WHERE is a rule for what is allowed to enter a pile; HAVING is a rule about which finished piles to keep, such as "only piles with more than one paper".',
     code: 'SELECT city, COUNT(*) AS students, AVG(marks)\nFROM student\nGROUP BY city\nHAVING COUNT(*) > 1;',
     exam: 'Key points: aggregate functions ignore NULLs (except COUNT(*)). Every non-aggregated column in SELECT must appear in GROUP BY. WHERE cannot contain aggregate functions; use HAVING. Clause order: WHERE, GROUP BY, HAVING, ORDER BY.'},
   check: {q: 'Which clause filters groups AFTER GROUP BY has formed them?', opts: [
     o('WHERE', 'WHERE filters individual rows before they are grouped, so it cannot use group totals like COUNT(*).', 'sql-where-having'),
     ok('HAVING', 'HAVING is checked after grouping, so it can use aggregates such as COUNT(*) > 1.'),
     o('ORDER BY', 'ORDER BY only sorts the result. It does not remove anything.', null),
     o('LIMIT', 'LIMIT cuts the result to a fixed number of rows. It does not test a condition.', null)]},
   bug: {lvl: 2, q: 'This query is meant to show cities with more than one student, but it fails. Why?', code: 'SELECT city, COUNT(*)\nFROM student\nWHERE COUNT(*) > 1\nGROUP BY city;', opts: [
     ok('Aggregate functions are not allowed in WHERE. The condition belongs in HAVING, after GROUP BY', 'Write GROUP BY city HAVING COUNT(*) > 1.'),
     o('COUNT(*) must be written as COUNT(city)', 'Both forms are valid. That is not the cause.', null),
     o('GROUP BY must come before FROM', 'GROUP BY comes after FROM and WHERE.', null),
     o('There is no table called student', 'The table exists. The problem is the aggregate inside WHERE.', 'sql-where-agg')]},
   predict: {lvl: 2, q: 'How many rows does this query return?', code: 'SELECT city, COUNT(*) FROM student GROUP BY city;', db: true, kind: 'rowcount',
     explain: 'There are three different cities (Delhi, Mumbai, Pune), and GROUP BY returns one row per city, not one per student.', m: 'sql-group'},
   fix: {lvl: 3, q: 'Show each city with the average marks of its students. This query is missing something. Fix it.', db: true,
     starter: 'SELECT city, AVG(marks) FROM student;',
     solution: 'SELECT city, AVG(marks) FROM student GROUP BY city;',
     hints: ['You want one result row per city, not one row for the whole table.', 'Which clause creates one row per distinct value?', 'Add GROUP BY city at the end.'],
     explainErr: {m: 'sql-group', text: 'AVG(marks) squashes the whole table into a single value, so SQL cannot also show a separate city per row. GROUP BY city tells it to make one average per city.'}}},

  {id: 'sql-join', subject: 'sql', title: 'Joining tables', blurb: 'Matching rows across two tables',
   lesson: {
     beginner: 'A join combines rows from two tables. Listing two tables (FROM student, club) pairs EVERY row of the first with EVERY row of the second. To keep only the matching pairs, add a join condition such as WHERE student.roll = club.roll.',
     real: 'Imagine two lists: students and their clubs. Without a condition, SQL is like pairing every student with every club on the sheet, which gives silly combinations. The join condition is the shared roll number: it says "only pair a student with the clubs that have the same roll number".',
     code: 'SELECT name, club\nFROM student, club\nWHERE student.roll = club.roll;\n-- or: FROM student JOIN club ON student.roll = club.roll',
     exam: 'Key points: Cartesian product has rows1 x rows2 rows (degree = columns added together). Equi-join uses =. Natural join matches columns with the same name. Qualify shared column names with table.column. JOIN ... ON is the modern syntax.'},
   check: {q: 'SELECT * FROM student, club; has no join condition. What does it return?', opts: [
     o('Only the rows where the roll numbers match', 'Matching only happens when you add a condition such as WHERE student.roll = club.roll.', 'sql-cross'),
     ok('Every student row paired with every club row', 'With no condition, SQL returns the Cartesian product: all possible pairs.'),
     o('An error, because a condition is required', 'SQL allows it. It just returns far more rows than you probably want.', 'sql-cross'),
     o('No rows', 'The tables are not empty, so every combination is produced.', null)]},
   bug: {lvl: 2, q: 'This query returns far too many rows. Why?', code: 'SELECT name, club\nFROM student, club;', opts: [
     ok('There is no join condition, so every student is paired with every club (a Cartesian product)', 'Add WHERE student.roll = club.roll.'),
     o('club is a reserved word', 'club is just a table and column name here.', null),
     o('name and club must be in quotes', 'Column names are never put in quotes in a SELECT list.', null),
     o('SELECT cannot use two tables', 'SELECT can read from several tables. It needs a join condition to match them.', 'sql-cross')]},
   predict: {lvl: 2, q: 'How many rows does this query return?', code: 'SELECT * FROM student, club;', db: true, kind: 'rowcount',
     explain: 'There are 6 students and 4 club rows. A Cartesian product has 6 x 4 = 24 rows.', m: 'sql-cross'},
   fix: {lvl: 3, q: 'List each student name with the club they belong to. The query below returns far too many rows. Fix it.', db: true,
     starter: 'SELECT name, club FROM student, club;',
     solution: 'SELECT name, club FROM student, club WHERE student.roll = club.roll;',
     hints: ['Both tables have a roll column that identifies the same student.', 'Only keep the pairs where the two roll numbers are equal.', 'Add WHERE student.roll = club.roll.'],
     explainErr: {m: 'sql-cross', text: 'Without a condition, SQL pairs every student with every club (24 rows). Matching on the shared roll number keeps only the real memberships (4 rows).'}}},
];

const SUBJECTS = {python: {label: 'Python', icon: '🐍'}, sql: {label: 'SQL', icon: '🗄️'}};
const VARIANTS = [['beginner', 'Beginner'], ['real', 'Real-life example'], ['code', 'Code-based'], ['exam', 'Exam-oriented']];

if (typeof module !== 'undefined' && module.exports) module.exports = {CONCEPTS, MIS, SQL_SEED, SUBJECTS, VARIANTS};
