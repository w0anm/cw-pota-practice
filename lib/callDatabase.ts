export type CallRecord = {
  callsign: string;
  location: string;
  notes?: string;
};

export const callDatabase: CallRecord[] = [
  { callsign: 'K1ABC', location: 'New England', notes: 'POTA friendly training set' },
  { callsign: 'N7RDX', location: 'Oregon', notes: 'Mountain activation' },
  { callsign: 'W3POTA', location: 'Pennsylvania', notes: 'Classic parks contact' },
  { callsign: 'K9SUN', location: 'Illinois', notes: 'Field station' },
  { callsign: 'N4BAY', location: 'Florida', notes: 'Coastal call' },
  { callsign: 'WA7JIM', location: 'Arizona', notes: 'Desert activation' },
  { callsign: 'K0LARK', location: 'Colorado', notes: 'Mountain state' },
  { callsign: 'N8PARK', location: 'Ohio', notes: 'Park operations' },
  { callsign: 'W6COVE', location: 'California', notes: 'West coast practice' },
  { callsign: 'K2MOSS', location: 'New York', notes: 'Forest activation' },
  { callsign: 'N5RIVER', location: 'Texas', notes: 'Wide-open field' },
  { callsign: 'K7CREEK', location: 'Washington', notes: 'Northwest practice' }
];
