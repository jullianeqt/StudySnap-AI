export interface SampleLesson {
  id: string;
  title: string;
  subject: string;
  category: string;
  content: string;
}

export const SAMPLE_LESSONS: SampleLesson[] = [
  {
    id: "os-deadlocks",
    title: "Operating Systems: Process Synchronization & Deadlocks",
    subject: "Computer Science",
    category: "OS & Systems",
    content: `OPERATING SYSTEMS: PROCESS SYNCHRONIZATION AND DEADLOCKS
Lecture 08 - Computer Science 201

1. THE CRITICAL SECTION PROBLEM
When multiple concurrent processes access shared variables or data structures, concurrent execution may result in data inconsistency.
Critical Section: A piece of code where a process accesses shared resources (e.g., shared variables, files, tables).
Requirement for Solution:
- Mutual Exclusion: If process Pi is executing in its critical section, no other processes can execute in their critical sections.
- Progress: If no process is in its critical section and some processes wish to enter, only processes not in their remainder section can participate in deciding who enters next.
- Bounded Waiting: There must be a bound on the number of times other processes are allowed to enter their critical sections after a process has requested entry.

2. SYNCHRONIZATION MECHANISMS
- Mutex Lock: A boolean lock protecting a critical section. A process acquires the lock before entering and releases it upon exiting. Busy waiting occurs in spinlocks.
- Semaphore: An integer variable S accessed via two standard atomic operations: wait() and signal() (historically P and V).
  - Counting Semaphore: Value can range over an unrestricted domain, controlling access to a given resource with multiple instances.
  - Binary Semaphore: Value can range only between 0 and 1 (functions like a mutex).

3. DEADLOCK DEFINITION
A deadlock is a situation where a set of processes are blocked because each process is holding a resource and waiting for another resource held by another process in the same set.

4. COFFMAN FOUR CONDITIONS FOR DEADLOCK
A deadlock can arise if and only if the following four conditions hold simultaneously in a system:
1. Mutual Exclusion: At least one resource must be held in a non-shareable mode (only one process can use it at a time).
2. Hold and Wait: A process must be holding at least one resource and waiting to acquire additional resources that are currently held by other processes.
3. No Preemption: Resources cannot be preempted; a resource can be released only voluntarily by the process holding it after completing its task.
4. Circular Wait: A closed chain of processes exists such that each process holds at least one resource needed by the next process in the chain (P0 -> P1 -> P2 -> ... -> Pn -> P0).

5. DEADLOCK PREVENTION vs DEADLOCK AVOIDANCE
- Deadlock Prevention: Eliminating at least one of the four Coffman conditions before execution (e.g., ordering resource requests monotonically to break Circular Wait).
- Deadlock Avoidance: The operating system dynamically examines the resource-allocation state to ensure that a circular wait condition can never exist (requires prior knowledge of maximum resource demands, e.g., Dijkstra's Banker's Algorithm).

6. BANKER'S ALGORITHM FORMULAS
Let n be the number of processes and m be the number of resource types.
- Available[m]: If Available[j] = k, there are k instances of resource type Rj available.
- Max[n][m]: If Max[i][j] = k, process Pi may request at most k instances of resource type Rj.
- Allocation[n][m]: If Allocation[i][j] = k, process Pi is currently allocated k instances of resource type Rj.
- Need[n][m]: Need[i][j] = Max[i][j] - Allocation[i][j]

Safety Algorithm Rule:
A system is in a SAFE STATE if there exists a safe sequence <P1, P2, ..., Pn> such that for each Pi, the resources that Pi can still request can be satisfied by currently available resources plus resources held by all preceding processes Pj.`
  },
  {
    id: "bio-photosynthesis",
    title: "Cellular Energy: Photosynthesis & Light Reactions",
    subject: "Biological Sciences",
    category: "Cell Biology",
    content: `BIOLOGICAL SCIENCES 101: CELLULAR BIOENERGETICS
Topic: Photosynthesis and Photophosphorylation

1. OVERVIEW OF PHOTOSYNTHESIS
Photosynthesis is the biological process that converts radiant light energy into chemical energy stored in glucose molecules.
Overall Balanced Chemical Equation:
6 CO2 + 6 H2O + Light Energy -> C6H12O6 + 6 O2

Location:
- In eukaryotic plant cells, photosynthesis occurs inside Chloroplasts.
- The Light-Dependent Reactions occur across the Thylakoid Membrane.
- The Light-Independent Reactions (Calvin Cycle) occur in the Stroma (the fluid-filled space surrounding the thylakoids).

2. KEY CONCEPTS & DEFINITIONS
- Chlorophyll: The primary green photosynthetic pigment that absorbs blue and red wavelengths while reflecting green light.
- Photolysis: The splitting of water molecules into hydrogen ions (protons), electrons, and molecular oxygen driven by absorbed light.
  Formula: 2 H2O -> 4 H+ + 4 e- + O2
- ATP Synthase: A membrane-bound enzyme complex that synthesizes ATP from ADP and inorganic phosphate using a proton gradient.

3. LIGHT REACTIONS (STEP-BY-STEP PROCESS)
1. Photon Absorption: Light strikes Photosystem II (PSII / P680), exciting electrons to a higher energy level.
2. Photolysis of Water: Water molecules are split to replenish electrons lost by PSII, releasing oxygen gas into the atmosphere.
3. Electron Transport Chain (ETC): Excited electrons pass through plastoquinone, cytochrome b6f complex, and plastocyanin, pumping H+ ions into the thylakoid lumen.
4. Photosystem I Activation: Light hits Photosystem I (PSI / P700), re-energizing electrons.
5. NADPH Formation: High-energy electrons are transferred to NADP+ reductase, reducing NADP+ to NADPH.
6. Photophosphorylation: Protons flow down the electrochemical gradient from the thylakoid lumen to the stroma through ATP Synthase, generating ATP.

4. COMPARISON: LIGHT REACTIONS vs CALVIN CYCLE
Aspect | Light-Dependent Reactions | Light-Independent Reactions (Calvin Cycle)
Location | Thylakoid Membrane | Stroma of Chloroplast
Input Requirements | Light, H2O, NADP+, ADP + Pi | CO2, ATP, NADPH
Primary Output | O2, ATP, NADPH | G3P (precursor to Glucose), ADP, NADP+
Light Dependency | Absolutely required | Directly light-independent (requires ATP/NADPH from light phase)

5. MUST REMEMBER FOR EXAM
- Oxygen released during photosynthesis originates exclusively from water (H2O), NOT carbon dioxide (CO2). Verified by isotopic tracing experiments.
- Rubisco (Ribulose-1,5-bisphosphate carboxylase-oxygenase) is the primary enzyme catalyzing carbon fixation in the Calvin Cycle and is the most abundant enzyme on Earth.`
  },
  {
    id: "db-normalization",
    title: "Database Systems: Normalization from 1NF to BCNF",
    subject: "Information Technology",
    category: "Databases",
    content: `DATABASE MANAGEMENT SYSTEMS (DBMS)
Lecture: Relational Database Normalization

1. DEFINITION AND PURPOSE
Normalization is a systematic technique of organizing data in a relational database to minimize data redundancy and eliminate undesirable insertion, update, and deletion anomalies.

2. FUNCTIONAL DEPENDENCY (FD)
A functional dependency X -> Y holds in a relation R if every valid instance of X uniquely determines the corresponding value of Y.
- X is called the Determinant.
- Y is called the Dependent.
- Candidate Key: A minimal superkey that uniquely identifies a row in a table.
- Prime Attribute: An attribute that is a member of any candidate key.
- Non-prime Attribute: An attribute that is not part of any candidate key.

3. THE NORMAL FORMS (STEP-BY-STEP)

First Normal Form (1NF):
- Rule: A relation is in 1NF if and only if all domain values are atomic (indivisible) and there are no repeating groups or multivalued attributes.
- Fix: Decompose multivalued attributes into distinct rows or related separate tables.

Second Normal Form (2NF):
- Rule: A relation is in 2NF if it is in 1NF and NO non-prime attribute is partially dependent on any candidate key (Eliminate Partial Dependencies).
- Note: If candidate key is a single attribute (not composite), the table is automatically in 2NF once in 1NF.
- Fix: Move partially dependent attributes to a new table with a copy of the partial key.

Third Normal Form (3NF):
- Rule: A relation is in 3NF if it is in 2NF and NO non-prime attribute is transitively dependent on the primary key (Eliminate Transitive Dependencies: X -> Y and Y -> Z where Z is non-prime).
- Rule Formula: For every non-trivial FD X -> Y, either X is a Superkey OR Y is a Prime attribute.
- Fix: Separate the transitively dependent attributes into their own relation.

Boyce-Codd Normal Form (BCNF):
- Rule: A stricter version of 3NF. For every non-trivial functional dependency X -> Y, X MUST be a Superkey.
- Key difference from 3NF: BCNF does not allow Y to be a prime attribute if X is not a superkey.

4. MUST REMEMBER
- Decompositions must satisfy two crucial mathematical properties:
  1. Lossless Join Property: Natural join of decomposed tables must reconstruct the exact original relation without spurious tuples.
  2. Dependency Preservation: All functional dependencies must be enforceable on the individual decomposed tables.`
  }
];

