// let topTitleDiv = "<h4>South Florida</h4>";

// let titleDiv =
//   "<h1>Here are the resi projects planned for downtown Miami</h1>";

// let descriptionDiv =
// "<p>The rules don't seen to apply to Miami.</p>" +
// "<p>Despite economists predicting a global recession, developers are betting big on downtown Miami. Projects under construction and those planned since the start of the year expect to bring a whopping 7,000-plus apartments and condos to the Magic City.</p>" + 
// "<p>According to an analysis by <em>The Real Deal</em>, 1,358 condos are in the works and 3,793 apartments are planned. More than 2,000 additional units are not yet specified as condos or rentals.</p>" +
// "<p>The disclosed land acquisitions in downtown Miami total more than $230 million. This doesn't include other projects in Brickell, Edgewater and Wynwood.</p>";

let introDiv =
"<p style='font-size:20px;'>Scroll down for a guided, inside look at South Florida's branded condo boom.</p>" +
"<p> &#8681;  &#8681;  &#8681;</p>"

// let bylineDiv = "<p><em>By Adam Farence. Research by Lidia Dinkova and Katherine Kallergis</em></p>";

// let footerDiv =
//   '<p><a href="https://www.mapbox.com/about/maps/" target="_blank">© Mapbox</a> | <a href="http://www.openstreetmap.org/about/" target="_blank">© OpenStreetMap</a>';

let divChapter1 =
  "<h3>1420 South Miami Avenue in Miami | Cipriani Residences </h3>" +
  '<img src="images/Cipriani Residences Miami Crown.jpg">' +
  '<p class="imageCredit">Credit: The Boundary</p>' +
  "<p>Mast Capital plans a new 80-story condo tower, the first Cipriani-branded residential building in the U.S. It is expected to have 397 units, according to a press release. </p>";

let divChapter2 =
  "<h3>18401 Collins Avenue in Sunny Isles Beach | Bentley Residences</h3>" +
  '<img src="images/Dezer-BentleyTower-05-Beach_View-03.jpg">' +
  '<p class="imageCredit">Credit: TK TK</p>' +
  "<p>Dezer Development plans a 61-story condo tower with 216 units. Dezer partnered with Bentley Motors to develop the luxury automotive brand's first residential building in the world.</p>";

let divChapter3 =
  "<h3>300 Biscayne Boulevard in Miami | Waldorf Astoria Hotel and Residences</h3>" +
  '<img src="images/WaldorfAstoria.jpg">' +
  '<p class="imageCredit">Insert credit here...</p>' +
  "<p>PMG, Greybook, Mohari Hospitality, S2 Development and Hilton plan the Waldorf Astoria, a 100-story tower with 360 condos and 205 hotel rooms.</p>";

let divChapter4 = 
"<p style='font-size:20px;'>Most branded projects are in Miami.</p>"

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
        center: [-80.1921083,26.2504704],
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
      id: "1420 South Miami Avenue in Miami",
      alignment: "left",
      hidden: false,
      title: "",
      image: "",
      description: "",
      chapterDiv: divChapter1,
      location: {
        center: [-80.193908,25.760140],
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
          layer: "1420 South Miami Avenue in Miami",
          opacity: .5,
          duration: 300,
        },
      ],
    },
    {
      id: "18401 Collins Avenue in Sunny Isles Beach", 
      alignment: "left",
      hidden: false,
      title: "",
      image: "",
      description: "",
      chapterDiv: divChapter2,
      location: {
        center: [-80.120438	,25.946842],
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
          layer: "1420 South Miami Avenue in Miami",
          opacity: 1,
          duration: 300,
        },
      ],
      onChapterExit: [
        {
          layer: "",
          opacity: 0.5,
          duration: 300,
        },
      ],
    },
    {
      id: "300 Biscayne Boulevard in Miami", 
      alignment: "right",
      hidden: false,
      title: "",
      image: "",
      description: "",
      chapterDiv: divChapter3,
      location: {
        center: [-80.187768,25.771434],
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
          layer: "1420 South Miami Avenue in Miami",
          opacity: 1,
          duration: 300,
        },
      ],
      onChapterExit: [
        {
          layer: "MiamiCenter",
          opacity: .5,
          duration: 300,
        },
      ],
    },
    {
      id: "MiamiCenter",
      alignment: "left",
      hidden: false,
      title: "",
      image: "",
      description: "",
      chapterDiv: divChapter4,
      location: {
        center: [-80.199,25.785],
        zoom: 12,
        zoomSmall: 7,
        pitch: 0,
        bearing: 0,
      },
      mapAnimation: "flyTo",
      rotateAnimation: false,
      callback: "",
      onChapterEnter: "300 Biscayne Boulevard in Miami",
      onChapterExit: "overallMap2",
    },
    {
      id: "overallMap2",
      alignment: "left",
      hidden: true,
      title: "",
      image: "",
      description: "",
      chapterDiv: "",
      location: {
        center: [-80.1921083,26.2504704],
        zoom: 8,
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
  ],
};