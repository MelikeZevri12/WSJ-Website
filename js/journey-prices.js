// Fixed prices for one stretch of a back-to-back journey, used on its journey page (journey.html)
// INSTEAD of adding up the cruises' own prices. For stretches the cruise line sells as one booking at
// its own price, which stays bookable even when single cruises in it show sold out.
//
// journey slug -> list of stretches. A stretch = the first cruise's departure date (from) and the last
// cruise's arrival date (to), YYYY-MM-DD; it only applies when a family picks exactly that stretch.
// prices: party size (2 / 3 / 4 guests) -> cabin type -> total price for the cabin, in dollars.
// A cabin type listed here but not on the cruises (Obstructed Ocean View) only shows for this stretch.
// Cabin types left out here (Mini Suite) keep the normal added-up price / Waitlist.
// The "1 or 2 guests" price from the cruise line goes under 2.
window.JOURNEY_PRICES = {
  'BB-PC-06JAN2027-FOR-LOS': [ // Grand Circle World Cruise
    {
      from: '2027-01-21', to: '2027-05-15', // Los Angeles -> Los Angeles (cruises 2 to 7)
      prices: {
        2: { 'Interior': 41610, 'Obstructed Ocean View': 42790, 'Ocean View': 47152, 'Balcony': 53254 },
        3: { 'Interior': 43795, 'Obstructed Ocean View': 45949, 'Ocean View': 49337, 'Balcony': 58445 },
        4: { 'Interior': 45980, 'Obstructed Ocean View': 48134, 'Ocean View': 51522, 'Balcony': 60640 },
      },
    },
  ],
};
