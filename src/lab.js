'use strict';
/* ===== SQL Lab: helpful error hints + sample databases + quests (graded challenges) + free playground ===== */
const SQLHints = (() => {
  const KW = ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'DROP', 'ALTER', 'SHOW', 'DESCRIBE', 'TRUNCATE', 'FROM', 'WHERE', 'GROUP', 'ORDER', 'HAVING', 'LIMIT', 'VALUES', 'INTO', 'JOIN', 'DISTINCT', 'LIKE', 'BETWEEN', 'TABLE', 'SET'];
  const lev = (a, b) => { a = a.toLowerCase(); b = b.toLowerCase(); const d = Array.from({length: a.length + 1}, (_, i) => [i, ...Array(b.length).fill(0)]); for (let j = 1; j <= b.length; j++) d[0][j] = j; for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); return d[a.length][b.length]; };
  const closest = (w, list, max = 2) => { let best = null, bd = max + 1; for (const x of list) { const d = lev(w, x); if (d < bd) { bd = d; best = x; } } return best; };
  const mentioned = (sql, db) => Object.values(db.tables).filter(t => new RegExp('\\b' + t.name + '\\b', 'i').test(sql));

  function forError(e, sql, db) {
    const h = [], i = e.info || {}, tabs = Object.values(db.tables);
    switch (e.code) {
      case 1054: {
        const pool = (mentioned(sql, db).length ? mentioned(sql, db) : tabs).flatMap(t => t.cols.map(c => c.name));
        const m = i.bad && closest(i.bad, pool, 3);
        if (m) h.push(`Did you mean the column "${m}"? Column names must be spelled exactly as in the table.`);
        if (i.bad && /^[A-Za-z]+$/.test(i.bad) && new RegExp("[=<>]\\s*" + i.bad + "\\b|\\bIN\\s*\\([^)]*\\b" + i.bad + "\\b", 'i').test(sql) || i.asValue)
          h.push(`If "${i.bad}" is meant to be text (like a city or a name), put it in quotes: '${i.bad}'. Without quotes SQL thinks it is a column.`);
        const t = mentioned(sql, db)[0]; if (t) h.push(`Columns of ${t.name}: ${t.cols.map(c => c.name).join(', ')}`);
        break;
      }
      case 1146: case 1051: {
        const m = i.bad && closest(i.bad, tabs.map(t => t.name), 3);
        if (m) h.push(`Did you mean the table "${m}"?`);
        h.push(`Tables in this database: ${tabs.map(t => t.name).join(', ') || '(none yet — use CREATE TABLE)'}`); break;
      }
      case 1055: h.push(`When you use GROUP BY (or an aggregate like COUNT/AVG), every plain column in SELECT must be listed in GROUP BY, or be wrapped in an aggregate.`, i.bad ? `Try adding "${i.bad}" to GROUP BY, or remove it from SELECT.` : ''); break;
      case 1111: h.push('WHERE filters single rows, before grouping. To filter on COUNT/SUM/AVG results use HAVING, placed after GROUP BY.'); break;
      case 1052: h.push(`Both tables have a column called "${i.bad}". Say which one: table_name.${i.bad}`); break;
      case 1062: h.push('A PRIMARY KEY (or UNIQUE) column cannot repeat. A row with that value already exists. Pick a new value, or UPDATE the existing row instead.'); break;
      case 1048: case 1364: h.push(`"${i.bad}" is NOT NULL, so it must be given a real value. List it in the INSERT.`); break;
      case 1406: h.push(`The text is longer than the column allows (VARCHAR(${i.max})). Shorten it, or widen the column with a bigger VARCHAR.`); break;
      case 1136: h.push(`You gave ${i.vals} value(s) for ${i.cols} column(s). Either list all the columns' values, or name the columns: INSERT INTO t (col1, col2) VALUES (...).`); break;
      case 1366: h.push('A number column only accepts numbers. Remove the quotes/letters, or check the order of your values matches the column order.'); break;
      case 1292: h.push("Dates must look like 'YYYY-MM-DD' (in quotes), e.g. '2007-03-14'."); break;
      case 1050: h.push('That table already exists. Use a different name, or DROP TABLE it first.'); break;
      case 1305: { const m = closest(i.bad, Object.keys({UPPER: 1, LOWER: 1, LENGTH: 1, ROUND: 1, COUNT: 1, SUM: 1, AVG: 1, MIN: 1, MAX: 1, YEAR: 1, MONTH: 1, SUBSTR: 1, CONCAT: 1, ABS: 1}), 2); if (m) h.push(`Did you mean ${m}()?`); break; }
      case 1065: h.push('The editor is empty — type a query first.'); break;
      case 1064: {
        const first = (sql.trim().match(/^[A-Za-z]+/) || [''])[0];
        if (first && !KW.includes(first.toUpperCase())) { const m = closest(first, KW, 2); if (m) h.push(`The first word "${first}" is not a command. Did you mean ${m}?`); }
        const words = [...sql.matchAll(/\b[A-Za-z]+\b/g)].map(x => x[0]);
        for (const w of words) if (!KW.includes(w.toUpperCase()) && closest(w, ['FROM', 'WHERE', 'GROUP', 'ORDER', 'HAVING', 'LIMIT', 'VALUES', 'SELECT', 'DISTINCT'], 1) && lev(w, closest(w, ['FROM', 'WHERE', 'GROUP', 'ORDER', 'HAVING', 'LIMIT', 'VALUES', 'SELECT', 'DISTINCT'], 1)) === 1 && w.length > 3 && !db.tables[w.toLowerCase()] && !tabs.some(t => t.cols.some(c => c.name.toLowerCase() === w.toLowerCase()))) { h.push(`"${w}" looks like a misspelt keyword — did you mean ${closest(w, ['FROM', 'WHERE', 'GROUP', 'ORDER', 'HAVING', 'LIMIT', 'VALUES', 'SELECT', 'DISTINCT'], 1)}?`); break; }
        if (i.kind === 'quote' || (sql.match(/'/g) || []).length % 2) h.push("A quote is not closed. Every opening ' needs a closing ' — check text values.");
        if ((sql.match(/\(/g) || []).length !== (sql.match(/\)/g) || []).length) h.push('Brackets do not match: count your ( and ).');
        if (/,\s*(FROM|WHERE)\b/i.test(sql)) h.push('Remove the extra comma just before FROM / WHERE.');
        const order = ['FROM', 'WHERE', 'GROUP BY', 'HAVING', 'ORDER BY', 'LIMIT'].map(k => sql.toUpperCase().search(new RegExp('\\b' + k.replace(' ', '\\s+') + '\\b')));
        const present = order.filter(x => x >= 0); if (present.join() !== [...present].sort((a, b) => a - b).join()) h.push('Clauses must come in this order: SELECT → FROM → WHERE → GROUP BY → HAVING → ORDER BY → LIMIT.');
        if (/\bSELECT\b[^;]*\b(\w+)\s+(\w+)\s+FROM/i.test(sql) && i.kind === 'syntax') h.push('Between two column names in SELECT you need a comma.');
        if (/\bAND\b[^;]*\bBETWEEN\b|\bIN\s*\(\s*\)/i.test(sql)) h.push('Check BETWEEN a AND b and IN (x, y) are written exactly like that.');
        h.push(`SQL stopped reading at: "${i.near || ''}". The mistake is usually right at, or just before, that spot.`);
        break;
      }
    }
    return h.filter(Boolean);
  }
  // gentle nudges for queries that run but are probably wrong
  function soft(sql, res) {
    const h = [];
    if (/[=<>]\s*NULL\b/i.test(sql) && !/IS\s+(NOT\s+)?NULL/i.test(sql)) h.push('Comparing with = NULL never matches. Use IS NULL or IS NOT NULL.');
    if (res && res.kind === 'rows' && !res.rows.length && /\bWHERE\b/i.test(sql)) h.push('No rows matched. Check the spelling of text values (they must be in quotes) and the comparison signs.');
    if (/\bSELECT\s+\*/i.test(sql) && /\bCOUNT\s*\(/i.test(sql)) h.push('SELECT * together with COUNT is unusual — decide which columns you really need.');
    return h;
  }
  return {forError, soft, lev, closest};
})();

const SEEDS = {
  school: {
    label: '🏫 School', blurb: 'student and club tables',
    sql: `CREATE TABLE student (roll INT PRIMARY KEY, name VARCHAR(20) NOT NULL, class INT, section CHAR(1), marks INT, city VARCHAR(15), dob DATE);
INSERT INTO student VALUES (1,'Aarav',12,'A',92,'Delhi','2007-03-14'),(2,'Diya',12,'A',85,'Mumbai','2007-07-21'),(3,'Kabir',12,'B',67,'Delhi','2006-12-02'),(4,'Meera',12,'B',78,'Pune','2007-01-30'),(5,'Rohan',11,'A',54,'Chennai','2008-05-11'),(6,'Sana',11,'A',88,'Delhi','2008-09-09'),(7,'Tara',11,'B',NULL,'Mumbai','2008-02-17'),(8,'Vikram',11,'B',73,'Pune','2008-11-25'),(9,'Anaya',12,'A',95,'Chennai','2007-04-05'),(10,'Yash',12,'B',41,'Delhi','2007-08-19');
CREATE TABLE club (roll INT, club VARCHAR(15));
INSERT INTO club VALUES (1,'Chess'),(1,'Coding'),(2,'Dance'),(4,'Chess'),(6,'Coding'),(9,'Coding'),(9,'Drama');`},
  company: {
    label: '🏢 Company', blurb: 'emp and dept tables',
    sql: `CREATE TABLE emp (empid INT PRIMARY KEY, name VARCHAR(20) NOT NULL, dept VARCHAR(10), salary INT, city VARCHAR(15), joined DATE);
INSERT INTO emp VALUES (101,'Neha','Sales',52000,'Delhi','2019-06-01'),(102,'Arjun','IT',78000,'Pune','2018-02-12'),(103,'Priya','IT',69000,'Mumbai','2020-09-23'),(104,'Rahul','HR',45000,'Delhi','2021-01-15'),(105,'Isha','Sales',58000,'Chennai','2017-11-30'),(106,'Dev','IT',91000,'Pune','2016-04-08'),(107,'Kavya','HR',47000,'Mumbai','2022-03-03'),(108,'Sameer','Sales',NULL,'Delhi','2023-07-19');
CREATE TABLE dept (dept VARCHAR(10) PRIMARY KEY, head VARCHAR(20));
INSERT INTO dept VALUES ('Sales','Anita'),('IT','Rajesh'),('HR','Sunita'),('Legal','Mohan');`},
  library: {
    label: '📚 Library', blurb: 'book and issue tables',
    sql: `CREATE TABLE book (bookid INT PRIMARY KEY, title VARCHAR(30) NOT NULL, author VARCHAR(20), genre VARCHAR(12), price INT, year INT);
INSERT INTO book VALUES (1,'The Alchemist','Coelho','Fiction',299,1988),(2,'Wings of Fire','Kalam','Biography',350,1999),(3,'Malgudi Days','Narayan','Fiction',199,1943),(4,'Python Basics','Sharma','Tech',450,2019),(5,'Database Systems','Korth','Tech',699,2010),(6,'Discovery of India','Nehru','History',399,1946),(7,'Gitanjali','Tagore','Poetry',149,1910),(8,'SQL in 10 Days','Verma','Tech',250,2021),(9,'Train to Pakistan','Singh','Fiction',275,1956),(10,'Ignited Minds','Kalam','Biography',320,2002);
CREATE TABLE issue (issueid INT PRIMARY KEY, bookid INT, member VARCHAR(15), issued DATE, returned DATE);
INSERT INTO issue VALUES (1,1,'Asha','2026-08-01','2026-08-10'),(2,4,'Ravi','2026-08-03',NULL),(3,5,'Asha','2026-08-05',NULL),(4,2,'Meena','2026-08-07','2026-08-15'),(5,4,'Meena','2026-08-20',NULL),(6,8,'Ravi','2026-09-01','2026-09-09'),(7,1,'Ravi','2026-09-03',NULL);`},
  shop: {
    label: '🛒 Shop', blurb: 'product and orders tables',
    sql: `CREATE TABLE product (pid INT PRIMARY KEY, pname VARCHAR(20) NOT NULL, category VARCHAR(12), price INT, stock INT);
INSERT INTO product VALUES (1,'Notebook','Stationery',60,120),(2,'Pen Pack','Stationery',45,200),(3,'Backpack','Bags',799,15),(4,'Water Bottle','Home',199,0),(5,'Headphones','Electronics',999,8),(6,'Calculator','Electronics',650,25),(7,'Lunch Box','Home',249,40),(8,'USB Cable','Electronics',149,60);
CREATE TABLE orders (oid INT PRIMARY KEY, pid INT, customer VARCHAR(15), qty INT, odate DATE);
INSERT INTO orders VALUES (1,1,'Asha',5,'2026-10-01'),(2,3,'Ravi',1,'2026-10-02'),(3,5,'Meena',2,'2026-10-02'),(4,2,'Asha',10,'2026-10-04'),(5,6,'Kabir',1,'2026-10-05'),(6,1,'Ravi',3,'2026-10-07'),(7,8,'Meena',4,'2026-10-09'),(8,5,'Asha',1,'2026-10-12');`},
  cricket: {
    label: '🏏 Cricket', blurb: 'player and team tables',
    sql: `CREATE TABLE player (pid INT PRIMARY KEY, name VARCHAR(20) NOT NULL, team VARCHAR(10), role VARCHAR(12), runs INT, wickets INT, matches INT);
INSERT INTO player VALUES (1,'Virat','RCB','Batter',7263,4,237),(2,'Rohit','MI','Batter',6211,15,243),(3,'Bumrah','MI','Bowler',56,165,120),(4,'Jadeja','CSK','Allrounder',2692,152,226),(5,'Dhoni','CSK','Keeper',5243,0,264),(6,'Chahal','RR','Bowler',74,205,145),(7,'Pandya','MI','Allrounder',1963,64,123),(8,'Samson','RR','Keeper',4419,0,160),(9,'Rashid','GT','Bowler',443,139,121);
CREATE TABLE team (team VARCHAR(10) PRIMARY KEY, city VARCHAR(12), titles INT);
INSERT INTO team VALUES ('MI','Mumbai',5),('CSK','Chennai',5),('RCB','Bengaluru',0),('RR','Jaipur',1),('GT','Ahmedabad',1);`},
};
const _base = {};
const baseDb = n => { if (!_base[n]) { const d = SQLEngine.newDb(); const r = SQLEngine.run(d, SEEDS[n].sql); if (r.error) throw r.error; _base[n] = d; } return _base[n]; };
const freshDb = n => SQLEngine.clone(baseDb(n));

const QUESTS = [
  {id: 's1', db: 'school', lvl: 1, title: 'Show everyone', task: 'Display every column and every row of the student table.', sol: 'SELECT * FROM student',
    hints: ['Start with SELECT, then say which columns, then FROM which table.', 'The symbol for "all columns" is *', 'SELECT * FROM student;']},
  {id: 's2', db: 'school', lvl: 1, title: 'Delhi crew', task: 'List the names of students who live in Delhi.', sol: "SELECT name FROM student WHERE city='Delhi'",
    hints: ['You only want the name column, and only some rows. Filtering rows is the job of WHERE.', "Text values go inside quotes: 'Delhi'", "SELECT name FROM student WHERE city = 'Delhi';"]},
  {id: 's3', db: 'school', lvl: 1, title: 'Distinct cities', task: 'Show each city only once (no repeats).', sol: 'SELECT DISTINCT city FROM student',
    hints: ['Some cities appear several times. Which keyword removes duplicates?', 'Put DISTINCT right after SELECT.', 'SELECT DISTINCT city FROM student;']},
  {id: 's4', db: 'school', lvl: 2, title: 'Toppers', task: 'Show name and marks of students scoring more than 80, highest marks first.', ordered: true, sol: 'SELECT name, marks FROM student WHERE marks > 80 ORDER BY marks DESC',
    hints: ['You need two things: a WHERE condition and an ORDER BY.', 'ORDER BY marks DESC puts the biggest first. ORDER BY goes after WHERE.', 'SELECT name, marks FROM student WHERE marks > 80 ORDER BY marks DESC;']},
  {id: 's5', db: 'school', lvl: 2, title: 'Name pattern', task: "List names that start with the letter 'A'.", sol: "SELECT name FROM student WHERE name LIKE 'A%'",
    hints: ['Pattern matching on text uses LIKE.', "% means \"anything can follow\". So 'A%' means starts with A.", "SELECT name FROM student WHERE name LIKE 'A%';"]},
  {id: 's6', db: 'school', lvl: 2, title: 'Missing marks', task: 'Find the names of students whose marks are not recorded (NULL).', sol: 'SELECT name FROM student WHERE marks IS NULL',
    hints: ['NULL is "no value", so = does not work with it.', 'The test is IS NULL.', 'SELECT name FROM student WHERE marks IS NULL;']},
  {id: 's7', db: 'school', lvl: 3, title: 'Class averages', task: 'For each class show the class and the average marks.', sol: 'SELECT class, AVG(marks) FROM student GROUP BY class',
    hints: ['"For each class" is the signal for GROUP BY.', 'SELECT class, AVG(marks) ... then GROUP BY class.', 'SELECT class, AVG(marks) FROM student GROUP BY class;']},
  {id: 's8', db: 'school', lvl: 3, title: 'Busy cities', task: 'Show each city that has more than 2 students, with the number of students.', sol: 'SELECT city, COUNT(*) FROM student GROUP BY city HAVING COUNT(*) > 2',
    hints: ['Group by city and count. But the filter is on the count, not on a single row.', 'Conditions on COUNT/AVG/SUM go in HAVING (after GROUP BY), not WHERE.', 'SELECT city, COUNT(*) FROM student GROUP BY city HAVING COUNT(*) > 2;']},
  {id: 's9', db: 'school', lvl: 3, title: 'Club members', task: 'Show each student name with the club they belong to (only students who are in a club).', sol: 'SELECT name, club FROM student JOIN club ON student.roll = club.roll',
    hints: ['The data is in two tables, so you need a JOIN.', 'They are linked by roll: student.roll = club.roll', 'SELECT name, club FROM student JOIN club ON student.roll = club.roll;']},
  {id: 's10', db: 'school', lvl: 3, title: 'Grace marks', task: 'Give +5 marks to every class 11 student who scored below 60.', check: 'SELECT roll, marks FROM student ORDER BY roll', sol: 'UPDATE student SET marks = marks + 5 WHERE class = 11 AND marks < 60',
    hints: ['Changing existing rows is UPDATE ... SET ... WHERE.', 'SET marks = marks + 5, and WHERE needs both conditions joined with AND.', 'UPDATE student SET marks = marks + 5 WHERE class = 11 AND marks < 60;']},
  {id: 'c1', db: 'company', lvl: 1, title: 'Well paid', task: 'Show the names of employees earning more than 60000.', sol: 'SELECT name FROM emp WHERE salary > 60000',
    hints: ['SELECT the name, FROM emp, with a WHERE on salary.', 'Numbers need no quotes: salary > 60000', 'SELECT name FROM emp WHERE salary > 60000;']},
  {id: 'c2', db: 'company', lvl: 2, title: 'Top salary', task: 'Display the highest salary in the company.', sol: 'SELECT MAX(salary) FROM emp',
    hints: ['There is an aggregate function that finds the biggest value.', 'MAX( column )', 'SELECT MAX(salary) FROM emp;']},
  {id: 'c3', db: 'company', lvl: 2, title: 'Recent joiners', task: 'List names of employees who joined after the year 2020.', sol: 'SELECT name FROM emp WHERE YEAR(joined) > 2020',
    hints: ['You only need the year part of the date. Is there a function for that?', 'YEAR(joined) gives a number you can compare.', 'SELECT name FROM emp WHERE YEAR(joined) > 2020;']},
  {id: 'c4', db: 'company', lvl: 3, title: 'Payroll per dept', task: 'Show each dept with its total salary, biggest total first.', ordered: true, sol: 'SELECT dept, SUM(salary) FROM emp GROUP BY dept ORDER BY SUM(salary) DESC',
    hints: ['Per department means GROUP BY dept.', 'Use SUM(salary) and ORDER BY it, descending.', 'SELECT dept, SUM(salary) FROM emp GROUP BY dept ORDER BY SUM(salary) DESC;']},
  {id: 'c5', db: 'company', lvl: 3, title: 'Who is the boss', task: 'Show each employee name with the head of their department.', sol: 'SELECT name, head FROM emp JOIN dept ON emp.dept = dept.dept',
    hints: ['Two tables again: JOIN them on the shared column.', 'Both tables have a column called dept, so write table.dept (e.g. emp.dept = dept.dept).', 'SELECT name, head FROM emp JOIN dept ON emp.dept = dept.dept;']},
  {id: 'c6', db: 'company', lvl: 2, title: 'New hire', task: "Add a new employee: id 109, name 'Zoya', dept 'IT', salary 65000, city 'Delhi', joined '2024-01-10'.", check: 'SELECT * FROM emp ORDER BY empid', sol: "INSERT INTO emp VALUES (109,'Zoya','IT',65000,'Delhi','2024-01-10')",
    hints: ['Adding a row is INSERT INTO table VALUES (...).', 'Values must follow the column order: empid, name, dept, salary, city, joined. Text and dates in quotes.', "INSERT INTO emp VALUES (109,'Zoya','IT',65000,'Delhi','2024-01-10');"]},
];
QUESTS.push(
  {id: 'l1', db: 'library', lvl: 1, title: 'Tech shelf', task: "Show the titles of all books in the genre 'Tech'.", sol: "SELECT title FROM book WHERE genre='Tech'",
    hints: ['One column (title), filtered rows: use WHERE.', "Text goes in quotes: genre = 'Tech'", "SELECT title FROM book WHERE genre = 'Tech';"]},
  {id: 'l2', db: 'library', lvl: 1, title: 'Pocket friendly', task: 'Show title and price of books costing less than 300, cheapest first.', ordered: true, sol: 'SELECT title, price FROM book WHERE price < 300 ORDER BY price',
    hints: ['WHERE for the price limit, then sort the result.', 'ORDER BY price sorts low to high (ASC is the default).', 'SELECT title, price FROM book WHERE price < 300 ORDER BY price;']},
  {id: 'l3', db: 'library', lvl: 2, title: "Kalam's books", task: "How many books are written by 'Kalam'? Show just the count.", sol: "SELECT COUNT(*) FROM book WHERE author='Kalam'",
    hints: ['You want a number, not a list of rows. Which function counts rows?', 'COUNT(*) together with a WHERE on author.', "SELECT COUNT(*) FROM book WHERE author = 'Kalam';"]},
  {id: 'l4', db: 'library', lvl: 2, title: 'Old classics', task: 'List titles of books published between 1900 and 1950 (both included).', sol: 'SELECT title FROM book WHERE year BETWEEN 1900 AND 1950',
    hints: ['A range of values has its own keyword.', 'year BETWEEN low AND high (both ends are included).', 'SELECT title FROM book WHERE year BETWEEN 1900 AND 1950;']},
  {id: 'l5', db: 'library', lvl: 2, title: 'Still out', task: 'Show member and bookid for every issue that has not been returned yet (returned is empty).', sol: 'SELECT member, bookid FROM issue WHERE returned IS NULL',
    hints: ['"Not returned" means the returned column has no value.', 'No value = NULL, and you test it with IS NULL, not =.', 'SELECT member, bookid FROM issue WHERE returned IS NULL;']},
  {id: 'l6', db: 'library', lvl: 3, title: 'Genre value', task: 'For each genre show the genre and the total price of its books.', sol: 'SELECT genre, SUM(price) FROM book GROUP BY genre',
    hints: ['"For each genre" is the sign of GROUP BY.', 'Pair the grouped column with an aggregate: genre, SUM(price).', 'SELECT genre, SUM(price) FROM book GROUP BY genre;']},
  {id: 'l7', db: 'library', lvl: 3, title: 'Who has what', task: 'Show book title and member name for books that are currently not returned.', sol: 'SELECT title, member FROM book JOIN issue ON book.bookid = issue.bookid WHERE returned IS NULL',
    hints: ['The title is in book, the member in issue. You need a JOIN.', 'Join on bookid, then add the filter with WHERE returned IS NULL.', 'SELECT title, member FROM book JOIN issue ON book.bookid = issue.bookid WHERE returned IS NULL;']},
  {id: 'l8', db: 'library', lvl: 2, title: 'Clear the shelf', task: 'Delete all books published before 1950.', check: 'SELECT bookid FROM book ORDER BY bookid', sol: 'DELETE FROM book WHERE year < 1950',
    hints: ['Removing rows is DELETE FROM table.', 'Without WHERE it would delete EVERYTHING. Add the condition on year.', 'DELETE FROM book WHERE year < 1950;']},
  {id: 'h1', db: 'shop', lvl: 1, title: 'Sold out', task: 'List the names of products whose stock is 0.', sol: 'SELECT pname FROM product WHERE stock = 0',
    hints: ['Filter rows with WHERE on the stock column.', 'Numbers need no quotes: stock = 0', 'SELECT pname FROM product WHERE stock = 0;']},
  {id: 'h2', db: 'shop', lvl: 1, title: 'Electronics aisle', task: "Show name and price of products in the category 'Electronics', most expensive first.", ordered: true, sol: "SELECT pname, price FROM product WHERE category='Electronics' ORDER BY price DESC",
    hints: ['WHERE for the category, ORDER BY for the sorting.', 'DESC makes it high to low.', "SELECT pname, price FROM product WHERE category = 'Electronics' ORDER BY price DESC;"]},
  {id: 'h3', db: 'shop', lvl: 2, title: 'Sale time', task: 'Show each product name with its price after a 10% discount.', sol: 'SELECT pname, price * 0.9 FROM product',
    hints: ['You can calculate inside SELECT, e.g. price * 2.', '10% off means paying 90% of the price: price * 0.9', 'SELECT pname, price * 0.9 FROM product;  (add AS sale_price to name the column)']},
  {id: 'h4', db: 'shop', lvl: 2, title: 'Stock value', task: 'Find the total value of the stock (price × stock for every product, added up).', sol: 'SELECT SUM(price * stock) FROM product',
    hints: ['One number for the whole table: use an aggregate function.', 'The aggregate can wrap a calculation: SUM( a * b )', 'SELECT SUM(price * stock) FROM product;']},
  {id: 'h5', db: 'shop', lvl: 2, title: 'Category count', task: 'Show each category with the number of products in it.', sol: 'SELECT category, COUNT(*) FROM product GROUP BY category',
    hints: ['"Each category" means GROUP BY category.', 'Select the category and COUNT(*).', 'SELECT category, COUNT(*) FROM product GROUP BY category;']},
  {id: 'h6', db: 'shop', lvl: 3, title: 'Order bill', task: 'For every order show customer, product name and the bill (price × qty).', sol: 'SELECT customer, pname, price * qty FROM orders JOIN product ON orders.pid = product.pid',
    hints: ['customer is in orders, pname and price in product: JOIN.', 'Link them with orders.pid = product.pid, then calculate price * qty.', 'SELECT customer, pname, price * qty FROM orders JOIN product ON orders.pid = product.pid;']},
  {id: 'h7', db: 'shop', lvl: 3, title: 'Never ordered', task: 'List the names of products that nobody has ordered yet.', sol: 'SELECT pname FROM product LEFT JOIN orders ON product.pid = orders.pid WHERE orders.oid IS NULL',
    hints: ['A normal JOIN drops products with no orders. Which join keeps all rows of the left table?', 'LEFT JOIN keeps every product; unmatched ones get NULL order columns. Filter for those.', 'SELECT pname FROM product LEFT JOIN orders ON product.pid = orders.pid WHERE orders.oid IS NULL;']},
  {id: 'h8', db: 'shop', lvl: 2, title: 'Restock', task: 'Add 50 to the stock of every product that has fewer than 10 in stock.', check: 'SELECT pid, stock FROM product ORDER BY pid', sol: 'UPDATE product SET stock = stock + 50 WHERE stock < 10',
    hints: ['Changing existing rows: UPDATE ... SET ... WHERE.', 'SET stock = stock + 50, limited by WHERE stock < 10.', 'UPDATE product SET stock = stock + 50 WHERE stock < 10;']},
  {id: 'k1', db: 'cricket', lvl: 1, title: 'Run machines', task: 'Show name and runs of players with more than 5000 runs, highest first.', ordered: true, sol: 'SELECT name, runs FROM player WHERE runs > 5000 ORDER BY runs DESC',
    hints: ['WHERE for the runs condition, ORDER BY for the order.', 'ORDER BY runs DESC', 'SELECT name, runs FROM player WHERE runs > 5000 ORDER BY runs DESC;']},
  {id: 'k2', db: 'cricket', lvl: 1, title: 'Bowlers only', task: "List the names of players whose role is 'Bowler'.", sol: "SELECT name FROM player WHERE role='Bowler'",
    hints: ['Filter rows with WHERE.', "Text in quotes: role = 'Bowler'", "SELECT name FROM player WHERE role = 'Bowler';"]},
  {id: 'k3', db: 'cricket', lvl: 2, title: 'Team strength', task: 'Show each team with its number of players.', sol: 'SELECT team, COUNT(*) FROM player GROUP BY team',
    hints: ['"Each team" → GROUP BY team.', 'COUNT(*) counts the rows in every group.', 'SELECT team, COUNT(*) FROM player GROUP BY team;']},
  {id: 'k4', db: 'cricket', lvl: 2, title: 'Wicket king', task: 'Show the name of the player with the most wickets.', sol: 'SELECT name FROM player ORDER BY wickets DESC LIMIT 1',
    hints: ['Sort so the best comes first, then keep only one row.', 'ORDER BY wickets DESC, then LIMIT.', 'SELECT name FROM player ORDER BY wickets DESC LIMIT 1;']},
  {id: 'k5', db: 'cricket', lvl: 2, title: 'Runs per match', task: 'Show each name with runs divided by matches, rounded to 2 decimals.', sol: 'SELECT name, ROUND(runs / matches, 2) FROM player',
    hints: ['Divide with / and round with a function.', 'ROUND(value, decimals)', 'SELECT name, ROUND(runs / matches, 2) FROM player;']},
  {id: 'k6', db: 'cricket', lvl: 3, title: 'Big-title squads', task: 'Show player name and team city for players whose team has won 5 or more titles.', sol: 'SELECT name, city FROM player JOIN team ON player.team = team.team WHERE titles >= 5',
    hints: ['Name is in player, city and titles in team: JOIN.', 'Both tables have a column called team, so write player.team = team.team.', 'SELECT name, city FROM player JOIN team ON player.team = team.team WHERE titles >= 5;']},
  {id: 'k7', db: 'cricket', lvl: 3, title: 'Team runs', task: 'Show each team with its total runs, but only teams whose total is above 7000.', sol: 'SELECT team, SUM(runs) FROM player GROUP BY team HAVING SUM(runs) > 7000',
    hints: ['Group by team and add up runs. The filter is on the total.', 'Filters on SUM/COUNT/AVG go in HAVING, after GROUP BY.', 'SELECT team, SUM(runs) FROM player GROUP BY team HAVING SUM(runs) > 7000;']},
  {id: 'k8', db: 'cricket', lvl: 2, title: 'Build a table', task: 'Create a table awards with: award_id (integer, primary key), pid (integer), title (VARCHAR of 30).', check: 'DESCRIBE awards', sol: 'CREATE TABLE awards (award_id INT PRIMARY KEY, pid INT, title VARCHAR(30))',
    hints: ['CREATE TABLE name ( column type, column type, ... )', 'Add PRIMARY KEY after the type of award_id. Text type needs a size: VARCHAR(30).', 'CREATE TABLE awards (award_id INT PRIMARY KEY, pid INT, title VARCHAR(30));']},
);
const LVL = ['', 'Easy', 'Medium', 'Hard'], LVL_XP = [0, 10, 20, 30];
const RANKS = [[0, 'Rookie 🐣'], [40, 'Query Cadet 🧭'], [100, 'Filter Fox 🦊'], [180, 'Join Juggler 🤹'], [260, 'SQL Ninja 🥷']];

const labDefaults = () => ({xp: 0, solved: {}, db: 'school', tab: 'quests', open: null, drafts: {}, used: {}, dailyDone: ''});
const dailyQuest = () => QUESTS[Math.floor(new Date().setHours(12, 0, 0, 0) / 864e5) % QUESTS.length];   // same quest all day, new one tomorrow
const DAILY_BONUS = 10;
let labOut = '', labConfetti = false;
const labKey = () => lab.tab === 'quests' && lab.open ? 'q:' + lab.open : 'p:' + lab.db;
const PLAY_KEY = 'sqlrev.play.v1';
function playDb() {
  try { const all = JSON.parse(localStorage.getItem(PLAY_KEY) || '{}'); if (all[lab.db] && all[lab.db].tables) return all[lab.db]; } catch (e) { /* ignore */ }
  return freshDb(lab.db);
}
function savePlay(db) { try { const all = JSON.parse(localStorage.getItem(PLAY_KEY) || '{}'); all[lab.db] = db; localStorage.setItem(PLAY_KEY, JSON.stringify(all)); } catch (e) { /* ignore */ } }

const cell = v => v === null ? '<span class="nul">NULL</span>' : esc(typeof v === 'number' && !Number.isInteger(v) ? +v.toFixed(4) : v);
function tableHtml(r) {
  const rows = r.rows.slice(0, 200);
  return `<div class="res-wrap"><table class="res"><thead><tr>${r.cols.map(c => `<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${rows.map(x => `<tr>${x.map(v => `<td>${cell(v)}</td>`).join('')}</tr>`).join('') || `<tr><td colspan="${r.cols.length}" class="nul">(0 rows)</td></tr>`}</tbody></table></div>
  <div class="res-meta">${r.rows.length} row${r.rows.length === 1 ? '' : 's'}${r.rows.length > 200 ? ' (showing first 200)' : ''}</div>`;
}
const norm = v => v === null ? 'NULL' : typeof v === 'number' ? String(+v.toFixed(4)) : String(v);
function compare(user, want, ordered) {
  if (!user || user.kind !== 'rows') return 'Your query did not return a table. A SELECT is needed here.';
  if (user.cols.length !== want.cols.length) return `Your result has ${user.cols.length} column(s) but the task needs ${want.cols.length}. Re-read which columns are asked for.`;
  const a = user.rows.map(r => r.map(norm).join('\u0001')), b = want.rows.map(r => r.map(norm).join('\u0001'));
  if (a.length !== b.length) {
    const dist = new Set(a).size === b.length || new Set(a).size < a.length && a.length > b.length;
    return `You returned ${a.length} row(s) but ${b.length} are expected.` + (a.length > b.length ? (dist ? ' Some rows repeat — is DISTINCT needed?' : ' Your condition may be too loose.') : ' Your condition may be too strict, or a JOIN/WHERE removes rows.');
  }
  const same = [...a].sort().join('\u0002') === [...b].sort().join('\u0002');
  if (!same) return 'Right number of rows, but some values differ. Check your conditions, the column you picked, or the calculation.';
  if (ordered && a.join('\u0002') !== b.join('\u0002')) return 'Right rows, but in the wrong order. Check ORDER BY and ASC / DESC.';
  return null;
}
function gradeQuest(q, db, res) {
  const want = freshDb(q.db), w = SQLEngine.run(want, q.sol);
  if (q.check) {
    const u = SQLEngine.run(db, q.check), e = SQLEngine.run(want, q.check);
    if (!res.results.length || res.results.every(r => r.kind === 'rows')) return 'This task changes data (UPDATE / INSERT). Your query only reads it.';
    return compare(u.results[0], e.results[0], true);
  }
  const lastRows = [...res.results].reverse().find(r => r.kind === 'rows');
  return compare(lastRows, w.results[w.results.length - 1], q.ordered);
}
const rankOf = xp => RANKS.filter(r => xp >= r[0]).pop();

function schemaHtml(n) {
  return Object.values(baseDb(n).tables).map(t => `<div class="sch"><b>${esc(t.name)}</b> (${t.cols.map(c => `${esc(c.name)} <i>${esc(c.type.toLowerCase())}${c.pk ? ' 🔑' : ''}</i>`).join(', ')})</div>`).join('');
}
function labHeader() {
  const r = rankOf(lab.xp), nx = RANKS.find(x => x[0] > lab.xp), pct = nx ? Math.round((lab.xp - r[0]) / (nx[0] - r[0]) * 100) : 100;
  return `<div class="lab-head"><div><div class="lab-rank">${esc(r[1])}</div><div class="xpbar"><div style="width:${pct}%"></div></div>
    <div class="res-meta">${lab.xp} XP · 🔥 ${liveStreak()}${nx ? ` · ${nx[0] - lab.xp} to ${esc(nx[1])}` : ' · max rank!'} · ${Object.keys(lab.solved).length}/${QUESTS.length} quests</div></div>
    <div class="lab-tabs"><button class="btn ${lab.tab === 'quests' ? 'primary' : ''}" data-action="labtab" data-tab="quests">🎯 Quests</button>
    <button class="btn ${lab.tab === 'play' ? 'primary' : ''}" data-action="labtab" data-tab="play">🧪 Playground</button></div></div>`;
}
const editor = ph => `<textarea id="lab-sql" class="sql" spellcheck="false" autocapitalize="off" autocomplete="off" rows="6" placeholder="${ph}">${esc(lab.drafts[labKey()] || '')}</textarea>`;

const card = q => `<button class="quiz-mode-card lab-card" data-action="labopen" data-id="${q.id}">
  <h3>${lab.solved[q.id] ? '✅' : '▶️'} ${esc(q.title)}</h3><p>${LVL[q.lvl]} · +${LVL_XP[q.lvl]} XP</p>
  <div class="stars">${lab.solved[q.id] ? '⭐'.repeat(lab.solved[q.id]) : ''}</div></button>`;
function gradeSql(id, sql) {                     // used by the mock exam: run the student's SQL and grade it like a quest
  const q = QUESTS.find(x => x.id === id), db = freshDb(q.db), res = SQLEngine.run(db, sql);
  if (res.error) return {ok: false, msg: 'Error: ' + res.error.message};
  const bad = gradeQuest(q, db, res); return {ok: !bad, msg: bad || ''};
}
function renderLab() {
  const dbChips = Object.keys(SEEDS).map(k => `<button class="btn ${lab.db === k ? 'primary' : ''}" data-action="labdb" data-db="${k}">${SEEDS[k].label}</button>`).join('');
  let body;
  if (lab.tab === 'quests' && !lab.open) {
    const dq = dailyQuest(), dDone = lab.dailyDone === dayStr();
 const groups = Object.keys(SEEDS).map(k => `<h3 class="grp">${SEEDS[k].label} <span>${QUESTS.filter(q => q.db === k && lab.solved[q.id]).length}/${QUESTS.filter(q => q.db === k).length}</span></h3><div class="lab-grid">${QUESTS.filter(q => q.db === k).map(card).join('')}</div>`).join('');
    body = `<button class="quiz-mode-card daily" data-action="labopen" data-id="${dq.id}"><h3>📅 Daily challenge: ${esc(dq.title)}</h3>
      <p>${dDone ? '✅ Done today — come back tomorrow for a new one!' : `Solve it today for +${DAILY_BONUS} bonus XP`}</p></button>
      ${groups}`;
  } else if (lab.tab === 'quests') {
    const q = QUESTS.find(x => x.id === lab.open), used = lab.used[q.id] || 0;
    body = `<button class="btn" data-action="labback">← All quests</button>
      <h2 class="lab-title">${esc(q.title)} <span class="keyword-badge">${LVL[q.lvl]}</span></h2><p class="lab-task">${esc(q.task)}</p>
      <details class="lab-schema" open><summary>${SEEDS[q.db].label} database</summary>${schemaHtml(q.db)}</details>
      ${editor('Write your SQL here…  (Ctrl+Enter to run)')}
      <div class="btn-row"><button class="btn primary" data-action="labrun">▶ Run</button>
        <button class="btn" data-action="labhint" ${used >= 3 ? 'disabled' : ''}>💡 Hint (${used}/3)</button>
        ${used >= 3 ? '<button class="btn" data-action="labsol">👀 Show solution</button>' : ''}</div>
      ${used ? `<ol class="lab-hints">${q.hints.slice(0, Math.min(used, 3)).map(h => `<li>${esc(h)}</li>`).join('')}</ol>` : ''}`;
  } else {
    body = `<div class="btn-row">${dbChips}</div><details class="lab-schema" open><summary>Tables</summary>${schemaHtml(lab.db)}</details>
      ${editor('Try anything: SELECT, INSERT, UPDATE, DELETE, CREATE TABLE …  (Ctrl+Enter to run)')}
      <div class="btn-row"><button class="btn primary" data-action="labrun">▶ Run</button><button class="btn danger" data-action="labreset">↺ Reset this database</button></div>
      <p class="res-meta">Your changes here are kept on this device. Reset restores the original data.</p>`;
  }
  root.innerHTML = `<div class="lab">${labHeader()}${body}<div id="lab-out">${labOut}</div></div>`;
}

function labRun() {
  const ta = $('#lab-sql'); if (!ta) return;
  const sql = ta.value; lab.drafts[labKey()] = sql;
  const q = lab.tab === 'quests' && lab.open ? QUESTS.find(x => x.id === lab.open) : null;
  const db = q ? freshDb(q.db) : playDb();
  const res = SQLEngine.run(db, sql);
  let out = '';
  res.results.forEach(r => { out += r.kind === 'rows' ? tableHtml(r) : `<div class="lab-ok">✔ ${esc(r.msg)}</div>`; });
  if (res.error) {
    const hs = SQLHints.forError(res.error, sql, db);
    out += `<div class="lab-err"><b>ERROR ${res.error.code}:</b> ${esc(res.error.message)}</div>` + (hs.length ? `<div class="lab-hint">💡 <b>Hint</b><ul>${hs.map(h => `<li>${esc(h)}</li>`).join('')}</ul></div>` : '');
  } else {
    const soft = SQLHints.soft(sql, res.results[res.results.length - 1]);
    if (soft.length) out += `<div class="lab-hint">💡 <ul>${soft.map(h => `<li>${esc(h)}</li>`).join('')}</ul></div>`;
    if (q) {
      const bad = gradeQuest(q, db, res);
      if (bad) out += `<div class="lab-err">Not quite yet. ${esc(bad)}</div>`;
      else {
        const first = !lab.solved[q.id], used = lab.used[q.id] || 0, stars = used === 0 ? 3 : used < 3 ? 2 : 1;
        const gain = first ? Math.max(5, LVL_XP[q.lvl] - used * 5) : 0, before = rankOf(lab.xp)[1];
        const bonus = q.id === dailyQuest().id && lab.dailyDone !== dayStr() ? DAILY_BONUS : 0;
        if (bonus) lab.dailyDone = dayStr();
        lab.solved[q.id] = Math.max(lab.solved[q.id] || 0, stars); lab.xp += gain + bonus; touchStreak();
        const after = rankOf(lab.xp)[1];
        out += `<div class="lab-win">🎉 Nailed it! ${'⭐'.repeat(stars)} ${first ? `+${gain} XP` : '(already solved)'}${bonus ? ` 📅 +${bonus} daily bonus!` : ''}${after !== before ? `<br>🚀 Rank up: ${esc(after)}` : ''}</div>`;
        const nx = QUESTS[QUESTS.indexOf(q) + 1]; if (nx) out += `<button class="btn primary" data-action="labopen" data-id="${nx.id}">Next quest →</button>`;
      }
    } else if (res.results.some(r => r.kind === 'ok')) savePlay(db);
  }
  if (!q && res.error && res.results.some(r => r.kind === 'ok')) savePlay(db);
  labOut = out; save(); renderLab();
  $('#lab-out').scrollIntoView({block: 'nearest', behavior: 'smooth'});
}
const LAB_ACTIONS = {
  labtab: d => { lab.tab = d.tab; lab.open = null; labOut = ''; save(); renderLab(); },
  labdb: d => { lab.db = d.db; labOut = ''; save(); renderLab(); },
  labopen: d => { lab.open = d.id; lab.tab = 'quests'; labOut = ''; save(); renderLab(); root.scrollTop = 0; },
  labback: () => { lab.open = null; labOut = ''; save(); renderLab(); },
  labrun: () => labRun(),
  labhint: () => { const q = QUESTS.find(x => x.id === lab.open); lab.used[q.id] = Math.min(3, (lab.used[q.id] || 0) + 1); const t = $('#lab-sql'); if (t) lab.drafts[labKey()] = t.value; save(); renderLab(); },
  labsol: () => { const q = QUESTS.find(x => x.id === lab.open); lab.drafts[labKey()] = q.sol + ';'; labOut = '<div class="lab-hint">👀 Solution loaded in the editor. Press Run to see it work. Try to understand each part!</div>'; save(); renderLab(); },
  labreset: () => { if (!confirm('Reset this database to its original data? Your changes will be lost.')) return; try { const all = JSON.parse(localStorage.getItem(PLAY_KEY) || '{}'); delete all[lab.db]; localStorage.setItem(PLAY_KEY, JSON.stringify(all)); } catch (e) { /* ignore */ } labOut = '<div class="lab-ok">✔ Database reset</div>'; renderLab(); },
};
if (typeof module !== 'undefined' && module.exports) module.exports = {SQLHints, SEEDS, QUESTS, freshDb, gradeQuest, compare, gradeSql};
