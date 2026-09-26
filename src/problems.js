// The catalog is versioned with the app. Submitted attempts retain a problem snapshot.
export const problems = [
  {
    id: 'parking-lot', version: 1, number: '01', title: 'Parking Lot', level: 'Foundation', minutes: 35,
    focus: 'Responsibilities & relationships', symbol: 'P', color: 'green',
    summary: 'A small space. A surprisingly rich set of design decisions.',
    context: 'Design the software for a single parking lot with multiple floors. A driver enters, receives a ticket, and pays on exit. Focus on the objects and their interactions; no UI, database, or payment integration is required.',
    requirements: [
      'Support motorcycles and cars, with compatible spots on multiple floors.',
      'Assign one available spot and issue a ticket on entry. Reject entry when no compatible spot is free.',
      'Calculate a fee from elapsed time and vehicle type on exit, then release the spot.',
      'Reject an invalid or already closed ticket without changing occupancy.',
      'Keep the allocation and pricing rules replaceable without rewriting the entry / exit flow.'
    ],
    constraints: ['One lot, multiple floors', 'In-memory design is enough', 'No real payment processing'],
    change: 'Tomorrow, the lot adds an hourly cap on fees. Which object changes, and which callers stay the same?',
    scenario: 'Two cars request the last compatible spot. Walk through who owns the reservation and what the second request observes.',
    edgeTerms: ['full', 'no available', 'no compatible', 'invalid ticket', 'closed ticket', 'duplicate', 'already closed'],
    lifecycleTerms: ['release', 'closed', 'occupied', 'reserve', 'reserved', 'free'],
    hints: ['Start with the entry and exit stories. Assign each decision to an owner.', 'A spot should protect its occupancy. Consider separating fee calculation from ticket lifecycle.']
  },
  {
    id: 'vending-machine', version: 1, number: '02', title: 'Vending Machine', level: 'Intermediate', minutes: 40,
    focus: 'State & invariants', symbol: 'V', color: 'orange',
    summary: 'Model a transaction where the unhappy path matters.',
    context: 'Design a vending machine that accepts coins, lets a customer select a product, dispenses it, and returns change. Describe one transaction at a time. Hardware can be represented by an interface.',
    requirements: [
      'Track product prices, stock, inserted credit, and the available change.',
      'Only dispense when stock, credit, and change are sufficient.',
      'Support cancellation before dispensing and return the inserted credit.',
      'On dispenser failure, avoid charging the customer or losing stock.',
      'Separate hardware calls from transaction rules so failure can be tested.'
    ],
    constraints: ['One transaction at a time', 'Coin payments only', 'Hardware behind an interface'],
    change: 'A new dispenser reports success asynchronously. Where would that change belong?',
    scenario: 'A customer has enough credit, but the dispenser jams. Explain credit, stock, and transaction state after failure.',
    edgeTerms: ['insufficient', 'out of stock', 'cancel', 'refund', 'jam', 'failure', 'no change'],
    lifecycleTerms: ['idle', 'credit', 'dispensing', 'refund', 'cancelled', 'transaction'],
    hints: ['List legal states and actions before choosing classes.', 'Treat dispensing as a boundary that can fail. Decide when stock and money become committed.']
  },
  {
    id: 'library', version: 1, number: '03', title: 'Library Lending', level: 'Foundation', minutes: 30,
    focus: 'Identity & business rules', symbol: 'L', color: 'blue',
    summary: 'One book title, many copies, and rules worth protecting.',
    context: 'Design a small library lending system. Members borrow physical copies, return them, and view active loans. A title can have multiple copies. Keep searching simple and focus on lending rules.',
    requirements: [
      'Distinguish a book title from each independently lendable physical copy.',
      'Allow a member to borrow at most three copies at a time.',
      'Prevent a copy from being borrowed by two members simultaneously.',
      'Record a due date, and reject a duplicate return without changing active loans.',
      'Make the borrowing limit and loan duration changeable without editing copy identity.'
    ],
    constraints: ['One library', 'No fines or reservations', 'Three active loans per member'],
    change: 'Faculty members may borrow five copies for a month. How does your design accommodate the new policy?',
    scenario: 'Two members try to borrow the same physical copy. Explain where availability is checked and updated together.',
    edgeTerms: ['limit', 'unavailable', 'duplicate', 'already returned', 'already borrowed', 'three', '3'],
    lifecycleTerms: ['borrowed', 'returned', 'available', 'active', 'due'],
    hints: ['Separate the identity of a title from the identity of a copy.', 'Choose one owner for the borrow operation so the loan limit and availability cannot disagree.']
  }
];

export function getProblem(id) { return problems.find(p => p.id === id); }
