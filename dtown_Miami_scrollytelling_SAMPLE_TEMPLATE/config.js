let topTitleDiv = "<h4>South Florida</h4>";

let titleDiv =
  "<h1>Here are the resi projects planned for downtown Miami</h1>";

let descriptionDiv =
"<p>The rules don't seen to apply to Miami.</p>" +
"<p>Despite economists predicting a global recession, developers are betting big on downtown Miami. Projects under construction and those planned since the start of the year expect to bring a whopping 7,000-plus apartments and condos to the Magic City.</p>" + 
"<p>According to an analysis by <em>The Real Deal</em>, 1,358 condos are in the works and 3,793 apartments are planned. More than 2,000 additional units are not yet specified as condos or rentals.</p>" +
"<p>The disclosed land acquisitions in downtown Miami total more than $230 million. This doesn't include other projects in Brickell, Edgewater and Wynwood.</p>";

let introDiv =
"<p>Here are some of the residential projects planned for downtown Miami:</p>"

let bylineDiv = "<p><em>By Adam Farence. Research by Lidia Dinkova and Katherine Kallergis</em></p>";

let footerDiv =
  '<p><a href="https://www.mapbox.com/about/maps/" target="_blank">© Mapbox</a> | <a href="http://www.openstreetmap.org/about/" target="_blank">© OpenStreetMap</a>';

let divChapter1 =
  "<h3>222 Northeast First Avenue | Namdar</h3>" +
  '<img src="images/Chapter_2_Image.jpeg">' +
  '<p class="imageCredit">David Schwartz and Martin Nussbaum with rendering of Namdar Towers (Slate Property Group)</p>' +
  "<p>Namdar Group scored a $195 million loan last month to buy the development site at 222 Northeast First Avenue and build two apartment towers. The New York-based real estate investment and development firm plans Namdar Towers to include one 41-story tower with 640 units and a 43-story tower with 714 units. Slate Property Group’s affiliate Scale Lending provided the financing.</p>";

let divChapter2 =
  "<h3>400 Southeast Second Avenue | Hyatt, Gencom</h3>" +
  '<img src="images/Chapter_3_Image.jpeg">' +
  '<p class="imageCredit">Hyatt CEO Mark Hoplamazian and Gencom Founder and Principal Karim Alibhai with a rendering of the proposed three-tower development at 400 Southeast Second Avenue (James L. Knight Center) (LinkedIn, Gencom, Arquitectonica)</p>' +
  "<p>Chicago-based Hyatt and Miami-based Gencom plan to redevelop the James L. Knight Center, along with the attached Hyatt Regency Miami hotel, into a three-tower project called Miami Riverbridge. Arquitectonica is designing the project. In July, the Miami City Commission approved a voter referendum for November for residents to approve the makeover of the city-owned property.</p>";

let divChapter3 =
  "<h3>56 Southwest First Street | Lions Group NYC, Fortis Design + Build</h3>" +
  '<img src="images/Chapter_3_Image.jpeg">' +
  '<p class="imageCredit">Lions Group\'s Albert Shirian, Fortis Design + Build\'s Andrew Lenahan and David Polinsky with renderings of the M Tower apartment project (LinkedIn, Fortis Design + Build, Nichols Architects)</p>' +
  "<p>Long Island-based Lions Group NYC and Miami-based Fortis Design + Build proposed in June to build a 57-story, 675-unit apartment building at 65 Southwest Second Street.</p>";

let divChapter4 =
  "<h3>225 North Miami Avenue | Related Group, ROVR Development and BH Group</h3>" +
  '<img src="images/Chapter_4_Image.jpeg">' +
  '<p class="imageCredit">From left: Ricardo Vadia, Jon Paul Perez, and Oscar Rodriguez with District 225</p>' +
  "<p>Currently under construction, financed by a $76 million loan from Madison Realty Capital, the Related Group, ROVR Development and BH group are building a 37-story condo tower with 343 units. District 225 is already fully presold, with prices ranging from $300,000 to $800,000. Construction will likely finish in 2024.</p>";

var config = {
  style: "mapbox://styles/trddata/cl6h00632006t14o08g2ppqvj",
  accessToken: "pk.eyJ1IjoidHJkZGF0YSIsImEiOiJjbDdreW9oZzEwb3JzNDJvYmNnd2swbzBmIn0.ZJiADpTaqdGS3fiMUdFYFw",
  showMarkers: false,
  markerColor: "#3FB1CE",
  theme: "light",
  use3dTerrain: false,
  topTitle: topTitleDiv,
  title: titleDiv,
  subtitle: "",
  byline: bylineDiv,
  description: descriptionDiv,
  footer: footerDiv,
  chapters: [
    {
      id: "overallMap",
      alignment: "left",
      hidden: false,
      chapterDiv: introDiv,
      location: {
        center: [-80.2021083,25.7764704],
        zoom: 14,
        zoomSmall: 9,
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
      id: "222NEFA", //222 Northeast First Avenue | Namdar
      alignment: "left",
      hidden: false,
      title: "",
      image: "",
      description: "",
      chapterDiv: divChapter1,
      location: {
        center: [-80.19205,25.77670],
        zoom: 17.79,
        zoomSmall: 9,
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
          layer: "222NEFA",
          opacity: .5,
          duration: 300,
        },
      ],
    },
    {
      id: "400SESA", // 400 Southeast Second Avenue | Hyatt, Gencom
      alignment: "left",
      hidden: false,
      title: "",
      image: "",
      description: "",
      chapterDiv: divChapter2,
      location: {
        center: [-80.19093,25.77109],
        zoom: 17.48,
        zoomSmall: 14,
        pitch: 45,
        bearing: 1.09,
      },
      mapAnimation: "flyTo",
      rotateAnimation: false,
      callback: "",
      onChapterEnter: [
        {
          layer: "222NEFA",
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
      id: "56SWFS", // 56 Southwest First Street
      alignment: "right",
      hidden: false,
      title: "",
      image: "",
      description: "",
      chapterDiv: divChapter3,
      location: {
        center: [-80.19435,25.77324],
        zoom: 18.27,
        zoomSmall: 14,
        pitch: 54.5,
        bearing: .74,
      },
      mapAnimation: "flyTo",
      rotateAnimation: false,
      callback: "",
      onChapterEnter: [
        {
          layer: "400SESA",
          opacity: 1,
          duration: 300,
        },
      ],
      onChapterExit: [
        {
          layer: "56SWFS",
          opacity: .5,
          duration: 300,
        },
      ],
    },
    {
      id: "225NMA", // 225 North Miami Avenue
      alignment: "right",
      hidden: false,
      title: "",
      image: "",
      description: "",
      chapterDiv: divChapter4,
      location: {
        center: [-80.19353,25.77684],
        zoom: 17.52,
        zoomSmall: 14,
        pitch: 54.5,
        bearing: -.07,
      },
      mapAnimation: "flyTo",
      rotateAnimation: false,
      callback: "",
      onChapterEnter: [
        {
          layer: "56SWFS",
          opacity: 1,
          duration: 300,
        },
      ],
      onChapterExit: [
        {
          layer: "225NMA",
          opacity: .5,
          duration: 300,
        },
      ],
    },
  ],
};