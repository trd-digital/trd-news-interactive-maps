// let topTitleDiv = "<h4>South Florida</h4>";

// let titleDiv =
//   "<h1>Here are the resi projects planned for downtown Miami</h1>";

// let descriptionDiv =
// "<p>The rules don't seen to apply to Miami.</p>" +
// "<p>Despite economists predicting a global recession, developers are betting big on downtown Miami. Projects under construction and those planned since the start of the year expect to bring a whopping 7,000-plus apartments and condos to the Magic City.</p>" + 
// "<p>According to an analysis by <em>The Real Deal</em>, 1,358 condos are in the works and 3,793 apartments are planned. More than 2,000 additional units are not yet specified as condos or rentals.</p>" +
// "<p>The disclosed land acquisitions in downtown Miami total more than $230 million. This doesn't include other projects in Brickell, Edgewater and Wynwood.</p>";

let introDiv =
"<p style='font-size:20px;'>Scroll down for a guided round-up of South Florida's largest Construction Mortgages.</p>" +
"<p> &#8681;  &#8681;  &#8681;</p>"

// let bylineDiv = "<p><em>By Adam Farence. Research by Lidia Dinkova and Katherine Kallergis</em></p>";

// let footerDiv =
//   '<p><a href="https://www.mapbox.com/about/maps/" target="_blank">© Mapbox</a> | <a href="http://www.openstreetmap.org/about/" target="_blank">© OpenStreetMap</a>';

let divChapter1 =
  "<h3>Nautilus 220 | 220 Lake Shore Drive in Lake Park</h3>" +
  '<img src="images/Nautilus 220_Exterior Marina_062022.jpg">' +
  '<p class="imageCredit">Credit: TK TK</p>' +
  "<p>Forest Development and Dan Kodsi's Royal Palm Companies secured a $269 million construction loan from Fortress Investment Group for Nautilus 220, a waterfront condo project in Palm Beach County's Lake Park. The loan closed in July.</p>";

let divChapter2 =
  "<h3>Aman Miami Beach | 3425 Collins Avenue in Miami Beach</h3>" +
  '<img src="images/Aman Hotel _ Residences Miami Beach.jpg">' +
  '<p class="imageCredit">Credit: TK TK</p>' +
  "<p>Vlad Doronin and Len Blavatnik closed on a $242.4 million construction loan from Bank OZK for the oceanfront Aman Miami Beach condo and hotel development in January.</p>";

let divChapter3 =
  "<h3>Wynwood Plaza | 95 Northwest 29th Street in Miami</h3>" +
  '<img src="images/The Wynwood Plaza - Office Tower - Credit Gensler.jpg">' +
  '<p class="imageCredit">Credit: TK TK</p>' +
  "<p>Bank OZK is the lender for Wynwood Plaza, a mixed-use office, apartment and retail project developed by a group led by L&L Holding Company and Oak Row Equities. They secured $215 million in construction financing last month, marking the fifth largest loan in a year.</p>";

let divChapter4 = 
"<p style='font-size:20px;'>South Florida has notched major construction mortgages in the past year. Read more below.</p>"

var config = {
  style: "mapbox://styles/trddata/clcjj6iyv009a15qs5sv5wc5z",
  accessToken: "pk.eyJ1IjoidHJkZGF0YSIsImEiOiJjbDdreW9oZzEwb3JzNDJvYmNnd2swbzBmIn0.ZJiADpTaqdGS3fiMUdFYFw",
  showMarkers: false,
  markerColor: "#db3eb1",
  theme: "light",
  use3dTerrain: false,
  topTitle: introDiv,
  title: [],
  subtitle: "",
  byline: [],
  description: [],
  footer: [],
  chapters: [
    {
      id: "overallMap",
      alignment: "full",
      hidden: true,
      chapterDiv: [],
      location: {
        center: [-80.1921083,26.04704],
        zoom: 7,
        zoomSmall: 7,
        pitch: 0,
        bearing: 0,
      },
      mapAnimation: "flyTo",
      rotateAnimation: false,
      callback: "",
      onChapterEnter: [],
      onChapterExit: [],
    },
    {
      id: "220 Lake Shore Drive in Lake Park",
      alignment: "right",
      hidden: false,
      title: "",
      image: "",
      description: "",
      chapterDiv: divChapter1,
      location: {
        center: [
          -80.05336,
          26.794158
      ],
        zoom: 17.79,
        zoomSmall: 16,
        pitch: 32.50,
        bearing: -25.60,
      },
      mapAnimation: "flyTo",
      rotateAnimation: false,
      callback: "",
      onChapterEnter: [
        {
          layer: "overallMap",
          opacity: 1,
          duration: 300,
        },
      ],
      onChapterExit: [
        {
          layer: "overallMap",
          opacity: .5,
          duration: 300,
        },
      ],
    },
    {
      id: "3425 Collins Avenue in Miami Beach", 
      alignment: "left",
      hidden: false,
      title: "",
      image: "",
      description: "",
      chapterDiv: divChapter2,
      location: {
        center: [
          -80.1233168,
          25.8087909
      ],
        zoom: 17.48,
        zoomSmall: 16,
        pitch: 45,
        bearing: 1.09,
      },
      mapAnimation: "flyTo",
      rotateAnimation: false,
      callback: "",
      onChapterEnter: [
        {
          layer: "overallMap",
          opacity: 1,
          duration: 300,
        },
      ],
      onChapterExit: [
        {
          layer: "overallMap",
          opacity: 0.5,
          duration: 300,
        },
      ],
    },
    {
      id: "95 Northwest 29th Street in Miami", 
      alignment: "right",
      hidden: false,
      title: "",
      image: "",
      description: "",
      chapterDiv: divChapter3,
      location: {
        center: [
          -80.1938555,
          25.8043297
      ],
        zoom: 18.27,
        zoomSmall: 16,
        pitch: 54.5,
        bearing: .74,
      },
      mapAnimation: "flyTo",
      rotateAnimation: false,
      callback: "",
      onChapterEnter: [
        {
          layer: "overallMap",
          opacity: 1,
          duration: 300,
        },
      ],
      onChapterExit: [
        {
          layer: "overallMap",
          opacity: .5,
          duration: 300,
        },
      ],
    },
    {
      id: "interactive_layer", 
      alignment: "right",
      hidden: false,
      title: "",
      image: "",
      description: "",
      chapterDiv: divChapter4,
      location: {
        center: [
          -80.20672777833579, 25.805596491963456
      ],
        zoom: 12,
        zoomSmall: 14,
        pitch: 54.5,
        bearing: -30,
      },
      mapAnimation: "flyTo",
      rotateAnimation: false,
      callback: "",
      onChapterEnter: [
        {
          layer: "interactive_layer",
          opacity: 1,
          duration: 300,
        },
      ],
      onChapterExit: [
        {
          layer: "interactive_layer",
          opacity: .5,
          duration: 300,
        },
      ],
    },
  ],
};