


# Build a realistic DAT One Load Board Simulator

I want you to build a fully functional Truck Load Board Simulator that closely replicates the workflow, functionality, layout, and user experience of **DAT One Load Board**.

This application is intended for practical training as a US Truck Dispatcher. It must simulate the real American freight market, using realistic fictional loads, brokers, carriers, rates, locations, and equipment.

This is NOT a simple dashboard or static demo. I want a functional application where I can practice real dispatcher operations.

## 1. Main objective

Build a realistic DAT One-style platform where I can:

- Search available loads across the United States.
- Find loads based on pickup and delivery locations.
- Filter loads by trailer type.
- Analyze rates and calculate RPM (Rate Per Mile).
- View broker details.
- Contact brokers using a simulated calling and messaging interface.
- Negotiate rates.
- Book loads.
- Assign loads to trucks and drivers.
- Manage my dispatch operations.

All data should be fictional but realistic.

## 2. Design and interface

The interface should closely resemble DAT One.

Design requirements:
- Professional freight industry interface.
- Clean, compact, information-dense layout.
- White and light gray background.
- Blue primary colors.
- Dark navy text.
- Modern tables with small typography.
- Sidebar navigation.
- Top navigation with search and account information.
- Responsive desktop-first layout.

Do not create a generic AI dashboard.

The main Load Board should be the central part of the application.

## 3. Load Board

Create a complete load search page.

Each load should contain:

- Load ID
- Pickup city and state
- Delivery city and state
- Pickup date
- Delivery date
- Distance in miles
- Deadhead miles
- Equipment type
- Load size
- Weight (lbs)
- Commodity
- Rate (USD)
- Rate per mile
- Broker company
- Broker credit score
- Broker contact name
- Broker phone number
- Broker email
- Load status

Include realistic fictional American loads.

Generate at least 500 loads across different US states.

The data must be varied and realistic.

## 4. Equipment types

I primarily want to practice Open Deck dispatching.

Include these equipment types:

- Flatbed
- Step Deck
- Conestoga
- Hotshot
- Dry Van
- Reefer
- Power Only
- Box Truck

Make it possible to filter by equipment type.

Include realistic load requirements such as:

- Maximum weight
- Length
- Width
- Height
- Tarps required
- Chains required
- Straps required
- Oversized load
- Permit required

Open Deck loads must have realistic cargo descriptions, dimensions, and securement requirements.

## 5. Advanced search and filters

Implement working filters for:

- Origin city
- Origin state
- Destination city
- Destination state
- Origin radius (miles)
- Destination radius (miles)
- Equipment type
- Pickup date
- Delivery date
- Minimum rate
- Maximum rate
- Minimum RPM
- Maximum weight
- Length
- Broker name

Add sorting by:

- Highest rate
- Lowest rate
- Highest RPM
- Lowest RPM
- Shortest distance
- Newest loads

Filters must actually change the displayed results.

## 6. Load details

When clicking a load, open a detailed view with:

- Full pickup and delivery information.
- Exact addresses.
- Pickup and delivery appointment windows.
- Cargo details.
- Equipment requirements.
- Total mileage.
- Deadhead mileage.
- Loaded mileage.
- Rate and RPM.
- Broker information.
- Broker credit rating.
- Contact information.
- Special instructions.
- Notes.

Include a map showing the pickup and delivery locations and the route.

## 7. Broker negotiation simulator

This is one of the most important features.

Create an interactive broker contact simulator.

When I select a load, I should be able to:

1. Call the broker using a simulated call interface.
2. See the broker's name and phone number.
3. Start a simulated conversation.
4. Negotiate the load rate.
5. Receive different broker responses based on my offer.

Example:

Original rate: $1,850

I offer: $2,200

Broker responses can include:
- "That's too high. Can you do $1,950?"
- "I can do $2,000."
- "The best I can do is $1,900."
- "Let me check with my customer."
- "I have another carrier interested."

Create different broker personalities and negotiation behaviors.

The broker should have a hidden minimum acceptable rate.

Allow multiple negotiation attempts.

The negotiation should feel realistic, not like a simple predetermined conversation.

## 8. Booking system

After agreeing on a rate, I should be able to:

- Book the load.
- Enter the agreed rate.
- Select a truck.
- Select a driver.
- Generate a Rate Confirmation document.
- Change the load status to Booked.

Create a realistic fictional Rate Confirmation PDF with:
- Broker information.
- Carrier information.
- Load ID.
- Pickup and delivery details.
- Agreed rate.
- Commodity.
- Weight.
- Equipment.
- Special instructions.

## 9. My Trucks

Create a fleet management page.

Allow me to add trucks and drivers.

Truck information:
- Truck number.
- Trailer type.
- Current city and state.
- Availability.
- Driver name.
- Driver phone.
- Current location.
- Next available date.

Allow me to assign booked loads to trucks.

## 10. My Loads

Create a dispatch management page with statuses:

- Available
- Negotiating
- Booked
- Dispatched
- In Transit
- Delivered
- Cancelled

Include the ability to update statuses and track active loads.

## 11. Analytics

Create a statistics page showing:

- Total booked loads.
- Total revenue.
- Average rate per mile.
- Total loaded



> NOTE: the original paste was truncated here (section 11 "Analytics" ends at "Total loaded").
> Completed by implementation: total loaded miles, total deadhead miles, deadhead %, revenue per truck/driver,
> RPM by equipment, top brokers by revenue, booked loads per week, negotiation success rate.

## 12. Data generation

Generate a realistic dataset of at least 500 fictional loads.

Include: different American cities, different states, realistic freight lanes, different pickup dates,
realistic Open Deck cargo, different broker companies, different rates and distances.

Examples of freight: steel coils, lumber, construction equipment, excavators, agricultural machinery,
roofing materials, pipes, metal beams, industrial equipment, generators, building materials.

Rates should vary based on distance, equipment, market conditions, and load requirements.

Do not use real people's personal contact information.

## 13. Technical requirements

Stack: Next.js, TypeScript, Tailwind CSS, MongoDB, Prisma if compatible with the selected MongoDB setup,
modern reusable React components.

Requirements: clean architecture, reusable components, proper database models, server-side pagination,
efficient database queries, search and filtering with indexes, loading skeletons, error handling,
responsive interface.

## 14. Training mode

Add a Training Mode with practical dispatch scenarios. Examples:

1. You have a Flatbed truck available in Dallas, TX. Find a load going toward Atlanta, GA.
2. Your driver is empty in Houston, TX. Find a Step Deck load with a minimum RPM of $2.50.
3. Find a Conestoga load and negotiate at least $200 above the initial offer.
4. Find a load with delivery in Chicago and calculate whether the deadhead miles make it profitable.

The training system should evaluate decisions and show: whether I selected a suitable load, whether the
rate was good, whether the RPM was profitable, whether the deadhead was reasonable, whether I negotiated
successfully. Beginner, intermediate, and advanced difficulty levels.

## 15. Important instructions

- Build a fully working application, not just a visual prototype.
- Do not leave buttons without functionality.
- Do not use static hardcoded UI data for all pages.
- All filters, searches, negotiations, bookings, and status changes must work.
- Fictional but realistic freight market data.
- Focus especially on Flatbed, Step Deck, and Conestoga.
- Prioritize desktop experience.
- Complete the actual Load Board and all the main workflows.
- The final result should feel like a realistic DAT One training environment.

## Reference screenshots provided by the user
- DAT One "Search Loads" screen: dark navy sidebar (Dashboard, Search Trucks, Private Loads, Search Loads,
  My Loads, Private Network, My Trucks, Live Support, Tools; bottom: Send Feedback, Notifications, user).
  Search tabs on top (origin/destination). Search bar: Origin, DH-O, swap, Destination, DH-D, Equipment Type,
  Date Range, blue search button. Chips: Load Requirements, Search Back, Company, Private Loads, Book/Bid.
  Results header: "33 Results +160 Similar Results", Sort by Age - Newest, Lane Rate $3,441 ($2.74/mi), Tri-Haul.
  Table columns: Age, Rate (+$/mi), verified check, Trip (miles link, origin/destination), DH-O (DH-D),
  Pick Up, Equipment code (F, FD, FT), weight / length / Full|Partial, Company, CS / DTP, actions.
- Paper "Customer / Broker Rate Confirmation" form: Freight Bill No, Bill of Lading No, legal terms paragraph,
  Shipper and Destination blocks with address/city/state/zip, Miles, Weight, Commodity, Van or Flat,
  Rate or Charge, Accessorial Charges, Pallets Required, payment terms, Effective Date, signature blocks
  for Carrier and Customer/Broker.
