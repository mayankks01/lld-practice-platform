export const completeSolution = {
  assumptions: 'One parking lot supports cars and motorcycles. Payment processing is outside this in-memory design.',
  responsibilities: 'ParkingSpot owns occupancy. ParkingLot coordinates entry and exit. FeePolicy calculates the price.',
  relationships: 'ParkingLot uses FeePolicy and contains floors. A Ticket references a single spot.',
  walkthrough: 'Entry reserves a free compatible spot and issues a ticket atomically. A full lot rejects entry. Exit releases the spot; a closed ticket is rejected.',
  tradeoffs: 'I chose a policy interface because fee rules change separately, but a function would be simpler for one rule.',
  tests: 'Given a full lot, when another car enters, then expect a rejection and unchanged occupancy.',
  code: ''
};

export async function waitFor(predicate, timeoutMs = 3000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const result = await predicate();
    if (result) return result;
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  throw new Error('Condition did not become true before timeout.');
}
