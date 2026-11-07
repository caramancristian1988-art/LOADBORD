import type { BrokerSeed } from "../types";

/* Fictional freight brokerages. Any resemblance to real companies is coincidental.
   cs = credit score (0-100), dtp = average days to pay, p = negotiation personality. */
export const BROKER_SEED: BrokerSeed[] = [
  { name: 'Ironridge Freight Solutions', hq: ['Chicago', 'IL'], cs: 97, dtp: 24, p: 'corporate', yrs: 18, qp: 2.0 },
  { name: 'Bluewater Logistics Group', hq: ['Houston', 'TX'], cs: 94, dtp: 27, p: 'flexible', yrs: 11, qp: 2.5 },
  { name: 'Summit Lane Brokerage', hq: ['Denver', 'CO'], cs: 91, dtp: 30, p: 'friendly', yrs: 9, qp: 3.0 },
  { name: 'Red Mesa Transport Services', hq: ['Phoenix', 'AZ'], cs: 88, dtp: 33, p: 'lowballer', yrs: 7, qp: 3.0 },
  { name: 'Keystone Cargo Partners', hq: ['Pittsburgh', 'PA'], cs: 96, dtp: 22, p: 'firm', yrs: 22, qp: 1.5 },
  { name: 'Gulfline Freight Brokers', hq: ['Mobile', 'AL'], cs: 84, dtp: 38, p: 'hustler', yrs: 5, qp: 3.5 },
  { name: 'Prairie Wind Logistics', hq: ['Omaha', 'NE'], cs: 93, dtp: 26, p: 'friendly', yrs: 14, qp: 2.0 },
  { name: 'Northstar Haul Brokerage', hq: ['Minneapolis', 'MN'], cs: 95, dtp: 25, p: 'corporate', yrs: 16, qp: 2.0 },
  { name: 'Lone Oak Freight Co.', hq: ['Dallas', 'TX'], cs: 90, dtp: 31, p: 'flexible', yrs: 8, qp: 2.5 },
  { name: 'Steel City Shipping Agents', hq: ['Birmingham', 'AL'], cs: 92, dtp: 28, p: 'firm', yrs: 19, qp: 2.0 },
  { name: 'Coastal Bend Logistics', hq: ['Corpus Christi', 'TX'], cs: 79, dtp: 44, p: 'lowballer', yrs: 3, qp: 4.0 },
  { name: 'Great Plains Carrier Network', hq: ['Wichita', 'KS'], cs: 89, dtp: 32, p: 'friendly', yrs: 10, qp: 2.5 },
  { name: 'Cumberland Freight Partners', hq: ['Nashville', 'TN'], cs: 94, dtp: 26, p: 'flexible', yrs: 12, qp: 2.0 },
  { name: 'Patriot Load Solutions', hq: ['Richmond', 'VA'], cs: 86, dtp: 36, p: 'hustler', yrs: 6, qp: 3.0 },
  { name: 'Silver State Brokerage', hq: ['Reno', 'NV'], cs: 87, dtp: 35, p: 'firm', yrs: 9, qp: 3.0 },
  { name: 'Magnolia Transport Brokers', hq: ['Jackson', 'MS'], cs: 82, dtp: 41, p: 'friendly', yrs: 4, qp: 3.5 },
  { name: 'Cascade Range Logistics', hq: ['Portland', 'OR'], cs: 95, dtp: 24, p: 'corporate', yrs: 15, qp: 2.0 },
  { name: 'Heartland Flatbed Brokerage', hq: ['Kansas City', 'MO'], cs: 93, dtp: 27, p: 'flexible', yrs: 13, qp: 2.0 },
  { name: 'Rust Belt Freight Group', hq: ['Cleveland', 'OH'], cs: 90, dtp: 30, p: 'firm', yrs: 17, qp: 2.5 },
  { name: 'Pinecrest Logistics LLC', hq: ['Charlotte', 'NC'], cs: 91, dtp: 29, p: 'friendly', yrs: 8, qp: 2.5 },
  { name: 'Sunbelt Cargo Connect', hq: ['Atlanta', 'GA'], cs: 85, dtp: 37, p: 'lowballer', yrs: 6, qp: 3.0 },
  { name: 'Brazos Valley Freight', hq: ['Waco', 'TX'], cs: 88, dtp: 33, p: 'hustler', yrs: 7, qp: 3.0 },
  { name: 'Granite Peak Transport Brokers', hq: ['Salt Lake City', 'UT'], cs: 92, dtp: 28, p: 'firm', yrs: 11, qp: 2.5 },
  { name: 'Lakeshore Freight Alliance', hq: ['Milwaukee', 'WI'], cs: 96, dtp: 23, p: 'corporate', yrs: 21, qp: 1.5 },
  { name: 'Delta Crossing Logistics', hq: ['Memphis', 'TN'], cs: 89, dtp: 32, p: 'flexible', yrs: 10, qp: 2.5 },
  { name: 'Frontier Open Deck Brokers', hq: ['Oklahoma City', 'OK'], cs: 87, dtp: 34, p: 'hustler', yrs: 5, qp: 3.0 },
  { name: 'Evergreen Freight Desk', hq: ['Tacoma', 'WA'], cs: 93, dtp: 26, p: 'friendly', yrs: 12, qp: 2.0 },
  { name: 'Palmetto Shipping Partners', hq: ['Greenville', 'SC'], cs: 90, dtp: 30, p: 'flexible', yrs: 9, qp: 2.5 },
  { name: 'Crescent City Brokerage', hq: ['New Orleans', 'LA'], cs: 74, dtp: 49, p: 'lowballer', yrs: 2, qp: 5.0 },
  { name: 'Allegheny Load Exchange', hq: ['Harrisburg', 'PA'], cs: 94, dtp: 25, p: 'firm', yrs: 15, qp: 2.0 },
  { name: 'Mile Marker Logistics', hq: ['Indianapolis', 'IN'], cs: 92, dtp: 27, p: 'friendly', yrs: 10, qp: 2.5 },
  { name: 'Tri-County Freight Brokers', hq: ['Columbus', 'OH'], cs: 81, dtp: 42, p: 'hustler', yrs: 4, qp: 3.5 },
  { name: 'Badlands Transport Group', hq: ['Bismarck', 'ND'], cs: 86, dtp: 36, p: 'firm', yrs: 8, qp: 3.0 },
  { name: 'Sierra Freightways Brokerage', hq: ['Fresno', 'CA'], cs: 91, dtp: 29, p: 'flexible', yrs: 11, qp: 2.5 },
  { name: 'Anchor Point Logistics', hq: ['Savannah', 'GA'], cs: 95, dtp: 24, p: 'corporate', yrs: 14, qp: 2.0 },
  { name: 'Boomtown Energy Logistics', hq: ['Midland', 'TX'], cs: 83, dtp: 40, p: 'hustler', yrs: 5, qp: 3.5 },
  { name: 'Liberty Bell Freight Co.', hq: ['Philadelphia', 'PA'], cs: 89, dtp: 31, p: 'lowballer', yrs: 9, qp: 3.0 },
  { name: 'Copperline Brokerage', hq: ['Tucson', 'AZ'], cs: 90, dtp: 30, p: 'friendly', yrs: 7, qp: 2.5 },
  { name: 'Riverbend Carrier Services', hq: ['St. Louis', 'MO'], cs: 93, dtp: 27, p: 'flexible', yrs: 13, qp: 2.0 },
  { name: 'Interstate 10 Logistics', hq: ['San Antonio', 'TX'], cs: 68, dtp: 56, p: 'lowballer', yrs: 2, qp: 5.0 },
  { name: 'Wolverine Freight Brokers', hq: ['Detroit', 'MI'], cs: 92, dtp: 28, p: 'firm', yrs: 16, qp: 2.0 },
  { name: 'Bayou Steel Transport Brokers', hq: ['Baton Rouge', 'LA'], cs: 88, dtp: 33, p: 'flexible', yrs: 8, qp: 3.0 }
];

export const NAMES = {
  first: ['Mike', 'Chris', 'Jessica', 'Brandon', 'Ashley', 'Tyler', 'Kevin', 'Megan', 'Josh', 'Amanda', 'Ryan', 'Brittany',
    'Derek', 'Kayla', 'Justin', 'Lauren', 'Cody', 'Danielle', 'Travis', 'Nicole', 'Marcus', 'Heather', 'Jake', 'Samantha',
    'Andre', 'Rachel', 'Dustin', 'Courtney', 'Hector', 'Tiffany', 'Logan', 'Vanessa', 'Trevor', 'Alicia', 'Garrett', 'Monica',
    'Shane', 'Erica', 'Carlos', 'Lindsey', 'Darnell', 'Kristen', 'Wes', 'Paige', 'Ivan', 'Brooke', 'Nate', 'Jordan'],
  last: ['Miller', 'Johnson', 'Rodriguez', 'Thompson', 'Walker', 'Nguyen', 'Brooks', 'Patel', 'Sanders', 'Coleman',
    'Hayes', 'Bennett', 'Ramirez', 'Foster', 'Ward', 'Price', 'Hughes', 'Russell', 'Griffin', 'Diaz', 'Myers', 'Ford',
    'Hamilton', 'Graham', 'Sullivan', 'Wallace', 'West', 'Cole', 'Jordan', 'Reyes', 'Fisher', 'Henderson', 'Kowalski',
    'Ortiz', 'Gibson', 'Marshall', 'Owens', 'Harper', 'Tucker', 'Porter', 'Hunter', 'Stone', 'Mendoza', 'Black', 'Burke'],
  driverFirst: ['Dale', 'Ray', 'Luis', 'Terrence', 'Bogdan', 'Earl', 'Andrei', 'Jerome', 'Miguel', 'Vlad', 'Curtis', 'Ahmed',
    'Roy', 'Sergiu', 'Tony', 'Marco', 'Darius', 'Wayne', 'Ricky', 'Omar']
};

// Area codes by state for realistic-looking (555-01xx fictional) numbers
export const AREA_CODES: Record<string, string[]> = {
  TX: ['713', '214', '210', '832', '817', '432', '956'], IL: ['312', '630', '815'], CO: ['303', '720'], AZ: ['602', '480', '520'],
  PA: ['412', '717', '215', '610'], AL: ['205', '251', '256'], NE: ['402'], MN: ['612', '651'], KS: ['316'], TN: ['615', '901', '423'],
  VA: ['804', '757'], NV: ['775', '702'], MS: ['601'], OR: ['503'], MO: ['816', '314'], OH: ['216', '614', '513'], NC: ['704', '919'],
  GA: ['404', '912', '770'], UT: ['801'], WI: ['414'], OK: ['405'], WA: ['253', '206'], SC: ['864'], LA: ['504', '225'], IN: ['317'],
  ND: ['701'], CA: ['559', '909', '213'], MI: ['313']
};
