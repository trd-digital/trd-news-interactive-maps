let introDiv =
"<p style='font-size:20px;'>Map of planned malls-to-resi conversions in South Florida.</p>" +
"<p> &#8681;  &#8681;  &#8681;</p>"

let divChapter1 =
  "<h3>Southland Mall | 20505 South Dixie Highway, Cutler Bay</h3>" +
  "<p><a href=\"https://therealdeal.com/miami/2023/05/04/electra-america-bh-score-approval-for-first-phase-of-1b-southland-mall-redevelopment/\" target=\"_blank\" rel=\"noopener noreferrer\">Electra America and</a> BH Group paid $100.3 million for Southland Mall, which sits on 80 acres in an Opportunity Zone. After purchasing Southland Mall, the joint venture acquired a shuttered Sears store on an adjacent 15 acres for $34 million. The partnership is planning a $1 billion development called Southplace City Center that would surround the existing 808,776-square-foot indoor mall. The planned project consists of 4,395 apartments and condos, a 150-room hotel, 60,000 square feet of medical office space, 150,000 square feet of retail out parcels and a community amphitheater.</p>";

let divChapter2 =
  "<h3>Sears store at Westland Mall | 1625 West 49th Street, Hialeah</h3>" +
  "<p><a href=\"https://therealdeal.com/miami/2023/05/23/codina-buys-hialeah-sears-site-from-seritage-for-17m/\" target=\"_blank\" rel=\"noopener noreferrer\">Last year, Codina</a> Partners paid $16.5 million for 153,596-square-foot big box store built in 1970, an outparcel and adjoining parking lot at Westland Mall. Sears closed four years ago. Codina is partnering with mall owner, Dallas-based Centennial, James Carr and Manny Kadre to redevelop the Sears site into a mixed-use project on the 15-acre site. The plan calls for 815 apartments in a pair of eight-story buildings and a six-story building with commercial space; two eight-story parking garages with 1,559 spaces; a three-story building with 15 townhomes; a two-story amenity center and a public plaza.</p>";

let divChapter3 =
  "<h3>Searstown Plaza | 901 North Federal Highway, Fort Lauderdale</h3>" +
  "<p><a href=\"https://therealdeal.com/miami/2022/06/07/aimco-drops-64m-for-mixed-use-dev-site-in-fort-lauderdales-flagler-village/\" target=\"_blank\" rel=\"noopener noreferrer\">In 2022, Aimco paid</a> $64 million for the former Searstown Plaza at 901-927 North Federal Highway and an adjacent 3.4 acres. The Denver-based multifamily firm plans to build a three million-square-foot mixed-use project with 1,500 apartments on the redevelopment site, which totals 9 acres.</p>";

let divChapter4 = 
  "<h3>Cocogate Plaza | 1308-1350 North State Rd 7, Margate</h3>" +
  "<p><a href=\"https://therealdeal.com/miami/2024/01/10/south-florida-retail-construction-drops-off-in-q4/\" target=\"_blank\" rel=\"noopener noreferrer\">Coral Springs-based</a> Amera is demolishing a portion of Cocogate Plaza at 5203 Coconut Creek Parkway. The developer is planning to build a 220-unit apartment complex called Marquesa.</p>";

let divChapter5 = 
  "<h3>Shops at Sunset Place | 5701 Sunset Drive, South Miami</h3>" +
  "<p><a href=\"https://therealdeal.com/miami/2023/12/01/vadias-sunset-place-development-in-south-miami-moves-ahead/\" target=\"_blank\" rel=\"noopener noreferrer\">Midtown Miami</a> developer Alex Vadia is moving forward with plans to redevelop the Shops at Sunset Place, a shopping center in South Miami. Vadia\u2019s firm aid $65.5 million Sunset Place in early 2021, a steep discount from its previous $110.2 million sale price in 2015. British design and architecture firm Heatherwick Studio and ODP Architecture & Design will be working on the master plan and timeline for the 10-plus-acre property at 5701 Southwest 72nd Street.</p>";

let divChapter6 = 
"<h3>Palms at Town & Country | 11800 Mills Drive, Kendall</h3>" +
"<p><a href=\"https://therealdeal.com/miami/2023/08/03/kimco-proposes-630-apartments-at-kendalls-palms-at-town-and-country/\" target=\"_blank\" rel=\"noopener noreferrer\">Jericho, New York-</a>based Kimco Realty wants to redevelop a portion of Kendall\u2019s Palms at Town and Country with plans for two 12-story buildings with 630 apartments and 35,000 square feet of retail to replace a big box store currently leased to Kohl\u2019s.</p>";

let divChapter7 = 
"<h3>Intracoastal Mall | 3881 Northeast 163rd Street, North Miami Beach</h3>" +
"<p><a href=\"https://therealdeal.com/miami/2020/09/25/dezers-30-acre-megaproject-in-north-miami-beach-gets-first-approval/\" target=\"_blank\" rel=\"noopener noreferrer\">Dezer Development</a> paid $63.5 million for the Intracoastal Mall at 3881 Northeast 163rd Street in 2013. In 2020, the city of North Miami Beach granted the first approvals for a planned project that consists of 2,000 residential units, 575,000 square feet of retail and office space, 250 hotel rooms, a harbor and central park and more. The megadevelopment would replace the 234,000-square-foot Intracoastal Mall and a three-story office building.</p>";

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
      id: "20505 South Dixie Highway, Cutler Bay",
      alignment: "center",
      hidden: false,
      title: "",
      image: "",
      description: "",
      chapterDiv: divChapter1,
      location: {
        center: [                     
          -80.3706371,25.575258
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
      id: "1625 West 49th Street, Hialeah", 
      alignment: "center",
      hidden: false,
      title: "",
      image: "",
      description: "",
      chapterDiv: divChapter2,
      location: {
        center: [                     
          -80.316262, 25.8683792
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
      id: "901 North Federal Highway, Fort Lauderdale", 
      alignment: "center",
      hidden: false,
      title: "",
      image: "",
      description: "",
      chapterDiv: divChapter3,
      location: {
        center: [                    
          -80.1385647, 26.135447
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
      id: "1308-1350 North State Rd 7, Margate", 
      alignment: "center",
      hidden: false,
      title: "",
      image: "",
      description: "",
      chapterDiv: divChapter4,
      location: {
        center: [                    
          -80.206436, 26.2445263
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
      id: "5701 Sunset Drive, South Miami", 
      alignment: "center",
      hidden: false,
      title: "",
      image: "",
      description: "",
      chapterDiv: divChapter5,
      location: {
        center: [                    
          -80.28635500000001, 25.7053567
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
      id: "11800 Mills Drive, Kendall", 
      alignment: "center",
      hidden: false,
      title: "",
      image: "",
      description: "",
      chapterDiv: divChapter6,
      location: {
        center: [                    
          -80.3867417, 25.6894717
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
      id: "3881 Northeast 163rd Street, North Miami Beach", 
      alignment: "center",
      hidden: false,
      title: "",
      image: "",
      description: "",
      chapterDiv: divChapter7,
      location: {
        center: [                    
          -80.1322706, 25.9315038
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