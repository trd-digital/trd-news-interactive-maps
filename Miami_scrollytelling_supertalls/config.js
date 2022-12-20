// let topTitleDiv = "<h4>South Florida</h4>";

// let titleDiv =
//   "<h1>Here are the resi projects planned for downtown Miami</h1>";

// let descriptionDiv =
// "<p>The rules don't seen to apply to Miami.</p>" +
// "<p>Despite economists predicting a global recession, developers are betting big on downtown Miami. Projects under construction and those planned since the start of the year expect to bring a whopping 7,000-plus apartments and condos to the Magic City.</p>" + 
// "<p>According to an analysis by <em>The Real Deal</em>, 1,358 condos are in the works and 3,793 apartments are planned. More than 2,000 additional units are not yet specified as condos or rentals.</p>" +
// "<p>The disclosed land acquisitions in downtown Miami total more than $230 million. This doesn't include other projects in Brickell, Edgewater and Wynwood.</p>";

let introDiv =
"<p>Here are some of the skyscraper projects planned for downtown Miami:</p>"

// let bylineDiv = "<p><em>By Adam Farence. Research by Lidia Dinkova and Katherine Kallergis</em></p>";

// let footerDiv =
//   '<p><a href="https://www.mapbox.com/about/maps/" target="_blank">© Mapbox</a> | <a href="http://www.openstreetmap.org/about/" target="_blank">© OpenStreetMap</a>';

let divChapter1 =
  "<h3>300 Biscayne Boulevard | PMG and its partners, Greybrook, Mohari Hospitality, S2 Development and Hilton </h3>" +
  // '<img src="images/WaldorfAstoria.jpg">' +
  // '<p class="imageCredit">Insert credit here...</p>' +
  "<p>Waldorf Astoria Hotel & Residences: Expected completion is in 2027. The tower will have 205 hotel keys and 360 luxury condo units, which were 87 percent pre-sold as of November.  This will be the tallest residental structure south of New York once completed. </p>";

let divChapter2 =
  "<h3>100 South Biscayne Boulevard | Tibor Hollo's Florida East Coast Realty</h3>" +
  "<p>One Bayfront Plaza. This one has been planned since at least 2016. It will include office, commercial, hotel and residential space.</p>";

let divChapter3 =
  "<h3>700 Brickell Avenue and 799 Brickell Plaza | Swire Properties and Steve Ross' Related Companies</h3>" +
  // '<img src="images/OneBrickell.jpg">' +
  // '<p class="imageCredit">Insert credit here...</p>' +
  "<p>Construction is expected to start next year. This will be an office tower at the Brickell City Centre.</p>";

let divChapter4 =
  "<h3>400 Southeast Second Avenue | Hyatt Hotels and Gencom</h3>" +
  // '<img src="images/Riverbridge.jpg">' +
  // '<p class="imageCredit">Insert credit here...</p>' +
  "<p>The Miami Riverbridge project will redevelop the James L. Knight Center and next-door Hyatt hotel with three towers. One of the towers will rise 1,049 feet and will have 860 units. Miami voters approved the lease for the project site in a November referendum.</p>";

let divChapter5 =
  "<h3>888 Brickell Avenue | Michael Stern's JDS Development Group</h3>" +
  // '<img src="images/888 Brickell Avenue.jpg">' +
  // '<p class="imageCredit">Insert credit here...</p>' +
  "<p>The tower is branded as 888. It will have 259 residential units for sale (condos). Developer JDS just scored FAA approval for the tower's height. </p>";

var config = {
  style: "mapbox://styles/trddata/cl6h00632006t14o08g2ppqvj",
  accessToken: "pk.eyJ1IjoidHJkZGF0YSIsImEiOiJjbDdreW9oZzEwb3JzNDJvYmNnd2swbzBmIn0.ZJiADpTaqdGS3fiMUdFYFw",
  showMarkers: false,
  markerColor: "#3FB1CE",
  theme: "light",
  use3dTerrain: false,
  topTitle: [],
  title: [],
  subtitle: "",
  byline: [],
  description: [],
  footer: [],
  chapters: [
    {
      id: "overallMap",
      alignment: "left",
      hidden: false,
      chapterDiv: introDiv,
      location: {
        center: [-80.1921083,25.7704704],
        zoom: 14,
        zoomSmall: 11,
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
      id: "300 Biscayne Boulevard",
      alignment: "left",
      hidden: false,
      title: "",
      image: "",
      description: "",
      chapterDiv: divChapter1,
      location: {
        center: [-80.1895731176583,25.7774202098037],
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
          layer: "300 Biscayne Boulevard",
          opacity: .5,
          duration: 300,
        },
      ],
    },
    {
      id: "100 South Biscayne Boulevard", 
      alignment: "left",
      hidden: false,
      title: "",
      image: "",
      description: "",
      chapterDiv: divChapter2,
      location: {
        center: [-80.188597555905,25.7728928912491],
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
          layer: "300 Biscayne Boulevard",
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
      id: "700 Brickell Avenue and 799 Brickell Plaza", 
      alignment: "right",
      hidden: false,
      title: "",
      image: "",
      description: "",
      chapterDiv: divChapter3,
      location: {
        center: [-80.1910412701565,25.7668053996104],
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
          layer: "300 Biscayne Boulevard",
          opacity: 1,
          duration: 300,
        },
      ],
      onChapterExit: [
        {
          layer: "700 Brickell Avenue and 799 Brickell Plaza",
          opacity: .5,
          duration: 300,
        },
      ],
    },
    {
      id: "400 Southeast Second Avenue", 
      alignment: "right",
      hidden: false,
      title: "",
      image: "",
      description: "",
      chapterDiv: divChapter4,
      location: {
        center: [-80.1905477438852,25.7708809096629],
        zoom: 17.52,
        zoomSmall: 16,
        pitch: 54.5,
        bearing: -.07,
      },
      mapAnimation: "flyTo",
      rotateAnimation: false,
      callback: "",
      onChapterEnter: [
        {
          layer: "700 Brickell Avenue and 799 Brickell Plaza",
          opacity: 1,
          duration: 300,
        },
      ],
      onChapterExit: [
        {
          layer: "400 Southeast Second Avenue",
          opacity: .5,
          duration: 300,
        },
      ],
    },
    {
      id: "888 Brickell Avenue", 
      alignment: "right",
      hidden: false,
      title: "",
      image: "",
      description: "",
      chapterDiv: divChapter5,
      location: {
        center: [-80.1910695518629,25.7645244788327],
        zoom: 17.52,
        zoomSmall: 16,
        pitch: 54.5,
        bearing: -.07,
      },
      mapAnimation: "flyTo",
      rotateAnimation: false,
      callback: "",
      onChapterEnter: [
        {
          layer: "888 Brickell Avenue",
          opacity: 1,
          duration: 300,
        },
      ],
      onChapterExit: [
        {
          layer: "888 Brickell Avenue",
          opacity: .5,
          duration: 300,
        },
      ],
    },
  ],
};