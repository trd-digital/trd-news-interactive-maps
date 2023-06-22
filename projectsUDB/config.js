let introDiv =
"<p style='font-size:20px;'>Scroll down for a guided round-up of projects outside of the urban development boundary.</p>" +
"<p> &#8681;  &#8681;  &#8681;</p>"

let divChapter1 =
  "<h3>Westend at Princeton | Legacy Residential Group, CD Group and Fenix Contractors</h3>" +
  "<p>This is a proposal for a 630-unit apartment complex with 14 three-story and four-story buildings on 20 acres at the southeast corner of Southwest 252nd Street and Southwest 145th Avenue.</p>";

let divChapter2 =
  "<h3>Infinity Gardens Apartments | Brandon Shpirt of BSB Global Enterprises</h3>" +
  "<p>This is a proposal for a six-story apartment complex with 773 units.</p>";

let divChapter3 =
  "<p>This is a proposal for a 1,677 residential development consisting of 313 single-family houses, 201 townhouses and 1,163 apartments, as well as a commercial portion.</p>";

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
        center: [-80.4222065,25.532677],
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
      id: "Westend at Princeton",
      alignment: "right",
      hidden: false,
      title: "",
      image: "",
      description: "",
      chapterDiv: divChapter1,
      location: {
        center: [
          -80.4222065,
          25.532677
      ],
        zoom: 15.79,
        zoomSmall: 14,
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
      id: "Infinity Gardens Apartments", 
      alignment: "left",
      hidden: false,
      title: "",
      image: "",
      description: "",
      chapterDiv: divChapter2,
      location: {
        center: [
          -80.4269364,
          25.5260418
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
      id: "Apartment proposal", 
      alignment: "right",
      hidden: false,
      title: "",
      image: "",
      description: "",
      chapterDiv: divChapter3,
      location: {
        center: [
          -80.46549383357674,
          25.665743293905635
      ],
        zoom: 16.27,
        zoomSmall: 14,
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