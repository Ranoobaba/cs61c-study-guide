/*
 * CS61C Fall 2026 Midterm Part I cram: lessons and questions for
 * C coding (Q3), Memory regions (Q2) and CALL (Q1).
 * Rendered by app.js. Everything here is plain data built with a few string helpers.
 * Assumptions: numbers are for a 64-bit machine (as the practice exam states) unless a question says 32-bit;
 * typical gcc/clang struct layout (alignment = size); RISC-V for assembly.
 */
(function () {
  'use strict';

  const R = String.raw;
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  // Inline code: c('p->x') gives <code>p-&gt;x</code>
  const c = (s) => '<code>' + esc(s) + '</code>';
  // Drop one leading blank line and all trailing whitespace from a code template.
  const trimCode = (s) => String(s).replace(/^[ \t]*\n/, '').replace(/\s+$/, '');
  // Code block inside lesson or explanation HTML (escaped here).
  const pre = (s, lang) => '<pre><code class="language-' + (lang || 'c') + '">' + esc(trimCode(s)) + '</code></pre>';
  // Raw source for the question `code` field (app.js escapes it).
  const src = (s) => trimCode(s);
  const trap = (html) => '<div class="alert alert-warning"><b>Exam trap.</b> ' + html + '</div>';
  const tip = (html) => '<div class="alert alert-info">' + html + '</div>';
  const good = (html) => '<div class="alert alert-success">' + html + '</div>';
  const REG = ['Text', 'Data', 'Heap', 'Stack'];
  const STAGES = ['compiler', 'assembler', 'linker', 'loader'];

  // Shared SVG arrow marker. Each SVG gets its own marker id so pages with several SVGs stay valid.
  const arrowDefs = (id, color) => '<defs><marker id="' + id + '" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="' + (color || '#1f2933') + '"/></marker></defs>';

  const NODE_T = src(R`
typedef struct Node {
    char name[6];
    struct Node *left, *right;
    int64_t *data;
} node_t;
`);

  const RECORD_T = src(R`
typedef struct {
    int id;
    int *scores;
    int count;
} Record;
`);

  const PM12_CODE = src(R`
typedef struct Node {
    char name[6];
    struct Node *left, *right;
    int64_t *data;
} node_t;

node_t* node_new(char *name, int64_t data) {
    node_t *n = calloc(1,sizeof(node_t));
    if (!n) return NULL;

    memcpy(n->name, name, strlen(name)+1);
    n->data = malloc(sizeof(int64_t));
    if(!(n->data)) return NULL;

    *(n->data) = data;
    return n;
}

void free_tree(node_t *t) {
    if (!t) return;

    free_tree(t->left);
    free_tree(t->right);
    free(t->data);
    free(t);
}

int main(void) {
    node_t *root = node_new("root", 61);
    free_tree(root);
    return 0;
}
`);

  const modules = [];
  const walkthroughs = [];

  // ===================================================================
  // C 1: Types, sizeof and memory
  // ===================================================================
  const SVG_PADDING = R`
<svg viewBox="0 0 680 196" width="100%" role="img" aria-label="Byte layout on a 64-bit machine: node_t (32 bytes) and Record (24 bytes)">
  <g font-family="ui-monospace, Menlo, monospace" font-size="13" fill="#1f2933">
    <text x="20" y="20" font-weight="700">node_t on 64-bit: 32 bytes</text>
    <rect x="20" y="30" width="120" height="40" fill="#dbeafe" stroke="#1f2933"/>
    <text x="80" y="55" text-anchor="middle">name[6]</text>
    <rect x="140" y="30" width="40" height="40" fill="#f3f4f6" stroke="#1f2933" stroke-dasharray="4 3"/>
    <text x="160" y="55" text-anchor="middle" fill="#6b7280">pad</text>
    <rect x="180" y="30" width="160" height="40" fill="#dcfce7" stroke="#1f2933"/>
    <text x="260" y="55" text-anchor="middle">left (8)</text>
    <rect x="340" y="30" width="160" height="40" fill="#fef3c7" stroke="#1f2933"/>
    <text x="420" y="55" text-anchor="middle">right (8)</text>
    <rect x="500" y="30" width="160" height="40" fill="#fce7f3" stroke="#1f2933"/>
    <text x="580" y="55" text-anchor="middle">data (8)</text>
    <g font-size="12" fill="#5b6673" text-anchor="middle">
      <text x="20" y="88">0</text><text x="140" y="88">6</text><text x="180" y="88">8</text>
      <text x="340" y="88">16</text><text x="500" y="88">24</text><text x="660" y="88">32</text>
    </g>
    <text x="20" y="118" font-weight="700">Record on 64-bit: 24 bytes</text>
    <rect x="20" y="128" width="80" height="40" fill="#dbeafe" stroke="#1f2933"/>
    <text x="60" y="153" text-anchor="middle">id (4)</text>
    <rect x="100" y="128" width="80" height="40" fill="#f3f4f6" stroke="#1f2933" stroke-dasharray="4 3"/>
    <text x="140" y="153" text-anchor="middle" fill="#6b7280">pad</text>
    <rect x="180" y="128" width="160" height="40" fill="#dcfce7" stroke="#1f2933"/>
    <text x="260" y="153" text-anchor="middle">scores (8)</text>
    <rect x="340" y="128" width="80" height="40" fill="#fef3c7" stroke="#1f2933"/>
    <text x="380" y="153" text-anchor="middle">count (4)</text>
    <rect x="420" y="128" width="80" height="40" fill="#f3f4f6" stroke="#1f2933" stroke-dasharray="4 3"/>
    <text x="460" y="153" text-anchor="middle" fill="#6b7280">pad</text>
    <g font-size="12" fill="#5b6673" text-anchor="middle">
      <text x="20" y="186">0</text><text x="100" y="186">4</text><text x="180" y="186">8</text>
      <text x="340" y="186">16</text><text x="420" y="186">20</text><text x="500" y="186">24</text>
    </g>
  </g>
</svg>`;

  // Same structs and the same 20px-per-byte scale as SVG_PADDING, with 4-byte pointers.
  const SVG_PADDING_32 = R`
<svg viewBox="0 0 680 196" width="100%" role="img" aria-label="Byte layout on a 32-bit machine: node_t (20 bytes) and Record (12 bytes, no padding)">
  <g font-family="ui-monospace, Menlo, monospace" font-size="13" fill="#1f2933">
    <text x="20" y="20" font-weight="700">node_t on 32-bit: 20 bytes</text>
    <rect x="20" y="30" width="120" height="40" fill="#dbeafe" stroke="#1f2933"/>
    <text x="80" y="55" text-anchor="middle">name[6]</text>
    <rect x="140" y="30" width="40" height="40" fill="#f3f4f6" stroke="#1f2933" stroke-dasharray="4 3"/>
    <text x="160" y="55" text-anchor="middle" fill="#6b7280">pad</text>
    <rect x="180" y="30" width="80" height="40" fill="#dcfce7" stroke="#1f2933"/>
    <text x="220" y="55" text-anchor="middle" font-size="12">left (4)</text>
    <rect x="260" y="30" width="80" height="40" fill="#fef3c7" stroke="#1f2933"/>
    <text x="300" y="55" text-anchor="middle" font-size="12">right (4)</text>
    <rect x="340" y="30" width="80" height="40" fill="#fce7f3" stroke="#1f2933"/>
    <text x="380" y="55" text-anchor="middle" font-size="12">data (4)</text>
    <g font-size="12" fill="#5b6673" text-anchor="middle">
      <text x="20" y="88">0</text><text x="140" y="88">6</text><text x="180" y="88">8</text>
      <text x="260" y="88">12</text><text x="340" y="88">16</text><text x="420" y="88">20</text>
    </g>
    <text x="20" y="118" font-weight="700">Record on 32-bit: 12 bytes, no padding</text>
    <rect x="20" y="128" width="80" height="40" fill="#dbeafe" stroke="#1f2933"/>
    <text x="60" y="153" text-anchor="middle" font-size="12">id (4)</text>
    <rect x="100" y="128" width="80" height="40" fill="#dcfce7" stroke="#1f2933"/>
    <text x="140" y="153" text-anchor="middle" font-size="12">scores (4)</text>
    <rect x="180" y="128" width="80" height="40" fill="#fef3c7" stroke="#1f2933"/>
    <text x="220" y="153" text-anchor="middle" font-size="12">count (4)</text>
    <g font-size="12" fill="#5b6673" text-anchor="middle">
      <text x="20" y="186">0</text><text x="100" y="186">4</text><text x="180" y="186">8</text>
      <text x="260" y="186">12</text>
    </g>
  </g>
</svg>`;

  modules.push({
    id: 'c1-types',
    section: 'C coding',
    title: 'C 1: Types, sizeof and memory',
    minutes: 20,
    quickCheck: ['c1-q4', 'c1-q5'],
    lesson: [
      {
        title: 'The sizes you must memorize (32-bit and 64-bit)',
        html: R`
<p>Every value in C occupies some number of <b>bytes</b>. Most sizes are the same on every machine, but an <b>address</b> is as wide as the machine: 4 bytes on a <b>32-bit</b> machine and 8 bytes on a <b>64-bit</b> machine.</p>
<p>Lecture's RISC-V is 32-bit (RV32), so class examples usually have 4-byte pointers. The practice exam's memory regions question says "Assume a 64-bit system". The real exam can use either, so <b>read the question's assumption line first</b>. Only the last three rows of this table change:</p>
<table class="table table-sm">
<thead><tr><th>Type</th><th class="text-nowrap">32-bit</th><th class="text-nowrap">64-bit</th><th>Notes</th></tr></thead>
<tbody>
<tr><td>${c('char')}, ${c('int8_t')}, ${c('uint8_t')}</td><td>1</td><td>1</td><td>${c('sizeof(char)')} is 1 by definition</td></tr>
<tr><td>${c('short')}, ${c('int16_t')}</td><td>2</td><td>2</td><td></td></tr>
<tr><td>${c('int')}, ${c('int32_t')}, ${c('float')}</td><td>4</td><td>4</td><td><b>int is 4 on both</b></td></tr>
<tr><td>${c('int64_t')}, ${c('uint64_t')}, ${c('long long')}, ${c('double')}</td><td>8</td><td>8</td><td>the 64-bit types are 8 on both</td></tr>
<tr class="table-warning"><td>${c('long')}</td><td><b>4</b></td><td><b>8</b></td><td>changes</td></tr>
<tr class="table-warning"><td>${c('size_t')}</td><td><b>4</b></td><td><b>8</b></td><td>unsigned; the type that ${c('sizeof')} and ${c('strlen')} return (print with ${c('%zu')})</td></tr>
<tr class="table-warning"><td><b>any pointer</b>: ${c('char *')}, ${c('int *')}, ${c('void *')}, ${c('node_t *')}, ${c('int **')}</td><td><b>4</b></td><td><b>8</b></td><td>a pointer holds one address</td></tr>
</tbody>
</table>
<p><b>The pointer rule.</b> A pointer's size depends on the machine, not on what it points to. ${c('char *')} and ${c('node_t *')} are the same size because each holds exactly one address: 4 bytes on 32-bit, 8 bytes on 64-bit.</p>
<p><b>What sizeof is.</b> ${c('sizeof')} is worked out by the compiler before the program runs. It works on a type, like ${c('sizeof(int)')}, or on an expression, like ${c('sizeof(x)')}, ${c('sizeof(*p)')} or ${c('sizeof(a[0])')}. It never runs the expression; it only looks at its type.</p>
<p><b>On this page</b>, numbers are for a 64-bit machine, like the practice exam, unless a question says 32-bit. Some questions ask for 32-bit on purpose.</p>
${trap(`${c('int')} is 4 bytes on both machines. Only pointers, ${c('long')} and ${c('size_t')} change between 32-bit and 64-bit. ${c('double')} and ${c('int64_t')} are 8 on both.`)}
`
      },
      {
        title: 'Arrays vs pointers under sizeof',
        html: R`
<p>An <b>array</b> is a block of elements sitting right there in memory. A <b>pointer</b> is one small box that holds an address (8 bytes on 64-bit, 4 on 32-bit). ${c('sizeof')} tells them apart:</p>
${pre(R`
int a[10];                 // 10 ints sitting right here: 40 bytes
int *p = a;                // p holds the address of a[0]

sizeof(a)                  // 40  (the whole array, on both machines)
sizeof(p)                  // 8   (just the pointer; 4 on 32-bit)
sizeof(a[0])               // 4   (one int)
sizeof(a) / sizeof(a[0])   // 10  (element count; only works on a real array)
`)}
<p><b>Decay.</b> When you use an array's name in almost any expression, including passing it to a function, C quietly turns it into a pointer to its first element. So a parameter that <i>looks</i> like an array is really a pointer:</p>
${pre(R`
void f(int arr[100]) {     // the compiler reads this as: int *arr
    sizeof(arr);           // 8 (a pointer; 4 on 32-bit), not 400!
}
`)}
<p>That is why C functions that take arrays also take a length, like ${c('n')} and ${c('counts[i]')} in the exam question. Once you only hold a pointer, nothing in memory tells you how many elements follow it.</p>
<p>Strings follow the same rule: ${c('char s[] = "hi";')} is a 3-byte array (h, i and the terminating zero byte), so ${c('sizeof(s)')} is 3. But ${c('char *t = "hi";')} is a pointer, so ${c('sizeof(t)')} is the pointer size: 8 (or 4 on 32-bit).</p>
${trap(`Using ${c('sizeof(ptr)')} as "the size of the buffer" is a classic bug. For a pointer it is always the pointer size (8, or 4 on 32-bit), whatever the buffer size.`)}
`
      },
      {
        title: 'Struct padding: two rules',
        html: R`
<p>A struct stores its fields in the order you wrote them, but the compiler may insert unused <b>padding</b> bytes so that every field is <b>aligned</b> (starts at an address the hardware likes).</p>
<ol>
<li><b>Each field starts at an offset that is a multiple of its own alignment.</b> For basic types, alignment = size (char 1, int 4, double 8, pointer 8 on 64-bit or 4 on 32-bit). An array aligns like one element, so ${c('char name[6]')} aligns to 1 and ${c('int v[3]')} aligns to 4. A nested struct aligns like its strictest field.</li>
<li><b>The total size is rounded up to a multiple of the largest alignment in the struct</b>, so every element of an array of these structs is aligned too.</li>
</ol>
<p><b>Procedure:</b> keep a running offset starting at 0. For each field, round the offset up to the field's alignment, place the field, and add its size. At the end, round the total up to the largest alignment.</p>
<p>Worked on a 64-bit machine (the 32-bit version is in the next section):</p>
${SVG_PADDING}
<table class="table table-sm">
<thead><tr><th>node_t field</th><th>size</th><th>align</th><th>offset</th><th>why</th></tr></thead>
<tbody>
<tr><td>${c('char name[6]')}</td><td>6</td><td>1</td><td>0</td><td>bytes 0 to 5</td></tr>
<tr><td><i>padding</i></td><td>2</td><td></td><td>6</td><td>next field is a pointer, which must start at a multiple of 8</td></tr>
<tr><td>${c('struct Node *left')}</td><td>8</td><td>8</td><td>8</td><td>bytes 8 to 15</td></tr>
<tr><td>${c('struct Node *right')}</td><td>8</td><td>8</td><td>16</td><td>bytes 16 to 23</td></tr>
<tr><td>${c('int64_t *data')}</td><td>8</td><td>8</td><td>24</td><td>bytes 24 to 31</td></tr>
<tr><td colspan="5"><b>Total 32</b>, already a multiple of 8, so no tail padding.</td></tr>
</tbody>
</table>
<p><b>Record</b> (${c('int id; int *scores; int count;')}): id at 0 to 3, 4 bytes of padding so the pointer starts at 8, scores at 8 to 15, count at 16 to 19. That is 20 bytes, rounded up to a multiple of 8 (the largest alignment) = <b>24</b>.</p>
${tip(`Sorting fields from biggest to smallest removes most padding: on 64-bit, ${c('{ int *scores; int id; int count; }')} is only 16 bytes. You can't change the exam's struct, but this is a handy check on your understanding.`)}
`
      },
      {
        title: '32-bit vs 64-bit: what changes on the exam',
        html: R`
<p>Run the same padding procedure with 4-byte pointers (alignment 4) and the exam's structs shrink:</p>
${SVG_PADDING_32}
<table class="table table-sm">
<thead><tr><th>Expression</th><th class="text-nowrap">32-bit</th><th class="text-nowrap">64-bit</th><th>Why</th></tr></thead>
<tbody>
<tr><td>${c('sizeof(char *)')}, ${c('sizeof(int **)')}, ${c('sizeof(Record *)')}</td><td>4</td><td>8</td><td>any pointer is one address</td></tr>
<tr><td>${c('sizeof(node_t)')}</td><td>20</td><td>32</td><td>32-bit: name 0 to 5, 2 padding, left 8, right 12, data 16. 20 is already a multiple of 4.</td></tr>
<tr><td>${c('sizeof(Record)')}</td><td>12</td><td>24</td><td>32-bit: id 0, scores 4, count 8. Every field is 4 bytes, so no padding at all.</td></tr>
<tr><td>${c('sizeof(Node)')} (${c('int val; struct Node *next;')})</td><td>8</td><td>16</td><td>the 4 padding bytes only exist to align an 8-byte pointer</td></tr>
<tr><td>${c('struct { char a; int b; char c; }')}</td><td>12</td><td>12</td><td>no pointers, so no change</td></tr>
<tr><td>${c('struct { char c; double d; short s; }')}</td><td>24</td><td>24</td><td>double is 8 bytes with alignment 8 on both, so no change</td></tr>
</tbody>
</table>
<p><b>What does not change:</b></p>
<ul>
<li><b>Memory regions:</b> where something lives depends on how it was made (local, malloc, global, function, literal), never on its size. The answers are the same on both machines.</li>
<li><b>CALL, FSMs, timing and Boolean algebra:</b> nothing in them depends on pointer size. RISC-V instructions are 32 bits wide on both.</li>
<li><b>Your C code</b>, as long as you write ${c('sizeof(Record)')}, ${c('sizeof(char *)')} or ${c('sizeof(*recs)')} and never a number like 4, 8 or 24. Then the same code is correct on both machines.</li>
</ul>
${trap(`If you learned on 32-bit and write ${c('malloc(n * 4)')} for an array of n pointers, a 64-bit grader sees every write past the halfway point as out of bounds. ${c('malloc(n * sizeof(char *))')} is right everywhere.`)}
${good(`The classic bugs are bugs on both machines. ${c('sizeof(Record *)')} is a third of ${c('sizeof(Record)')} either way (4 vs 12, 8 vs 24), and ${c('sizeof(ptr)')} is never the buffer size, whether it says 4 or 8.`)}
`
      }
    ],
    questions: [
      {
        id: 'c1-q1', type: 'number', difficulty: 'core', unit: 'bytes',
        prompt: R`On a 64-bit machine, what is ${c('sizeof(char **)')}?`,
        answer: 8,
        explain: R`<p>${c('char **')} is a pointer (to a pointer to char). Every pointer holds exactly one address, and on a 64-bit machine an address is 8 bytes. What it points to doesn't matter: ${c('char *')}, ${c('int **')} and ${c('node_t *')} are all 8.</p>`
      },
      {
        id: 'c1-q13', type: 'number', difficulty: 'core', unit: 'bytes',
        prompt: R`Now on a <b>32-bit</b> machine (like lecture's RV32 RISC-V), what is ${c('sizeof(char **)')}?`,
        answer: 4,
        explain: R`<p>Still one address, but on a 32-bit machine an address is 32 bits = <b>4</b> bytes. Every pointer type (${c('char *')}, ${c('int **')}, ${c('node_t *')}) is 4 there.</p>`
      },
      {
        id: 'c1-q2', type: 'number', difficulty: 'core', unit: 'bytes',
        prompt: R`Inside the same function that declares it, what is ${c('sizeof(a)')}?`,
        code: src(R`
int a[10];
`),
        answer: 40,
        explain: R`<p>Here ${c('a')} is a real array, so ${c('sizeof')} measures the whole thing: 10 elements times 4 bytes per ${c('int')} = <b>40</b>. Only after ${c('a')} decays into a pointer (for example, once it has been passed to a function) would ${c('sizeof')} give the pointer size (8 on 64-bit). The 40 is the same on both machines.</p>`
      },
      {
        id: 'c1-q3', type: 'number', difficulty: 'core', unit: 'bytes',
        prompt: R`This is the struct from the practice exam. On a 64-bit machine, what is ${c('sizeof(node_t)')}?`,
        code: NODE_T,
        answer: 32,
        explain: R`<p>Walk the fields with a running offset:</p>
<ul>
<li>${c('name[6]')}: 6 chars, alignment 1, bytes 0 to 5.</li>
<li>${c('left')} is a pointer, alignment 8. Offset 6 isn't a multiple of 8, so 2 bytes of padding, then left at 8 to 15.</li>
<li>${c('right')}: 16 to 23. ${c('data')}: 24 to 31.</li>
</ul>
<p>Total 6 + 2 + 8 + 8 + 8 = <b>32</b>, which is already a multiple of 8 (the largest alignment).</p>`
      },
      {
        id: 'c1-q15', type: 'number', difficulty: 'exam+', unit: 'bytes',
        prompt: R`The same struct on a <b>32-bit</b> machine. What is ${c('sizeof(node_t)')}?`,
        code: NODE_T,
        answer: 20,
        explain: R`<p>Pointers are now 4 bytes with alignment 4:</p>
<ul>
<li>${c('name[6]')}: bytes 0 to 5.</li>
<li>${c('left')} needs a multiple of 4. Offset 6 isn't one, so 2 bytes of padding, then left at 8 to 11.</li>
<li>${c('right')}: 12 to 15. ${c('data')}: 16 to 19.</li>
</ul>
<p>Total 20, already a multiple of 4, so <b>20</b>.</p>
<p>The trap is ${c('data')}: it points at an 8-byte ${c('int64_t')}, but the field itself is a pointer, so it is 4 bytes here. Answering 24 usually means you treated it as 8 bytes.</p>`
      },
      {
        id: 'c1-q4', type: 'number', difficulty: 'core', unit: 'bytes',
        prompt: R`This is the struct from the practice C question. On a 64-bit machine, what is ${c('sizeof(Record)')}?`,
        code: RECORD_T,
        answer: 24,
        explain: R`<p>${c('id')}: bytes 0 to 3. ${c('scores')} is a pointer and needs a multiple of 8, so bytes 4 to 7 are padding and scores is 8 to 15. ${c('count')}: 16 to 19. That's 20 bytes; round up to a multiple of 8 (the largest alignment) to get <b>24</b>. The 4 tail-padding bytes keep ${c('recs[1].scores')} aligned in an array of Records.</p>
<p>So ${c('calloc61(n, sizeof(Record))')} allocates 24n bytes.</p>`
      },
      {
        id: 'c1-q14', type: 'number', difficulty: 'core', unit: 'bytes',
        prompt: R`The same struct on a <b>32-bit</b> machine. What is ${c('sizeof(Record)')}?`,
        code: RECORD_T,
        answer: 12,
        explain: R`<p>${c('id')}: bytes 0 to 3. ${c('scores')} is now a 4-byte pointer with alignment 4, and offset 4 is already a multiple of 4, so no padding: scores at 4 to 7. ${c('count')}: 8 to 11. Total 12, a multiple of 4 (the largest alignment): <b>12</b>.</p>
<p>Compare 24 on 64-bit: the pointer doubled to 8 bytes, and that created 8 bytes of padding too.</p>`
      },
      {
        id: 'c1-q5', type: 'number', difficulty: 'exam+', unit: 'bytes',
        prompt: R`On a 64-bit machine, what number does this program print?`,
        code: src(R`
void show(int arr[100]) {
    printf("%zu\n", sizeof(arr));
}

int main(void) {
    int nums[100];
    show(nums);
    return 0;
}
`),
        answer: 8,
        explain: R`<p>An array parameter is really a pointer: ${c('int arr[100]')} in a parameter list means ${c('int *arr')}, and the 100 is ignored. ${c('sizeof(arr)')} is the size of a pointer: <b>8</b>. (In ${c('main')}, ${c('sizeof(nums)')} would be 400, because there it's a real array.) Many compilers even warn about this.</p>
<p>On a 32-bit machine the same program prints 4.</p>`
      },
      {
        id: 'c1-q6', type: 'number', difficulty: 'exam+', unit: 'bytes',
        prompt: R`What is ${c('sizeof(struct A)')}?`,
        code: src(R`
struct A {
    char a;
    int b;
    char c;
};
`),
        answer: 12,
        explain: R`<p>${c('a')} at offset 0. ${c('b')} needs a multiple of 4, so 3 bytes of padding and b at 4 to 7. ${c('c')} at 8. That's 9 bytes; round up to a multiple of 4 (the largest alignment, from int) = <b>12</b>.</p>
<p>Common wrong answers: 6 (forgot padding), 9 (forgot the tail rounding), 16 (rounded to 8, but nothing here needs 8).</p>
<p>No pointers or longs, so it's 12 on a 32-bit machine too.</p>`
      },
      {
        id: 'c1-q7', type: 'number', difficulty: 'exam+', unit: 'bytes',
        prompt: R`Same three fields, different order. What is ${c('sizeof(struct B)')}?`,
        code: src(R`
struct B {
    int b;
    char a;
    char c;
};
`),
        answer: 8,
        explain: R`<p>${c('b')} at 0 to 3, ${c('a')} at 4, ${c('c')} at 5 (chars need no padding). That's 6 bytes; round up to a multiple of 4 = <b>8</b>. Field order changes the size: the same fields took 12 bytes in the order char, int, char. Both answers are the same on 32-bit and 64-bit.</p>`
      },
      {
        id: 'c1-q8', type: 'number', difficulty: 'exam+', unit: 'bytes',
        prompt: R`What is ${c('sizeof(struct C)')}?`,
        code: src(R`
struct C {
    char c;
    double d;
    short s;
};
`),
        answer: 24,
        explain: R`<p>${c('c')} at 0. ${c('d')} is 8 bytes with alignment 8, so 7 bytes of padding and d at 8 to 15. ${c('s')} (2 bytes) at 16 to 17. That's 18 bytes; round up to a multiple of 8 = <b>24</b>.</p>
<p>Same on a 32-bit machine: a double is 8 bytes with alignment 8 there too. Only pointers, long and size_t change size.</p>`
      },
      {
        id: 'c1-q9', type: 'number', difficulty: 'exam+', unit: 'bytes',
        prompt: R`On a 64-bit machine, a ${c('node_t')} starts at address ${c('0x1000')}. Its ${c('data')} field starts at ${c('0x1000 + k')}. What is k?`,
        code: NODE_T,
        answer: 24,
        explain: R`<p>Offsets: name 0, padding 6 to 7, left 8, right 16, data <b>24</b>. So ${c('&n->data')} is ${c('0x1018')} (24 in hex is 0x18).</p>
<p>On a 32-bit machine: left 8, right 12, data 16, so ${c('&n->data')} would be ${c('0x1010')}.</p>`
      },
      {
        id: 'c1-q10', type: 'number', difficulty: 'exam+', unit: 'bytes',
        prompt: R`What is ${c('sizeof(struct Outer)')}?`,
        code: src(R`
struct Pair {
    int a;
    char b;
};

struct Outer {
    char c;
    struct Pair p;
};
`),
        answer: 12,
        explain: R`<p>First size ${c('struct Pair')}: a at 0 to 3, b at 4, total 5 rounded up to a multiple of 4 = 8. Its alignment is 4 (its strictest field), <b>not</b> 8.</p>
<p>In ${c('Outer')}: c at 0, padding 1 to 3, p at 4 to 11. Total 12, a multiple of 4, so <b>12</b>.</p>
<p>The trap is aligning ${c('p')} to 8 because Pair is 8 bytes. A struct aligns like its largest field, not like its total size. (No pointers, so 12 on both machines.)</p>`
      },
      {
        id: 'c1-q11', type: 'text', difficulty: 'exam+', normalize: 'nospace',
        prompt: R`On a 64-bit machine, what does this print? (Type the output exactly, numbers separated by spaces.)`,
        code: src(R`
char a[] = "hello!";
char *p = a;
printf("%zu %zu %zu\n", sizeof(a), sizeof(p), strlen(p));
`),
        answer: '7 8 6',
        explain: R`<ul>
<li>${c('sizeof(a)')}: a is an array holding the 6 letters plus the terminating zero byte: <b>7</b>.</li>
<li>${c('sizeof(p)')}: p is a pointer: <b>8</b>.</li>
<li>${c('strlen(p)')}: counts characters before the zero byte: <b>6</b>.</li>
</ul>`
      },
      {
        id: 'c1-q12', type: 'mcq', difficulty: 'exam+',
        prompt: R`A function receives ${c('int *scores')}, pointing at the first of several ints. How can the function find out how many ints there are?`,
        options: [
          R`${c('sizeof(scores) / sizeof(int)')}`,
          R`${c('sizeof(*scores)')}`,
          R`${c('strlen(scores)')}`,
          R`It can't. The caller has to pass the count separately (like ${c('counts[i]')} in the exam).`
        ],
        answer: 3,
        whyWrong: [
          R`${c('sizeof(scores)')} is the size of the pointer, so this is always 8 / 4 = 2 on 64-bit (or 4 / 4 = 1 on 32-bit), no matter how many ints there are.`,
          R`That's the size of one int: 4.`,
          R`${c('strlen')} is for char strings and stops at a zero byte. Int arrays have no terminator, and a score of 0 would stop it early anyway.`,
          null
        ],
        explain: R`<p>A pointer is just one address. Nothing stored there records how many elements follow. That's why the exam hands you ${c('counts[i]')} next to ${c('score_lists[i]')}, and ${c('n')} next to ${c('ids')}. Use those lengths, never ${c('sizeof')} on a pointer.</p>`
      },
      {
        id: 'c1-q16', type: 'multi', difficulty: 'core',
        prompt: R`Which of these have a <b>different</b> ${c('sizeof')} on a 32-bit machine than on a 64-bit machine? Select every one.`,
        options: [
          R`${c('int')}`,
          R`${c('char *')}`,
          R`${c('long')}`,
          R`${c('double')}`,
          R`${c('size_t')}`,
          R`${c('int64_t')}`,
          R`${c('struct { char a; int b; char c; }')}`
        ],
        answer: [1, 2, 4],
        explain: R`<ul>
<li>${c('char *')} (any pointer): 4 vs 8. <b>Changes.</b></li>
<li>${c('long')}: 4 vs 8. <b>Changes.</b></li>
<li>${c('size_t')}: 4 vs 8. <b>Changes.</b> It has to be able to count every byte of memory, so it matches the address size.</li>
<li>${c('int')} is 4 on both, ${c('double')} and ${c('int64_t')} are 8 on both.</li>
<li>The struct has no pointers or longs, so it's 12 on both.</li>
</ul>`
      },
      {
        id: 'c1-q17', type: 'text', difficulty: 'exam+', normalize: 'nospace',
        prompt: R`Same code as before, but now on a <b>32-bit</b> machine. What does it print? (Numbers separated by spaces.)`,
        code: src(R`
char a[] = "hello!";
char *p = a;
printf("%zu %zu %zu\n", sizeof(a), sizeof(p), strlen(p));
`),
        answer: '7 4 6',
        explain: R`<ul>
<li>${c('sizeof(a)')}: an array of 6 letters plus the zero byte. Chars are 1 byte on every machine: <b>7</b>.</li>
<li>${c('sizeof(p)')}: a pointer, 4 bytes on a 32-bit machine: <b>4</b>.</li>
<li>${c('strlen(p)')}: still 6 letters before the zero byte: <b>6</b>.</li>
</ul>
<p>Only the middle number changed. That's the pattern: the machine only changes the size of pointers (and long and size_t), never of chars, ints or arrays of them.</p>`
      },
      {
        id: 'c1-q18', type: 'dropdowns', difficulty: 'exam+',
        prompt: R`For each expression, choose its value on the machine named. The exam can change the assumption line between variants, so practice switching.`,
        code: src(R`
typedef struct {
    int id;
    int *scores;
    int count;
} Record;

typedef struct Node {
    char name[6];
    struct Node *left, *right;
    int64_t *data;
} node_t;

struct S {
    char c;
    char *p;
    char d;
};
`),
        choices: ['4', '8', '12', '16', '20', '24', '32'],
        items: [
          { label: R`${c('sizeof(Record)')} on 32-bit`, answer: '12', explain: R`id 0, scores 4, count 8, no padding: 12.` },
          { label: R`${c('sizeof(Record)')} on 64-bit`, answer: '24', explain: R`id 0, 4 padding, scores 8, count 16, 4 tail padding: 24.` },
          { label: R`${c('sizeof(Record *)')} on 32-bit`, answer: '4', explain: R`Any pointer on a 32-bit machine: 4.` },
          { label: R`${c('sizeof(node_t)')} on 32-bit`, answer: '20', explain: R`name 0 to 5, 2 padding, then three 4-byte pointers at 8, 12 and 16: 20.` },
          { label: R`${c('sizeof(node_t)')} on 64-bit`, answer: '32', explain: R`name 0 to 5, 2 padding, then three 8-byte pointers at 8, 16 and 24: 32.` },
          { label: R`${c('sizeof(struct S)')} on 32-bit`, answer: '12', explain: R`c at 0, 3 padding, p at 4 to 7, d at 8. 9 bytes rounded up to a multiple of 4: 12.` },
          { label: R`${c('sizeof(struct S)')} on 64-bit`, answer: '24', explain: R`c at 0, 7 padding, p at 8 to 15, d at 16. 17 bytes rounded up to a multiple of 8: 24.` }
        ],
        explain: R`<p>Same procedure every time (running offset, align each field, round the total up). The only thing the machine changes is that pointers are 4 bytes with alignment 4 on 32-bit, and 8 with alignment 8 on 64-bit.</p>`
      }
    ]
  });

  // ===================================================================
  // C 2: Pointers
  // ===================================================================
  const SVG_POINTER = R`
<svg viewBox="0 0 640 170" width="100%" role="img" aria-label="p holds the address of x and points to it">
  ${arrowDefs('c2ArrowA')}
  <g font-family="ui-monospace, Menlo, monospace" font-size="14" fill="#1f2933">
    <text x="130" y="38" text-anchor="middle" font-weight="700">x (an int)</text>
    <rect x="60" y="48" width="140" height="50" rx="4" fill="#dcfce7" stroke="#1f2933"/>
    <text x="130" y="79" text-anchor="middle" font-size="18">9</text>
    <text x="130" y="120" text-anchor="middle" font-size="12" fill="#5b6673">lives at address 0x1000</text>
    <text x="470" y="38" text-anchor="middle" font-weight="700">p (an int *)</text>
    <rect x="380" y="48" width="180" height="50" rx="4" fill="#dbeafe" stroke="#1f2933"/>
    <text x="470" y="79" text-anchor="middle" font-size="18">0x1000</text>
    <text x="470" y="120" text-anchor="middle" font-size="12" fill="#5b6673">lives at address 0x2000</text>
    <line x1="380" y1="73" x2="204" y2="73" stroke="#1d4ed8" stroke-width="2.5" marker-end="url(#c2ArrowA)"/>
    <text x="292" y="64" text-anchor="middle" font-size="12" fill="#1d4ed8">*p follows</text>
    <text x="320" y="152" text-anchor="middle" font-size="12" fill="#5b6673">&amp;x is 0x1000, p is 0x1000, *p is 9, &amp;p is 0x2000</text>
  </g>
</svg>`;

  const SVG_PTRPTR = R`
<svg viewBox="0 0 680 240" width="100%" role="img" aria-label="score_lists points to an array of int pointers, each pointing to its own int array">
  ${arrowDefs('c2ArrowB')}
  <g font-family="ui-monospace, Menlo, monospace" font-size="13" fill="#1f2933">
    <text x="80" y="80" text-anchor="middle" font-weight="700">score_lists</text>
    <text x="80" y="96" text-anchor="middle" font-size="11" fill="#5b6673">int **</text>
    <rect x="20" y="104" width="120" height="40" rx="4" fill="#dbeafe" stroke="#1f2933"/>
    <circle cx="80" cy="124" r="4" fill="#1f2933"/>
    <text x="275" y="28" text-anchor="middle" font-weight="700">array of int *</text>
    <rect x="220" y="40" width="110" height="44" fill="#fef3c7" stroke="#1f2933"/>
    <rect x="220" y="84" width="110" height="44" fill="#fef3c7" stroke="#1f2933"/>
    <rect x="220" y="128" width="110" height="44" fill="#fef3c7" stroke="#1f2933"/>
    <text x="230" y="67" font-size="12" fill="#5b6673">[0]</text>
    <text x="230" y="111" font-size="12" fill="#5b6673">[1]</text>
    <text x="230" y="155" font-size="12" fill="#5b6673">[2]</text>
    <circle cx="300" cy="62" r="4" fill="#1f2933"/><circle cx="300" cy="106" r="4" fill="#1f2933"/><circle cx="300" cy="150" r="4" fill="#1f2933"/>
    <line x1="84" y1="124" x2="216" y2="64" stroke="#1d4ed8" stroke-width="2" marker-end="url(#c2ArrowB)"/>
    <text x="510" y="28" text-anchor="middle" font-weight="700">int arrays (one per list)</text>
    <rect x="420" y="40" width="60" height="44" fill="#dcfce7" stroke="#1f2933"/><text x="450" y="67" text-anchor="middle">90</text>
    <rect x="480" y="40" width="60" height="44" fill="#dcfce7" stroke="#1f2933"/><text x="510" y="67" text-anchor="middle">85</text>
    <rect x="420" y="84" width="60" height="44" fill="#dcfce7" stroke="#1f2933"/><text x="450" y="111" text-anchor="middle">70</text>
    <rect x="480" y="84" width="60" height="44" fill="#dcfce7" stroke="#1f2933"/><text x="510" y="111" text-anchor="middle">60</text>
    <rect x="540" y="84" width="60" height="44" fill="#dcfce7" stroke="#1f2933"/><text x="570" y="111" text-anchor="middle">50</text>
    <rect x="420" y="128" width="60" height="44" fill="#dcfce7" stroke="#1f2933"/><text x="450" y="155" text-anchor="middle">100</text>
    <line x1="304" y1="62" x2="416" y2="62" stroke="#1d4ed8" stroke-width="2" marker-end="url(#c2ArrowB)"/>
    <line x1="304" y1="106" x2="416" y2="106" stroke="#1d4ed8" stroke-width="2" marker-end="url(#c2ArrowB)"/>
    <line x1="304" y1="150" x2="416" y2="150" stroke="#1d4ed8" stroke-width="2" marker-end="url(#c2ArrowB)"/>
    <text x="340" y="205" text-anchor="middle" font-size="12" fill="#5b6673">counts = {2, 3, 1}: the lists have different lengths, so you need counts[i]</text>
    <text x="340" y="226" text-anchor="middle" font-size="12" fill="#5b6673">score_lists[1] is the int * in slot [1]; score_lists[1][2] is 50</text>
  </g>
</svg>`;

  modules.push({
    id: 'c2-pointers',
    section: 'C coding',
    title: 'C 2: Pointers',
    minutes: 25,
    quickCheck: ['c2-q2', 'c2-q6'],
    lesson: [
      {
        title: 'A pointer is just an address',
        html: R`
<p>Picture memory as one long row of numbered boxes, one box per byte. A box's number is its <b>address</b>. A <b>pointer</b> is a variable whose value is an address.</p>
${pre(R`
int x = 7;      // 4 bytes somewhere, say starting at address 0x1000
int *p = &x;    // &x means "the address of x", so p holds 0x1000
*p = 9;         // *p means "the int at the address in p", so x becomes 9
`)}
${SVG_POINTER}
<table class="table table-sm">
<thead><tr><th>Expression</th><th>Type</th><th>Value</th></tr></thead>
<tbody>
<tr><td>${c('x')}</td><td>${c('int')}</td><td>9</td></tr>
<tr><td>${c('&x')}</td><td>${c('int *')}</td><td>0x1000</td></tr>
<tr><td>${c('p')}</td><td>${c('int *')}</td><td>0x1000</td></tr>
<tr><td>${c('*p')}</td><td>${c('int')}</td><td>9</td></tr>
<tr><td>${c('&p')}</td><td>${c('int **')}</td><td>0x2000</td></tr>
</tbody>
</table>
<p><b>Two operators with opposite jobs.</b> ${c('&')} goes from a thing to its address. ${c('*')} goes from an address to the thing. So ${c('*&x')} is just ${c('x')}.</p>
<p><b>Reading declarations.</b> ${c('int *p;')} reads as "${c('*p')} is an int", so p is a pointer to int. The ${c('*')} in a declaration declares a pointer; the ${c('*')} in an expression like ${c('*p = 9')} follows one. Same symbol, two meanings.</p>
`
      },
      {
        title: 'Pointer arithmetic and a[i]',
        html: R`
<p>Adding an integer to a pointer moves it by that many <b>elements</b>, not bytes. The compiler multiplies by the size of the pointed-to type for you.</p>
${pre(R`
int a[4] = {10, 20, 30, 40};   // say a starts at 0x100
int *p = a;                    // p = 0x100 (the array name decays to &a[0])
p + 1                          // 0x104: one int later, 4 bytes
*(p + 2)                       // 30
p[2]                           // 30, exactly the same thing
char *b = (char *) a;          // same address, but now "points to chars"
b + 1                          // 0x101: one char later, 1 byte
`)}
<p><b>The identity:</b> ${c('a[i]')} is defined to mean ${c('*(a + i)')}. That works for arrays and pointers alike, which is why you can index the pointer returned by ${c('malloc')} as if it were an array.</p>
<table class="table table-sm">
<thead><tr><th>Pointer type</th><th>${c('p + 1')} moves by</th></tr></thead>
<tbody>
<tr><td>${c('char *')}</td><td>1 byte</td></tr>
<tr><td>${c('int *')}</td><td>4 bytes</td></tr>
<tr><td>${c('int64_t *')}, ${c('double *')}</td><td>8 bytes (on both machines)</td></tr>
<tr><td>${c('char **')}, ${c('int **')}, any pointer to a pointer</td><td>the size of one pointer: 8 bytes on 64-bit, 4 on 32-bit</td></tr>
<tr><td>${c('Record *')}</td><td>${c('sizeof(Record)')}: 24 bytes on 64-bit, 12 on 32-bit</td></tr>
</tbody>
</table>
<p><b>Subtracting</b> two pointers into the same array gives the number of elements between them, not bytes: ${c('&a[3] - &a[1]')} is 2.</p>
${trap(`Addresses on exams are in hex, so do the scaling in hex. If ${c('int *p')} holds ${c('0x1000')}, then ${c('p + 3')} is 0x1000 + 12 = ${c('0x100C')}. Not 0x1003 (forgot to scale) and not 0x1012 (wrote decimal 12 as if it were hex).`)}
`
      },
      {
        title: 'Pass by value, and why swap needs pointers',
        html: R`
<p>C always passes <b>a copy</b> of each argument. The function gets its own boxes, and changing them never touches the caller's variables.</p>
${pre(R`
void swap_broken(int a, int b) {   // a and b are copies
    int t = a; a = b; b = t;       // swaps the copies only
}

void swap(int *a, int *b) {        // a and b hold addresses
    int t = *a; *a = *b; *b = t;   // follow them and swap the real ints
}

int x = 1, y = 2;
swap_broken(x, y);   // x is still 1, y is still 2
swap(&x, &y);        // now x is 2, y is 1
`)}
<p><b>Rule:</b> to let a function change a variable of yours, pass that variable's address.</p>
<p>That includes pointer variables. To let a function change <i>which thing</i> your ${c('int *p')} points to, pass ${c('&p')}, which has type ${c('int **')}:</p>
${pre(R`
void set(int **pp, int *target) {
    *pp = target;        // writes into the caller's pointer variable
}

int a = 1, b = 2;
int *p = &a;
set(&p, &b);             // now p points at b
`)}
<p>The same idea explains why ${c('free(p)')} can't set your ${c('p')} to NULL: free only receives a copy of the address.</p>
`
      },
      {
        title: 'Pointers to pointers: int **score_lists',
        html: R`
<p>The exam's ${c('int **score_lists')} points at an array of pointers, and each of those points at its own array of ints. Draw it:</p>
${SVG_PTRPTR}
<p>Read the types by peeling: each ${c('[ ]')} or ${c('*')} removes one star; each ${c('&')} adds one.</p>
<table class="table table-sm">
<thead><tr><th>Expression</th><th>Type</th><th>Meaning</th></tr></thead>
<tbody>
<tr><td>${c('score_lists')}</td><td>${c('int **')}</td><td>address of the first ${c('int *')}</td></tr>
<tr><td>${c('score_lists[i]')} (same as ${c('*(score_lists + i)')})</td><td>${c('int *')}</td><td>address of list i's first score</td></tr>
<tr><td>${c('*score_lists')}</td><td>${c('int *')}</td><td>same as ${c('score_lists[0]')}</td></tr>
<tr><td>${c('score_lists[i][j]')}</td><td>${c('int')}</td><td>score j of list i</td></tr>
<tr><td>${c('&score_lists[i][j]')}</td><td>${c('int *')}</td><td>address of that score</td></tr>
<tr><td>${c('counts[i]')}</td><td>${c('int')}</td><td>how many ints ${c('score_lists[i]')} points to</td></tr>
</tbody>
</table>
${tip(`In build_records, ${c('score_lists[i]')} is a whole list you must copy, and ${c('counts[i]')} is its length. So the copy needs ${c('counts[i] * sizeof(int)')} bytes.`)}
`
      },
      {
        title: 'NULL and bad pointers',
        html: R`
<p>${c('NULL')} is a special pointer value (address 0) that means "points to nothing". Following it (${c('*p')}, ${c('p->x')} or ${c('p[i]')} when p is NULL) crashes the program with a <b>segmentation fault</b>, the error you get when touching memory you're not allowed to.</p>
<p>The four kinds of bad pointer you'll meet:</p>
<ul>
<li><b>NULL from a failed allocation.</b> ${c('malloc')}, ${c('calloc')} and the exam's ${c('calloc61')} return NULL when they fail. Check before using.</li>
<li><b>Uninitialized pointer.</b> ${c('int *p; *p = 5;')} p holds leftover garbage, so this writes to a random address.</li>
<li><b>Pointer to a dead local.</b> A function's locals vanish when it returns, so returning their address hands back garbage:</li>
</ul>
${pre(R`
int *make_array(int n) {
    int arr[100];                      // lives in make_array's stack frame
    for (int i = 0; i < n; i++) arr[i] = i;
    return arr;                        // BUG: arr dies right here
}
`)}
<ul>
<li><b>Pointer after free.</b> After ${c('free(p)')}, p still holds the old address, but the memory is no longer yours (module C5).</li>
</ul>
<p>Any of these is <b>undefined behavior</b>: the C standard makes no promise about what happens. It might seem to work, crash, or quietly corrupt something else.</p>
${trap(`One of the exam's 10 grading categories is "using a NULL from calloc61". Check every allocation result before you touch it.`)}
`
      }
    ],
    questions: [
      {
        id: 'c2-q1', type: 'text', difficulty: 'core', normalize: 'nospace',
        prompt: R`What does this print?`,
        code: src(R`
int x = 5;
int *p = &x;
*p = 9;
printf("%d %d\n", x, *p);
`),
        answer: '9 9',
        explain: R`<p>${c('p')} holds x's address, so ${c('*p = 9')} writes 9 into x itself. Both ${c('x')} and ${c('*p')} name the same 4 bytes: <b>9 9</b>.</p>`
      },
      {
        id: 'c2-q2', type: 'text', difficulty: 'exam+', normalize: 'nospace',
        prompt: R`What does this print?`,
        code: src(R`
int a[5] = {10, 20, 30, 40, 50};
int *p = a + 1;
printf("%d %d %d\n", *p + 1, *(p + 1), p[-1]);
`),
        answer: '21 30 10',
        explain: R`<p>${c('p = a + 1')} points at ${c('a[1]')}, which is 20.</p>
<ul>
<li>${c('*p + 1')}: ${c('*')} binds tighter than ${c('+')}, so this is ${c('(*p) + 1')} = 20 + 1 = <b>21</b>.</li>
<li>${c('*(p + 1)')}: one int later is ${c('a[2]')} = <b>30</b>.</li>
<li>${c('p[-1]')} means ${c('*(p - 1)')}, which is ${c('a[0]')} = <b>10</b>. Negative indexes are fine as long as you stay inside the array.</li>
</ul>`
      },
      {
        id: 'c2-q3', type: 'mcq', difficulty: 'core',
        prompt: R`${c('int *p')} holds the address ${c('0x1000')}. What address does ${c('p + 3')} hold?`,
        options: [R`${c('0x1003')}`, R`${c('0x100C')}`, R`${c('0x1012')}`, R`${c('0x1018')}`],
        answer: 1,
        whyWrong: [
          R`That adds 3 bytes. Pointer arithmetic moves by whole ints: 3 times 4 = 12 bytes.`,
          null,
          R`12 in decimal is 0xC in hex, not 0x12.`,
          R`That's 3 times 8, as if p pointed at 8-byte values. An int is 4 bytes.`
        ],
        explain: R`<p>p + 3 moves 3 ints = 12 bytes. 12 in hex is 0xC, so the result is <b>0x100C</b>.</p>`
      },
      {
        id: 'c2-q4', type: 'mcq', difficulty: 'exam+',
        prompt: R`${c('q')} holds ${c('0x2000')}. What are the values of ${c('q + 2')} and ${c('(char *) q + 2')}?`,
        code: src(R`
int64_t arr[4];
int64_t *q = arr;     // q holds 0x2000
`),
        options: [
          R`${c('0x2010')} and ${c('0x2002')}`,
          R`${c('0x2002')} and ${c('0x2002')}`,
          R`${c('0x2010')} and ${c('0x2010')}`,
          R`${c('0x2016')} and ${c('0x2002')}`
        ],
        answer: 0,
        whyWrong: [
          null,
          R`${c('q + 2')} moves 2 elements of 8 bytes each, not 2 bytes.`,
          R`The cast happens first: ${c('(char *) q')} is a char pointer, so adding 2 moves 2 bytes.`,
          R`2 times 8 is 16 bytes, which is 0x10 in hex, not 0x16.`
        ],
        explain: R`<p>${c('q + 2')}: 2 elements of ${c('int64_t')} (8 bytes each) = 16 bytes = 0x10, giving <b>0x2010</b>.</p>
<p>${c('(char *) q + 2')}: a cast binds tighter than ${c('+')}, so q is first viewed as a ${c('char *')} (still 0x2000). Adding 2 then moves 2 chars = 2 bytes, giving <b>0x2002</b>.</p>`
      },
      {
        id: 'c2-q5', type: 'text', difficulty: 'core', normalize: 'nospace',
        prompt: R`What does this print?`,
        code: src(R`
void swap(int a, int b) {
    int t = a;
    a = b;
    b = t;
}

int main(void) {
    int x = 1, y = 2;
    swap(x, y);
    printf("%d %d\n", x, y);
    return 0;
}
`),
        answer: '1 2',
        explain: R`<p>C passes copies. ${c('swap')} swaps its own ${c('a')} and ${c('b')}, which vanish when it returns. main's x and y never change: <b>1 2</b>. To really swap, pass ${c('&x, &y')} and write through the pointers.</p>`
      },
      {
        id: 'c2-q6', type: 'multi', difficulty: 'exam+',
        prompt: R`${c('int **score_lists')} is a parameter, and ${c('i')} and ${c('j')} are valid indexes. Select <b>every</b> expression whose type is ${c('int *')}.`,
        options: [
          R`${c('score_lists')}`,
          R`${c('score_lists[i]')}`,
          R`${c('score_lists[i][j]')}`,
          R`${c('*score_lists')}`,
          R`${c('&score_lists[i][j]')}`,
          R`${c('*score_lists[i]')}`,
          R`${c('&score_lists[i]')}`
        ],
        answer: [1, 3, 4],
        explain: R`<p>Count stars: start from ${c('int **')}; each ${c('[ ]')} or ${c('*')} removes one star, each ${c('&')} adds one.</p>
<ul>
<li>${c('score_lists')}: no change, ${c('int **')}.</li>
<li>${c('score_lists[i]')}: one removed, <b>${c('int *')}</b>.</li>
<li>${c('score_lists[i][j]')}: two removed, ${c('int')}.</li>
<li>${c('*score_lists')}: one removed, <b>${c('int *')}</b> (same as ${c('score_lists[0]')}).</li>
<li>${c('&score_lists[i][j]')}: two removed then one added, <b>${c('int *')}</b>.</li>
<li>${c('*score_lists[i]')}: two removed, ${c('int')} (same as ${c('score_lists[i][0]')}).</li>
<li>${c('&score_lists[i]')}: one removed then one added, ${c('int **')}.</li>
</ul>`
      },
      {
        id: 'c2-q7', type: 'text', difficulty: 'exam+', normalize: 'nospace',
        prompt: R`What does this print?`,
        code: src(R`
void set(int **pp, int *target) {
    *pp = target;
}

int main(void) {
    int a = 1, b = 2;
    int *p = &a;
    set(&p, &b);
    *p = 7;
    printf("%d %d\n", a, b);
    return 0;
}
`),
        answer: '1 7',
        explain: R`<p>${c('set')} receives the address of main's ${c('p')}, so ${c('*pp = target')} changes main's p itself: p now points at b. Then ${c('*p = 7')} writes into b. a is untouched: <b>1 7</b>.</p>
<p>This is the pointer-to-pointer pattern: to change a caller's pointer variable, pass its address (an ${c('int **')}).</p>`
      },
      {
        id: 'c2-q8', type: 'mcq', difficulty: 'exam+',
        prompt: R`What is wrong with this function?`,
        code: src(R`
int *make_array(int n) {
    int arr[100];
    for (int i = 0; i < n; i++) {
        arr[i] = i;
    }
    return arr;
}
`),
        options: [
          R`Nothing. The caller can read the values through the returned pointer.`,
          R`${c('arr')} lives in make_array's stack frame, which is gone once the function returns, so the caller gets a dangling pointer.`,
          R`It doesn't compile, because C functions can't return arrays.`,
          R`It should use ${c('sizeof(arr)')} instead of ${c('n')} as the loop bound.`
        ],
        answer: 1,
        whyWrong: [
          R`It might even seem to work in a quick test, but the next function call reuses that stack space and overwrites the values. That's undefined behavior.`,
          null,
          R`It compiles: ${c('arr')} decays to an ${c('int *')}, and returning a pointer is allowed. Most compilers only warn. That's what makes the bug sneaky.`,
          R`The loop bound isn't the problem (though n over 100 would also overflow). The returned address is.`
        ],
        explain: R`<p>Locals live in the function's stack frame and die when it returns. To hand memory back to the caller, allocate it on the heap:</p>
${pre(R`
int *make_array(int n) {
    int *arr = malloc(n * sizeof(int));
    if (arr == NULL) return NULL;
    for (int i = 0; i < n; i++) arr[i] = i;
    return arr;            // the caller must free it later
}
`)}`
      },
      {
        id: 'c2-q9', type: 'mcq', difficulty: 'core',
        prompt: R`What is the problem with this code?`,
        code: src(R`
int *p;
*p = 5;
printf("%d\n", *p);
`),
        options: [
          R`${c('p')} was never given an address, so ${c('*p = 5')} writes to whatever garbage address p happens to hold.`,
          R`It should be ${c('&p = 5;')}`,
          R`${c('*p = 5')} makes p point at address 5.`,
          R`Nothing. It prints 5.`
        ],
        answer: 0,
        whyWrong: [
          null,
          R`${c('&p')} is the address of p; you can't assign to it.`,
          R`That would be ${c('p = (int *) 5;')}. ${c('*p = 5')} writes the value 5 into the int that p points to.`,
          R`It might print 5 by luck, or it might crash. Reading or writing through an uninitialized pointer is undefined behavior.`
        ],
        explain: R`<p>A pointer must point at real memory before you follow it. Fix: point it at something, such as ${c('int x; int *p = &x;')} or ${c('int *p = malloc(sizeof(int));')} (then check for NULL).</p>`
      },
      {
        id: 'c2-q10', type: 'text', difficulty: 'exam+', normalize: 'nospace',
        prompt: R`What does this print?`,
        code: src(R`
int a[4] = {5, 6, 7, 8};
int *p = a;
p++;
*p += 10;
p[1] = *p * 2;
printf("%d %d %d %d\n", a[0], a[1], a[2], a[3]);
`),
        answer: '5 16 32 8',
        explain: R`<ul>
<li>${c('p++')}: p now points at ${c('a[1]')}.</li>
<li>${c('*p += 10')}: a[1] becomes 6 + 10 = 16.</li>
<li>${c('p[1] = *p * 2')}: ${c('p[1]')} is ${c('a[2]')}, and ${c('*p * 2')} is 16 times 2 = 32. So a[2] becomes 32.</li>
<li>a[0] and a[3] are untouched.</li>
</ul>
<p>Output: <b>5 16 32 8</b>.</p>`
      },
      {
        id: 'c2-q11', type: 'number', difficulty: 'exam+',
        prompt: R`What is the value of ${c('p - q')}?`,
        code: src(R`
int a[8];
int *p = &a[6];
int *q = &a[2];
`),
        answer: 4,
        explain: R`<p>Subtracting pointers into the same array gives the number of <b>elements</b> between them, not bytes. The byte distance is 16, but 16 / 4 bytes per int = <b>4</b>. (It mirrors addition: ${c('q + 4 == p')}.)</p>`
      },
      {
        id: 'c2-q12', type: 'text', difficulty: 'core', normalize: 'nospace',
        prompt: R`What does this print?`,
        code: src(R`
int s0[] = {90, 85};
int s1[] = {70, 60, 50};
int *lists[] = {s0, s1};
int **score_lists = lists;
printf("%d %d\n", score_lists[1][2], *score_lists[0]);
`),
        answer: '50 90',
        explain: R`<p>${c('score_lists[1]')} is ${c('s1')} (an ${c('int *')}), and index 2 of it is <b>50</b>. ${c('score_lists[0]')} is ${c('s0')}, and ${c('*s0')} is its first element, <b>90</b>.</p>`
      },
      {
        id: 'c2-q13', type: 'dropdowns', difficulty: 'exam+',
        prompt: R`${c('words')} holds the address ${c('0x2000')}. For each expression, choose the address it gives on the machine named.`,
        code: src(R`
char **words;          /* holds 0x2000 */
`),
        choices: ['0x2003', '0x2006', '0x200C', '0x2012', '0x2018', '0x2024'],
        items: [
          { label: R`${c('words + 3')} on 32-bit`, answer: '0x200C', explain: R`words points at ${c('char *')} values, 4 bytes each on 32-bit. 3 times 4 = 12 = 0xC, so 0x200C.` },
          { label: R`${c('words + 3')} on 64-bit`, answer: '0x2018', explain: R`Now each ${c('char *')} is 8 bytes. 3 times 8 = 24 = 0x18, so 0x2018. (0x2024 is the trap of writing decimal 24 as if it were hex.)` },
          { label: R`${c('(char *) words + 3')} on either machine`, answer: '0x2003', explain: R`The cast happens first, so this is a ${c('char *')} plus 3: 3 times 1 byte = 0x2003 on both machines.` },
          { label: R`${c('(int64_t *) words + 3')} on 32-bit`, answer: '0x2018', explain: R`An ${c('int64_t')} is 8 bytes on every machine, so 3 times 8 = 24 = 0x18 even on 32-bit.` },
          { label: R`${c('(int *) words + 3')} on 64-bit`, answer: '0x200C', explain: R`An ${c('int')} is 4 bytes on both machines: 3 times 4 = 12 = 0xC.` }
        ],
        explain: R`<p>${c('p + k')} moves k times the size of what p points to. Only when that pointed-to type is itself a pointer (like the ${c('char *')} elements of ${c('char **words')}) does the machine change the answer.</p>`
      }
    ]
  });

  // ===================================================================
  // C 3: Strings
  // ===================================================================
  const SVG_STRING = R`
<svg viewBox="0 0 520 132" width="100%" role="img" aria-label="The string hi! stored as four bytes: h, i, !, and the zero byte">
  <g font-family="ui-monospace, Menlo, monospace" font-size="16" fill="#1f2933">
    <text x="20" y="22" font-size="13" font-weight="700">char s[] = "hi!";   (4 bytes)</text>
    <rect x="20" y="34" width="80" height="46" fill="#dbeafe" stroke="#1f2933"/><text x="60" y="63" text-anchor="middle">'h'</text>
    <rect x="100" y="34" width="80" height="46" fill="#dbeafe" stroke="#1f2933"/><text x="140" y="63" text-anchor="middle">'i'</text>
    <rect x="180" y="34" width="80" height="46" fill="#dbeafe" stroke="#1f2933"/><text x="220" y="63" text-anchor="middle">'!'</text>
    <rect x="260" y="34" width="80" height="46" fill="#fde68a" stroke="#1f2933"/><text x="300" y="63" text-anchor="middle">'\0'</text>
    <g font-size="12" fill="#5b6673" text-anchor="middle">
      <text x="60" y="98">s[0]</text><text x="140" y="98">s[1]</text><text x="220" y="98">s[2]</text><text x="300" y="98">s[3]</text>
    </g>
    <text x="360" y="54" font-size="12" fill="#92400e">the terminator:</text>
    <text x="360" y="72" font-size="12" fill="#92400e">a byte with value 0</text>
    <text x="20" y="124" font-size="12" fill="#5b6673">strlen(s) = 3 (stops before the 0), sizeof(s) = 4 (whole array)</text>
  </g>
</svg>`;

  modules.push({
    id: 'c3-strings',
    section: 'C coding',
    title: 'C 3: Strings',
    minutes: 20,
    quickCheck: ['c3-q2', 'c3-q5'],
    lesson: [
      {
        title: R`A string is a char array ending in '\0'`,
        html: R`
<p>C has no string type. A string is a run of ${c('char')}s in memory followed by the <b>null terminator</b>: a byte whose value is 0, written ${c(R`'\0'`)}. Everything that handles strings (${c('printf("%s")')}, ${c('strlen')}, ${c('strcpy')}) walks forward from the first char until it hits that 0.</p>
${SVG_STRING}
${pre(R`
char s[] = "hi!";     // 4 bytes: 'h' 'i' '!' '\0'
printf("%s\n", s);    // walks until the 0 byte: prints hi!
s[2] = '\0';          // put a terminator earlier
printf("%s\n", s);    // now prints hi
`)}
<p>A string <b>literal</b> like ${c('"hi!"')} always gets the terminator added for you, so it takes one more byte than the letters you see.</p>
<p>Three different "zeros" not to mix up: ${c(R`'\0'`)} is the zero byte (a char), ${c("'0'")} is the digit character (value 48), and ${c('NULL')} is a pointer to nothing.</p>
`
      },
      {
        title: 'strlen vs sizeof',
        html: R`
<p>${c('strlen(s)')} runs at run time: it counts the characters <b>before</b> the ${c(R`'\0'`)}. ${c('sizeof')} is decided at compile time: it reports the bytes of the variable itself.</p>
<table class="table table-sm">
<thead><tr><th>Declaration</th><th>${c('sizeof(s)')}</th><th>${c('strlen(s)')}</th></tr></thead>
<tbody>
<tr><td>${c('char s[] = "hello";')}</td><td>6 (5 letters + terminator)</td><td>5</td></tr>
<tr><td>${c('char *s = "hello";')}</td><td>8 on 64-bit, 4 on 32-bit (s is a pointer)</td><td>5</td></tr>
<tr><td>${c('char s[20] = "hello";')}</td><td>20 (the array you declared)</td><td>5</td></tr>
<tr><td>${c('char s[] = "";')}</td><td>1 (just the terminator)</td><td>0</td></tr>
</tbody>
</table>
<p><b>Rule of thumb:</b> to know how long a string is, use ${c('strlen')}. To know how many bytes a copy needs, use ${c('strlen(s) + 1')}. Never use ${c('sizeof')} on a ${c('char *')} to get a length; it is always the pointer size (8 on 64-bit, 4 on 32-bit).</p>
`
      },
      {
        title: 'Copying strings: why strlen + 1',
        html: R`
<p>A copy needs room for every character <b>plus</b> the terminator. These are the signatures to know:</p>
<table class="table table-sm">
<thead><tr><th>Function</th><th>What it does</th></tr></thead>
<tbody>
<tr><td>${c('size_t strlen(const char *s)')}</td><td>Returns the number of chars before the ${c(R`'\0'`)}.</td></tr>
<tr><td>${c('char *strcpy(char *dst, const char *src)')}</td><td>Copies src <b>including</b> its ${c(R`'\0'`)} into dst and returns dst. dst must already have enough room.</td></tr>
<tr><td>${c('void *memcpy(void *dst, const void *src, size_t n)')}</td><td>Copies exactly <b>n bytes</b>, whatever they are. It does not stop at a ${c(R`'\0'`)} and does not add one.</td></tr>
</tbody>
</table>
<p>Destination comes first in both, like an assignment: ${c('dst = src')}. ${c('const char *')} just means the function promises not to change those chars.</p>
${pre(R`
char *copy = malloc(strlen(src) + 1);   // +1 for the '\0' (sizeof(char) is 1)
if (copy == NULL) return NULL;
strcpy(copy, src);                      // copies the '\0' too

// equivalent, with memcpy you count the '\0' yourself:
memcpy(copy, src, strlen(src) + 1);
`)}
<p>This is exactly what the practice exam's ${c('node_new')} does with ${c('memcpy(n->name, name, strlen(name)+1)')}: the +1 copies the terminator, so ${c('n->name')} is a proper string.</p>
${trap(`${c('memcpy(dst, src, strlen(src))')} copies the letters but not the terminator. If dst came from malloc (garbage bytes), the copy has no end, and printing it reads past the block.`)}
`
      },
      {
        title: 'char s[] vs char *s',
        html: R`
${pre(R`
void f(void) {
    char a[] = "hi";   // a is a 3-byte array in f's stack frame, filled with a copy of "hi"
    char *p = "hi";    // p is a pointer (8 bytes on 64-bit) on the stack, pointing at the literal "hi"

    a[0] = 'H';        // fine: a is your own copy
    p[0] = 'H';        // undefined behavior: string literals are read-only (usually crashes)
    p = "bye";         // fine: p now points at a different literal
    a = "bye";         // compile error: you can't assign to an array
}
`)}
<table class="table table-sm">
<thead><tr><th></th><th>${c('char a[] = "hi";')}</th><th>${c('char *p = "hi";')}</th></tr></thead>
<tbody>
<tr><td>What it is</td><td>a 3-byte char array</td><td>a pointer (8 bytes on 64-bit, 4 on 32-bit)</td></tr>
<tr><td>Where the chars live</td><td>in a itself (on the Stack for a local)</td><td>in the literal, in static Data</td></tr>
<tr><td>Can you change the chars?</td><td>yes</td><td>no (read-only)</td></tr>
<tr><td>${c('sizeof')}</td><td>3</td><td>8 (4 on 32-bit)</td></tr>
</tbody>
</table>
<p>This difference shows up again in the Memory regions question: ${c('a[0]')} is on the Stack, but ${c('*p')} is in Data.</p>
`
      },
      {
        title: 'Off-by-one bugs to recognize',
        html: R`
<ul>
<li>${c('malloc(strlen(s))')} is one byte short. The ${c(R`'\0'`)} that strcpy writes lands one past the end: an out-of-bounds write.</li>
<li>${c('char buf[5]; strcpy(buf, "hello");')} overflows: "hello" needs 6 bytes.</li>
<li>A loop ${c('for (i = 0; i <= n; i++) dst[i] = ...')} writes n + 1 elements. Fine only if dst really has n + 1 slots (like copying a string of length n with its terminator).</li>
<li>Building a string one char at a time and forgetting ${c(R`dst[len] = '\0';`)} at the end.</li>
<li>Using ${c('sizeof(p)')} for a ${c('char *p')} as if it were the length. It's always the pointer size (8, or 4 on 32-bit).</li>
<li>Joining k words with one separator between neighbors needs: (sum of the strlens) + (k - 1) separators + 1 for the terminator.</li>
</ul>
${tip(`Before writing any string allocation, say the size out loud as "letters plus one". Before writing any copy, ask "does this copy the terminator?"`)}
`
      }
    ],
    questions: [
      {
        id: 'c3-q1', type: 'number', difficulty: 'core', unit: 'bytes',
        prompt: R`How many bytes must you allocate to hold a copy of the string ${c('"bear"')}?`,
        answer: 5,
        explain: R`<p>4 letters plus 1 byte for the terminator ${c(R`'\0'`)} = <b>5</b>. In code: ${c('malloc(strlen(s) + 1)')}.</p>`
      },
      {
        id: 'c3-q2', type: 'text', difficulty: 'exam+', normalize: 'nospace',
        prompt: R`What does this print?`,
        code: src(R`
char s[] = "hello";
s[2] = '\0';
printf("%s %zu %zu\n", s, strlen(s), sizeof(s));
`),
        answer: 'he 2 6',
        explain: R`<ul>
<li>After ${c(R`s[2] = '\0'`)} the bytes are h, e, 0, l, o, 0. ${c('%s')} stops at the first 0: prints <b>he</b>.</li>
<li>${c('strlen')} also stops there: <b>2</b>.</li>
<li>${c('sizeof(s)')} is the size of the array, which was fixed at compile time from "hello" (5 + 1): <b>6</b>. Writing a 0 into the middle doesn't shrink the array.</li>
</ul>`
      },
      {
        id: 'c3-q3', type: 'mcq', difficulty: 'core',
        prompt: R`${c('const char *src')} points at some string. Which call allocates exactly enough for a copy?`,
        options: [
          R`${c('malloc(strlen(src))')}`,
          R`${c('malloc(strlen(src) + 1)')}`,
          R`${c('malloc(sizeof(src))')}`,
          R`${c('malloc(sizeof(src) + 1)')}`
        ],
        answer: 1,
        whyWrong: [
          R`No room for the terminator. strcpy would write one byte past the end.`,
          null,
          R`${c('src')} is a pointer, so ${c('sizeof(src)')} is always the pointer size (8 on 64-bit, 4 on 32-bit), whatever the string's length.`,
          R`Always 9 bytes on 64-bit (5 on 32-bit): too small for long strings and wasteful for short ones.`
        ],
        explain: R`<p>Letters plus one: ${c('strlen(src) + 1')}. Since ${c('sizeof(char)')} is 1, no multiplication is needed.</p>`
      },
      {
        id: 'c3-q4', type: 'mcq', difficulty: 'exam+',
        prompt: R`Which statement about lines A and B is true?`,
        code: src(R`
char a[] = "hi";
char *p = "hi";
a[0] = 'H';    // line A
p[0] = 'H';    // line B
`),
        options: [
          R`Both lines are fine.`,
          R`Line A is fine. Line B is undefined behavior, because p points at a read-only string literal.`,
          R`Line A is a compile error because arrays can't be changed. Line B is fine.`,
          R`Both lines are errors, because "hi" is a constant.`
        ],
        answer: 1,
        whyWrong: [
          R`Line B writes into the literal itself. Literals live in read-only static memory; on most systems this crashes.`,
          null,
          R`You can change an array's elements (${c('a[0] = ...')}). What you can't do is assign a whole new array (${c('a = "yo"')}).`,
          R`${c('char a[] = "hi"')} copies the literal into a fresh array that belongs to you, so changing it is fine.`
        ],
        explain: R`<p>${c('char a[] = "hi"')} makes a new 3-byte array initialized with a copy of the characters; it's yours to change. ${c('char *p = "hi"')} makes a pointer to the one shared literal, which is read-only. Writing through p is undefined behavior (usually a segmentation fault).</p>`
      },
      {
        id: 'c3-q5', type: 'multi', difficulty: 'exam+',
        prompt: R`Setup: ${c('char *src = "cs61c";')} and ${c('char *dst = malloc(strlen(src) + 1);')} (assume malloc succeeded). Select <b>every</b> line that leaves dst holding a complete, terminated copy of "cs61c" without any memory errors.`,
        options: [
          R`${c('strcpy(dst, src);')}`,
          R`${c('memcpy(dst, src, strlen(src));')}`,
          R`${c('memcpy(dst, src, strlen(src) + 1);')}`,
          R`${c('memcpy(dst, src, sizeof(src));')}`,
          R`${c('dst = src;')}`,
          R`${c('for (size_t i = 0; i <= strlen(src); i++) dst[i] = src[i];')}`
        ],
        answer: [0, 2, 5],
        explain: R`<ul>
<li><b>strcpy</b> copies the letters and the terminator. Correct.</li>
<li>${c('memcpy(..., strlen(src))')} copies 5 bytes, missing the terminator. dst came from malloc, so byte 5 is garbage. Wrong.</li>
<li>${c('memcpy(..., strlen(src) + 1)')} copies all 6 bytes. Correct.</li>
<li>${c('sizeof(src)')} is 8 on 64-bit (a pointer), so this copies 8 bytes: it reads 2 bytes past the 6-byte literal and writes 2 bytes past the 6-byte dst. On a 32-bit machine it copies only 4 bytes and misses the last letter and the terminator. Wrong on both.</li>
<li>${c('dst = src')} copies no characters: it just points dst at the literal and leaks the malloc'd block. Wrong.</li>
<li>The loop runs i = 0 to 5 inclusive (strlen is 5), copying the terminator at index 5 too. Correct.</li>
</ul>`
      },
      {
        id: 'c3-q6', type: 'text', difficulty: 'core', normalize: 'nospace',
        prompt: R`What does this print?`,
        code: src(R`
char buf[10] = "abc";
printf("%zu %zu\n", strlen(buf), sizeof(buf));
`),
        answer: '3 10',
        explain: R`<p>${c('strlen')} counts the letters before the terminator: <b>3</b>. ${c('sizeof')} gives the declared size of the array: <b>10</b> (the unused bytes are filled with zeros).</p>`
      },
      {
        id: 'c3-q7', type: 'mcq', difficulty: 'exam+',
        prompt: R`This function is meant to return a new heap copy of ${c('s')}. What is the bug?`,
        code: src(R`
char *dup(const char *s) {
    size_t n = strlen(s);
    char *d = malloc(n + 1);
    if (d == NULL) return NULL;
    for (size_t i = 0; i < n; i++) {
        d[i] = s[i];
    }
    return d;
}
`),
        options: [
          R`${c('malloc(n + 1)')} should be ${c('malloc(n)')}.`,
          R`The loop never writes the terminator, so ${c('d[n]')} is garbage and d is not a proper string.`,
          R`${c('strlen(s)')} counts the terminator, so n is one too big.`,
          R`It should return ${c('s')} instead of ${c('d')}.`
        ],
        answer: 1,
        whyWrong: [
          R`n + 1 is right; the copy needs the extra byte for the terminator.`,
          null,
          R`strlen does not count the terminator. "abc" has strlen 3.`,
          R`Returning s would hand back the original, not a copy.`
        ],
        explain: R`<p>The allocation is right, but the loop stops at ${c('i < n')}, so index n (where the terminator belongs) is never written. malloc doesn't zero memory, so it holds garbage. Fix: add ${c(R`d[n] = '\0';`)} after the loop, or loop with ${c('i <= n')}, or simply ${c('strcpy(d, s)')}.</p>`
      },
      {
        id: 'c3-q8', type: 'text', difficulty: 'exam+', normalize: 'nospace',
        prompt: R`What does this print?`,
        code: src(R`
char *s = "banana";
char *t = s + 2;
printf("%s %c %zu\n", t, *(s + 1), strlen(t));
`),
        answer: 'nana a 4',
        explain: R`<ul>
<li>${c('t = s + 2')} points at the first 'n' (index 2). Printing it walks to the terminator: <b>nana</b>.</li>
<li>${c('*(s + 1)')} is ${c('s[1]')}, the char <b>a</b>.</li>
<li>${c('strlen(t)')} counts n, a, n, a: <b>4</b>.</li>
</ul>
<p>A pointer into the middle of a string is itself a valid string: the rest of it.</p>`
      },
      {
        id: 'c3-q9', type: 'number', difficulty: 'exam+', unit: 'bytes',
        prompt: R`A join-words task: build one new string holding ${c('"ab"')}, ${c('"cde"')} and ${c('"f"')} joined with a single space between neighbors, giving ${c('"ab cde f"')}. How many bytes must you allocate?`,
        answer: 9,
        explain: R`<p>Letters: 2 + 3 + 1 = 6. Separators: 3 words have 2 gaps, so 2 spaces. Terminator: 1. Total <b>9</b>.</p>
<p>General formula for k words: (sum of strlens) + (k - 1) + 1. A common slip is adding k separators or forgetting the final +1.</p>`
      }
    ]
  });

  // ===================================================================
  // C 4: Structs
  // ===================================================================
  const recBox = (x, y, label, id, cnt) => R`
    <text x="${x}" y="${y - 6}" font-weight="700">${label}</text>
    <rect x="${x}" y="${y}" width="140" height="78" fill="#dbeafe" stroke="#1f2933"/>
    <line x1="${x}" y1="${y + 26}" x2="${x + 140}" y2="${y + 26}" stroke="#1f2933"/>
    <line x1="${x}" y1="${y + 52}" x2="${x + 140}" y2="${y + 52}" stroke="#1f2933"/>
    <text x="${x + 8}" y="${y + 18}">id</text><text x="${x + 110}" y="${y + 18}" text-anchor="middle">${id}</text>
    <text x="${x + 8}" y="${y + 44}">scores</text><circle cx="${x + 110}" cy="${y + 39}" r="4" fill="#1f2933"/>
    <text x="${x + 8}" y="${y + 70}">count</text><text x="${x + 110}" y="${y + 70}" text-anchor="middle">${cnt}</text>`;
  const arr3 = (x, y, vals, fill) => vals.map((v, k) =>
    '<rect x="' + (x + 36 * k) + '" y="' + y + '" width="36" height="30" fill="' + fill + '" stroke="#1f2933"/>' +
    '<text x="' + (x + 36 * k + 18) + '" y="' + (y + 20) + '" text-anchor="middle">' + v + '</text>').join('');

  const SVG_SHALLOW_DEEP = R`
<svg viewBox="0 0 700 250" width="100%" role="img" aria-label="Shallow copy: two Records point to one shared array. Deep copy: each Record points to its own array.">
  ${arrowDefs('c4ArrowA')}
  <g font-family="ui-monospace, Menlo, monospace" font-size="13" fill="#1f2933">
    <text x="20" y="16" font-weight="700" fill="#b91c1c">Shallow: Record b = a;</text>
    ${recBox(20, 44, 'a', 7, 3)}
    ${recBox(20, 154, 'b', 8, 3)}
    ${arr3(210, 106, [99, 2, 3], '#fee2e2')}
    <text x="264" y="154" text-anchor="middle" font-size="11" fill="#5b6673">one shared array</text>
    <line x1="134" y1="83" x2="207" y2="114" stroke="#b91c1c" stroke-width="2" marker-end="url(#c4ArrowA)"/>
    <line x1="134" y1="193" x2="207" y2="130" stroke="#b91c1c" stroke-width="2" marker-end="url(#c4ArrowA)"/>
    <text x="370" y="16" font-weight="700" fill="#15803d">Deep: new array + memcpy</text>
    ${recBox(370, 44, 'a', 7, 3)}
    ${recBox(370, 154, 'b', 8, 3)}
    ${arr3(564, 68, [1, 2, 3], '#dcfce7')}
    ${arr3(564, 178, [1, 2, 3], '#dcfce7')}
    <text x="618" y="114" text-anchor="middle" font-size="11" fill="#5b6673">a's array</text>
    <text x="618" y="224" text-anchor="middle" font-size="11" fill="#5b6673">b's own copy</text>
    <line x1="484" y1="83" x2="561" y2="83" stroke="#15803d" stroke-width="2" marker-end="url(#c4ArrowA)"/>
    <line x1="484" y1="193" x2="561" y2="193" stroke="#15803d" stroke-width="2" marker-end="url(#c4ArrowA)"/>
  </g>
</svg>`;

  const listNode = (x, val, last) => R`
    <rect x="${x}" y="40" width="50" height="40" fill="#dcfce7" stroke="#1f2933"/>
    <rect x="${x + 50}" y="40" width="50" height="40" fill="#fef3c7" stroke="#1f2933"/>
    <text x="${x + 25}" y="65" text-anchor="middle">${val}</text>
    <text x="${x + 25}" y="34" text-anchor="middle" font-size="11" fill="#5b6673">val</text>
    <text x="${x + 75}" y="34" text-anchor="middle" font-size="11" fill="#5b6673">next</text>
    ${last ? '<text x="' + (x + 75) + '" y="64" text-anchor="middle" font-size="11">NULL</text>' : '<circle cx="' + (x + 75) + '" cy="60" r="4" fill="#1f2933"/>'}`;

  const SVG_LIST = R`
<svg viewBox="0 0 600 100" width="100%" role="img" aria-label="A linked list: head points to node 1, which points to node 2, which points to node 3, whose next is NULL">
  ${arrowDefs('c4ArrowB')}
  <g font-family="ui-monospace, Menlo, monospace" font-size="14" fill="#1f2933">
    <text x="55" y="34" text-anchor="middle" font-size="11" fill="#5b6673">head</text>
    <rect x="20" y="40" width="70" height="40" fill="#dbeafe" stroke="#1f2933"/>
    <circle cx="55" cy="60" r="4" fill="#1f2933"/>
    ${listNode(140, 1, false)}
    ${listNode(300, 2, false)}
    ${listNode(460, 3, true)}
    <line x1="59" y1="60" x2="137" y2="60" stroke="#1d4ed8" stroke-width="2" marker-end="url(#c4ArrowB)"/>
    <line x1="219" y1="60" x2="297" y2="60" stroke="#1d4ed8" stroke-width="2" marker-end="url(#c4ArrowB)"/>
    <line x1="379" y1="60" x2="457" y2="60" stroke="#1d4ed8" stroke-width="2" marker-end="url(#c4ArrowB)"/>
  </g>
</svg>`;

  modules.push({
    id: 'c4-structs',
    section: 'C coding',
    title: 'C 4: Structs',
    minutes: 20,
    quickCheck: ['c4-q2', 'c4-q3'],
    lesson: [
      {
        title: 'struct and typedef',
        html: R`
<p>A <b>struct</b> glues several fields together into one block of memory (with padding, see C1). ${c('typedef')} just gives a type a shorter nickname.</p>
${pre(R`
struct Point { int x; int y; };       // defines the type "struct Point"
struct Point a = {1, 2};             // without typedef you must write "struct Point"

typedef struct { int x; int y; } Point;   // nickname: Point
Point b = {3, 4};                         // fields in order: x = 3, y = 4
b.x = 10;
`)}
<p><b>A struct that points to its own type</b> (lists, trees) must use the <i>tag</i> name inside, because the nickname doesn't exist until the typedef finishes:</p>
${pre(R`
typedef struct Node {
    int val;
    struct Node *next;   // "struct Node", not "Node": Node isn't defined yet on this line
} Node;                  // from here on, Node works too
`)}
<p>The practice exam's ${c('node_t')} does exactly this: ${c('struct Node *left, *right;')} inside ${c('typedef struct Node { ... } node_t;')}.</p>
<p>A struct can hold a <i>pointer</i> to its own type (just one address) but never a struct of its own type, which would be infinitely big.</p>
`
      },
      {
        title: 'Dot vs arrow',
        html: R`
<p>Use <b>${c('.')}</b> when you have a struct. Use <b>${c('->')}</b> when you have a pointer to a struct. ${c('p->x')} is shorthand for ${c('(*p).x')}.</p>
${pre(R`
Point pt = {1, 2};
Point *pp = &pt;

pt.x = 5;       // struct: dot
pp->x = 5;      // pointer to struct: arrow
(*pp).x = 5;    // exactly the same as the line above
*pp.x = 5;      // WRONG: means *(pp.x), and a pointer has no field x
`)}
<p><b>Arrays of structs.</b> The exam's ${c('Record *recs')} points at n Records sitting side by side. ${c('recs[i]')} is a whole Record (not a pointer), so you use a dot:</p>
${pre(R`
Record *recs = calloc(n, sizeof(Record));
recs[i].id = 7;        // recs[i] is a Record: dot
(recs + i)->id = 7;    // recs + i is a Record *: arrow. Same thing.
recs[i]->id = 7;       // WRONG: recs[i] is not a pointer (compile error)
`)}
<table class="table table-sm">
<thead><tr><th>Expression</th><th>Type</th></tr></thead>
<tbody>
<tr><td>${c('recs')}</td><td>${c('Record *')}</td></tr>
<tr><td>${c('recs[i]')} (same as ${c('*(recs + i)')})</td><td>${c('Record')}</td></tr>
<tr><td>${c('&recs[i]')} (same as ${c('recs + i')})</td><td>${c('Record *')}</td></tr>
<tr><td>${c('recs[i].scores')}</td><td>${c('int *')}</td></tr>
<tr><td>${c('recs[i].scores[j]')}</td><td>${c('int')}</td></tr>
<tr><td>${c('recs->id')}</td><td>${c('int')}, the id of ${c('recs[0]')} only</td></tr>
</tbody>
</table>
${trap(`${c('Record *recs')} is an array of structs, not an array of pointers. It's ${c('recs[i].id')}, never ${c('recs[i]->id')}.`)}
`
      },
      {
        title: 'Shallow copy vs deep copy',
        html: R`
<p>Assigning a struct copies every field. If a field is a pointer, only the <b>address</b> is copied, not the data behind it. That's a <b>shallow copy</b>: both structs now share one array.</p>
${pre(R`
int data[3] = {1, 2, 3};
Record a = {7, data, 3};
Record b = a;          // shallow: b.scores holds the same address as a.scores
b.id = 8;              // b's own field; a.id is still 7
b.scores[0] = 99;      // writes the ONE shared array, so a.scores[0] is 99 too
`)}
${SVG_SHALLOW_DEEP}
<p>A <b>deep copy</b> allocates new memory for the pointed-to data and copies the contents into it:</p>
${pre(R`
Record b = a;                                  // copies id, count (and the old pointer)
b.scores = malloc(a.count * sizeof(int));      // new array of the right size
if (b.scores == NULL) { /* clean up and fail */ }
memcpy(b.scores, a.scores, a.count * sizeof(int));
`)}
<p>"Each Record gets its own newly allocated copy of ${c('score_lists[i]')}" in the exam means a deep copy. Writing ${c('recs[i].scores = score_lists[i];')} is a shallow copy and fails the tests that check you allocated new memory.</p>
`
      },
      {
        title: 'Linked lists and trees',
        html: R`
${SVG_LIST}
<p><b>Walking a list:</b> start at head and follow ${c('next')} until NULL.</p>
${pre(R`
int sum = 0;
for (Node *cur = head; cur != NULL; cur = cur->next) {
    sum += cur->val;
}
`)}
<p><b>Making a node on the heap:</b></p>
${pre(R`
Node *n = malloc(sizeof(Node));   // sizeof(Node), the struct (16 bytes on 64-bit), NOT sizeof(Node *)
if (n == NULL) return NULL;
n->val = 5;
n->next = NULL;                   // malloc doesn't zero: always set every field
`)}
<p><b>Freeing a list:</b> save ${c('next')} <i>before</i> freeing the node, because after ${c('free(cur)')} you may not read ${c('cur->next')}.</p>
${pre(R`
Node *cur = head;
while (cur != NULL) {
    Node *next = cur->next;   // read it while cur is still valid
    free(cur);
    cur = next;
}
`)}
<p><b>Trees</b> are the same idea with two pointers. Recursion handles each child. The exam's ${c('free_tree')} frees both subtrees first, then the node's own ${c('data')} block, then the node itself. Each ${c('free')} happens only after the last read of that block.</p>
`
      }
    ],
    questions: [
      {
        id: 'c4-q1', type: 'mcq', difficulty: 'core',
        prompt: R`${c('r')} is a ${c('Record *')} pointing at a valid Record. Which expression reads its id?`,
        code: RECORD_T,
        options: [R`${c('r.id')}`, R`${c('r->id')}`, R`${c('*r.id')}`, R`${c('&r->id')}`],
        answer: 1,
        whyWrong: [
          R`r is a pointer, not a struct. Dot needs a struct. This doesn't compile.`,
          null,
          R`${c('.')} binds tighter than ${c('*')}, so this means ${c('*(r.id)')}: dot on a pointer, compile error. You'd need ${c('(*r).id')}.`,
          R`That's the address of the id field (an ${c('int *')}), not the id.`
        ],
        explain: R`<p>${c('r->id')} means "follow r, then take the id field", the same as ${c('(*r).id')}. Rule: pointer to struct uses arrow, struct uses dot.</p>`
      },
      {
        id: 'c4-q2', type: 'multi', difficulty: 'exam+',
        prompt: R`${c('Record *recs')} points at an array of n Records and ${c('0 <= i < n')}. Select <b>every</b> expression that is the id of element i.`,
        options: [
          R`${c('recs[i].id')}`,
          R`${c('(recs + i)->id')}`,
          R`${c('(*(recs + i)).id')}`,
          R`${c('recs[i]->id')}`,
          R`${c('*recs[i].id')}`,
          R`${c('recs->id')}`
        ],
        answer: [0, 1, 2],
        explain: R`<ul>
<li>${c('recs[i]')} is a Record, so ${c('recs[i].id')} is right.</li>
<li>${c('recs + i')} is a ${c('Record *')} to element i, so arrow works: right.</li>
<li>${c('*(recs + i)')} is the Record itself, so dot works: right.</li>
<li>${c('recs[i]->id')}: recs[i] isn't a pointer. Compile error.</li>
<li>${c('*recs[i].id')} parses as ${c('*(recs[i].id)')}: dereferencing an int. Compile error.</li>
<li>${c('recs->id')} is ${c('recs[0].id')}: only correct when i is 0.</li>
</ul>`
      },
      {
        id: 'c4-q3', type: 'text', difficulty: 'exam+', normalize: 'nospace',
        prompt: R`What does this print?`,
        code: src(R`
typedef struct {
    int id;
    int *scores;
    int count;
} Record;

int data[3] = {1, 2, 3};
Record a = {7, data, 3};
Record b = a;
b.id = 8;
b.scores[0] = 99;
printf("%d %d %d\n", a.id, a.scores[0], data[0]);
`),
        answer: '7 99 99',
        explain: R`<p>${c('Record b = a')} copies each field. ${c('id')} is a plain int, so b gets its own copy, and changing ${c('b.id')} leaves ${c('a.id')} at <b>7</b>.</p>
<p>${c('scores')} is a pointer, so b gets the <i>same address</i>. ${c('b.scores[0] = 99')} writes the shared array, which is ${c('data')} itself. So ${c('a.scores[0]')} and ${c('data[0]')} are both <b>99</b>. That is a shallow copy.</p>`
      },
      {
        id: 'c4-q4', type: 'mcq', difficulty: 'exam+',
        prompt: R`In ${c('build_records')}, a student skips the allocation and writes ${c('recs[i].scores = score_lists[i];')}. Why does this lose points?`,
        options: [
          R`It doesn't compile, because ${c('score_lists[i]')} is an ${c('int **')}.`,
          R`It's a shallow copy: the Record shares the caller's array instead of owning a new copy, so tests that check for a separate allocation (or that later change or free the caller's arrays) fail.`,
          R`It leaks memory.`,
          R`It copies too many bytes.`
        ],
        answer: 1,
        whyWrong: [
          R`${c('score_lists[i]')} is an ${c('int *')}, the same type as ${c('recs[i].scores')}, so it compiles fine. That's what makes it tempting.`,
          null,
          R`Nothing was allocated, so nothing leaks. The problem is sharing (aliasing), not leaking. If the caller later frees each Record's scores, it would even free the caller's own arrays.`,
          R`It copies no bytes of the scores at all, just one address.`
        ],
        explain: R`<p>The spec says each Record gets its own newly allocated copy. That means ${c('calloc61(counts[i], sizeof(int))')} followed by ${c('memcpy(recs[i].scores, score_lists[i], counts[i] * sizeof(int))')}. A grader can detect the shortcut by checking ${c('recs[i].scores != score_lists[i]')}, or by changing the input after the call.</p>`
      },
      {
        id: 'c4-q5', type: 'text', difficulty: 'core', normalize: 'nospace',
        prompt: R`What does this print?`,
        code: src(R`
typedef struct Node {
    int val;
    struct Node *next;
} Node;

Node c = {3, NULL};
Node b = {2, &c};
Node a = {1, &b};
int sum = 0;
for (Node *cur = &a; cur != NULL; cur = cur->next) {
    sum += cur->val;
}
printf("%d %d\n", sum, a.next->next->val);
`),
        answer: '6 3',
        explain: R`<p>The list is a, then b, then c, then NULL. The loop adds 1 + 2 + 3 = <b>6</b>. ${c('a.next')} is ${c('&b')} (a pointer, so arrow next), ${c('b.next')} is ${c('&c')}, and ${c('c.val')} is <b>3</b>.</p>`
      },
      {
        id: 'c4-q6', type: 'mcq', difficulty: 'exam+',
        prompt: R`What's wrong with this function, which should free every node of a heap-allocated list?`,
        code: src(R`
void free_list(Node *head) {
    for (Node *cur = head; cur != NULL; cur = cur->next) {
        free(cur);
    }
}
`),
        options: [
          R`It frees nodes in the wrong order; the last node must be freed first.`,
          R`After ${c('free(cur)')}, the loop update ${c('cur = cur->next')} reads from memory that was just freed (use after free).`,
          R`${c('free(cur)')} should be ${c('free(&cur)')}.`,
          R`Nothing is wrong.`
        ],
        answer: 1,
        whyWrong: [
          R`Any order works, as long as you never read a node after freeing it.`,
          null,
          R`${c('&cur')} is the address of a local variable on the stack. Freeing it is an invalid free.`,
          R`It may pass a quick test by luck, but a memory checker reports the read of ${c('cur->next')} after free.`
        ],
        explain: R`<p>The ${c('for')} loop's update step runs <i>after</i> the body, so it reads ${c('cur->next')} from a freed node. Save the next pointer first:</p>
${pre(R`
Node *cur = head;
while (cur != NULL) {
    Node *next = cur->next;
    free(cur);
    cur = next;
}
`)}`
      },
      {
        id: 'c4-q7', type: 'mcq', difficulty: 'exam+',
        prompt: R`Why doesn't this compile?`,
        code: src(R`
typedef struct {
    int val;
    Node *next;
} Node;
`),
        options: [
          R`${c('Node')} isn't defined yet on the line ${c('Node *next;')}. Give the struct a tag and use it: ${c('typedef struct Node { int val; struct Node *next; } Node;')}`,
          R`A struct can't contain a pointer to its own type.`,
          R`${c('next')} should have type ${c('Node')}, not ${c('Node *')}.`,
          R`It does compile.`
        ],
        answer: 0,
        whyWrong: [
          null,
          R`It can: that's how every list and tree node works. A pointer is just one address (8 bytes on 64-bit).`,
          R`A struct can't contain a whole copy of itself; it would be infinitely large.`,
          R`The nickname ${c('Node')} only exists after the closing ${c('} Node;')}, so the compiler doesn't know it inside the braces.`
        ],
        explain: R`<p>Inside the braces, only the tag name (${c('struct Node')}) can refer to the type being defined. The typedef nickname becomes usable after the declaration ends. That's why the practice exam writes ${c('struct Node *left, *right;')}.</p>`
      },
      {
        id: 'c4-q8', type: 'text', difficulty: 'core', normalize: 'nospace',
        prompt: R`What does this print?`,
        code: src(R`
typedef struct { int x; int y; } Point;

void move(Point p)      { p.x += 10; }
void move_ptr(Point *p) { p->y += 10; }

int main(void) {
    Point pt = {1, 2};
    move(pt);
    move_ptr(&pt);
    printf("%d %d\n", pt.x, pt.y);
    return 0;
}
`),
        answer: '1 12',
        explain: R`<p>${c('move')} receives a <b>copy</b> of the whole struct, changes the copy, and the copy dies. So pt.x stays <b>1</b>. ${c('move_ptr')} receives pt's address and changes the real pt: pt.y becomes <b>12</b>.</p>`
      },
      {
        id: 'c4-q9', type: 'text', difficulty: 'exam+', normalize: 'nospace',
        prompt: R`What does this print?`,
        code: src(R`
typedef struct Tree {
    int val;
    struct Tree *left, *right;
} Tree;

int count(Tree *t) {
    if (t == NULL) return 0;
    return 1 + count(t->left) + count(t->right);
}

int sum(Tree *t) {
    if (t == NULL) return 0;
    return t->val + sum(t->left) + sum(t->right);
}

int main(void) {
    Tree d = {4, NULL, NULL};
    Tree b = {2, &d, NULL};
    Tree c = {3, NULL, NULL};
    Tree a = {1, &b, &c};
    printf("%d %d %d\n", count(&a), sum(&a), a.left->left->val);
    return 0;
}
`),
        answer: '4 10 4',
        explain: R`<p>Draw it: a (1) has children b (2) and c (3); b has a left child d (4).</p>
<ul>
<li>${c('count')}: 4 nodes, so <b>4</b>.</li>
<li>${c('sum')}: 1 + 2 + 3 + 4 = <b>10</b>.</li>
<li>${c('a.left')} is ${c('&b')}, ${c('b.left')} is ${c('&d')}, so ${c('d.val')} is <b>4</b>.</li>
</ul>
<p>The shape of ${c('count')} (handle NULL, then do this node plus both children) is the same shape you'd use for a tree copy.</p>`
      },
      {
        id: 'c4-q10', type: 'number', difficulty: 'exam+', unit: 'bytes',
        prompt: R`On a 64-bit machine, what is ${c('sizeof(Node)')}? (And so, how many bytes should ${c('malloc')} get for one node?)`,
        code: src(R`
typedef struct Node {
    int val;
    struct Node *next;
} Node;
`),
        answer: 16,
        explain: R`<p>val at 0 to 3, 4 bytes of padding, next (a pointer) at 8 to 15. Total <b>16</b>. Writing ${c('malloc(sizeof(Node *))')} would allocate only 8 bytes, and ${c('n->next = ...')} would write past the end.</p>
<p>On a 32-bit machine: val 0 to 3, next 4 to 7, total 8, while ${c('sizeof(Node *)')} is 4. Still half of what you need.</p>`
      }
    ]
  });

  // ===================================================================
  // C 5: The heap (the most important module for Q3)
  // ===================================================================
  const SVG_CLEANUP = R`
<svg viewBox="0 0 540 230" width="100%" role="img" aria-label="Outer array of 5 slots. Slots 0 and 1 point to heap blocks, slot 2 failed and is NULL, slots 3 and 4 are still NULL. Free blocks 0 and 1, then the outer array.">
  ${arrowDefs('c5ArrowA')}
  <g font-family="ui-monospace, Menlo, monospace" font-size="13" fill="#1f2933">
    <text x="20" y="16" font-weight="700">outer = calloc(5, ...); allocation i = 2 just failed</text>
    <g font-size="12" fill="#5b6673" text-anchor="middle">
      <text x="70" y="34">[0]</text><text x="170" y="34">[1]</text><text x="270" y="34">[2]</text><text x="370" y="34">[3]</text><text x="470" y="34">[4]</text>
    </g>
    <rect x="20" y="40" width="100" height="44" fill="#dbeafe" stroke="#1f2933"/><circle cx="70" cy="62" r="4" fill="#1f2933"/>
    <rect x="120" y="40" width="100" height="44" fill="#dbeafe" stroke="#1f2933"/><circle cx="170" cy="62" r="4" fill="#1f2933"/>
    <rect x="220" y="40" width="100" height="44" fill="#fee2e2" stroke="#b91c1c" stroke-width="2"/><text x="270" y="67" text-anchor="middle" fill="#b91c1c">NULL</text>
    <rect x="320" y="40" width="100" height="44" fill="#f3f4f6" stroke="#1f2933"/><text x="370" y="67" text-anchor="middle" fill="#6b7280">NULL</text>
    <rect x="420" y="40" width="100" height="44" fill="#f3f4f6" stroke="#1f2933"/><text x="470" y="67" text-anchor="middle" fill="#6b7280">NULL</text>
    <line x1="70" y1="66" x2="70" y2="136" stroke="#15803d" stroke-width="2" marker-end="url(#c5ArrowA)"/>
    <line x1="170" y1="66" x2="170" y2="136" stroke="#15803d" stroke-width="2" marker-end="url(#c5ArrowA)"/>
    <rect x="30" y="140" width="80" height="36" rx="4" fill="#dcfce7" stroke="#15803d"/><text x="70" y="163" text-anchor="middle">block 0</text>
    <rect x="130" y="140" width="80" height="36" rx="4" fill="#dcfce7" stroke="#15803d"/><text x="170" y="163" text-anchor="middle">block 1</text>
    <text x="270" y="150" text-anchor="middle" font-size="12" fill="#b91c1c">calloc61 failed</text>
    <text x="270" y="166" text-anchor="middle" font-size="12" fill="#b91c1c">nothing to free</text>
    <text x="420" y="150" text-anchor="middle" font-size="12" fill="#6b7280">never allocated</text>
    <text x="420" y="166" text-anchor="middle" font-size="12" fill="#6b7280">(zero from calloc)</text>
    <text x="20" y="204" font-size="12">Cleanup: free block 0, free block 1 (j = 0 .. i-1),</text>
    <text x="20" y="222" font-size="12">then free(outer), then return NULL.</text>
  </g>
</svg>`;

  modules.push({
    id: 'c5-heap',
    section: 'C coding',
    title: 'C 5: The heap: malloc, calloc, free and cleanup',
    minutes: 35,
    quickCheck: ['c5-q4', 'c5-q6'],
    lesson: [
      {
        title: 'Why the heap exists',
        html: R`
<p>A function's local variables live in its stack frame and vanish when it returns. When you need memory that <b>outlives the function</b> (to return a new array, a copied string, a new list) or whose size you only learn at run time (${c('n')}, ${c('counts[i]')}), you ask the <b>heap</b> for it. Heap memory stays yours until you call ${c('free')}.</p>
${pre(R`
int *bad(int n) {
    int arr[100];                         // on the stack: dies at return
    return arr;                           // dangling pointer
}

int *good(int n) {
    int *arr = malloc(n * sizeof(int));   // on the heap: lives until free(arr)
    if (arr == NULL) return NULL;
    return arr;                           // the caller now owns it and must free it
}
`)}
<p>The two ways to get this wrong are opposites: forget to free and you have a <b>leak</b>; touch it after freeing and you have a <b>use after free</b>. The exam's memory checker catches both.</p>
`
      },
      {
        title: 'The four functions (memorize the signatures)',
        html: R`
<table class="table table-sm">
<thead><tr><th>Signature</th><th>What you get</th><th>Returns</th></tr></thead>
<tbody>
<tr><td>${c('void *malloc(size_t size)')}</td><td>size bytes, contents are <b>garbage</b></td><td>pointer to the block, or NULL on failure</td></tr>
<tr><td>${c('void *calloc(size_t count, size_t size)')}</td><td>count times size bytes, <b>all zero</b></td><td>pointer, or NULL on failure</td></tr>
<tr><td>${c('void *realloc(void *ptr, size_t new_size)')}</td><td>the block resized to new_size; old contents kept; it may move</td><td>new pointer, or NULL on failure (then the old block is untouched and still yours)</td></tr>
<tr><td>${c('void free(void *ptr)')}</td><td>gives the block back</td><td>nothing. ptr must be exactly what malloc, calloc or realloc returned, or NULL (which does nothing)</td></tr>
</tbody>
</table>
<p>They live in ${c('<stdlib.h>')}; ${c('memcpy')}, ${c('strlen')} and ${c('strcpy')} are in ${c('<string.h>')}. ${c('void *')} means "an address, type unknown"; C converts it to any pointer type automatically, so no cast is needed.</p>
${pre(R`
int *a = malloc(n * sizeof(int));        // n ints, garbage values
int *b = calloc(n, sizeof(int));         // n ints, all 0
Record *r = calloc(n, sizeof(Record));   // n Records: every id/count is 0, every scores is NULL
`)}
<p><b>calloc61</b> on the exam behaves exactly like calloc, except the grader can make it fail on purpose (return NULL) on, say, its 3rd call, to test your failure handling. Memory from calloc61 is released with plain ${c('free')}.</p>
`
      },
      {
        title: 'Getting the size right',
        html: R`
<p>The size is always <b>how many</b> times <b>sizeof(one element)</b>. The element type is the pointer's type with one ${c('*')} removed.</p>
<table class="table table-sm">
<thead><tr><th>You're allocating</th><th>Pointer type</th><th>Size</th></tr></thead>
<tbody>
<tr><td>n ints (dup_ints)</td><td>${c('int *')}</td><td>${c('n * sizeof(int)')} or ${c('calloc(n, sizeof(int))')}</td></tr>
<tr><td>a copy of string s (dup_string)</td><td>${c('char *')}</td><td>${c('strlen(s) + 1')}</td></tr>
<tr><td>an array of n string pointers (dup_strings)</td><td>${c('char **')}</td><td>${c('n * sizeof(char *)')}</td></tr>
<tr><td>n Records (build_records)</td><td>${c('Record *')}</td><td>${c('calloc61(n, sizeof(Record))')}</td></tr>
<tr><td>counts[i] scores</td><td>${c('int *')}</td><td>${c('calloc61(counts[i], sizeof(int))')}</td></tr>
<tr><td>one list node</td><td>${c('Node *')}</td><td>${c('sizeof(Node)')}</td></tr>
</tbody>
</table>
<p>A safe idiom: ${c('sizeof(*ptr)')} is always the right element size. ${c('Record *recs = calloc(n, sizeof(*recs));')}</p>
<p><b>Never write the number yourself.</b> ${c('malloc(n * 4)')} for n pointers is right on a 32-bit machine and half the needed space on a 64-bit one. ${c('malloc(n * sizeof(char *))')} is right on both, so you never need to know which machine the grader uses.</p>
<p><b>Copying</b> follows the same rule, because ${c('memcpy')} counts <b>bytes</b>: ${c('memcpy(dst, src, count * sizeof(elem))')}.</p>
${trap(`On a 64-bit machine ${c('sizeof(Record *)')} is 8 but ${c('sizeof(Record)')} is 24 (on 32-bit, 4 and 12). ${c('calloc(n, sizeof(Record *))')} compiles fine, gives you a third of the memory you need, and the memory checker flags your writes past the end. Same story with ${c('memcpy(dst, src, counts[i])')}: it silently copies only a quarter of the ints.`)}
`
      },
      {
        title: 'What memory checkers catch',
        html: R`
<p>On the exam, about half of the 10 grading categories run under a memory checker. Your function can return the right values and still lose those points.</p>
<table class="table table-sm">
<thead><tr><th>Bug</th><th>Tiny example</th><th>Why it's wrong</th></tr></thead>
<tbody>
<tr><td>Out of bounds</td><td>${c('int *a = malloc(4 * sizeof(int)); a[4] = 1;')}</td><td>only a[0] to a[3] exist</td></tr>
<tr><td>Leak</td><td>${c('p = malloc(8); p = NULL;')} or ${c('return NULL;')} without freeing earlier blocks</td><td>block can never be freed</td></tr>
<tr><td>Use after free</td><td>${c('free(p); p[0] = 1;')}</td><td>block is no longer yours</td></tr>
<tr><td>Double free</td><td>${c('free(p); free(p);')}</td><td>second free of the same block</td></tr>
<tr><td>Invalid free</td><td>${c('int x; free(&x);')}, ${c('free(p + 1);')}, ${c('free("hi");')}</td><td>free only exact pointers from malloc, calloc, realloc</td></tr>
<tr><td>Using NULL</td><td>${c('int *p = calloc61(n, 4); p[0] = 1;')} with no check</td><td>p may be NULL</td></tr>
<tr><td>Uninitialized read</td><td>${c('int *p = malloc(4); printf("%d", *p);')}</td><td>malloc doesn't zero</td></tr>
</tbody>
</table>
<p>Two facts that save you: ${c('free(NULL)')} is always safe (it does nothing), and ${c('free')} does <b>not</b> set your pointer to NULL (it only gets a copy of the address).</p>
`
      },
      {
        title: 'Cleanup on failure, step by step',
        html: R`
<p>Whenever you make several allocations and any of them can fail, you must undo the ones that succeeded before returning NULL. Picture the moment allocation i fails:</p>
${SVG_CLEANUP}
<ol>
<li>Allocate the outer thing. If it's NULL, return NULL immediately (nothing to clean up yet).</li>
<li>Loop i from 0 to n - 1 and allocate piece i.</li>
<li>If piece i is NULL: free pieces 0 to i - 1 (loop ${c('j = 0; j < i')}), then free the outer, then return NULL.</li>
<li>Otherwise fill piece i (memcpy) and keep going.</li>
<li>After the loop, return the outer pointer.</li>
</ol>
${pre(R`
T *outer = calloc(n, sizeof(T));
if (outer == NULL) return NULL;                      // step 1
for (int i = 0; i < n; i++) {
    outer[i].piece = calloc(len_i, sizeof(elem));    // step 2
    if (outer[i].piece == NULL) {                    // step 3
        for (int j = 0; j < i; j++) free(outer[j].piece);   // the pieces that worked
        free(outer);                                         // then the container
        return NULL;
    }
    memcpy(outer[i].piece, source_i, len_i * sizeof(elem)); // step 4
}
return outer;                                        // step 5
`)}
<p><b>Order matters.</b> Free the inner pieces <i>before</i> the outer array, because you find the inner pieces by reading the outer array. Free the outer first and the loop reads freed memory.</p>
${tip(`Because calloc zeroes the outer array, slots you haven't reached yet hold NULL, and ${c('free(NULL)')} does nothing. So with a calloc'd outer array, freeing all n slots is also safe. With malloc it is not: those slots hold garbage. The ${c('j < i')} loop is correct either way, so use that.`)}
`
      },
      {
        title: 'Worked example: dup_strings, built up',
        html: R`
<p><b>Task:</b> ${c('char **dup_strings(char **strs, int n)')} returns a new array of n new strings, each a copy of ${c('strs[i]')}. On any failure return NULL with nothing leaked. (The gym's version may differ slightly; the shape is what matters.)</p>
<p><b>Step 1: write the sizes before any code.</b></p>
${pre(R`
// outer: n pointers         -> calloc(n, sizeof(char *))
// string i: letters + '\0'  -> malloc(strlen(strs[i]) + 1)
`)}
<p><b>Step 2: the outer array, checked.</b></p>
${pre(R`
char **out = calloc(n, sizeof(char *));
if (out == NULL) return NULL;
`)}
<p><b>Step 3: the loop, with the check and cleanup right after each allocation.</b></p>
${pre(R`
for (int i = 0; i < n; i++) {
    size_t len = strlen(strs[i]);
    out[i] = malloc(len + 1);
    if (out[i] == NULL) {
        for (int j = 0; j < i; j++) free(out[j]);
        free(out);
        return NULL;
    }
`)}
<p><b>Step 4: copy, including the terminator. Step 5: return.</b></p>
${pre(R`
    memcpy(out[i], strs[i], len + 1);   // or strcpy(out[i], strs[i]);
}
return out;
`)}
<p><b>Finished function:</b></p>
${pre(R`
char **dup_strings(char **strs, int n) {
    char **out = calloc(n, sizeof(char *));
    if (out == NULL) return NULL;
    for (int i = 0; i < n; i++) {
        size_t len = strlen(strs[i]);
        out[i] = malloc(len + 1);
        if (out[i] == NULL) {
            for (int j = 0; j < i; j++) free(out[j]);
            free(out);
            return NULL;
        }
        memcpy(out[i], strs[i], len + 1);
    }
    return out;
}
`)}
<p>The caller later frees it in the same order as cleanup: every ${c('out[i]')}, then ${c('out')}. That's n + 1 calls to free.</p>
<p>Notice the build_records checkpoint has the same skeleton. The differences: the outer elements are Records (so ${c('sizeof(Record)')} and ${c('recs[i].scores')}), there are plain fields to fill, and the inner size is ${c('counts[i] * sizeof(int)')} instead of strlen + 1.</p>
`
      },
      {
        title: 'Exam C question checklist',
        html: R`
${tip(`<b>Before you type:</b>
<ol>
<li>Read the struct and parameter types. Write the type of each expression you'll use (e.g. ${c('score_lists[i]')} is ${c('int *')} with length ${c('counts[i]')}).</li>
<li>Write the allocation sizes as comments first: outer = n times sizeof(the struct); inner i = count_i times sizeof(element).</li>
</ol>
<b>While typing:</b>
<ol start="3">
<li>Use the allocator they name (${c('calloc61')}), with (how many, sizeof ONE element).</li>
<li>Check every allocation for NULL immediately, before touching it.</li>
<li>Fill plain fields; copy arrays with ${c('memcpy(dst, src, count * sizeof(elem))')} (strings: strlen + 1).</li>
<li>On failure: free inner pieces 0 to i - 1, then the outer, then return NULL.</li>
<li>Return the outer pointer. Don't free what you return. Don't print anything.</li>
</ol>
<b>Before you submit:</b>
<ol start="8">
<li>Every size has its ${c('* sizeof(...)')}? Every index below its count? Every ${c('return NULL')} after the first allocation frees everything allocated so far?</li>
</ol>`)}
`
      }
    ],
    questions: [
      {
        id: 'c5-q1', type: 'mcq', difficulty: 'core',
        prompt: R`What does ${c('calloc')} guarantee that ${c('malloc')} does not?`,
        options: [
          R`It never returns NULL.`,
          R`The returned memory is all zero bytes.`,
          R`The memory is automatically freed when the function returns.`,
          R`The memory is on the heap.`
        ],
        answer: 1,
        whyWrong: [
          R`Both can fail and return NULL. calloc61 on the exam fails on purpose during testing.`,
          null,
          R`That describes stack memory. Heap memory from either function lives until you free it.`,
          R`Both allocate on the heap.`
        ],
        explain: R`<p>calloc(count, size) allocates count times size bytes <b>and sets every byte to 0</b>. So ints start at 0 and pointers start as NULL. malloc leaves whatever garbage was there. Everything else (heap, NULL on failure, needs free) is the same.</p>`
      },
      {
        id: 'c5-q2', type: 'mcq', difficulty: 'core',
        prompt: R`${c('recs')} should point at a new array of n Records. Which call allocates exactly the right amount?`,
        code: RECORD_T,
        options: [
          R`${c('calloc(n, sizeof(Record *))')}`,
          R`${c('calloc(n, sizeof(Record))')}`,
          R`${c('calloc(sizeof(Record))')}`,
          R`${c('malloc(n)')}`,
          R`${c('calloc(n * sizeof(Record), sizeof(Record))')}`
        ],
        answer: 1,
        whyWrong: [
          R`That's room for n pointers (8 bytes each on 64-bit), not n Records (24 bytes each). Writes past recs[0] go out of bounds. On 32-bit it's 4 vs 12: still a third.`,
          null,
          R`calloc takes two arguments (how many, size of one). This doesn't compile, and it forgot n anyway.`,
          R`n bytes, not n Records.`,
          R`That's n times 24 times 24 bytes: 24 times too much. Not "exactly enough".`
        ],
        explain: R`<p>calloc's arguments are (how many elements, size of ONE element). One element is a ${c('Record')}, 24 bytes on a 64-bit machine. So ${c('calloc(n, sizeof(Record))')} gives 24n bytes, all zero (12n on 32-bit, with the same code). ${c('malloc(n * sizeof(Record))')} would also be the right size, just not zeroed.</p>`
      },
      {
        id: 'c5-q3', type: 'number', difficulty: 'core', unit: 'bytes',
        prompt: R`On a 64-bit machine, how many bytes does ${c('calloc(5, sizeof(Record))')} allocate? (Record is the exam's struct: int id; int *scores; int count;)`,
        answer: 120,
        explain: R`<p>${c('sizeof(Record)')} is 24 (4 + 4 padding + 8 + 4 + 4 tail padding). 5 times 24 = <b>120</b>.</p>
<p>On a 32-bit machine ${c('sizeof(Record)')} is 12 (no padding), so it would be 60.</p>`
      },
      {
        id: 'c5-q4', type: 'mcq', difficulty: 'exam+',
        prompt: R`Suppose allocation 3 (${c('arr[1]')}) fails, so the function returns at (C). What leaks?`,
        code: src(R`
int **make_three(void) {
    int **arr = malloc(3 * sizeof(int *));   // allocation 1
    if (arr == NULL) return NULL;            // (A)
    arr[0] = malloc(sizeof(int));            // allocation 2
    if (arr[0] == NULL) return NULL;         // (B)
    arr[1] = malloc(sizeof(int));            // allocation 3
    if (arr[1] == NULL) return NULL;         // (C)
    arr[2] = malloc(sizeof(int));            // allocation 4
    if (arr[2] == NULL) return NULL;         // (D)
    return arr;
}
`),
        options: [
          R`Nothing. (C) returns NULL, so the caller knows it failed.`,
          R`Only the block ${c('arr')} points to.`,
          R`Only the block ${c('arr[0]')} points to.`,
          R`Both the block ${c('arr')} points to and the block ${c('arr[0]')} points to.`
        ],
        answer: 3,
        whyWrong: [
          R`Returning NULL tells the caller it failed, but the caller never receives arr, so it can't free anything. Every block that succeeded is lost.`,
          R`arr[0] also succeeded (allocation 2), and nothing frees it either.`,
          R`arr (allocation 1) also succeeded, and arr is a local variable that dies at the return.`,
          null
        ],
        explain: R`<p>At (C), allocations 1 and 2 succeeded. The only pointers to them are the local ${c('arr')} and the slot ${c('arr[0]')} inside it; both become unreachable when the function returns. A correct (C) is:</p>
${pre(R`
if (arr[1] == NULL) { free(arr[0]); free(arr); return NULL; }
`)}
<p>(B) has the same bug on a smaller scale (it leaks arr); (A) is fine because nothing was allocated yet. This is exactly the pattern the exam's failure-injection tests probe.</p>`
      },
      {
        id: 'c5-q5', type: 'mcq', difficulty: 'exam+',
        prompt: R`This is the failure branch inside a build_records-style loop. What is wrong with it?`,
        code: src(R`
if (recs[i].scores == NULL) {
    free(recs);
    for (int j = 0; j < i; j++) {
        free(recs[j].scores);
    }
    return NULL;
}
`),
        options: [
          R`Nothing; everything gets freed.`,
          R`After ${c('free(recs)')}, the loop reads ${c('recs[j].scores')} from freed memory (use after free). Free the scores first, then recs.`,
          R`The loop should run to ${c('j <= i')}.`,
          R`${c('free(recs)')} should be ${c('free(*recs)')}.`
        ],
        answer: 1,
        whyWrong: [
          R`Every block does get passed to free, but reading ${c('recs[j]')} after recs is freed is itself a memory error, and the checker flags it.`,
          null,
          R`${c('recs[i].scores')} is the one that failed (NULL), so there's nothing to free there. Including it would be harmless, but it isn't the bug.`,
          R`${c('*recs')} is a Record (a struct), not a pointer. You free the pointer calloc returned: ${c('recs')}.`
        ],
        explain: R`<p>You reach the inner blocks <i>through</i> the outer array, so the outer array must be freed last. Correct order: loop ${c('free(recs[j].scores)')} for j below i, then ${c('free(recs)')}, then ${c('return NULL')}.</p>`
      },
      {
        id: 'c5-q6', type: 'multi', difficulty: 'exam+',
        prompt: R`Assume every allocation succeeds and ${c('t')} is a valid string. Select <b>every</b> snippet that a memory checker reports as an error.`,
        options: [
          R`${c('int *p = malloc(4 * sizeof(int)); p[4] = 1;')}`,
          R`${c('free(NULL);')}`,
          R`${c('int x = 5; free(&x);')}`,
          R`${c('char *s = malloc(strlen(t)); strcpy(s, t);')}`,
          R`${c('int *p = calloc(3, sizeof(int)); int y = p[2]; free(p);')}`,
          R`${c('int *p = calloc(3, sizeof(int)); free(p); free(p);')}`,
          R`${c('int *p = malloc(8 * sizeof(int)); free(p + 1);')}`,
          R`${c('char *s = calloc(4, 1); strcpy(s, "abc"); free(s);')}`
        ],
        answer: [0, 2, 3, 5, 6],
        explain: R`<ul>
<li><b>Error:</b> ${c('p[4]')} is one past the last valid index (0 to 3): out-of-bounds write.</li>
<li>Fine: ${c('free(NULL)')} does nothing by definition.</li>
<li><b>Error:</b> x is on the stack; freeing it is an invalid free.</li>
<li><b>Error:</b> one byte short. strcpy writes the terminator past the end.</li>
<li>Fine: calloc zeroed the ints, p[2] is in bounds and is 0, then freed once.</li>
<li><b>Error:</b> double free.</li>
<li><b>Error:</b> ${c('p + 1')} isn't the pointer malloc returned: invalid free (and the real block leaks).</li>
<li>Fine: "abc" needs 4 bytes (3 letters + terminator), and that's exactly what was allocated.</li>
</ul>`
      },
      {
        id: 'c5-q7', type: 'mcq', difficulty: 'exam+',
        prompt: R`A student's build_records starts like this. What happens when n = 3, on a 64-bit machine?`,
        code: src(R`
Record *recs = calloc61(n, sizeof(Record *));
if (recs == NULL) return NULL;
for (int i = 0; i < n; i++) {
    recs[i].id = ids[i];
    recs[i].count = counts[i];
    /* ... */
}
`),
        options: [
          R`It works: a Record and a Record pointer are the same size.`,
          R`It allocates 24 bytes but 3 Records need 72, so writes to ${c('recs[1]')} and ${c('recs[2]')} go past the end of the block.`,
          R`It doesn't compile.`,
          R`It allocates too much memory, which wastes space but is otherwise fine.`
        ],
        answer: 1,
        whyWrong: [
          R`${c('sizeof(Record *)')} is 8; ${c('sizeof(Record)')} is 24. (On 32-bit: 4 and 12. Still different.)`,
          null,
          R`calloc only sees two numbers (3 and 8). It compiles without a warning, which is why this bug is so common.`,
          R`It's the opposite: too little.`
        ],
        explain: R`<p>3 times ${c('sizeof(Record *)')} = 3 times 8 = 24 bytes, which is room for exactly one Record. ${c('recs[1]')} starts at byte 24, already past the end. The program may even print correct values, but every "under memory checker" test fails. Fix: ${c('sizeof(Record)')} (or ${c('sizeof(*recs)')}).</p>
<p>On a 32-bit machine it's the same bug: 3 times 4 = 12 bytes, again room for exactly one Record.</p>`
      },
      {
        id: 'c5-q8', type: 'mcq', difficulty: 'exam+',
        prompt: R`What is the problem with the realloc line?`,
        code: src(R`
int *arr = malloc(n * sizeof(int));
if (arr == NULL) return NULL;
/* ... fill arr ... */
arr = realloc(arr, 2 * n * sizeof(int));
if (arr == NULL) return NULL;
`),
        options: [
          R`realloc can't make a block bigger.`,
          R`If realloc fails it returns NULL but the old block is still allocated. Overwriting arr with NULL loses the only pointer to it, so it leaks.`,
          R`realloc always moves the block, so the old contents are lost.`,
          R`You must ${c('free(arr)')} before calling realloc.`
        ],
        answer: 1,
        whyWrong: [
          R`Growing a block is realloc's main job.`,
          null,
          R`If it moves the block, realloc copies the old contents over for you (and frees the old block).`,
          R`That would make realloc operate on freed memory: use after free.`
        ],
        explain: R`<p>Keep the result in a temporary until you know it worked:</p>
${pre(R`
int *tmp = realloc(arr, 2 * n * sizeof(int));
if (tmp == NULL) { free(arr); return NULL; }
arr = tmp;
`)}`
      },
      {
        id: 'c5-q9', type: 'mcq', difficulty: 'exam+',
        prompt: R`Inside a build_records loop, the copy line is written like this. ${c('recs[i].scores')} was just allocated with ${c('calloc61(counts[i], sizeof(int))')}. What's the bug?`,
        code: src(R`
memcpy(recs[i].scores, score_lists[i], counts[i]);
`),
        options: [
          R`memcpy's third argument is a number of <b>bytes</b>, so this copies only counts[i] bytes (a quarter of the data). It should be ${c('counts[i] * sizeof(int)')}.`,
          R`The arguments are in the wrong order; the source comes first.`,
          R`memcpy can only copy chars, not ints.`,
          R`Nothing is wrong.`
        ],
        answer: 0,
        whyWrong: [
          null,
          R`memcpy is ${c('memcpy(dst, src, n)')}: destination first, like an assignment.`,
          R`memcpy copies raw bytes, so it works for any type, as long as the byte count is right.`,
          R`It runs without crashing and the memory checker sees nothing, which is exactly why it's dangerous. But the copied values are wrong.`
        ],
        explain: R`<p>With counts[i] = 3 and scores {90, 85, 70}, only 3 of the 12 bytes are copied. The rest of the calloc'd copy stays 0, so on a little-endian machine (RISC-V and x86 are both little-endian) the copy reads {90, 0, 0}. No crash, no checker error, but the "scores copied correctly" tests fail. Always write the byte count as count times sizeof(element).</p>`
      },
      {
        id: 'c5-q10', type: 'mcq', difficulty: 'core',
        prompt: R`Right after ${c('free(p);')}, what does the variable ${c('p')} hold?`,
        options: [
          R`NULL`,
          R`The same address as before, which now points at memory that isn't yours (a dangling pointer).`,
          R`A random new address.`
        ],
        answer: 1,
        whyWrong: [
          R`free receives a copy of the address (pass by value), so it can't change your variable. If you want p to be NULL, write ${c('p = NULL;')} yourself.`,
          null,
          R`Nothing changes p. It keeps the old address.`
        ],
        explain: R`<p>free gives the block back to the allocator but leaves your pointer alone. Reading or writing through p afterwards is a use after free; freeing it again is a double free.</p>`
      },
      {
        id: 'c5-q11', type: 'mcq', difficulty: 'exam+',
        prompt: R`This builds a linked list from an array. What should replace ${c('/* ??? */')} so nothing leaks when a malloc fails partway?`,
        code: src(R`
typedef struct Node { int val; struct Node *next; } Node;

Node *list_from_array(int *vals, int n) {
    Node *head = NULL, *tail = NULL;
    for (int i = 0; i < n; i++) {
        Node *nd = malloc(sizeof(Node));
        if (nd == NULL) {
            /* ??? */
            return NULL;
        }
        nd->val = vals[i];
        nd->next = NULL;
        if (head == NULL) head = nd;
        else tail->next = nd;
        tail = nd;
    }
    return head;
}
`),
        options: [
          R`${c('free(head);')}`,
          R`${c('while (head != NULL) { Node *next = head->next; free(head); head = next; }')}`,
          R`${c('free(nd);')}`,
          R`${c('for (int j = 0; j < i; j++) free(head[j]);')}`,
          R`Nothing; returning NULL is enough.`
        ],
        answer: 1,
        whyWrong: [
          R`That frees only the first node; every other node leaks.`,
          null,
          R`nd is NULL here (it's the allocation that failed), so this frees nothing and every earlier node leaks.`,
          R`Nodes aren't in an array; ${c('head[j]')} is a Node struct (not a pointer), so this doesn't compile, and the nodes aren't side by side anyway.`,
          R`Every node created so far would leak.`
        ],
        explain: R`<p>The nodes built so far are reachable only by walking from head, so cleanup walks the list, saving ${c('next')} before each free. Since every node's ${c('next')} is set to NULL when it's created, the walk stops correctly. If i is 0, head is NULL and the loop does nothing, which is also correct.</p>`
      },
      {
        id: 'c5-q12', type: 'number', difficulty: 'core',
        prompt: R`${c('dup_strings(strs, 4)')} succeeds and returns a new array of 4 new strings. How many calls to ${c('free')} does the caller need to release everything?`,
        answer: 5,
        explain: R`<p>One free per successful allocation: 4 strings + 1 outer array = <b>5</b>. Order: each ${c('out[i]')} first, then ${c('out')}. Likewise, a successful ${c('build_records(..., n)')} needs n + 1 frees.</p>`
      },
      {
        id: 'c5-q13', type: 'mcq', difficulty: 'exam+',
        prompt: R`Here the outer array comes from malloc, and the cleanup loop runs over all n slots. When allocation i fails (with i below n - 1), what goes wrong?`,
        code: src(R`
char **out = malloc(n * sizeof(char *));
if (out == NULL) return NULL;
for (int i = 0; i < n; i++) {
    out[i] = malloc(strlen(strs[i]) + 1);
    if (out[i] == NULL) {
        for (int j = 0; j < n; j++) free(out[j]);
        free(out);
        return NULL;
    }
    strcpy(out[i], strs[i]);
}
return out;
`),
        options: [
          R`Nothing; it frees everything.`,
          R`Slots after i were never set, and malloc doesn't zero, so they hold garbage. Freeing garbage pointers is an invalid free. Loop ${c('j < i')} instead (or allocate out with calloc).`,
          R`${c('free(out[i])')} frees NULL, which crashes.`,
          R`out should be freed before the loop.`
        ],
        answer: 1,
        whyWrong: [
          R`It also "frees" slots i + 1 to n - 1, which were never assigned.`,
          null,
          R`${c('free(NULL)')} is always safe. Slot i is fine; the slots after it are the problem.`,
          R`Then the loop would read freed memory (use after free).`
        ],
        explain: R`<p>Only slots 0 to i - 1 hold real heap pointers. Slot i is NULL (harmless), but slots after i contain whatever bytes malloc left there. With ${c('calloc')} for the outer array they'd be NULL and this loop would happen to work, which is one reason to prefer calloc for the outer array. The ${c('j < i')} loop is correct with either.</p>`
      }
    ]
  });

  // ===================================================================
  // Memory regions (Q2)
  // ===================================================================
  const SVG_ADDRSPACE = R`
<svg viewBox="0 0 680 370" width="100%" role="img" aria-label="Address space: Stack at the top growing down, free space, Heap growing up, then static Data, then Text (code) at the bottom near address 0">
  ${arrowDefs('regArrowA')}
  <g font-family="ui-monospace, Menlo, monospace" font-size="14" fill="#1f2933">
    <text x="140" y="20" text-anchor="middle" font-size="12" fill="#5b6673">high addresses (0xFFFF...)</text>
    <rect x="40" y="30" width="200" height="70" fill="#dbeafe" stroke="#1f2933"/>
    <text x="140" y="70" text-anchor="middle" font-weight="700">Stack</text>
    <rect x="40" y="100" width="200" height="90" fill="#ffffff" stroke="#9ca3af" stroke-dasharray="5 4"/>
    <line x1="110" y1="104" x2="110" y2="136" stroke="#1d4ed8" stroke-width="2.5" marker-end="url(#regArrowA)"/>
    <text x="122" y="126" font-size="12" fill="#1d4ed8">grows down</text>
    <line x1="110" y1="186" x2="110" y2="156" stroke="#15803d" stroke-width="2.5" marker-end="url(#regArrowA)"/>
    <text x="122" y="174" font-size="12" fill="#15803d">grows up</text>
    <rect x="40" y="190" width="200" height="50" fill="#dcfce7" stroke="#1f2933"/>
    <text x="140" y="220" text-anchor="middle" font-weight="700">Heap</text>
    <rect x="40" y="240" width="200" height="50" fill="#fef3c7" stroke="#1f2933"/>
    <text x="140" y="270" text-anchor="middle" font-weight="700">Data (static)</text>
    <rect x="40" y="290" width="200" height="50" fill="#fce7f3" stroke="#1f2933"/>
    <text x="140" y="320" text-anchor="middle" font-weight="700">Text (code)</text>
    <text x="140" y="360" text-anchor="middle" font-size="12" fill="#5b6673">address 0 (low addresses)</text>
    <g font-size="12.5">
      <text x="260" y="58">locals and parameters,</text>
      <text x="260" y="76">one frame per call that hasn't returned</text>
      <text x="260" y="140" fill="#5b6673">unused gap: stack and heap grow into it</text>
      <text x="260" y="212">every block from malloc, calloc, realloc</text>
      <text x="260" y="230">(lives until free)</text>
      <text x="260" y="262">globals, static variables,</text>
      <text x="260" y="280">string literals (whole program)</text>
      <text x="260" y="312">machine code of every function:</text>
      <text x="260" y="330">yours and the library's (memcpy, printf)</text>
    </g>
  </g>
</svg>`;

  const SVG_NODENEW = R`
<svg viewBox="0 0 720 290" width="100%" role="img" aria-label="Snapshot just before node_new returns: n, name and data are in node_new's stack frame; n points to the node_t struct on the heap; its data field points to an int64_t block on the heap; name points to the literal root in static data">
  ${arrowDefs('regArrowB')}
  <g font-family="ui-monospace, Menlo, monospace" font-size="13" fill="#1f2933">
    <text x="10" y="22" font-weight="700">Data</text>
    <rect x="10" y="34" width="150" height="36" fill="#fef3c7" stroke="#1f2933"/>
    <text x="85" y="57" text-anchor="middle">"root"</text>
    <text x="85" y="86" text-anchor="middle" font-size="11" fill="#5b6673">the literal = *name</text>
    <text x="10" y="122" font-weight="700">Text</text>
    <rect x="10" y="132" width="150" height="112" fill="#fce7f3" stroke="#1f2933"/>
    <g font-size="12"><text x="22" y="154">main</text><text x="22" y="174">node_new</text><text x="22" y="194">free_tree</text><text x="22" y="214">calloc, malloc</text><text x="22" y="234">memcpy, strlen</text></g>
    <text x="230" y="22" font-weight="700">Stack</text>
    <text x="290" y="22" font-size="11" fill="#5b6673">node_new's frame</text>
    <rect x="230" y="34" width="200" height="36" fill="#dbeafe" stroke="#1f2933"/>
    <circle cx="246" cy="52" r="4" fill="#1f2933"/><text x="262" y="57">name (char *)</text>
    <rect x="230" y="76" width="200" height="36" fill="#dbeafe" stroke="#1f2933"/>
    <text x="246" y="99">data = 61</text>
    <rect x="230" y="118" width="200" height="36" fill="#dbeafe" stroke="#1f2933"/>
    <text x="246" y="141">n (node_t *)</text><circle cx="412" cy="136" r="4" fill="#1f2933"/>
    <text x="230" y="184" font-size="11" fill="#5b6673">main's frame</text>
    <rect x="230" y="190" width="200" height="36" fill="#dbeafe" stroke="#1f2933"/>
    <text x="246" y="213">root (not set yet)</text>
    <text x="490" y="22" font-weight="700">Heap</text>
    <text x="540" y="22" font-size="11" fill="#5b6673">*n, from calloc</text>
    <rect x="490" y="34" width="220" height="128" fill="#dcfce7" stroke="#1f2933"/>
    <line x1="490" y1="66" x2="710" y2="66" stroke="#1f2933"/><line x1="490" y1="98" x2="710" y2="98" stroke="#1f2933"/><line x1="490" y1="130" x2="710" y2="130" stroke="#1f2933"/>
    <text x="500" y="55">name[6] "root"</text><text x="500" y="87">left    NULL</text><text x="500" y="119">right   NULL</text><text x="500" y="151">data</text><circle cx="690" cy="146" r="4" fill="#1f2933"/>
    <rect x="520" y="204" width="120" height="36" fill="#dcfce7" stroke="#1f2933"/>
    <text x="580" y="227" text-anchor="middle">61</text>
    <text x="580" y="258" text-anchor="middle" font-size="11" fill="#5b6673">*(n-&gt;data), from malloc</text>
    <line x1="242" y1="52" x2="164" y2="52" stroke="#b45309" stroke-width="2" marker-end="url(#regArrowB)"/>
    <line x1="416" y1="136" x2="486" y2="56" stroke="#1d4ed8" stroke-width="2" marker-end="url(#regArrowB)"/>
    <line x1="690" y1="150" x2="616" y2="201" stroke="#15803d" stroke-width="2" marker-end="url(#regArrowB)"/>
  </g>
</svg>`;

  const PM12_PROMPT = R`The very cool C program below stores items in various memory regions. For each item, choose the region where it is stored. Assume a 64-bit system, all pointers word-aligned, and that the code has <b>finished running ${c('node_new')}</b> (called from ${c('main')} as shown) <b>but has not returned from it yet</b>.`;
  const PAUSE = R`Execution is paused at <b>point X</b>. For each item, choose the region where it is stored.`;

  modules.push({
    id: 'regions',
    section: 'Memory regions',
    title: 'Memory regions: Stack, Heap, Data, Text',
    minutes: 25,
    quickCheck: ['reg-q2', 'reg-q5'],
    lesson: [
      {
        title: 'The four regions',
        html: R`
<p>A running C program's memory is split into four regions. Picture the address space as a tall column with address 0 at the bottom:</p>
${SVG_ADDRSPACE}
<table class="table table-sm">
<thead><tr><th>Region</th><th>What lives there</th><th>How long</th></tr></thead>
<tbody>
<tr><td><b>Stack</b></td><td>local variables and parameters of every function that is currently running (one <i>frame</i> per call)</td><td>until that call returns</td></tr>
<tr><td><b>Heap</b></td><td>every block returned by malloc, calloc, realloc (and the exam's calloc61)</td><td>until free</td></tr>
<tr><td><b>Data</b> (also called static)</td><td>global variables, ${c('static')} variables, string literals</td><td>the whole program</td></tr>
<tr><td><b>Text</b> (also called code)</td><td>the machine code of every function, yours and the library's</td><td>the whole program</td></tr>
</tbody>
</table>
`
      },
      {
        title: 'The decision rules',
        html: R`
<p>Ask: <b>where do the bytes of this exact expression live?</b> Not "what does it point to". Then go down this list:</p>
<table class="table table-sm">
<thead><tr><th>If the item is...</th><th>Region</th></tr></thead>
<tbody>
<tr><td>a function: its name used as a value (${c('node_new')}, ${c('free_tree')}, ${c('main')}) or a library function (${c('memcpy')}, ${c('printf')}, ${c('malloc')})</td><td><b>Text</b></td></tr>
<tr><td>a string literal ${c('"..."')}, or a char inside one</td><td><b>Data</b></td></tr>
<tr><td>a global variable or a ${c('static')} variable (even one declared inside a function), or an element or field of one</td><td><b>Data</b></td></tr>
<tr><td>a local variable or parameter, including pointer variables, local arrays and local structs, or an element or field of one</td><td><b>Stack</b></td></tr>
<tr><td>reached by following a pointer (${c('*p')}, ${c('p->f')}, ${c('p[i]')})</td><td>wherever that pointed-to block was created: malloc/calloc gives <b>Heap</b>, ${c('&local')} gives <b>Stack</b>, ${c('&global')} or a literal gives <b>Data</b></td></tr>
</tbody>
</table>
${trap(`A pointer variable and the thing it points to are two different items, often in different regions. ${c('n')} (the local pointer variable) is Stack. ${c('*n')} (the struct it points at) is Heap.`)}
${tip(`<b>32-bit or 64-bit doesn't matter here.</b> The "Assume a 64-bit system" line only changes how big things are, never where they live. Every answer is the same on a 32-bit system.`)}
<p><b>Fields and elements inherit.</b> ${c('n->name')} means ${c('(*n).name')}: a field inside ${c('*n')}, so it lives wherever ${c('*n')} lives. The same goes for ${c('recs[i].id')}, ${c('n->left')}, ${c('arr[3]')}. A field that is itself a pointer (${c('n->data')}) lives with its struct, but what it points at (${c('*(n->data)')}) is a separate item.</p>
`
      },
      {
        title: 'Walking node_new (the practice exam program)',
        html: R`
${pre(PM12_CODE)}
<p>Snapshot when node_new has finished but not returned, called as ${c('node_new("root", 61)')}:</p>
${SVG_NODENEW}
<table class="table table-sm">
<thead><tr><th>Item</th><th>Region</th><th>Why</th></tr></thead>
<tbody>
<tr><td>${c('n')}</td><td>Stack</td><td>local pointer variable in node_new's frame</td></tr>
<tr><td>${c('*n')}</td><td>Heap</td><td>the struct calloc returned</td></tr>
<tr><td>${c('n->name')}, ${c('n->name[0]')}</td><td>Heap</td><td>an array field (and its chars) inside ${c('*n')}</td></tr>
<tr><td>${c('n->left')}, ${c('n->right')}</td><td>Heap</td><td>pointer fields inside ${c('*n')} (their value is NULL thanks to calloc, but the fields' own bytes are in the heap struct)</td></tr>
<tr><td>${c('n->data')}</td><td>Heap</td><td>a pointer field inside ${c('*n')}</td></tr>
<tr><td>${c('*(n->data)')}</td><td>Heap</td><td>the separate int64_t block malloc returned</td></tr>
<tr><td>${c('name')}, ${c('data')}</td><td>Stack</td><td>parameters of node_new</td></tr>
<tr><td>${c('*name')}</td><td>depends on the caller</td><td>here the caller passed a literal, so Data. A char array local in main would make it Stack; a malloc'd string would make it Heap.</td></tr>
<tr><td>${c('node_new')}, ${c('free_tree')}, ${c('memcpy')}, ${c('calloc')}, ${c('strlen')}</td><td>Text</td><td>code</td></tr>
<tr><td>${c('root')}</td><td>Stack</td><td>main's local; main's frame exists the whole time</td></tr>
</tbody>
</table>
<p>"Finished running node_new but not returned" tells you node_new's frame still exists, so its parameters and locals (${c('name')}, ${c('data')}, ${c('n')}) are real Stack items you can be asked about.</p>
`
      },
      {
        title: 'Tricky cases the real exam can throw',
        html: R`
<ul>
<li><b>char array vs char pointer.</b> In a function, ${c('char a[] = "hi";')} puts a 3-byte copy in the frame: ${c('a')} and ${c('a[0]')} are Stack. ${c('char *p = "hi";')} puts only the pointer in the frame: ${c('p')} is Stack, ${c('*p')} and ${c('p[1]')} are Data.</li>
<li><b>static locals.</b> ${c('static int calls = 0;')} inside a function is Data, not Stack. It survives between calls, so it can't live in a frame.</li>
<li><b>Global arrays and global pointers.</b> ${c('int counts[10];')} at file level: counts and every element are Data. A global ${c('node_t *cache = malloc(...)')}: the variable ${c('cache')} is Data, but ${c('*cache')} and ${c('cache[i].name')} are Heap.</li>
<li><b>Local struct holding a heap pointer.</b> ${c('Record r; r.scores = malloc(...);')}: ${c('r')}, ${c('r.id')} and the field ${c('r.scores')} are Stack; ${c('r.scores[0]')} is Heap.</li>
<li><b>Heap array of pointers to locals.</b> ${c('int **ptrs = malloc(2 * sizeof(int *)); ptrs[0] = &x;')}: ${c('ptrs')} is Stack, ${c('ptrs[0]')} is Heap (a slot in the heap block), ${c('*ptrs[0]')} is Stack (it's x).</li>
<li><b>Addresses.</b> ${c('&x')} is a value, not a stored object. If asked where it points, the answer is where x lives (Stack for a local).</li>
<li><b>main's argc and argv.</b> Both are parameters: Stack. The argv array and the argument strings themselves are placed by the loader at the top of the stack, so ${c('argv[1]')} and ${c('*argv[1]')} are Stack too.</li>
<li><b>Recursion.</b> Every active call has its own frame. The local ${c('t')} in the 3rd call and ${c('t')} in the 1st call are two different Stack items.</li>
<li><b>const globals</b> like ${c('const int LIMIT = 100;')} are read-only static data: Data.</li>
</ul>
`
      }
    ],
    questions: [
      {
        id: 'reg-q1', type: 'dropdowns', difficulty: 'core',
        prompt: PM12_PROMPT,
        code: PM12_CODE,
        choices: REG,
        items: [
          { label: c('memcpy'), answer: 'Text', explain: R`A function: its machine code is in Text, even though it's a library function.` },
          { label: c('n->name'), answer: 'Heap', explain: R`An array field inside the struct calloc returned. Fields live with their struct.` },
          { label: c('n'), answer: 'Stack', explain: R`A local pointer variable in node_new's frame. It points to the heap, but n itself is on the stack.` },
          { label: c('data'), answer: 'Stack', explain: R`A parameter of node_new: parameters live in the frame. (It holds a copy of 61.)` },
          { label: c('*n'), answer: 'Heap', explain: R`The whole node_t that calloc returned.` },
          { label: c('free_tree'), answer: 'Text', explain: R`Function code is in Text, whether or not it is running right now.` }
        ],
        explain: R`<p>Rule of thumb: locals and parameters (n, data) are Stack; anything inside a calloc/malloc block (*n, n->name) is Heap; functions (memcpy, free_tree) are Text. See the full table in the lesson and walkthrough PM1.2.</p>`
      },
      {
        id: 'reg-q2', type: 'dropdowns', difficulty: 'exam+',
        prompt: PM12_PROMPT,
        code: PM12_CODE,
        choices: REG,
        items: [
          { label: c('n->data'), answer: 'Heap', explain: R`The pointer field itself is inside the heap struct *n, so Heap (it then points at another heap block).` },
          { label: c('*(n->data)'), answer: 'Heap', explain: R`The 8-byte block that malloc(sizeof(int64_t)) returned: Heap.` },
          { label: c('name'), answer: 'Stack', explain: R`A parameter (a char pointer variable) in node_new's frame.` },
          { label: c('*name'), answer: 'Data', explain: R`name points at the characters main passed in: the string literal "root", which lives in static Data.` },
          { label: c('n->left'), answer: 'Heap', explain: R`A pointer field inside the heap struct. Its value is NULL (calloc zeroed it), but its bytes are in the heap.` },
          { label: c('n->name[5]'), answer: 'Heap', explain: R`One char of the name array inside *n. Elements live with their array.` },
          { label: c('node_new'), answer: 'Text', explain: R`The function's machine code.` },
          { label: R`${c('root')} (in main)`, answer: 'Stack', explain: R`A local of main. main hasn't returned, so its frame is still on the stack (root just hasn't been assigned yet).` }
        ],
        explain: R`<p>The two traps here: a pointer field inside a heap struct (n->data, n->left) is Heap even though it "points somewhere", and *name depends on what the caller passed (a literal here, so Data).</p>`
      },
      {
        id: 'reg-q3', type: 'dropdowns', difficulty: 'core',
        prompt: R`Rules drill, no code. For each item, choose its memory region.`,
        choices: REG,
        items: [
          { label: R`A local variable ${c('int count')} declared inside ${c('main')}`, answer: 'Stack', explain: R`Locals live in the function's frame, and main is a function like any other.` },
          { label: R`The machine code of ${c('printf')}`, answer: 'Text', explain: R`All code, including library code, is Text.` },
          { label: R`The block returned by ${c('realloc')}`, answer: 'Heap', explain: R`malloc, calloc and realloc all hand out heap blocks.` },
          { label: R`The characters of the literal in ${c('printf("hi\n")')}`, answer: 'Data', explain: R`String literals are stored in static Data for the whole program.` },
          { label: R`A global variable ${c('int total;')}`, answer: 'Data', explain: R`Globals are static data.` },
          { label: R`A parameter ${c('int n')} of some function`, answer: 'Stack', explain: R`Parameters are locals that get their initial value from the caller.` },
          { label: R`${c('static int hits = 0;')} declared inside a function`, answer: 'Data', explain: R`static means "one copy that lasts the whole program", so it can't be in a frame: Data.` },
          { label: R`The array returned by ${c('calloc(n, sizeof(int))')}`, answer: 'Heap', explain: R`Heap, like every allocator result.` }
        ],
        explain: R`<p>Four buckets: running-function locals and parameters (Stack), allocator blocks (Heap), globals, statics and literals (Data), code (Text).</p>`
      },
      {
        id: 'reg-q4', type: 'dropdowns', difficulty: 'core',
        prompt: R`main has called ${c('total(local, 3)')}. ${PAUSE}`,
        code: src(R`
int counts[10];
char *label = "total";

int total(int *arr, int n) {
    static int calls = 0;
    int sum = 0;
    calls++;
    for (int i = 0; i < n; i++) {
        sum += arr[i];
    }
    // point X
    return sum;
}

int main(void) {
    int local[3] = {1, 2, 3};
    return total(local, 3);
}
`),
        choices: REG,
        items: [
          { label: c('counts[3]'), answer: 'Data', explain: R`An element of a global array. Globals and all their elements are static Data.` },
          { label: c('label'), answer: 'Data', explain: R`A global pointer variable: Data. (It happens to point at a literal, also in Data.)` },
          { label: c('*label'), answer: 'Data', explain: R`The first char of the string literal "total": Data.` },
          { label: c('calls'), answer: 'Data', explain: R`A static local: it keeps its value across calls, so it lives in Data, not in total's frame.` },
          { label: c('sum'), answer: 'Stack', explain: R`An ordinary local in total's frame.` },
          { label: c('arr'), answer: 'Stack', explain: R`A parameter: a pointer variable in total's frame.` },
          { label: c('arr[0]'), answer: 'Stack', explain: R`arr points at main's local array, so arr[0] is local[0] in main's frame: Stack.` },
          { label: c('total'), answer: 'Text', explain: R`Function code.` }
        ],
        explain: R`<p>Two traps: ${c('calls')} is declared inside a function but is ${c('static')}, so it's Data; and ${c('arr[0]')} follows the pointer into main's local array, so it's Stack, not Heap. Following a pointer does not automatically mean Heap.</p>`
      },
      {
        id: 'reg-q5', type: 'dropdowns', difficulty: 'exam+',
        prompt: PAUSE,
        code: src(R`
void greet(void) {
    char a[] = "hello";
    char *p = "hello";
    char *h = malloc(6);
    if (h == NULL) return;
    strcpy(h, a);
    // point X
    free(h);
}
`),
        choices: REG,
        items: [
          { label: c('a'), answer: 'Stack', explain: R`A local array: all 6 bytes of it sit in greet's frame (a copy of the literal's characters).` },
          { label: c('a[0]'), answer: 'Stack', explain: R`An element of a local array.` },
          { label: c('p'), answer: 'Stack', explain: R`A local pointer variable.` },
          { label: c('*p'), answer: 'Data', explain: R`p points at the string literal itself, which lives in static Data.` },
          { label: c('p[4]'), answer: 'Data', explain: R`Still a char of the literal: Data.` },
          { label: c('h'), answer: 'Stack', explain: R`A local pointer variable.` },
          { label: c('h[0]'), answer: 'Heap', explain: R`h points at the malloc'd block; its chars are Heap.` },
          { label: c('strcpy'), answer: 'Text', explain: R`Library function code: Text.` }
        ],
        explain: R`<p>Same text "hello", three different homes: copied into a local array (Stack), left in the literal (Data), copied into a malloc'd block (Heap). The pointer variables p and h are always Stack.</p>`
      },
      {
        id: 'reg-q6', type: 'dropdowns', difficulty: 'exam+',
        prompt: PAUSE,
        code: src(R`
typedef struct {
    int id;
    int *scores;
    int count;
} Record;

void demo(void) {
    Record r;
    r.id = 7;
    r.count = 3;
    r.scores = malloc(3 * sizeof(int));
    if (r.scores == NULL) return;
    Record *rp = &r;
    // point X
    free(r.scores);
}
`),
        choices: REG,
        items: [
          { label: c('r.id'), answer: 'Stack', explain: R`r is a local struct, so all its fields are in demo's frame.` },
          { label: c('r.scores'), answer: 'Stack', explain: R`The pointer field belongs to the local struct r: Stack. It points to the heap, but the field itself is on the stack.` },
          { label: c('r.scores[1]'), answer: 'Heap', explain: R`Follows the pointer into the malloc'd block: Heap.` },
          { label: c('rp'), answer: 'Stack', explain: R`A local pointer variable.` },
          { label: c('*rp'), answer: 'Stack', explain: R`rp points at r, a local struct: Stack.` },
          { label: c('rp->scores'), answer: 'Stack', explain: R`Same as r.scores: a field of the stack struct.` },
          { label: c('*(rp->scores)'), answer: 'Heap', explain: R`Same as r.scores[0]: inside the malloc'd block.` },
          { label: c('demo'), answer: 'Text', explain: R`Function code.` }
        ],
        explain: R`<p>This is the mirror image of node_new. There, the struct was on the heap, so all its fields were Heap. Here the struct is a local, so all its fields (including the pointer field) are Stack, and only what ${c('scores')} points at is Heap. Going through ${c('rp')} doesn't change where anything lives.</p>`
      },
      {
        id: 'reg-q7', type: 'dropdowns', difficulty: 'exam+',
        prompt: PAUSE,
        code: src(R`
void pair_up(void) {
    int x = 1, y = 2;
    int **ptrs = malloc(2 * sizeof(int *));
    if (ptrs == NULL) return;
    ptrs[0] = &x;
    ptrs[1] = &y;
    // point X
    free(ptrs);
}
`),
        choices: REG,
        items: [
          { label: c('ptrs'), answer: 'Stack', explain: R`A local pointer variable.` },
          { label: c('ptrs[0]'), answer: 'Heap', explain: R`A slot in the malloc'd block (it holds the address of x, but the slot is in the heap).` },
          { label: c('*ptrs'), answer: 'Heap', explain: R`Same thing as ptrs[0]: the first slot of the heap block.` },
          { label: c('*ptrs[1]'), answer: 'Stack', explain: R`Follows slot 1 to y, a local: Stack.` },
          { label: c('**ptrs'), answer: 'Stack', explain: R`Follows ptrs to slot 0, then slot 0 to x: Stack.` },
          { label: c('x'), answer: 'Stack', explain: R`A local int.` },
          { label: R`The memory that ${c('&y')} points to`, answer: 'Stack', explain: R`${c("&y")} is the address of y, a local, so it points into the stack.` }
        ],
        explain: R`<p>Count the hops. ${c('ptrs')} (0 hops) is the local variable. One hop lands in the heap block (${c('*ptrs')}, ${c('ptrs[0]')}). Two hops land back on the stack, at x or y. Each hop goes to wherever that pointer was aimed.</p>`
      },
      {
        id: 'reg-q8', type: 'dropdowns', difficulty: 'exam+',
        prompt: R`Suppose your ${c('build_records')} (Q3) keeps its result in a local ${c('Record *recs')} from ${c('calloc61')}, and gives each ${c('recs[i].scores')} its own ${c('calloc61')} block. main calls it as shown, and build_records has filled everything but has <b>not returned yet</b>. Choose each item's region.`,
        code: src(R`
typedef struct {
    int id;
    int *scores;
    int count;
} Record;

Record *build_records(int *ids, int **score_lists, int *counts, int n);

int main(void) {
    int ids[2] = {10, 20};
    int s0[2] = {90, 80};
    int s1[1] = {70};
    int *lists[2] = {s0, s1};
    int counts[2] = {2, 1};
    Record *out = build_records(ids, lists, counts, 2);
    /* ... */
}
`),
        choices: REG,
        items: [
          { label: R`${c('recs')} (inside build_records)`, answer: 'Stack', explain: R`A local pointer variable in build_records' frame.` },
          { label: c('recs[1]'), answer: 'Heap', explain: R`A whole Record inside the calloc61'd array.` },
          { label: c('recs[0].scores'), answer: 'Heap', explain: R`A pointer field of a Record that lives in the heap array.` },
          { label: c('recs[0].scores[1]'), answer: 'Heap', explain: R`An int in the separate calloc61 block for record 0's copied scores.` },
          { label: c('score_lists'), answer: 'Stack', explain: R`A parameter of build_records.` },
          { label: c('score_lists[1]'), answer: 'Stack', explain: R`score_lists points at main's local array lists, so score_lists[1] is lists[1] in main's frame.` },
          { label: c('score_lists[0][1]'), answer: 'Stack', explain: R`lists[0] is s0, a local array in main, so this is s0[1]: Stack.` },
          { label: c('build_records'), answer: 'Text', explain: R`Function code.` }
        ],
        explain: R`<p>Your copies are Heap; the caller's originals here are Stack (they're main's local arrays). That's the whole point of the deep copy: the Records must not depend on main's stack arrays, which die when main returns.</p>`
      },
      {
        id: 'reg-q9', type: 'dropdowns', difficulty: 'exam+',
        prompt: R`The program was run as ${c('./prog hello')}. ${PAUSE}`,
        code: src(R`
int main(int argc, char *argv[]) {
    if (argc < 2) return 1;
    char *first = argv[1];
    char *copy = malloc(strlen(first) + 1);
    if (copy == NULL) return 1;
    strcpy(copy, first);
    // point X
    free(copy);
    return 0;
}
`),
        choices: REG,
        items: [
          { label: c('argc'), answer: 'Stack', explain: R`A parameter of main.` },
          { label: c('argv'), answer: 'Stack', explain: R`A parameter of main (a pointer variable).` },
          { label: c('argv[1]'), answer: 'Stack', explain: R`The argv array is set up by the loader at the top of the stack, so its slots are Stack.` },
          { label: c('*first'), answer: 'Stack', explain: R`first equals argv[1], which points at the argument string "hello". The loader copies argument strings onto the stack.` },
          { label: c('copy'), answer: 'Stack', explain: R`A local pointer variable.` },
          { label: c('copy[0]'), answer: 'Heap', explain: R`The first char of the malloc'd copy.` },
          { label: c('strlen'), answer: 'Text', explain: R`Library code.` }
        ],
        explain: R`<p>In the 61C model, the loader "copies the arguments passed to the program onto the stack" before calling main. So everything argv leads to (the array of pointers and the strings) is Stack. Only the malloc'd copy is Heap.</p>`
      },
      {
        id: 'reg-q10', type: 'dropdowns', difficulty: 'exam+',
        prompt: R`main calls ${c('sum_list(&a)')}, which recurses to ${c('sum_list(b)')} and then ${c('sum_list(NULL)')}. Execution is paused at <b>point X</b> inside that third call. Choose each item's region.`,
        code: src(R`
typedef struct Node {
    int val;
    struct Node *next;
} Node;

int sum_list(Node *head) {
    static int calls = 0;
    calls++;
    if (head == NULL) {
        // point X
        return 0;
    }
    return head->val + sum_list(head->next);
}

int main(void) {
    Node *b = malloc(sizeof(Node));
    if (b == NULL) return 1;
    b->val = 2;
    b->next = NULL;
    Node a = {1, b};
    int total = sum_list(&a);
    free(b);
    return total;
}
`),
        choices: REG,
        items: [
          { label: R`${c('head')} in the first (outermost) call`, answer: 'Stack', explain: R`Each active call has its own frame with its own head parameter. All of them are Stack.` },
          { label: R`${c('*head')} in the first call`, answer: 'Stack', explain: R`The first call got ${c("&a")}, and a is a local struct in main: Stack.` },
          { label: R`${c('head->next')} in the first call`, answer: 'Stack', explain: R`That's the field a.next, part of the local struct a: Stack (even though it points to the heap).` },
          { label: R`${c('*head')} in the second call`, answer: 'Heap', explain: R`The second call got b, which points at the malloc'd node: Heap.` },
          { label: R`${c('head->next')} in the second call`, answer: 'Heap', explain: R`A field of the heap node (its value is NULL, but the field lives in the heap block).` },
          { label: c('calls'), answer: 'Data', explain: R`A static local: one shared copy in Data, not one per frame.` },
          { label: c('sum_list'), answer: 'Text', explain: R`Function code; recursion doesn't copy code.` },
          { label: R`${c('total')} in main`, answer: 'Stack', explain: R`A local of main (not assigned yet, but its frame exists).` }
        ],
        explain: R`<p>Recursion creates one frame per active call, so there are three ${c('head')} variables right now, all on the stack. A list can mix regions: here the first node is a stack struct and the second is a heap block. Decide each node by how it was created.</p>`
      },
      {
        id: 'reg-q11', type: 'dropdowns', difficulty: 'exam+',
        prompt: PAUSE,
        code: src(R`
typedef struct Node {
    char name[6];
    struct Node *left, *right;
    int64_t *data;
} node_t;

node_t *cache = NULL;
const char *greeting = "hey";

void setup(void) {
    static node_t spare;
    node_t local;
    cache = calloc(4, sizeof(node_t));
    if (cache == NULL) return;
    spare.left = cache;
    local.right = &spare;
    // point X
}
`),
        choices: REG,
        items: [
          { label: c('cache'), answer: 'Data', explain: R`A global pointer variable: Data, even though it holds a heap address.` },
          { label: c('cache[2]'), answer: 'Heap', explain: R`The third node_t in the calloc'd array.` },
          { label: c('cache[2].name'), answer: 'Heap', explain: R`A field of a heap struct.` },
          { label: c('*greeting'), answer: 'Data', explain: R`The first char of the literal "hey".` },
          { label: c('spare.left'), answer: 'Data', explain: R`spare is a static local, so the whole struct (every field) is in Data.` },
          { label: c('*(spare.left)'), answer: 'Heap', explain: R`spare.left was set to cache, so it points at cache[0], in the heap.` },
          { label: c('local.right'), answer: 'Stack', explain: R`A field of an ordinary local struct.` },
          { label: c('*(local.right)'), answer: 'Data', explain: R`local.right points at spare, which is static: Data.` }
        ],
        explain: R`<p>Every region shows up as both a "pointer home" and a "target": a Data pointer to Heap (cache), a Data struct field pointing to Heap (spare.left), and a Stack field pointing to Data (local.right). Always judge the item itself, then each hop separately.</p>`
      },
      {
        id: 'reg-q12', type: 'dropdowns', difficulty: 'exam+',
        prompt: R`Same tree code as the practice exam. main built a tree whose nodes all came from ${c('node_new')}, and called ${c('free_tree(root)')}. That top call has made the recursive call ${c('free_tree(t->left)')}, and execution is now at the start of that inner call, before anything has been freed. Choose each item's region.`,
        code: src(R`
void free_tree(node_t *t) {
    if (!t) return;

    free_tree(t->left);
    free_tree(t->right);
    free(t->data);
    free(t);
}
`),
        choices: REG,
        items: [
          { label: R`${c('t')} in the inner (current) call`, answer: 'Stack', explain: R`A parameter in the inner call's frame.` },
          { label: R`${c('t')} in the outer (top) call`, answer: 'Stack', explain: R`The outer call hasn't returned, so its frame and its own t still exist on the stack.` },
          { label: R`${c('t->left')} in the inner call`, answer: 'Heap', explain: R`A field of a node made by node_new (calloc): Heap.` },
          { label: R`${c('*(t->data)')} in the inner call`, answer: 'Heap', explain: R`The int64_t block from malloc in node_new.` },
          { label: c('free'), answer: 'Text', explain: R`Library code.` },
          { label: R`${c('root')} in main`, answer: 'Stack', explain: R`main's local pointer variable.` }
        ],
        explain: R`<p>Two frames of free_tree exist at once, each with its own ${c('t')}. Both t's are Stack; what they point to is Heap because node_new allocated every node and every data block.</p>`
      },
      {
        id: 'reg-q13', type: 'mcq', difficulty: 'core',
        prompt: R`The exam says the code "has finished running ${c('node_new')} but has not returned from the function yet". Why does that detail matter?`,
        options: [
          R`node_new's stack frame still exists, so its parameters and locals (${c('name')}, ${c('data')}, ${c('n')}) are real Stack items you can be asked about.`,
          R`calloc hasn't run yet, so ${c('*n')} doesn't exist.`,
          R`The heap blocks have been freed.`,
          R`${c('n')} has already been copied into main's ${c('root')}, so n is now in Data.`
        ],
        answer: 0,
        whyWrong: [
          null,
          R`"Finished running" means every line, including the calloc and malloc, has executed.`,
          R`Nothing has called free yet; free_tree hasn't run.`,
          R`Returning hasn't happened yet. Even after it does, root is a local of main: Stack, never Data.`
        ],
        explain: R`<p>A frame lives from the call until the return. Pausing just before the return means everything node_new created exists at once: its stack locals and the heap blocks they point to.</p>`
      },
      {
        id: 'reg-q14', type: 'mcq', difficulty: 'core',
        prompt: R`Which description matches the standard 61C picture of a program's address space?`,
        options: [
          R`Stack at the top (high addresses) growing down; heap above static data, growing up; text (code) at the bottom.`,
          R`Stack at the bottom growing up; heap at the top growing down.`,
          R`Heap at the top, then the stack, then text in the middle, then static data at the bottom.`,
          R`Static data at the very top, above the stack.`
        ],
        answer: 0,
        whyWrong: [
          null,
          R`Reversed: the stack starts at the top and grows toward lower addresses.`,
          R`Text and static data sit at the low end, with the heap just above them.`,
          R`Static data sits just above text, at the low end.`
        ],
        explain: R`<p>From high to low addresses: Stack (grows down), free space, Heap (grows up), static Data, Text. The stack and heap grow toward each other into the gap.</p>`
      }
    ]
  });

  // ===================================================================
  // CALL (Q1): Compiler, Assembler, Linker, Loader
  // ===================================================================
  const fileBox = (x, y, w, name, sub) => R`
    <rect x="${x}" y="${y}" width="${w}" height="50" rx="10" fill="#f3f4f6" stroke="#6b7280"/>
    <text x="${x + w / 2}" y="${y + 22}" text-anchor="middle" font-weight="700">${name}</text>
    <text x="${x + w / 2}" y="${y + 39}" text-anchor="middle" font-size="11" fill="#5b6673">${sub}</text>`;
  const stageBox = (x, y, w, name, fill) => R`
    <rect x="${x}" y="${y}" width="${w}" height="50" rx="3" fill="${fill}" stroke="#1f2933" stroke-width="2"/>
    <text x="${x + w / 2}" y="${y + 30}" text-anchor="middle" font-weight="700" font-size="15">${name}</text>`;
  const hArrow = (x1, x2, y) => '<line x1="' + x1 + '" y1="' + y + '" x2="' + x2 + '" y2="' + y + '" stroke="#1f2933" stroke-width="2" marker-end="url(#callArrow)"/>';

  const SVG_CALL = R`
<svg viewBox="0 0 720 280" width="100%" role="img" aria-label="CALL pipeline: foo.c to compiler to foo.s to assembler to foo.o; foo.o plus other object files and libraries to linker to a.out; a.out to loader to memory">
  ${arrowDefs('callArrow')}
  <g font-family="ui-monospace, Menlo, monospace" font-size="13" fill="#1f2933">
    ${fileBox(10, 30, 100, 'foo.c', 'C source')}
    ${hArrow(112, 137, 55)}
    ${stageBox(140, 30, 120, 'Compiler', '#dbeafe')}
    ${hArrow(262, 287, 55)}
    ${fileBox(290, 30, 100, 'foo.s', 'assembly')}
    ${hArrow(392, 417, 55)}
    ${stageBox(420, 30, 130, 'Assembler', '#dcfce7')}
    ${hArrow(552, 577, 55)}
    ${fileBox(580, 30, 120, 'foo.o', 'object file')}
    <polyline points="640,82 640,112 75,112 75,146" fill="none" stroke="#1f2933" stroke-width="2" marker-end="url(#callArrow)"/>
    <text x="360" y="106" text-anchor="middle" font-size="11" fill="#5b6673">every .o file of the program, plus libraries</text>
    ${stageBox(10, 150, 130, 'Linker', '#fef3c7')}
    ${fileBox(10, 226, 62, 'bar.o', 'object')}
    ${fileBox(78, 226, 62, 'libc.a', 'library')}
    <line x1="41" y1="224" x2="41" y2="204" stroke="#1f2933" stroke-width="2" marker-end="url(#callArrow)"/>
    <line x1="109" y1="224" x2="109" y2="204" stroke="#1f2933" stroke-width="2" marker-end="url(#callArrow)"/>
    ${hArrow(142, 172, 175)}
    ${fileBox(175, 150, 110, 'a.out', 'executable')}
    ${hArrow(287, 317, 175)}
    ${stageBox(320, 150, 120, 'Loader', '#fce7f3')}
    ${hArrow(442, 472, 175)}
    <rect x="475" y="150" width="225" height="50" rx="3" fill="#ede9fe" stroke="#1f2933"/>
    <text x="587" y="172" text-anchor="middle" font-weight="700">memory</text>
    <text x="587" y="189" text-anchor="middle" font-size="11" fill="#5b6673">the program is running</text>
  </g>
</svg>`;

  const CALL_LESSON_ASM = src(R`
        .data
msg:    .string "Go Bears!"
        .text
        .globl main
main:   addi sp, sp, -8
        sw   ra, 0(sp)
        sw   s0, 4(sp)
        li   s0, 3
loop:   beq  s0, x0, done     # forward reference: done comes later
        la   a0, msg          # needs the address of static data
        jal  ra, printf       # printf is defined in another file (libc)
        addi s0, s0, -1
        j    loop             # backward reference: loop already seen
done:   lw   ra, 0(sp)
        lw   s0, 4(sp)
        addi sp, sp, 8
        li   a0, 0
        ret
`);

  const CALL_Q_ASM = src(R`
        .data
msg:    .string "tick"
        .text
        .globl countdown
countdown:
        addi sp, sp, -8         # line 1
        sw   ra, 0(sp)          # line 2
        sw   s0, 4(sp)          # line 3
        mv   s0, a0             # line 4
loop:   beq  s0, x0, done       # line 5
        la   a0, msg            # line 6
        jal  ra, puts           # line 7   (puts is defined in libc)
        addi s0, s0, -1         # line 8
        j    loop               # line 9
done:   jal  ra, cleanup        # line 10
        lw   ra, 0(sp)          # line 11
        lw   s0, 4(sp)          # line 12
        addi sp, sp, 8          # line 13
        ret                     # line 14
cleanup:
        li   a0, 0              # line 15
        ret                     # line 16
`);

  const CALL_Q_LINES = [
    R`line 4: ${c('mv s0, a0')}`,
    R`line 5: ${c('beq s0, x0, done')}`,
    R`line 6: ${c('la a0, msg')}`,
    R`line 7: ${c('jal ra, puts')}`,
    R`line 9: ${c('j loop')}`,
    R`line 10: ${c('jal ra, cleanup')}`,
    R`line 15: ${c('li a0, 0')}`
  ];

  const S = (label, answer, explain) => ({ label: label, answer: answer, explain: explain });
  const CALL_POOL = [
    // compiler
    S(R`Takes high-level language code as input.`, 'compiler', R`Only the compiler reads C (or another high-level language). Every later stage reads assembly or binary.`),
    S(R`Takes a C source file such as ${c('foo.c')} as its input.`, 'compiler', R`.c in, .s out: that's the compiler.`),
    S(R`Outputs assembly language code (a ${c('.s')} file).`, 'compiler', R`The compiler's output is assembly; the assembler is the one that reads it.`),
    S(R`Produces assembly code that may still contain pseudoinstructions such as ${c('li')} and ${c('mv')}.`, 'compiler', R`The compiler is free to emit pseudoinstructions because the next stage, the assembler, expands them.`),
    S(R`Checks the program's types and reports errors such as using an undeclared variable.`, 'compiler', R`Types and variable names only exist in the C source, so only the compiler can check them.`),
    S(R`Translates C statements such as ${c('for')} loops into RISC-V assembly instructions.`, 'compiler', R`C to assembly is the compiler's whole job.`),
    S(R`Decides which registers will hold which C variables.`, 'compiler', R`Register allocation is part of turning C into assembly: compiler.`),
    S(R`Reports a syntax error for a missing semicolon in a ${c('.c')} file.`, 'compiler', R`Semicolons are C syntax; only the compiler parses C.`),
    // assembler
    S(R`Expands pseudoinstructions into their corresponding machine instructions.`, 'assembler', R`Pseudoinstructions exist only in assembly language; the assembler replaces each with one or more real instructions.`),
    S(R`Replaces ${c('mv a0, a1')} with ${c('addi a0, a1, 0')}.`, 'assembler', R`mv is a pseudoinstruction; expanding it is the assembler's job.`),
    S(R`Takes assembly language code as input and produces an object file.`, 'assembler', R`.s in, .o out: the assembler.`),
    S(R`Converts each assembly instruction into its 32-bit binary encoding.`, 'assembler', R`Turning text instructions into machine code is the assembler's core job.`),
    S(R`Makes two passes over the code so that it can handle forward references to labels.`, 'assembler', R`Pass 1 records where every label is; pass 2 fills in branches to labels that appeared later. That's the two-pass assembler.`),
    S(R`Creates the symbol table listing the labels defined in this file.`, 'assembler', R`The assembler builds the symbol table while reading the file. (The linker later uses it.)`),
    S(R`Creates the relocation table listing references whose final addresses are not known yet.`, 'assembler', R`The assembler records what it can't finish; the linker later reads that table and finishes it. Creates = assembler, uses = linker.`),
    S(R`Computes the offset for ${c('beq t0, x0, done')}, where ${c('done')} is a label later in the same file.`, 'assembler', R`A branch to a label in the same file is PC-relative, and the assembler knows both positions after pass 1. It resolves it in pass 2.`),
    S(R`Fills in the PC-relative offset of ${c('j loop')}, where ${c('loop')} is defined earlier in the same function.`, 'assembler', R`Same file, PC-relative: the assembler resolves it (a backward reference is even done in pass 1).`),
    S(R`Is the first stage whose output is binary machine code rather than text.`, 'assembler', R`The compiler outputs assembly text; the assembler outputs the binary object file.`),
    // linker
    S(R`Replaces the immediate in "la label" with its final value ("label" is defined in a different file than in the "la" instruction).`, 'linker', R`A label from another file has no known address until all files are combined. Only the linker sees every file.`),
    S(R`Combines several object files into a single executable.`, 'linker', R`Many .o files in, one executable out: linker.`),
    S(R`Patches the immediate of ${c('jal ra, printf')}, where ${c('printf')} is defined in another file.`, 'linker', R`A jump to a function in another file can only be filled in once the files are combined: linker.`),
    S(R`Uses the relocation tables of the object files to decide which instructions to fix up.`, 'linker', R`The assembler creates relocation tables; the linker reads them and patches each listed instruction.`),
    S(R`Places the text segments of all object files together, then the data segments together.`, 'linker', R`Steps 1 and 2 of linking: concatenate text segments, then data segments.`),
    S(R`Reports an "undefined reference" error when no file defines a function that some file calls.`, 'linker', R`Only the linker looks across all files, so only it can discover that a symbol is defined nowhere.`),
    S(R`Takes object files and static libraries (like ${c('libc.a')}) as input.`, 'linker', R`.o and .a files are linker inputs.`),
    S(R`Produces the executable file (such as ${c('a.out')}).`, 'linker', R`The executable is the linker's output and the loader's input.`),
    S(R`Copies the code of statically linked library functions into the program's executable.`, 'linker', R`Static linking means the linker pulls the needed library code into the executable.`),
    S(R`Determines the final absolute address of every label in the program.`, 'linker', R`Once the linker has placed every file's text and data, every label has a final address.`),
    // loader
    S(R`Copies the executable file into memory to prepare for execution.`, 'loader', R`Executable on disk into memory: the loader.`),
    S(R`Reads the executable's header to find the sizes of the text and data segments.`, 'loader', R`Step 1 of loading: read the header so it knows how much memory to set up.`),
    S(R`Creates a new address space big enough for the program's text, data and stack.`, 'loader', R`Setting up the program's memory is a loader step.`),
    S(R`Copies the command-line arguments (argc and argv) onto the stack.`, 'loader', R`Arguments only exist when the program is started, so the loader handles them.`),
    S(R`Initializes the machine registers, including setting the stack pointer.`, 'loader', R`Register setup happens at run time, right before the program starts: loader.`),
    S(R`Jumps to a start-up routine that copies the arguments into argument registers and calls ${c('main')}.`, 'loader', R`The loader's last step: jump to the start-up routine, which calls main.`),
    S(R`Is usually part of the operating system.`, 'loader', R`In practice the OS loads programs (for example, when you run a command in a shell).`),
    S(R`Runs every time you start the program, even if it was compiled and linked long ago.`, 'loader', R`Compiling, assembling and linking happen once; loading happens on every run.`),
    S(R`Brings a program stored on disk into memory so that it can run.`, 'loader', R`Disk to memory: loader.`)
  ];

  modules.push({
    id: 'call',
    section: 'CALL',
    title: 'CALL: Compiler, Assembler, Linker, Loader',
    minutes: 25,
    quickCheck: ['call-q1', 'call-q3'],
    lesson: [
      {
        title: 'The pipeline: from foo.c to a running program',
        html: R`
${SVG_CALL}
<table class="table table-sm">
<thead><tr><th>Stage</th><th>Input</th><th>Output</th><th>Main jobs</th></tr></thead>
<tbody>
<tr><td><b>Compiler</b></td><td>high-level code (${c('foo.c')})</td><td>assembly (${c('foo.s')}), may contain pseudoinstructions</td><td>parse C, check syntax and types, optimize, choose registers, turn C into assembly</td></tr>
<tr><td><b>Assembler</b></td><td>assembly (${c('foo.s')})</td><td>object file (${c('foo.o')}): machine code + symbol table + relocation table</td><td>expand pseudoinstructions, encode instructions in binary, resolve labels inside this file (two passes)</td></tr>
<tr><td><b>Linker</b></td><td>all object files + libraries (${c('.o')}, ${c('.a')})</td><td>executable (${c('a.out')})</td><td>combine text segments and data segments, resolve references across files, fill in final addresses</td></tr>
<tr><td><b>Loader</b></td><td>executable on disk</td><td>a running program in memory</td><td>part of the OS: set up memory, copy code and data in, set up the stack and registers, start main</td></tr>
</tbody>
</table>
<p>One way to remember the order: each stage can only do what it has the information for. The compiler sees C. The assembler sees one file of assembly. Only the linker sees all files at once. Only the loader deals with actual memory at run time.</p>
`
      },
      {
        title: 'The assembler: pseudoinstructions and two passes',
        html: R`
<p><b>Pseudoinstructions</b> are convenient instructions that the hardware doesn't actually have. The compiler (or you) writes them; the assembler expands each one into real instructions:</p>
<table class="table table-sm">
<thead><tr><th>Pseudoinstruction</th><th>Becomes</th></tr></thead>
<tbody>
<tr><td>${c('mv a0, a1')}</td><td>${c('addi a0, a1, 0')}</td></tr>
<tr><td>${c('li a0, 5')}</td><td>${c('addi a0, x0, 5')} (big constants: ${c('lui')} + ${c('addi')})</td></tr>
<tr><td>${c('j label')}</td><td>${c('jal x0, label')}</td></tr>
<tr><td>${c('ret')}</td><td>${c('jalr x0, ra, 0')}</td></tr>
<tr><td>${c('nop')}</td><td>${c('addi x0, x0, 0')}</td></tr>
<tr><td>${c('beqz t0, label')}</td><td>${c('beq t0, x0, label')}</td></tr>
<tr><td>${c('la a0, msg')}</td><td>${c('auipc a0, upper')} + ${c('addi a0, a0, lower')}</td></tr>
</tbody>
</table>
<p>Real instructions like ${c('add')}, ${c('addi')}, ${c('lw')}, ${c('sw')}, ${c('beq')}, ${c('jal')}, ${c('jalr')} are not pseudoinstructions.</p>
<p><b>Why two passes?</b> A branch to a label that appears <i>later</i> in the file (a <b>forward reference</b>) can't be encoded on first sight, because the assembler doesn't know where that label is yet.</p>
<ul>
<li><b>Pass 1:</b> read the file top to bottom, expand pseudoinstructions, and record the position of every label in the <b>symbol table</b>. Backward references (to labels already seen) can be finished now.</li>
<li><b>Pass 2:</b> now every label in this file is known, so fill in the PC-relative offsets of all branches and jumps to labels in this file, including forward ones.</li>
</ul>
<p>What's <i>still</i> unknown after pass 2: anything whose value depends on where things land after linking. That means references to labels in other files (${c('jal ra, printf')}) and addresses of static data (${c('la a0, msg')}). The assembler lists these in the <b>relocation table</b> for the linker.</p>
`
      },
      {
        title: 'Worked example: what is unresolved when',
        html: R`
${pre(CALL_LESSON_ASM, 'asm')}
<table class="table table-sm">
<thead><tr><th>Instruction</th><th>After pass 1</th><th>After pass 2</th><th>Who finishes it</th></tr></thead>
<tbody>
<tr><td>${c('beq s0, x0, done')}</td><td>unresolved (done not seen yet)</td><td>resolved</td><td>assembler</td></tr>
<tr><td>${c('la a0, msg')}</td><td>unresolved</td><td>unresolved</td><td>linker (needs msg's final address)</td></tr>
<tr><td>${c('jal ra, printf')}</td><td>unresolved</td><td>unresolved</td><td>linker (printf is in another file)</td></tr>
<tr><td>${c('j loop')}</td><td>resolved (loop already seen)</td><td>resolved</td><td>assembler</td></tr>
<tr><td>${c('li s0, 3')}, ${c('addi')}, ${c('sw')}, ${c('ret')}</td><td>no label involved</td><td></td><td>assembler</td></tr>
</tbody>
</table>
<p><b>Symbol table</b> (built by the assembler): the labels this file defines and their positions within the file, such as ${c('main')}, ${c('loop')}, ${c('done')} and ${c('msg')}. Labels marked ${c('.globl')} (like main) may be used by other files.</p>
<p><b>Relocation table</b> (built by the assembler, used by the linker): the places in this file that use an address the assembler can't finalize: ${c('la a0, msg')} and ${c('jal ra, printf')}. ${c('printf')} is not in this file's symbol table, because this file doesn't define it.</p>
<p>An object file holds: a header (sizes), the text segment (code), the data segment (static data), the relocation table, the symbol table, and debugging info.</p>
`
      },
      {
        title: 'The linker',
        html: R`
<p><b>Input:</b> all of the program's object files plus libraries. <b>Output:</b> one executable. The linker works in three steps:</p>
<ol>
<li>Put the text segments of all the ${c('.o')} files together.</li>
<li>Put the data segments together (after the text).</li>
<li>Resolve references: for every relocation table entry, look up the label in all the symbol tables, compute its final address, and patch the instruction (or data word) that uses it.</li>
</ol>
<p>After linking, every label has a final absolute address. Classic linker errors: "undefined reference to foo" (nobody defines foo) and "multiple definition of foo" (two files define it).</p>
<table class="table table-sm">
<thead><tr><th></th><th>Static linking</th><th>Dynamic linking</th></tr></thead>
<tbody>
<tr><td>When library code is attached</td><td>at link time: copied into the executable</td><td>when the program is loaded or run</td></tr>
<tr><td>Executable size</td><td>bigger (includes the library code it uses)</td><td>smaller</td></tr>
<tr><td>Library bug fix</td><td>must relink the program</td><td>picked up automatically next run</td></tr>
<tr><td>Cost</td><td>none at run time</td><td>some extra work at load/run time</td></tr>
</tbody>
</table>
`
      },
      {
        title: 'The loader',
        html: R`
<p>The loader is part of the operating system. When you run ${c('./a.out')}, it:</p>
<ol>
<li>Reads the executable's <b>header</b> to find the sizes of the text and data segments.</li>
<li>Creates a new <b>address space</b> big enough for text, data and stack.</li>
<li><b>Copies</b> the instructions and data from the executable file into memory.</li>
<li>Copies the <b>arguments</b> passed to the program (argc, argv) onto the stack.</li>
<li><b>Initializes registers</b>: most are cleared, and the stack pointer is set to the top of the stack.</li>
<li><b>Jumps to a start-up routine</b> that copies the arguments into argument registers and calls ${c('main')}. When main returns, that routine ends the program with the exit system call.</li>
</ol>
<p>Everything before the loader happens once, when you build the program. The loader runs every time you start it.</p>
`
      },
      {
        title: 'How to answer the "which stage" dropdowns',
        html: R`
<p>Match the statement to a stage using the files it mentions and the information it needs:</p>
<table class="table table-sm">
<thead><tr><th>If the statement mentions...</th><th>Answer</th></tr></thead>
<tbody>
<tr><td>high-level code, C, ${c('.c')}, types, syntax errors, optimization, producing assembly</td><td><b>compiler</b></td></tr>
<tr><td>pseudoinstructions being expanded, assembly in, object file out, machine code encoding, two passes, forward references, <i>creating</i> symbol or relocation tables, branches to labels in the same file</td><td><b>assembler</b></td></tr>
<tr><td>several object files, libraries, labels defined in a <i>different</i> file, final or absolute addresses, <i>using</i> relocation tables, producing the executable, undefined references, static linking</td><td><b>linker</b></td></tr>
<tr><td>memory, copying the executable in, running, OS, header sizes, address space, stack setup, argc/argv, registers, jumping to main</td><td><b>loader</b></td></tr>
</tbody>
</table>
${trap(`Two pairs are designed to trip you up. "Creates the relocation table" is the <b>assembler</b>, but "uses the relocation table" is the <b>linker</b>. A branch to a label <b>in the same file</b> is the <b>assembler</b>, but anything referring to a label <b>in a different file</b> is the <b>linker</b>.`)}
`
      }
    ],
    questions: [
      {
        id: 'call-q1', type: 'dropdowns', difficulty: 'core',
        prompt: R`Choose which stage (compiler, assembler, linker, loader) is best described by each statement.`,
        choices: STAGES,
        pool: CALL_POOL,
        draw: 4,
        explain: R`<p>Ask what the stage needs to know. Only the compiler sees C. The assembler sees one assembly file at a time (pseudoinstructions, encoding, labels in that file, creating the tables). Only the linker sees all files (cross-file labels, final addresses, using relocation tables). Only the loader touches memory at run time (copying in, stack, registers, main). Press Try again for 4 new statements.</p>`
      },
      {
        id: 'call-q2', type: 'multi', difficulty: 'exam+',
        prompt: R`The assembler processes this file. Select <b>every</b> line that is still <b>unresolved after pass 1</b>.`,
        code: CALL_Q_ASM,
        options: CALL_Q_LINES,
        answer: [1, 2, 3, 5],
        explain: R`<ul>
<li>Line 4 (${c('mv')}) and line 15 (${c('li')}) are pseudoinstructions with no label: expanded and done in pass 1.</li>
<li>Line 5 branches <b>forward</b> to ${c('done')}, which pass 1 hasn't reached yet: unresolved.</li>
<li>Line 6 (${c('la')}) needs the final address of static data: unresolved (and stays that way until linking).</li>
<li>Line 7 jumps to ${c('puts')}, defined in another file: unresolved.</li>
<li>Line 9 jumps <b>backward</b> to ${c('loop')}, already recorded: resolved in pass 1.</li>
<li>Line 10 jumps <b>forward</b> to ${c('cleanup')}, defined later in this same file: unresolved after pass 1.</li>
</ul>`
      },
      {
        id: 'call-q3', type: 'multi', difficulty: 'exam+',
        prompt: R`Same file. Select <b>every</b> line that is still <b>unresolved after pass 2</b> (and so must be finished by the linker).`,
        code: CALL_Q_ASM,
        options: CALL_Q_LINES,
        answer: [2, 3],
        explain: R`<p>After pass 1, every label in this file is known, so pass 2 resolves both forward references (line 5 to ${c('done')}, line 10 to ${c('cleanup')}). What's left are the two that depend on linking: line 6 (${c('la a0, msg')}, the address of static data) and line 7 (${c('jal ra, puts')}, a function in another file). Both go in the relocation table.</p>
<p>The trap is line 10: it's a ${c('jal')} like line 7, but its target is in this file, so the assembler can finish it.</p>`
      },
      {
        id: 'call-q4', type: 'mcq', difficulty: 'core',
        prompt: R`Which statement correctly describes the two tables in an object file?`,
        options: [
          R`<b>Symbol table:</b> labels defined in this file and their positions (for example ${c('countdown')} and ${c('msg')}). <b>Relocation table:</b> places in this file that use an address the assembler can't finalize (for example ${c('la a0, msg')} and ${c('jal ra, puts')}).`,
          R`<b>Symbol table:</b> instructions the linker must patch. <b>Relocation table:</b> labels defined in this file.`,
          R`<b>Symbol table:</b> every label used anywhere in the file, including ${c('puts')}. <b>Relocation table:</b> every branch and jump.`,
          R`Both tables are created by the linker.`
        ],
        answer: 0,
        whyWrong: [
          null,
          R`That's the two definitions swapped.`,
          R`puts isn't defined in this file, so it isn't in this file's symbol table. And branches to labels inside this file are resolved by the assembler, so they need no relocation entry.`,
          R`The assembler creates both tables; the linker <i>uses</i> them.`
        ],
        explain: R`<p>Symbol table = "what I define" (so other files can find it). Relocation table = "what I need someone else to fill in". The linker matches every relocation entry against all the symbol tables.</p>`
      },
      {
        id: 'call-q5', type: 'multi', difficulty: 'core',
        prompt: R`Select <b>every</b> kind of file the linker takes as input.`,
        options: [
          R`C source files (${c('.c')})`,
          R`assembly files (${c('.s')})`,
          R`object files (${c('.o')})`,
          R`static libraries (${c('.a')}, such as ${c('libc.a')})`,
          R`the executable (${c('a.out')})`
        ],
        answer: [2, 3],
        explain: R`<p>The linker combines object files and libraries (a static library is a bundle of object files). .c goes into the compiler, .s into the assembler, and a.out is the linker's output (and the loader's input).</p>`
      },
      {
        id: 'call-q6', type: 'mcq', difficulty: 'exam+',
        prompt: R`Compared with static linking, which is true of dynamic linking?`,
        options: [
          R`The executable is smaller, and a library bug fix can take effect without relinking the program, but some linking work happens when the program loads or runs.`,
          R`The whole library is copied into the executable.`,
          R`Programs always run faster, because no work is left for run time.`,
          R`It happens before the assembler runs.`
        ],
        answer: 0,
        whyWrong: [
          null,
          R`That describes static linking.`,
          R`It's the reverse: dynamic linking adds some run-time work (finding and connecting the library).`,
          R`Linking of either kind always comes after assembling; you need object files first.`
        ],
        explain: R`<p>Static: library code is copied in at link time (big, self-contained, must relink to update). Dynamic: the executable just records which library it needs, and the connection happens at load or run time (smaller, shares one copy of the library, picks up updates, small run-time cost).</p>`
      },
      {
        id: 'call-q7', type: 'multi', difficulty: 'core',
        prompt: R`Select <b>every</b> pseudoinstruction (an instruction the assembler must expand into real ones).`,
        options: [
          R`${c('mv a0, a1')}`,
          R`${c('li t0, 5')}`,
          R`${c('add a0, a1, a2')}`,
          R`${c('la a0, msg')}`,
          R`${c('lw t0, 0(sp)')}`,
          R`${c('j loop')}`,
          R`${c('jal ra, puts')}`,
          R`${c('ret')}`,
          R`${c('beq t0, x0, done')}`
        ],
        answer: [0, 1, 3, 5, 7],
        explain: R`<ul>
<li>${c('mv')} becomes ${c('addi a0, a1, 0')}.</li>
<li>${c('li')} becomes ${c('addi t0, x0, 5')}.</li>
<li>${c('la')} becomes ${c('auipc')} + ${c('addi')}.</li>
<li>${c('j loop')} becomes ${c('jal x0, loop')}.</li>
<li>${c('ret')} becomes ${c('jalr x0, ra, 0')}.</li>
</ul>
<p>${c('add')}, ${c('lw')}, ${c('jal ra, ...')} and ${c('beq')} are real RISC-V instructions. (${c('beqz')} would be a pseudoinstruction, but ${c('beq')} with x0 written out is real.)</p>`
      },
      {
        id: 'call-q8', type: 'mcq', difficulty: 'exam+',
        prompt: R`In the countdown file above, which stage is the first to know the final absolute address of the data label ${c('msg')}?`,
        code: CALL_Q_ASM,
        options: [R`compiler`, R`assembler`, R`linker`, R`loader`],
        answer: 2,
        whyWrong: [
          R`The compiler only produces assembly text with labels in it; no addresses are assigned yet.`,
          R`The assembler only knows msg's position within this one file's data segment. It doesn't know where that segment will end up, which is why ${c('la a0, msg')} goes in the relocation table.`,
          null,
          R`In the 61C model the loader just copies an executable whose addresses the linker already fixed.`
        ],
        explain: R`<p>The linker decides where every file's text and data go, so it is the first stage that can compute msg's absolute address, and it patches ${c('la a0, msg')} with it. That's exactly the practice statement "Replaces the immediate in la label with its final value".</p>`
      }
    ]
  });

  // ===================================================================
  // Walkthroughs of the practice midterm
  // ===================================================================
  walkthroughs.push({
    id: 'pm11',
    title: 'PM1.1 CALL',
    html: R`
<p><b>The question:</b> "Choose which stage (compiler, assembler, linker, loader) is best described by each statement." Four dropdowns, 2 points. The real exam draws different statements, so learn the reasoning, not just these four.</p>
<table class="table table-sm">
<thead><tr><th>Statement</th><th>Answer</th><th>Why</th></tr></thead>
<tbody>
<tr><td>Replaces the immediate in "la label" with its final value ("label" is defined in a different file than in the "la" instruction).</td><td><b>linker</b></td><td>The label lives in another file. Only the linker sees every file, so only it can compute the label's final address and patch the instruction. The giveaways: "different file" and "final value".</td></tr>
<tr><td>Copies the executable file into memory to prepare for execution.</td><td><b>loader</b></td><td>Executable plus memory plus execution: that's loading. The giveaways: "executable" (the linker's output) and "memory".</td></tr>
<tr><td>Takes high-level language code as input.</td><td><b>compiler</b></td><td>C is high-level. The compiler is the only stage that reads it; everything after reads assembly or binary.</td></tr>
<tr><td>Expands pseudoinstructions into their corresponding machine instructions.</td><td><b>assembler</b></td><td>Pseudoinstructions exist only in assembly language, and the assembler turns assembly into machine code. (The compiler produces pseudoinstructions; it doesn't expand them.)</td></tr>
</tbody>
</table>
<p><b>The general trick: ask four questions in order.</b></p>
<ol>
<li>Does it involve C or other high-level code, types, or producing assembly? <b>compiler</b>.</li>
<li>Does it happen when the program is started, or involve memory, the stack, registers, argv or main? <b>loader</b>.</li>
<li>Does it need information from more than one file (another file's label, libraries, final or absolute addresses, combining .o files, using relocation tables)? <b>linker</b>.</li>
<li>Otherwise it works on one assembly file: pseudoinstructions, binary encoding, two passes, labels in the same file, creating the symbol and relocation tables. <b>assembler</b>.</li>
</ol>
<p><b>Reworded variants you might see:</b></p>
<ul>
<li>"Resolves a jal to a function defined in another .o file": linker.</li>
<li>"Turns li a0, 5 into addi a0, x0, 5": assembler.</li>
<li>"Outputs a file containing assembly code": compiler.</li>
<li>"Sets up the stack and copies argc and argv onto it": loader.</li>
<li>"Fills in the offset of a branch to a label later in the same file": assembler (pass 2).</li>
<li>"Builds the relocation table": assembler. "Reads the relocation table": linker.</li>
</ul>
${trap(`"In the same file" means assembler; "in a different file" means linker. "Creates" a table means assembler; "uses" a table means linker. Read those words carefully.`)}
<p>Practice more in the CALL module: its bank has 37 statements and draws 4 at a time.</p>
`
  });

  walkthroughs.push({
    id: 'pm12',
    title: 'PM1.2 Memory regions',
    html: R`
<p><b>The question:</b> for each item, choose Text, Data, Heap or Stack. Assumptions: 64-bit system, pointers word-aligned, and the code <b>has finished running node_new but has not returned from it yet</b>. That last part means node_new's stack frame (its parameters and locals) still exists. The 64-bit part never changes an answer: regions depend on how memory was obtained, not on sizes.</p>
${pre(PM12_CODE)}
<p>The practice screenshot showed ${c('memcpy')} = Text and ${c('n->name')} = Heap. Here is every plausible item, assuming main called ${c('node_new("root", 61)')} as above:</p>
<table class="table table-sm">
<thead><tr><th>Item</th><th>Region</th><th>One-line reason</th></tr></thead>
<tbody>
<tr><td>${c('memcpy')}</td><td><b>Text</b></td><td>a function; library code is still code</td></tr>
<tr><td>${c('n->name')}</td><td><b>Heap</b></td><td>an array field inside the struct calloc returned</td></tr>
<tr><td>${c('n')}</td><td><b>Stack</b></td><td>a local pointer variable in node_new's frame</td></tr>
<tr><td>${c('*n')}</td><td><b>Heap</b></td><td>the whole node_t from calloc</td></tr>
<tr><td>${c('name')}</td><td><b>Stack</b></td><td>a parameter (a char pointer variable)</td></tr>
<tr><td>${c('*name')}</td><td><b>Data</b></td><td>points at the caller's string; a literal like "root" is static Data (a local char array in main would make it Stack; a malloc'd string would make it Heap)</td></tr>
<tr><td>${c('data')}</td><td><b>Stack</b></td><td>a parameter holding a copy of 61</td></tr>
<tr><td>${c('n->data')}</td><td><b>Heap</b></td><td>a pointer field inside the heap struct</td></tr>
<tr><td>${c('*(n->data)')}</td><td><b>Heap</b></td><td>the int64_t block from malloc</td></tr>
<tr><td>${c('node_new')}</td><td><b>Text</b></td><td>function code</td></tr>
<tr><td>${c('free_tree')}</td><td><b>Text</b></td><td>function code, even though it isn't running</td></tr>
<tr><td>${c('n->left')}, ${c('n->right')}</td><td><b>Heap</b></td><td>pointer fields of the heap struct (their value is NULL from calloc, but the fields are in the heap)</td></tr>
<tr><td>${c('n->name[0]')}</td><td><b>Heap</b></td><td>a char of the heap struct's name array</td></tr>
<tr><td>${c('root')} in main</td><td><b>Stack</b></td><td>main's local; main's frame is below node_new's</td></tr>
</tbody>
</table>
<p><b>The method in one sentence:</b> first decide where the expression's own bytes live (locals and parameters: Stack; inside an allocator block: Heap; globals, statics, literals: Data; functions: Text), and treat each pointer hop as a new item.</p>
${trap(`Don't answer Heap for ${c('n')} just because it points to the heap, and don't answer Stack for ${c('n->data')} just because n is a local. A pointer variable and its target are separate items.`)}
<p><b>Bonus for Q3:</b> this exam code has two real memory bugs worth spotting. (1) ${c('if(!(n->data)) return NULL;')} leaks n: it should ${c('free(n)')} before returning. (2) The memcpy overflows ${c('n->name')} if the name has more than 5 characters, since name holds only 6 bytes including the terminator.</p>
`
  });

  walkthroughs.push({
    id: 'pm13',
    title: 'PM1.3 build_records (C coding)',
    html: R`
<p><b>The task:</b> write ${c('Record *build_records(int *ids, int **score_lists, int *counts, int n)')}. Return a newly allocated array of n Records using ${c('calloc61')} (calloc that may fail and return NULL). Each Record gets ${c('ids[i]')}, ${c('counts[i]')}, and its <b>own newly allocated copy</b> of ${c('score_lists[i]')} (counts[i] ints). Allocate exactly enough. If any call fails, return NULL. Assume n is at least 1 and every counts[i] is at least 1.</p>
${pre(RECORD_T)}
<p><b>Step 0: name the types.</b></p>
<table class="table table-sm">
<thead><tr><th>Expression</th><th>Type</th><th>Meaning</th></tr></thead>
<tbody>
<tr><td>${c('ids[i]')}</td><td>${c('int')}</td><td>id for record i</td></tr>
<tr><td>${c('score_lists[i]')}</td><td>${c('int *')}</td><td>the caller's scores for record i (don't keep this pointer!)</td></tr>
<tr><td>${c('counts[i]')}</td><td>${c('int')}</td><td>how many ints ${c('score_lists[i]')} has</td></tr>
<tr><td>${c('recs[i]')}</td><td>${c('Record')}</td><td>a struct, so use a dot: ${c('recs[i].id')}</td></tr>
</tbody>
</table>
<p><b>Step 1: write the sizes before any code.</b></p>
${pre(R`
// outer: n Records          -> calloc61(n, sizeof(Record))        (24 bytes each on 64-bit)
// scores i: counts[i] ints  -> calloc61(counts[i], sizeof(int))
// copy i: counts[i] * sizeof(int) bytes
`)}
<p><b>Step 2: allocate the outer array and check it.</b> Nothing else exists yet, so failure just returns NULL.</p>
${pre(R`
Record *recs = calloc61(n, sizeof(Record));
if (recs == NULL) return NULL;
`)}
<p><b>Step 3: loop and fill the plain fields.</b></p>
${pre(R`
for (int i = 0; i < n; i++) {
    recs[i].id = ids[i];
    recs[i].count = counts[i];
`)}
<p><b>Step 4: allocate this record's scores and check it at once.</b> If it fails, free scores 0 to i - 1, then the outer array, then return NULL.</p>
${pre(R`
    recs[i].scores = calloc61(counts[i], sizeof(int));
    if (recs[i].scores == NULL) {
        for (int j = 0; j < i; j++) free(recs[j].scores);
        free(recs);
        return NULL;
    }
`)}
<p><b>Step 5: copy the scores (bytes = count times element size). Step 6: return.</b></p>
${pre(R`
    memcpy(recs[i].scores, score_lists[i], counts[i] * sizeof(int));
}
return recs;
`)}
<p><b>The finished function:</b></p>
${pre(R`
Record *build_records(int *ids, int **score_lists, int *counts, int n) {
    Record *recs = calloc61(n, sizeof(Record));
    if (recs == NULL) return NULL;
    for (int i = 0; i < n; i++) {
        recs[i].id = ids[i];
        recs[i].count = counts[i];
        recs[i].scores = calloc61(counts[i], sizeof(int));
        if (recs[i].scores == NULL) {
            for (int j = 0; j < i; j++) free(recs[j].scores);
            free(recs);
            return NULL;
        }
        memcpy(recs[i].scores, score_lists[i], counts[i] * sizeof(int));
    }
    return recs;
}
`)}
<p><b>Trace a failure.</b> n = 3, and the grader makes the 3rd calloc61 call fail. Call 1 is recs, call 2 is recs[0].scores, call 3 is recs[1].scores, so the failure happens at i = 1. The cleanup loop frees recs[0].scores (j = 0 only), then recs. Two allocations, two frees: nothing leaks, nothing NULL is touched.</p>
<p><b>What the 10 grading categories are probably checking</b> (an educated guess from "10 categories, half under memory checkers"):</p>
<table class="table table-sm">
<thead><tr><th>#</th><th>Likely check</th><th>What it needs from you</th></tr></thead>
<tbody>
<tr><td>1</td><td>n = 1, one record</td><td>id, count and scores all set correctly</td></tr>
<tr><td>2</td><td>several records with different counts</td><td>using ${c('counts[i]')}, not a fixed size</td></tr>
<tr><td>3</td><td>score values copied correctly</td><td>${c('memcpy')} with ${c('counts[i] * sizeof(int)')}</td></tr>
<tr><td>4</td><td>each scores array is a new allocation</td><td>a deep copy, not ${c('recs[i].scores = score_lists[i]')}</td></tr>
<tr><td>5</td><td>outer allocation fails</td><td>return NULL right away</td></tr>
<tr><td>6</td><td>no out-of-bounds access (checker)</td><td>${c('sizeof(Record)')} not ${c('sizeof(Record *)')}; loop bounds below n</td></tr>
<tr><td>7</td><td>no leaks on success (checker)</td><td>no extra allocations you don't return</td></tr>
<tr><td>8</td><td>first inner allocation fails (checker)</td><td>free recs, return NULL</td></tr>
<tr><td>9</td><td>a later inner allocation fails (checker)</td><td>free every earlier scores, then recs</td></tr>
<tr><td>10</td><td>never use a NULL from calloc61 (checker)</td><td>check each result before writing to it</td></tr>
</tbody>
</table>
<p><b>The 5 most common ways to lose points:</b></p>
<ol>
<li><b>Wrong element size:</b> ${c('calloc61(n, sizeof(Record *))')} (8 bytes instead of 24 on 64-bit). Compiles fine, fails every checker test.</li>
<li><b>Byte count without sizeof:</b> ${c('memcpy(dst, src, counts[i])')} copies a quarter of the data. No crash, wrong values.</li>
<li><b>Shallow copy:</b> ${c('recs[i].scores = score_lists[i];')} instead of allocating and copying.</li>
<li><b>Incomplete or misordered cleanup:</b> returning NULL without freeing earlier scores or recs, or freeing recs before the loop that reads recs[j].</li>
<li><b>Skipping a check, or using the wrong allocator:</b> writing to recs or recs[i].scores before checking for NULL, or using malloc instead of calloc61 (the grader injects failures through calloc61, so the failure tests most likely can't pass).</li>
</ol>
<p>For reference, the grader (or any caller) frees your result like this: ${c('for (int i = 0; i < n; i++) free(recs[i].scores); free(recs);')}. Your function must not free anything it returns.</p>
<p>Next: write it from scratch in the gym (q04 dup_strings has the same skeleton), then time yourself on this one.</p>
`
  });

  window.CONTENT = { modules: modules, walkthroughs: walkthroughs };
})();
