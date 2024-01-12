let introDiv =
"<p style='font-size:20px;'>Map of planned South Florida developments designed by major architects.</p>" +
"<p> &#8681;  &#8681;  &#8681;</p>"

let divChapter1 =
  "<h3>4218 Northeast Second Avenue in Miami</h3>" +
  "<p>Japanese architect Kengo Kuma is designing at least two projects in South Florida. In November, Lionheart Capital, Leviathan Development and Well Duo revealed Kuma will design their Miami Design District project.</p>" +
  "<img src='images/4218_NE_Second_Avenue_Miami.jpg'>" +
  "<p class='image-credit'>Photo credit: Kengo Kuma and Associates</p>";

let divChapter2 =
  "<h3>2175 and 2251 North Flagler Drive in West Palm Beach</h3>" +
  "<p>Jeff Greene plans a 152-unit condo project near Currie Park that would be designed by Herzog & de Meuron. The two-30-story tower, 152-unit project would sit on a 4.5-acre site.</p>" +
  "<img src='images/2175_and_2251_NorthFlaglerDrive_WPB.png'>" +
  "<p class='image-credit'>Photo credit: Jeff Greene/Herzog de Meuron</p>"; 

let divChapter3 =
  "<h3>1901 Collins Avenue in Miami Beach</h3>" +
  "<p>Witkoff and Monroe Capital are developing the Auberge-branded luxury condo and resort at the Shore Club property in Miami Beach. RAMSA is designing the oceanfront project alongside Kobi Karp Architecture & Interior Design.</p>" +
  "<img src='images/1901_Collins_Avenue_PC_the_Boundary.jpg'>" +
  "<p class='image-credit'>Photo credit: The Boundary</p>";   

let divChapter4 = 
  "<h3>8777 Collins Avenue in Surfside</h3>" +
  "<p>Damac Properties plans a 12-story, 57-unit boutique condo designed by Zaha Hadid Architects on the 1.8-acre oceanfront property. The plans call for up to six condos per floor, with units ranging from 4,000 square feet to 15,000 square feet.</p>" +
  "<img src='images/8777_Collins_Avenue.png'>" +
  "<p class='image-credit'>Photo credit: Damac Properties/Zaha Hadid Architects</p>";  

let divChapter5 = 
  "<h3>Waldorf Astoria Hotel & Residences, Miami | 300 Biscayne Boulevard</h3>" +
  "<p>Damac Properties plans a 12-story, 57-unit boutique condo designed by Zaha Hadid Architects on the 1.8-acre oceanfront property. The plans call for up to six condos per floor, with units ranging from 4,000 square feet to 15,000 square feet.</p>" +
  "<img src='images/PMG-Waldorf_Astoria-01-CubeDetail-05.jpg'>" +
  "<p class='image-credit'>Photo credit: ArX Solutions</p>";  

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
      id: "4218 Northeast Second Avenue in Miami",
      alignment: "center",
      hidden: false,
      title: "",
      image: "",
      description: "",
      chapterDiv: divChapter1,
      location: {
        center: [                     
          -80.19171290000001,25.8153646
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
      id: "2175 and 2251 North Flagler Drive in West Palm Beach", 
      alignment: "center",
      hidden: false,
      title: "",
      image: "",
      description: "",
      chapterDiv: divChapter2,
      location: {
        center: [                     
          -80.051332, 26.7341466
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
      id: "1901 Collins Avenue in Miami Beach", 
      alignment: "center",
      hidden: false,
      title: "",
      image: "",
      description: "",
      chapterDiv: divChapter3,
      location: {
        center: [                    
          -80.128334, 25.7950703
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
      id: "8777 Collins Avenue in Surfside", 
      alignment: "center",
      hidden: false,
      title: "",
      image: "",
      description: "",
      chapterDiv: divChapter4,
      location: {
        center: [                    
          -80.12078679999999, 25.8730174
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
      id: "300 Biscayne Boulevard in Miami", 
      alignment: "center",
      hidden: false,
      title: "",
      image: "",
      description: "",
      chapterDiv: divChapter5,
      location: {
        center: [                    
          -80.1877681, 25.771434
      ],
        zoom: 16,
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