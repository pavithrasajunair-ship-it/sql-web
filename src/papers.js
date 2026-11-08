'use strict';
/* ===== Board-style practice papers =====
   Four timed papers written in the PATTERN of CBSE Class 12 SQL questions (MCQ, output / query writing, GROUP BY / JOIN / aggregate queries).
   Every question is ORIGINAL. These are NOT real past papers and must never be described as previous-year questions.
   All queries run on the same sample databases as the Lab; tests/papers.test.js runs every model answer and output in the SQL engine. */
const PAPER_MARKS = {a: 1, b: 2, c: 3};
const PAPER_SECS = 2400;
const PAPERS = [
  {id: 'bp1', title: 'Paper 1 · School database', db: 'school', blurb: 'student and club tables · GROUP BY, HAVING, joins',
    mcq: [
      {q: 'Which of the following is NOT an aggregate function?', opts: ['COUNT()', 'SUM()', 'ROUND()', 'MAX()'], correct: 2, exp: 'ROUND() works on one value at a time (a single-row function). COUNT, SUM and MAX work on a whole group of rows.'},
      {q: 'What is the output of SELECT MOD(17, 5);', opts: ['3', '2', '12', '0'], correct: 1, exp: 'MOD gives the remainder: 17 = 3 x 5 + 2, so the answer is 2.', v: {sql: 'SELECT MOD(17, 5)', val: 2}},
      {q: 'Which clause is used to put a condition on the groups formed by GROUP BY?', opts: ['WHERE', 'ORDER BY', 'HAVING', 'LIMIT'], correct: 2, exp: 'WHERE filters individual rows before grouping. HAVING filters the groups after grouping.'},
      {q: 'A column (or set of columns) that uniquely identifies every row and can never be NULL is the:', opts: ['Foreign key', 'Primary key', 'Candidate attribute', 'Alternate key'], correct: 1, exp: 'The primary key is unique and NOT NULL. A foreign key may repeat and may be NULL.'},
      {q: 'The student table has 10 rows and one student has NULL marks. What does SELECT COUNT(marks) FROM student; return?', opts: ['10', '8', '1', '9'], correct: 3, exp: 'COUNT(column) skips NULLs, so it counts 9 rows. COUNT(*) would count all 10.', v: {sql: 'SELECT COUNT(marks) FROM student', val: 9}},
      {q: 'Which statement adds a new column to an existing table?', opts: ['UPDATE ... ADD', 'ALTER TABLE ... ADD', 'INSERT COLUMN', 'CREATE COLUMN'], correct: 1, exp: 'Changing the structure of a table is DDL: ALTER TABLE table_name ADD column_name datatype.'},
    ],
    out: [
      {q: 'Write the output of the query.', sql: "SELECT city, COUNT(*) FROM student WHERE class = 12 GROUP BY city ORDER BY city",
        out: [['Chennai', 1], ['Delhi', 3], ['Mumbai', 1], ['Pune', 1]], exp: 'Only the six Class 12 students are grouped by city. Delhi has Aarav, Kabir and Yash.'},
      {q: 'Write the output of the query.', sql: "SELECT MAX(marks), MIN(marks), AVG(marks) FROM student WHERE section = 'A'",
        out: [[95, 54, 82.8]], exp: 'Section A marks are 92, 85, 54, 88, 95. Average = 414 / 5 = 82.8.'},
      {q: 'Write the output of the query.', sql: 'SELECT UPPER(LEFT(name, 3)), LENGTH(name) FROM student WHERE roll <= 3',
        out: [['AAR', 5], ['DIY', 4], ['KAB', 5]], exp: 'LEFT(name, 3) takes the first three letters, UPPER makes them capitals and LENGTH counts the letters of the full name.'},
    ],
    wr: [
      {task: 'Write a query to display the name and marks of Class 12 students who have scored between 70 and 90 (both included), highest marks first.', db: 'school', sol: 'SELECT name, marks FROM student WHERE class = 12 AND marks BETWEEN 70 AND 90 ORDER BY marks DESC', ordered: true,
        scheme: [{m: 1, d: 'SELECT name, marks FROM student with the correct WHERE condition on class and marks', re: /SELECT[\s\S]*FROM\s+student[\s\S]*WHERE[\s\S]*(BETWEEN|>=|>)/i}, {m: 1, d: 'ORDER BY marks DESC', re: /ORDER\s+BY\s+marks\s+DESC/i}]},
      {task: 'Write a query to display the names of students whose marks have not been recorded (marks is NULL).', db: 'school', sol: 'SELECT name FROM student WHERE marks IS NULL',
        scheme: [{m: 1, d: 'SELECT name FROM student', re: /SELECT\s+name\s+FROM\s+student/i}, {m: 1, d: 'WHERE marks IS NULL (= NULL never matches)', re: /WHERE\s+marks\s+IS\s+NULL/i}]},
    ],
    c: [
      {task: 'Write a query to display each class, the number of students in it and their average marks, only for classes whose average marks are more than 75.', db: 'school', sol: 'SELECT class, COUNT(*), AVG(marks) FROM student GROUP BY class HAVING AVG(marks) > 75',
        scheme: [{m: 1, d: 'SELECT list with class, COUNT(*) and AVG(marks) from student', re: /SELECT[\s\S]*COUNT\s*\([\s\S]*AVG\s*\(\s*marks\s*\)[\s\S]*FROM\s+student/i}, {m: 1, d: 'GROUP BY class', re: /GROUP\s+BY\s+class/i}, {m: 1, d: 'HAVING AVG(marks) > 75 (not WHERE)', re: /HAVING[\s\S]*AVG\s*\(\s*marks\s*\)\s*>\s*75/i}]},
      {task: 'Write a query to display the name of each student along with the club(s) joined. Students who have joined no club need not be shown.', db: 'school', sol: 'SELECT student.name, club.club FROM student, club WHERE student.roll = club.roll',
        scheme: [{m: 1, d: 'Both tables named in FROM (student and club)', re: /FROM[\s\S]*student[\s\S]*club|FROM[\s\S]*club[\s\S]*student/i}, {m: 1, d: 'Join condition on roll (student.roll = club.roll, in WHERE or ON)', re: /roll\s*=\s*\w*\.?roll/i}, {m: 1, d: 'Correct columns: student name and club name', re: /SELECT[\s\S]*name[\s\S]*club/i}]},
      {task: 'Write a query to display each club and the number of Class 12 students who belong to it.', db: 'school', sol: 'SELECT club.club, COUNT(*) FROM student JOIN club ON student.roll = club.roll WHERE student.class = 12 GROUP BY club.club',
        scheme: [{m: 1, d: 'Join of student and club on roll', re: /roll\s*=\s*\w*\.?roll/i}, {m: 1, d: 'WHERE class = 12 (filter rows before grouping)', re: /WHERE[\s\S]*class\s*=\s*12/i}, {m: 1, d: 'GROUP BY club with COUNT(*)', re: /COUNT\s*\([\s\S]*GROUP\s+BY[\s\S]*club/i}]},
    ]},

  {id: 'bp2', title: 'Paper 2 · Company database', db: 'company', blurb: 'emp and dept tables · UPDATE, aggregates, joins',
    mcq: [
      {q: 'Which of the following is a DDL command?', opts: ['UPDATE', 'INSERT', 'ALTER', 'DELETE'], correct: 2, exp: 'DDL (Data Definition Language) commands define structure: CREATE, ALTER, DROP. UPDATE, INSERT and DELETE are DML.'},
      {q: 'What is the output of SELECT ROUND(278.538, 1);', opts: ['278.6', '278.5', '279', '278.54'], correct: 1, exp: 'ROUND(x, 1) keeps one decimal place. 278.538 becomes 278.5 because the next digit (3) is less than 5.', v: {sql: 'SELECT ROUND(278.538, 1)', val: 278.5}},
      {q: 'Which operator is used to match text with the wildcards % and _ ?', opts: ['IN', 'BETWEEN', 'LIKE', 'IS'], correct: 2, exp: "LIKE with % (any number of characters) and _ (exactly one character), for example name LIKE 'A%'."},
      {q: 'The dept column of the emp table refers to the primary key of the dept table. In emp, dept is a:', opts: ['Primary key', 'Foreign key', 'Unique key', 'Composite key'], correct: 1, exp: 'A column that refers to the primary key of another table is a foreign key.'},
      {q: 'The emp table has 8 rows and one salary is NULL. What does SELECT COUNT(*), COUNT(salary) FROM emp; display?', opts: ['8 and 8', '7 and 8', '8 and 7', '7 and 7'], correct: 2, exp: 'COUNT(*) counts every row (8). COUNT(salary) ignores the NULL salary (7).', v: {sql: 'SELECT COUNT(*), COUNT(salary) FROM emp', val: [8, 7]}},
      {q: 'Which is the correct order of clauses in a SELECT statement?', opts: ['SELECT, FROM, WHERE, GROUP BY, HAVING, ORDER BY', 'SELECT, FROM, GROUP BY, WHERE, HAVING, ORDER BY', 'SELECT, WHERE, FROM, GROUP BY, ORDER BY, HAVING', 'SELECT, FROM, WHERE, HAVING, GROUP BY, ORDER BY'], correct: 0, exp: 'WHERE comes before GROUP BY, HAVING after it, and ORDER BY is always last.'},
    ],
    out: [
      {q: 'Write the output of the query.', sql: 'SELECT dept, COUNT(*), SUM(salary) FROM emp GROUP BY dept ORDER BY dept',
        out: [['HR', 2, 92000], ['IT', 3, 238000], ['Sales', 3, 110000]], exp: 'SUM ignores the NULL salary of Sameer, so Sales is 52000 + 58000 = 110000, but COUNT(*) still counts him (3).'},
      {q: 'Write the output of the query.', sql: "SELECT name, YEAR(joined) FROM emp WHERE city = 'Delhi' ORDER BY joined",
        out: [['Neha', 2019], ['Rahul', 2021], ['Sameer', 2023]], exp: 'Three employees live in Delhi. They are listed from the earliest joining date.'},
      {q: 'Write the output of the query.', sql: 'SELECT DISTINCT dept FROM emp WHERE salary > 50000 ORDER BY dept',
        out: [['IT'], ['Sales']], exp: 'HR salaries are below 50000. IT and Sales each appear once because of DISTINCT.'},
    ],
    wr: [
      {task: "Write a query to display the names of employees whose name ends with the letter 'a'.", db: 'company', sol: "SELECT name FROM emp WHERE name LIKE '%a'",
        scheme: [{m: 1, d: 'SELECT name FROM emp', re: /SELECT\s+name\s+FROM\s+emp/i}, {m: 1, d: "WHERE name LIKE '%a' (the % comes before the letter)", re: /LIKE\s*['"]%a['"]/i}]},
      {task: 'Write a statement to increase the salary of all employees of the Sales department by 10%.', db: 'company', check: 'SELECT empid, salary FROM emp ORDER BY empid',
        sol: "UPDATE emp SET salary = salary * 1.1 WHERE dept = 'Sales'",
        scheme: [{m: 1, d: 'UPDATE emp SET salary = salary * 1.1 (or salary + salary * 10 / 100)', re: /UPDATE\s+emp\s+SET\s+salary\s*=\s*salary\s*(\*|\+)/i}, {m: 1, d: "WHERE dept = 'Sales' so only that department changes", re: /WHERE\s+dept\s*=\s*['"]Sales['"]/i}]},
    ],
    c: [
      {task: 'Write a query to display, for each department that has 3 or more employees, the department name with the highest and the lowest salary.', db: 'company', sol: 'SELECT dept, MAX(salary), MIN(salary) FROM emp GROUP BY dept HAVING COUNT(*) >= 3',
        scheme: [{m: 1, d: 'SELECT dept, MAX(salary), MIN(salary) FROM emp', re: /SELECT[\s\S]*MAX\s*\(\s*salary\s*\)[\s\S]*MIN\s*\(\s*salary\s*\)[\s\S]*FROM\s+emp/i}, {m: 1, d: 'GROUP BY dept', re: /GROUP\s+BY\s+dept/i}, {m: 1, d: 'HAVING COUNT(*) >= 3', re: /HAVING[\s\S]*COUNT\s*\([\s\S]*(>=\s*3|>\s*2)/i}]},
      {task: "Write a query to display the name of each employee along with the name of the head of the employee's department.", db: 'company', sol: 'SELECT emp.name, dept.head FROM emp, dept WHERE emp.dept = dept.dept',
        scheme: [{m: 1, d: 'Both tables in FROM (emp and dept)', re: /FROM[\s\S]*emp[\s\S]*dept|FROM[\s\S]*dept[\s\S]*emp|NATURAL\s+JOIN/i}, {m: 1, d: 'Join condition emp.dept = dept.dept (or NATURAL JOIN)', re: /dept\s*=\s*\w*\.?dept|NATURAL\s+JOIN/i}, {m: 1, d: 'Correct columns: employee name and head', re: /SELECT[\s\S]*name[\s\S]*head/i}]},
      {task: 'Write a query to display each department head and the total salary of his or her department, with the largest total first.', db: 'company', sol: 'SELECT dept.head, SUM(emp.salary) FROM emp JOIN dept ON emp.dept = dept.dept GROUP BY dept.head ORDER BY SUM(emp.salary) DESC', ordered: true,
        scheme: [{m: 1, d: 'Join of emp and dept on dept', re: /dept\s*=\s*\w*\.?dept|NATURAL\s+JOIN/i}, {m: 1, d: 'SUM(salary) with GROUP BY head', re: /SUM\s*\([\s\S]*GROUP\s+BY[\s\S]*head/i}, {m: 1, d: 'ORDER BY the total in descending order', re: /ORDER\s+BY[\s\S]*DESC/i}]},
    ]},

  {id: 'bp3', title: 'Paper 3 · Shop database', db: 'shop', blurb: 'product and orders tables · IN, BETWEEN, joins with calculations',
    mcq: [
      {q: 'Which command removes a table, its structure and all its data, from the database?', opts: ['DELETE', 'DROP TABLE', 'REMOVE TABLE', 'ALTER TABLE'], correct: 1, exp: 'DROP TABLE removes the table completely. DELETE only removes rows.'},
      {q: 'What does the keyword DISTINCT do in a SELECT query?', opts: ['Sorts the rows', 'Removes duplicate rows from the result', 'Counts the rows', 'Joins two tables'], correct: 1, exp: 'DISTINCT shows each different value (or row) only once.'},
      {q: 'What is the output of SELECT POWER(2, 5);', opts: ['10', '25', '7', '32'], correct: 3, exp: 'POWER(2, 5) = 2 x 2 x 2 x 2 x 2 = 32.', v: {sql: 'SELECT POWER(2, 5)', val: 32}},
      {q: 'Table X has 4 rows and 3 columns. Table Y has 5 rows and 2 columns. How many rows and columns are in the Cartesian product X x Y?', opts: ['9 rows, 5 columns', '20 rows, 5 columns', '20 rows, 6 columns', '9 rows, 6 columns'], correct: 1, exp: 'Rows multiply (4 x 5 = 20) and columns add (3 + 2 = 5).'},
      {q: 'How many different categories are returned by SELECT COUNT(DISTINCT category) FROM product;', opts: ['4', '8', '3', '5'], correct: 0, exp: 'The categories are Stationery, Bags, Home and Electronics: 4 different values.', v: {sql: 'SELECT COUNT(DISTINCT category) FROM product', val: 4}},
      {q: 'Which statement about NULL is correct?', opts: ['NULL is the same as 0', 'NULL is the same as an empty string', 'NULL is tested with IS NULL', 'WHERE col = NULL finds the NULL rows'], correct: 2, exp: 'NULL means "unknown / no value". It is never equal to anything, so use IS NULL or IS NOT NULL.'},
    ],
    out: [
      {q: 'Write the output of the query.', sql: 'SELECT category, SUM(stock) FROM product GROUP BY category ORDER BY category',
        out: [['Bags', 15], ['Electronics', 93], ['Home', 40], ['Stationery', 320]], exp: 'Electronics: 8 + 25 + 60 = 93. Stationery: 120 + 200 = 320.'},
      {q: 'Write the output of the query.', sql: 'SELECT pname, price * 2 FROM product WHERE stock < 10',
        out: [['Water Bottle', 398], ['Headphones', 1998]], exp: 'Only Water Bottle (stock 0) and Headphones (stock 8) have stock below 10. The price is doubled in the output.'},
      {q: 'Write the output of the query.', sql: 'SELECT customer, SUM(qty) FROM orders GROUP BY customer ORDER BY SUM(qty) DESC',
        out: [['Asha', 16], ['Meena', 6], ['Ravi', 4], ['Kabir', 1]], exp: 'Asha ordered 5 + 10 + 1 = 16 items. Rows are sorted by the total, largest first.'},
    ],
    wr: [
      {task: "Write a query to display the names of products that belong to the category 'Home' or 'Bags'.", db: 'shop', sol: "SELECT pname FROM product WHERE category IN ('Home', 'Bags')",
        scheme: [{m: 1, d: 'SELECT pname FROM product', re: /SELECT\s+pname\s+FROM\s+product/i}, {m: 1, d: "WHERE category IN ('Home', 'Bags') (or two conditions joined with OR)", re: /WHERE[\s\S]*(\bIN\s*\(|\bOR\b)/i}]},
      {task: 'Write a query to display the order id and customer of the orders placed between 2026-10-02 and 2026-10-05 (both dates included).', db: 'shop', sol: "SELECT oid, customer FROM orders WHERE odate BETWEEN '2026-10-02' AND '2026-10-05'",
        scheme: [{m: 1, d: 'SELECT oid, customer FROM orders', re: /SELECT\s+oid\s*,\s*customer\s+FROM\s+orders/i}, {m: 1, d: "WHERE odate BETWEEN '2026-10-02' AND '2026-10-05' (dates in quotes)", re: /WHERE\s+odate[\s\S]*(BETWEEN|>=)/i}]},
    ],
    c: [
      {task: 'Write a query to display each customer with the number of orders placed and the total quantity ordered, only for customers whose total quantity is more than 5.', db: 'shop', sol: 'SELECT customer, COUNT(*), SUM(qty) FROM orders GROUP BY customer HAVING SUM(qty) > 5',
        scheme: [{m: 1, d: 'SELECT customer, COUNT(*), SUM(qty) FROM orders', re: /SELECT[\s\S]*COUNT\s*\([\s\S]*SUM\s*\(\s*qty\s*\)[\s\S]*FROM\s+orders/i}, {m: 1, d: 'GROUP BY customer', re: /GROUP\s+BY\s+customer/i}, {m: 1, d: 'HAVING SUM(qty) > 5', re: /HAVING[\s\S]*SUM\s*\(\s*qty\s*\)\s*>\s*5/i}]},
      {task: 'Write a query to display the product name, customer and quantity for every order.', db: 'shop', sol: 'SELECT pname, customer, qty FROM product, orders WHERE product.pid = orders.pid',
        scheme: [{m: 1, d: 'Both tables in FROM (product and orders)', re: /FROM[\s\S]*product[\s\S]*orders|FROM[\s\S]*orders[\s\S]*product|NATURAL\s+JOIN/i}, {m: 1, d: 'Join condition on pid', re: /pid\s*=\s*\w*\.?pid|NATURAL\s+JOIN/i}, {m: 1, d: 'Correct columns: pname, customer, qty', re: /SELECT[\s\S]*pname[\s\S]*customer[\s\S]*qty/i}]},
      {task: 'Write a query to display each category and the total value of the orders placed for it (quantity multiplied by price, added up).', db: 'shop', sol: 'SELECT category, SUM(qty * price) FROM product JOIN orders ON product.pid = orders.pid GROUP BY category',
        scheme: [{m: 1, d: 'Join of product and orders on pid', re: /pid\s*=\s*\w*\.?pid|NATURAL\s+JOIN/i}, {m: 1, d: 'SUM(qty * price) as the aggregate', re: /SUM\s*\(\s*(qty\s*\*\s*price|price\s*\*\s*qty)\s*\)/i}, {m: 1, d: 'GROUP BY category', re: /GROUP\s+BY\s+category/i}]},
    ]},

  {id: 'bp4', title: 'Paper 4 · Library database', db: 'library', blurb: 'book and issue tables · NULL, DELETE, functions, joins',
    mcq: [
      {q: 'Which constraint makes sure that no two rows have the same value in a column, while still allowing NULL?', opts: ['PRIMARY KEY', 'NOT NULL', 'DEFAULT', 'UNIQUE'], correct: 3, exp: 'UNIQUE stops duplicates but permits NULL. PRIMARY KEY is unique and also NOT NULL.'},
      {q: "What is the output of SELECT MID('Computer', 4, 3);", opts: ['mpu', 'put', 'omp', 'ute'], correct: 1, exp: "MID(text, start, length) starts at position 4 ('p') and takes 3 characters: p, u, t.", v: {sql: "SELECT MID('Computer', 4, 3)", val: 'put'}},
      {q: 'The number of rows in a table (relation) is called its:', opts: ['Degree', 'Domain', 'Cardinality', 'Schema'], correct: 2, exp: 'Cardinality = number of rows (tuples). Degree = number of columns (attributes).'},
      {q: "What does SELECT DAYNAME('2026-08-01'); display?", opts: ['Friday', 'Sunday', 'Monday', 'Saturday'], correct: 3, exp: '1 August 2026 falls on a Saturday.', v: {sql: "SELECT DAYNAME('2026-08-01')", val: 'Saturday'}},
      {q: 'Which statement is used to change values that are already stored in a table?', opts: ['UPDATE', 'ALTER', 'MODIFY TABLE', 'INSERT'], correct: 0, exp: 'UPDATE ... SET ... changes existing data (DML). ALTER changes the structure.'},
      {q: 'A candidate key that is NOT chosen as the primary key is called a(n):', opts: ['Foreign key', 'Super key', 'Alternate key', 'Composite key'], correct: 2, exp: 'Every candidate key not selected as the primary key is an alternate key.'},
    ],
    out: [
      {q: 'Write the output of the query.', sql: 'SELECT genre, COUNT(*) FROM book GROUP BY genre ORDER BY genre',
        out: [['Biography', 2], ['Fiction', 3], ['History', 1], ['Poetry', 1], ['Tech', 3]], exp: 'Groups are listed alphabetically; Fiction (3 books) and Tech (3 books) are the largest.'},
      {q: 'Write the output of the query.', sql: 'SELECT bookid, price FROM book WHERE year > 2000 ORDER BY price',
        out: [[8, 250], [10, 320], [4, 450], [5, 699]], exp: 'Books published after 2000 have ids 4, 5, 8 and 10. They are sorted by price, lowest first.'},
      {q: 'Write the output of the query.', sql: 'SELECT member, COUNT(*) FROM issue WHERE returned IS NULL GROUP BY member ORDER BY member',
        out: [['Asha', 1], ['Meena', 1], ['Ravi', 2]], exp: 'Four issues are still not returned (ids 2, 3, 5, 7): Ravi has two of them.'},
    ],
    wr: [
      {task: "Write a query to display the titles of books whose author's name starts with the letter 'K'.", db: 'library', sol: "SELECT title FROM book WHERE author LIKE 'K%'",
        scheme: [{m: 1, d: 'SELECT title FROM book', re: /SELECT\s+title\s+FROM\s+book/i}, {m: 1, d: "WHERE author LIKE 'K%'", re: /WHERE\s+author\s+LIKE\s*['"]K%['"]/i}]},
      {task: 'Write a statement to delete the records of all issues that have been returned (the returned date is not NULL).', db: 'library', check: 'SELECT issueid, bookid, member FROM issue ORDER BY issueid',
        sol: 'DELETE FROM issue WHERE returned IS NOT NULL',
        scheme: [{m: 1, d: 'DELETE FROM issue', re: /DELETE\s+FROM\s+issue/i}, {m: 1, d: 'WHERE returned IS NOT NULL (without WHERE every row is deleted)', re: /WHERE\s+returned\s+IS\s+NOT\s+NULL/i}]},
    ],
    c: [
      {task: 'Write a query to display each genre, the number of books and the average price, only for genres that have more than one book.', db: 'library', sol: 'SELECT genre, COUNT(*), AVG(price) FROM book GROUP BY genre HAVING COUNT(*) > 1',
        scheme: [{m: 1, d: 'SELECT genre, COUNT(*), AVG(price) FROM book', re: /SELECT[\s\S]*COUNT\s*\([\s\S]*AVG\s*\(\s*price\s*\)[\s\S]*FROM\s+book/i}, {m: 1, d: 'GROUP BY genre', re: /GROUP\s+BY\s+genre/i}, {m: 1, d: 'HAVING COUNT(*) > 1', re: /HAVING[\s\S]*COUNT\s*\([\s\S]*(>\s*1|>=\s*2)/i}]},
      {task: 'Write a query to display the title and the member for every book that has been issued.', db: 'library', sol: 'SELECT title, member FROM book, issue WHERE book.bookid = issue.bookid',
        scheme: [{m: 1, d: 'Both tables in FROM (book and issue)', re: /FROM[\s\S]*book[\s\S]*issue|FROM[\s\S]*issue[\s\S]*book|NATURAL\s+JOIN/i}, {m: 1, d: 'Join condition on bookid', re: /bookid\s*=\s*\w*\.?bookid|NATURAL\s+JOIN/i}, {m: 1, d: 'Correct columns: title and member', re: /SELECT[\s\S]*title[\s\S]*member/i}]},
      {task: 'Write a query to display the title of each book and the number of times it has been issued, only for books issued more than once.', db: 'library', sol: 'SELECT title, COUNT(*) FROM book JOIN issue ON book.bookid = issue.bookid GROUP BY title HAVING COUNT(*) > 1',
        scheme: [{m: 1, d: 'Join of book and issue on bookid', re: /bookid\s*=\s*\w*\.?bookid|NATURAL\s+JOIN/i}, {m: 1, d: 'COUNT(*) with GROUP BY title', re: /COUNT\s*\([\s\S]*GROUP\s+BY[\s\S]*(title|bookid)/i}, {m: 1, d: 'HAVING COUNT(*) > 1', re: /HAVING[\s\S]*COUNT\s*\([\s\S]*(>\s*1|>=\s*2)/i}]},
    ]},
];
const PAPER_BY_ID = new Map(PAPERS.map(p => [p.id, p]));
const paperTotal = p => p.mcq.length * PAPER_MARKS.a + (p.out.length + p.wr.length) * PAPER_MARKS.b + p.c.length * PAPER_MARKS.c;

/* ---------- grading (pure functions: also used by tests/papers.test.js) ---------- */
const _tok = v => { const s = String(v).trim().replace(/^['"`]+|['"`]+$/g, '').toLowerCase(); return s !== '' && Number.isFinite(+s) ? String(+(+s).toFixed(4)) : s; };
const _split = t => String(t).split(/[\s,|;]+/).map(_tok).filter(Boolean);
function paperOutTokens(rows) { return rows.flat().flatMap(v => v === null ? ['null'] : _split(v)); }
function paperGradeOut(q, text, marks = PAPER_MARKS.b) {          // the student types the values row by row
  let got = _split(text), want = paperOutTokens(q.out);
  if (!got.length) return {got: 0, msg: 'Not attempted'};
  if (got.join(' ') === want.join(' ')) return {got: marks, msg: ''};
  const head = _split(q.heads || '');
  if (head.length && head.every((h, i) => got[i] === h) && got.slice(head.length).join(' ') === want.join(' ')) return {got: marks, msg: ''};
  if (got.length === want.length && [...got].sort().join(' ') === [...want].sort().join(' ')) return {got: Math.max(0, marks - 1), msg: 'All the values are right but the rows are in the wrong order or position.'};
  return {got: 0, msg: 'The values do not match the output of the query.'};
}
function paperGradeSql(q, sql, marks) {                           // full marks if the result matches; otherwise 1 mark per scheme step found, never full marks
  const text = String(sql || '').trim();
  if (!text) return {got: 0, msg: 'Not attempted', steps: q.scheme.map(() => false)};
  const steps = q.scheme.map(s => s.re.test(text)), partial = Math.min(marks - 1, q.scheme.reduce((a, s, i) => a + (steps[i] ? s.m : 0), 0));
  const db = freshDb(q.db), res = SQLEngine.run(db, text);
  if (res.error) return {got: partial, msg: 'Error: ' + res.error.message, steps};
  const bad = gradeQuest(q, db, res);
  return bad ? {got: partial, msg: bad, steps} : {got: marks, msg: '', steps: steps.map(() => true)};
}

/* ---------- state ---------- */
let paper = null, paperTickId = null, paperLast = 0, paperSaveT = 0, paperBest = {};
function paperNew(id) { const p = PAPER_BY_ID.get(id); return {id, m: Array(p.mcq.length).fill(null), o: Array(p.out.length).fill(''), w: Array(p.wr.length).fill(''), c: Array(p.c.length).fill(''), used: 0, limit: PAPER_SECS, done: false}; }
function paperRestore(r) {                                         // saved data may be old or edited: rebuild only if every part is valid
  try {
    if (!r || typeof r !== 'object' || !PAPER_BY_ID.has(r.id)) return null;
    const p = PAPER_BY_ID.get(r.id), n = paperNew(r.id);
    if (!Array.isArray(r.m) || !Array.isArray(r.o) || !Array.isArray(r.w) || !Array.isArray(r.c)) return null;
    if (r.m.length !== n.m.length || r.o.length !== n.o.length || r.w.length !== n.w.length || r.c.length !== n.c.length) return null;
    n.m = r.m.map((v, i) => Number.isInteger(v) && v >= 0 && v < p.mcq[i].opts.length ? v : null);
    for (const k of ['o', 'w', 'c']) n[k] = r[k].map(v => typeof v === 'string' ? v.slice(0, 2000) : '');
    n.used = Number.isFinite(r.used) && r.used >= 0 ? r.used : 0; n.limit = Number.isFinite(r.limit) && r.limit > 0 ? r.limit : PAPER_SECS; n.done = !!r.done;
    return n;
  } catch (e) { return null; }
}
function paperBestRestore(b) { const o = {}; if (b && typeof b === 'object') for (const p of PAPERS) if (Number.isFinite(b[p.id]) && b[p.id] >= 0 && b[p.id] <= 100) o[p.id] = Math.round(b[p.id]); return o; }
function paperGrade() {
  const P = PAPER_BY_ID.get(paper.id);
  const a = P.mcq.map((q, i) => paper.m[i] === q.correct ? PAPER_MARKS.a : 0);
  const o = P.out.map((q, i) => paperGradeOut(q, paper.o[i]));
  const w = P.wr.map((q, i) => paperGradeSql(q, paper.w[i], PAPER_MARKS.b));
  const c = P.c.map((q, i) => paperGradeSql(q, paper.c[i], PAPER_MARKS.c));
  const sum = x => x.reduce((s, v) => s + (typeof v === 'number' ? v : v.got), 0);
  const sec = {a: sum(a), b: sum(o) + sum(w), c: sum(c)};
  return {P, a, o, w, c, sec, total: sec.a + sec.b + sec.c};
}

/* ---------- timer ---------- */
function stopPaperTick() { clearInterval(paperTickId); paperTickId = null; }
function startPaperTick() { stopPaperTick(); if (!paper || paper.done) return; paperLast = Date.now(); paperTickId = setInterval(paperTick, 1000); }
function paperTick() {
  if (!paper || paper.done || currentMode !== 'practice') return stopPaperTick();
  const now = Date.now(); paper.used += (now - paperLast) / 1000; paperLast = now;
  const left = Math.ceil(paper.limit - paper.used);
  if (left <= 0) { paper.used = paper.limit; return paperSubmit(true); }
  const el = $('#pptimer'); if (el) { el.textContent = '⏱ ' + fmtTime(left); el.classList.toggle('warn', left <= 300); }
  if (left % 15 === 0) save();
}
function paperInput(el) {
  if (!paper || paper.done) return;
  const k = el.dataset.pp, i = +el.dataset.i;
  if (k === 'm') paper.m[i] = +el.value; else if (k === 'o' || k === 'w' || k === 'c') paper[k][i] = el.value.slice(0, 2000); else return;
  clearTimeout(paperSaveT); paperSaveT = setTimeout(save, 400);
}

/* ---------- screens ---------- */
const PAPER_NOTE = `<div class="paper-note" role="note"><b>Practice papers in board-exam style.</b> These are original questions written for revision, following the pattern of CBSE Class 12 SQL questions. They are <b>not</b> real past papers and are not issued by any board.</div>`;
function paperTables(db) {
  return Object.values(baseDb(db).tables).map(t => `<div class="sch"><b>${esc(t.name)}</b></div><div class="res-wrap"><table class="res"><thead><tr>${t.cols.map(c => `<th>${esc(c.name)}</th>`).join('')}</tr></thead><tbody>${t.rows.map(r => `<tr>${r.map(v => `<td>${cell(v)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`).join('');
}
function paperOutTable(P, q) {
  const r = SQLEngine.run(freshDb(P.db), q.sql).results[0];
  return `<div class="res-wrap"><table class="res"><thead><tr>${r.cols.map(c => `<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${r.rows.map(x => `<tr>${x.map(v => `<td>${cell(v)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}
function renderPapersHome() {
  paperView = 'home';
  root.innerHTML = `<div class="exam"><div class="exam-bar"><button class="btn" data-action="papersback">← Practice</button></div>
    <div class="practice-hero" style="padding-top:8px"><h2>Board-Style Practice Papers</h2><p>${PAPERS.length} timed papers · 25 marks each · ${PAPER_SECS / 60} minutes</p></div>
    ${PAPER_NOTE}
    <p class="res-meta">Each paper has Section A (6 MCQ, 1 mark each), Section B (3 output questions and 2 query-writing questions, 2 marks each) and Section C (3 queries using GROUP BY, JOIN and aggregate functions, 3 marks each). Answers and the marking scheme appear after you submit.</p>
    <div class="quiz-modes">${PAPERS.map(p => `<button class="quiz-mode-card" data-action="paperstart" data-id="${esc(p.id)}"><div class="icon">📄</div><h3>${esc(p.title)}</h3><p>${esc(p.blurb)}<br>${paperTotal(p)} marks · ${PAPER_SECS / 60} min${paperBest[p.id] != null ? ` · best ${paperBest[p.id]}%` : ''}${paper && paper.id === p.id && !paper.done ? ' · in progress' : ''}</p></button>`).join('')}</div></div>`;
  root.scrollTop = 0;
}
function renderPaper() {
  if (!paper) return;
  if (paper.done) return renderPaperResult();
  const P = PAPER_BY_ID.get(paper.id), left = Math.max(0, Math.ceil(paper.limit - paper.used));
  root.innerHTML = `<div class="exam">
    <div class="exam-bar"><button class="btn" data-action="paperexit">✕ Exit</button>
      <span id="pptimer" class="qtimer${left <= 300 ? ' warn' : ''}">⏱ ${fmtTime(left)}</span>
      <button class="btn primary" data-action="papersubmit">Submit paper</button></div>
    <h2 class="ex-title">${esc(P.title)}</h2>${PAPER_NOTE}
    <p class="res-meta">Total ${paperTotal(P)} marks · ${PAPER_SECS / 60} minutes · answers appear only after you submit · your answers are saved automatically</p>
    <details class="lab-schema" open><summary>Tables used in this paper (${esc(SEEDS[P.db].label)})</summary>${paperTables(P.db)}</details>
    <h3 class="ex-sec">Section A · Multiple choice <span>${PAPER_MARKS.a} mark each</span></h3>
    ${P.mcq.map((q, i) => `<div class="ex-q"><div class="ex-qt"><b>${i + 1}.</b> ${esc(q.q)}</div>
      ${q.opts.map((o, j) => `<label class="ex-opt"><input type="radio" name="pm${i}" data-pp="m" data-i="${i}" value="${j}" ${paper.m[i] === j ? 'checked' : ''}> <span>${esc(o)}</span></label>`).join('')}</div>`).join('')}
    <h3 class="ex-sec">Section B · Output and query writing <span>${PAPER_MARKS.b} marks each</span></h3>
    <p class="res-meta">For output questions, type the values of the result row by row (spaces or commas between values). Column headings are optional.</p>
    ${P.out.map((q, i) => `<div class="ex-q"><div class="ex-qt"><b>${i + 1}.</b> ${esc(q.q)}</div><code class="paper-sql">${esc(q.sql)}</code>
      <textarea class="sql" rows="2" spellcheck="false" aria-label="Output for question B${i + 1}" data-pp="o" data-i="${i}" placeholder="Type the output values…">${esc(paper.o[i])}</textarea></div>`).join('')}
    ${P.wr.map((q, i) => `<div class="ex-q"><div class="ex-qt"><b>${P.out.length + i + 1}.</b> ${esc(q.task)}</div>
      <textarea class="sql" rows="3" spellcheck="false" aria-label="Answer for question B${P.out.length + i + 1}" data-pp="w" data-i="${i}" placeholder="Write your SQL…">${esc(paper.w[i])}</textarea></div>`).join('')}
    <h3 class="ex-sec">Section C · Queries <span>${PAPER_MARKS.c} marks each</span></h3>
    ${P.c.map((q, i) => `<div class="ex-q"><div class="ex-qt"><b>${i + 1}.</b> ${esc(q.task)}</div>
      <textarea class="sql" rows="4" spellcheck="false" aria-label="Answer for question C${i + 1}" data-pp="c" data-i="${i}" placeholder="Write your SQL…">${esc(paper.c[i])}</textarea></div>`).join('')}
    <div class="btn-row"><button class="btn primary" data-action="papersubmit">Submit paper</button></div></div>`;
  startPaperTick();
}
function paperSubmit(auto) {
  if (!paper || paper.done) return;
  const blank = paper.m.filter(v => v === null).length + ['o', 'w', 'c'].reduce((n, k) => n + paper[k].filter(v => !v.trim()).length, 0);
  if (auto !== true && blank && !confirm(`${blank} question${blank === 1 ? ' is' : 's are'} unanswered. Submit anyway?`)) return;
  paper.done = true; stopPaperTick(); touchStreak();
  const g = paperGrade(), pct = Math.round(g.total / paperTotal(g.P) * 100);
  if (!(paperBest[paper.id] >= pct)) paperBest[paper.id] = pct;
  save(); renderPaperResult();
}
function paperSteps(q, r, marks) {
  return `<ul class="scheme">${q.scheme.map((s, i) => `<li class="${r.steps && r.steps[i] ? 'ok' : 'no'}"><span aria-hidden="true">${r.steps && r.steps[i] ? '✓' : '✗'}</span> <b>${s.m}</b> ${esc(s.d)}</li>`).join('')}</ul>`;
}
function renderPaperResult() {
  const g = paperGrade(), P = g.P, tot = paperTotal(P), pct = Math.round(g.total / tot * 100), up = paper.used >= paper.limit;
  const secMax = {a: P.mcq.length * PAPER_MARKS.a, b: (P.out.length + P.wr.length) * PAPER_MARKS.b, c: P.c.length * PAPER_MARKS.c};
  const msg = pct >= 80 ? '🎉 Excellent paper!' : pct >= 60 ? 'Good work. Check the marking scheme where you lost marks.' : pct >= 40 ? 'Getting there. Revise the weak topics and try again.' : 'Keep going: revise in Learn mode, then retry.';
  const mark = (got, max) => `<span class="pp-mk ${got === max ? 'full' : got ? 'part' : 'zero'}">${got}/${max}</span>`;
  const A = P.mcq.map((q, i) => `<div class="review-item"><strong>A${i + 1}. ${esc(q.q)}</strong> ${mark(g.a[i], PAPER_MARKS.a)}<br>${paper.m[i] === null ? 'Not answered' : `You chose: ${esc(q.opts[paper.m[i]])}`}<br>Answer: ${esc(q.opts[q.correct])}<br><span class="res-meta">${esc(q.exp)}</span></div>`).join('');
  const B1 = P.out.map((q, i) => `<div class="review-item"><strong>B${i + 1}. ${esc(q.q)}</strong> ${mark(g.o[i].got, PAPER_MARKS.b)}<br><code>${esc(q.sql)}</code>
    ${paper.o[i].trim() ? `<br>You wrote: <code class="mine">${esc(paper.o[i])}</code>` : '<br>Not answered'}${g.o[i].msg && g.o[i].got < PAPER_MARKS.b ? `<br>${esc(g.o[i].msg)}` : ''}
    <br>Correct output:${paperOutTable(P, q)}<span class="res-meta">${esc(q.exp)} Marking: ${PAPER_MARKS.b} marks for the correct output, ${PAPER_MARKS.b - 1} if all values are right but misplaced.</span></div>`).join('');
  const sqlReview = (q, r, ans, label, marks) => `<div class="review-item"><strong>${label}. ${esc(q.task)}</strong> ${mark(r.got, marks)}<br>
    ${ans.trim() ? `You wrote: <code class="mine">${esc(ans)}</code><br>${r.msg ? esc(r.msg) + '<br>' : ''}` : 'Not attempted<br>'}Model answer: <code>${esc(q.sol)}</code>
    <br><span class="res-meta">Marking scheme (any other query giving the same result earns full marks):</span>${paperSteps(q, r, marks)}</div>`;
  const B2 = P.wr.map((q, i) => sqlReview(q, g.w[i], paper.w[i], 'B' + (P.out.length + i + 1), PAPER_MARKS.b)).join('');
  const C = P.c.map((q, i) => sqlReview(q, g.c[i], paper.c[i], 'C' + (i + 1), PAPER_MARKS.c)).join('');
  root.innerHTML = `<div class="quiz-wrap"><div class="quiz-result">
    <div class="result-pct">${g.total}/${tot}</div><div class="result-label">${pct}% · Section A ${g.sec.a}/${secMax.a} · B ${g.sec.b}/${secMax.b} · C ${g.sec.c}/${secMax.c}</div>
    <div class="result-msg">${up ? '⏰ Time was up. ' : ''}${msg}</div>
    <div class="res-meta" style="text-align:center">${esc(P.title)} · ⏱ Time used: ${fmtTime(Math.round(paper.used))} of ${fmtTime(paper.limit)}</div>
    ${PAPER_NOTE}
    <p class="res-meta">Marks for queries are given automatically by running your SQL on the sample tables. If your query is not fully right, you get one mark for each step of the marking scheme found in your text (never full marks), roughly how an examiner gives step marks. Always compare with the model answer.</p>
    <div class="btn-row" style="justify-content:center"><button class="btn primary" data-action="paperstart" data-id="${esc(P.id)}">Retry this paper</button><button class="btn" data-action="papersopen">All papers</button></div>
    <div class="review-list"><h3>Section A · answers</h3>${A}</div>
    <div class="review-list"><h3>Section B · answers and marking scheme</h3>${B1}${B2}</div>
    <div class="review-list"><h3>Section C · answers and marking scheme</h3>${C}</div></div></div>`;
  root.scrollTop = 0;
}
let paperView = null;
const PAPER_ACTIONS = {
  papersopen: () => { quizMode = null; stopTicking(); if (paper && !paper.done) return renderPaper(); renderPapersHome(); },
  papersback: () => { paperView = null; renderPracticeHome(); },
  paperstart: d => {
    if (!PAPER_BY_ID.has(d.id)) return;
    if (paper && !paper.done && !confirm('Start a new paper? Your current paper will be lost.')) return;
    if (exam && !exam.done && !confirm('Start a paper? Your current mock exam will be lost.')) return;
    stopExamTick(); exam = null; quizMode = null; quizTimer = null; stopTicking();
    paper = paperNew(d.id); save(); renderPaper(); root.scrollTop = 0;
  },
  papersubmit: () => paperSubmit(),
  paperexit: () => {
    if (paper && !paper.done && !confirm('Leave the paper? Your answers will be lost.')) return;
    stopPaperTick(); paper = null; paperView = null; save(); renderPapersHome();
  },
};
if (typeof module !== 'undefined' && module.exports) module.exports = {PAPERS, PAPER_MARKS, paperTotal, paperGradeOut, paperGradeSql, paperRestore, paperOutTokens};
