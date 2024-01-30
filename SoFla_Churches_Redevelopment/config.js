let introDiv =
"<p style='font-size:20px;'>Map of planned South Florida religious redevelopment.</p>" +
"<p> &#8681;  &#8681;  &#8681;</p>"

let divChapter1 = 
  "<h3>Trinity Episcopal Cathedral | 464 Northeast 16th Street and 515 Northeast 15th Street</h3>" +
  "<p>Designed by Sieger Suarez Architects, the project would have 462 apartments atop a 533-space garage.</p>";

let divChapter2 =
  "<h3>First Miami Presbyterian Church | 1901 Collins Avenue in Miami Beach</h3>" +
  "<p>Key International and Arnaud Karsenti's 13th Floor Investments are partnering on a condo tower on a portion of First Miami Presbyterian Church's lot in Brickell.</p>";   

let divChapter3 =
  "<h3>Christ United Methodist Church | 210-217 Northeast Third Street in Pompano Beach</h3>" +
  "<p>The project will consist of two 10-story buildings with 319 apartments, combined, and 3,200 square feet of retail at 210-217 Northeast Third Street. Two pedestrian bridges over Northeast Second Street will connect the buildings.</p>";

let divChapter4 =
  "<h3>First Church of Christ, Scientist | 134 and 142 Lakeview Avenue, 809 South Flagler Drive</h3>" +
  "<p>Steve Ross' Related Companies is developing a 25-story One Flagler next to the First Church of Christ, Scientist in downtown West Palm Beach.</p>";

var config = {
  style: "mapbox://styles/trddata/clrax4la3005701qogu72fl71",
  accessToken: "pk.eyJ1IjoidHJkZGF0YSIsImEiOiJjamc2bTc2YmUxY2F3MnZxZGh2amR2MTY5In0.QlOWqB-yQNrNlXD0KQ9IvQ",
  showMarkers: false,
  markerColor: "#db3eb1",
  theme: "light",
  use3dTerrain: false,
  topTitle: [],
  title: introDiv,
  subtitle: "",
  byline: [],
  description: [],
  footer: [],
  chapters: [
    {
      id: "overallMap",
      alignment: "center",
      hidden: true,
      chapterDiv: [],
      location: { 
        center: [-80.21230857822022,26.332661310948394],
        zoom: 8.25,
        zoomSmall: 8,
        pitch: 40,
        bearing: 0,
      },
      mapAnimation: "flyTo",
      rotateAnimation: false,
      callback: "",
      onChapterEnter: [],
      onChapterExit: [],
    },
    {
      id: "Trinity Episcopal Cathedral",
      alignment: "center",
      hidden: false,
      title: "",
      image: "",
      description: "",
      chapterDiv: divChapter1,
      location: {
        center: [                     
          -80.18650389999999,
          25.7903332
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
          duration: 1000000000000,
        },
      ],
      onChapterExit: [
        {
          layer: "overallMap",
          opacity: 1,
          duration: 1000000000000,
        },
      ],
    },
    {
      id: "First Miami Presbyterian Church", 
      alignment: "center",
      hidden: false,
      title: "",
      image: "",
      description: "",
      chapterDiv: divChapter2,
      location: {
        center: [                     
          -80.1917902,
          25.7616798
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
          duration: 1000000000000,
        },
      ],
      onChapterExit: [
        {
          layer: "overallMap",
          opacity: 1,
          duration: 1000000000000,
        },
      ],
    },
    {
      id: "Christ United Methodist Church", 
      alignment: "center",
      hidden: false,
      title: "",
      image: "",
      description: "",
      chapterDiv: divChapter3,
      location: {
        center: [                    
          -80.1247667,
          26.2378597
      ],
        zoom: 17.57,
        zoomSmall: 15,
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
          duration: 1000000000000,
        },
      ],
      onChapterExit: [
        {
          layer: "overallMap",
          opacity: 1,
          duration: 1000000000000,
        },
      ],
    },
    {
      id: "First Church of Christ, Scientist", 
      alignment: "center",
      hidden: false,
      title: "",
      image: "",
      description: "",
      chapterDiv: divChapter4,
      location: {
        center: [                    
          -80.18965969999999,
          25.7946858
      ],
        zoom: 18,
        zoomSmall: 16,
        pitch: 24.5,
        bearing: .34,
      },
      mapAnimation: "flyTo",
      rotateAnimation: false,
      callback: "",
      onChapterEnter: [
        {
          layer: "overallMap",
          opacity: 1,
          duration: 1000000000000,
        },
      ],
      onChapterExit: [
        {
          layer: "overallMap",
          opacity: 1,
          duration: 1000000000000,
        },
      ],
    },
    {
      id: "overallMap",
      alignment: "center",
      hidden: true,
      chapterDiv: [],
      location: { 
        center: [-80.21230857822022,26.332661310948394],
        zoom: 8.25,
        zoomSmall: 8,
        pitch: 40,
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