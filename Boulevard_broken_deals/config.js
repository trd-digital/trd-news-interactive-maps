// let topTitleDiv = "<h4>South Florida</h4>";

// let titleDiv =
//   "<h1>Here are the resi projects planned for downtown Miami</h1>";

// let descriptionDiv =
// "<p>The rules don't seen to apply to Miami.</p>" +
// "<p>Despite economists predicting a global recession, developers are betting big on downtown Miami. Projects under construction and those planned since the start of the year expect to bring a whopping 7,000-plus apartments and condos to the Magic City.</p>" + 
// "<p>According to an analysis by <em>The Real Deal</em>, 1,358 condos are in the works and 3,793 apartments are planned. More than 2,000 additional units are not yet specified as condos or rentals.</p>" +
// "<p>The disclosed land acquisitions in downtown Miami total more than $230 million. This doesn't include other projects in Brickell, Edgewater and Wynwood.</p>";

let introDiv =
"<p style='font-size:20px;'>Scroll down for a guided round-up of Tom Brady and Gisele Bündchen's properties.</p>" +
"<p> &#8681;  &#8681;  &#8681;</p>"

// let bylineDiv = "<p><em>By Adam Farence. Research by Lidia Dinkova and Katherine Kallergis</em></p>";

// let footerDiv =
// "<p style='font-size:20px;'>South Florida has notched major construction mortgages in the past year. Read more below.</p>";

let divChapter1 =
  "<h3>Brady | 26 Indian Creek Island Road, Indian Creek, Florida 33154 </h3>" +
  "<p>Tom Brady and Gisele Bündchen paid $17 million for the nearly 2-acre Indian Creek lot in October 2020, where Brady is now building a waterfront mansion. The property is across the water from Bündchen's home in Surfside.</p>";

let divChapter2 =
  "<h3>Bündchen | 1400 Biscaya Drive, Surfside, Florida 33154</h3>" +
  "<p>Bündchen paid $11.5 million for the waterfront home at 1400 Biscaya Drive in Surfside in October via a trust. The 6,600-square-foot house, built in 1981, is likely a teardown. It's across the water from the Indian Creek mansion that Brady is building.</p>";

let divChapter3 =
  "<h3>Bündchen | 8850 Emerson Avenue, Surfside, Florida 33154</h3>" +
  "<p>Bündchen paid $1.3 million for the small, non-waterfront home at 8850 Emerson Avenue in Surfside in February 2022, months before she and Brady would announce their divorce. The three-bedroom, two-and-a-half-bathroom house, built in 1940, was renovated and sits on a 0.1-acre lot.</p>";

let divChapter4 = 
"<h3>Brady | 9349 Collins Avenue, Apt 901, Surfside, Florida 33154</h3>" +
"<p>Brady is paying $60,000 a month to rent a unit at Fendi Château Residences in Surfside. The 4,100-square-foot condo at 9349 Collins Avenue has three bedrooms, four and a half bathrooms, service quarters and a 1,400-square-foot wraparound terrace with an outdoor kitchen.</p>"

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
        center: [-80.1921083,25.90004],
        zoom: 10,
        zoomSmall: 10,
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
      id: "26 Indian Creek Island Road, Indian Creek, Florida 33154",
      alignment: "right",
      hidden: false,
      title: "",
      image: "",
      description: "",
      chapterDiv: divChapter1,
      location: {
        center: [
          -80.1350731,
          25.8740297
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
      id: "1400 Biscaya Drive, Surfside, Florida 33154", 
      alignment: "left",
      hidden: false,
      title: "",
      image: "",
      description: "",
      chapterDiv: divChapter2,
      location: {
        center: [
          -80.1317363,
          25.8740533
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
      id: "8850 Emerson Avenue, Surfside, Florida 33154", 
      alignment: "right",
      hidden: false,
      title: "",
      image: "",
      description: "",
      chapterDiv: divChapter3,
      location: {
        center: [
          -80.1267896,
          25.8740176
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
      id: "9349 Collins Avenue, Apt 901, Surfside, Florida 33154", 
      alignment: "right",
      hidden: false,
      title: "",
      image: "",
      description: "",
      chapterDiv: divChapter4,
      location: {
        center: [
          -80.1216893,
          25.8830205
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
  ],
};