// Ensure HTML updates have been applied before creating the chart
setTimeout(createChart, 0);

let legend = "$ Amount in Millions"

let introDiv =
"<p style='font-size:20px;'>Scroll down for a guided round-up of the Boulveard of Broken Deals.</p>" +
"<p> &#8681;  &#8681;  &#8681;</p>"

let divChapter1 =
  "<h3>600 West Jackson</h3>" +
  "<p><strong>Status:</strong> Sold in Oct. 2022, for $10.8M ($92 psf)<br><strong>Current mortgage:</strong> $7.8M, Lake Forest Bank & Trust, Oct. 2022<br><strong>Landlord/Buyer:</strong> Farbman Group<br><strong>Seller:</strong> Stockbridge Capital Group<br><strong>Last sale price:</strong> $23.5M, 2017 ($200 psf)<br><strong>Last mortgage:</strong> $20.5M, Citizens Bank, Feb. 2018<br><strong>Year built:</strong> 1911</p>" +
  "<canvas id='600_West_Jackson'></canvas>";

let divChapter2 =
  "<h3>300 South Riverside Plaza</h3>" +
  "<p><strong>Status:</strong> Leasehold owner in default<br><strong>Leasehold owner:</strong> JV of David Werner and Joseph Mizrachi<br><strong>Current leasehold mortgage:</strong> $175M, Shinhan Investment Corp., 2017 (in default, per Morningstar)<br><strong>Ground lease debt:</strong> $167M, CMBS debt originated by Morgan Stanley<br><strong>Ground landlord:</strong> JV of Rubin Schron and David Lowenfeld<br><strong>Last sale price:</strong> $220M for land only, 2015<br><strong>Year built:</strong> 1987</p>" +
  "<canvas id='300_South_Riverside_Plaza'></canvas>";

let divChapter3 =
  "<h3>311 South Wacker</h3>" +
  "<p><strong>Status:</strong> For sale, since Sept. 2021<br><strong>Owner:</strong> JV of Zeller Realty and Cindat<br><strong>Current first mortgage:</strong> $215M, Morgan Stanley, 2018<br><strong>Mezzanine loan:</strong> Approx. $90M, Nuveen, 2018<br><strong>Occupancy:</strong> 61% leased<br><strong>Last sale price:</strong> $302M, 2014 ($230 psf) plus $38M spent on renovations<br><strong>Year built:</strong> 1990</p>" +
  "<canvas id='311_South_Wacker'></canvas>";

let divChapter4 = 
  "<h3>216 West Jackson</h3>" +
  "<p><strong>Status:</strong> In receivership<br><strong>Owner:</strong> Marc Realty<br><strong>Current mortgage:</strong> $16.5M, CMBS debt originated by German American Capital Corp., 2013<br><strong>Occupancy:</strong> 26% leased<br><strong>Last sale price:</strong> $22.3M, 2013 ($112 psf)<br><strong>Latest appraisal:</strong> $7M, July 2023<br><strong>Year built:</strong> 1897</p>" +
  "<canvas id='216_West_Jackson'></canvas>";

let divChapter5 = 
  "<h3>209 West Jackson</h3>" +
  "<p><strong>Status: </strong>Lender-owned via deed in lieu of foreclosure, June 2023<br><strong>Owner: </strong>ACRES Capital, following surrender by Market Street Partners<br><strong>Last mortgage: </strong>$25M CMBS debt originated by ACRES Capital<br><strong>Last sale price: </strong>$23.3M, 2018 ($162 psf)<br><strong>Year built: </strong>1896" +
  "<canvas id='209_West_Jackson'></canvas>";

let divChapter6 =
  "<h3>175 West Jackson</h3>" +
  "<p><strong>Status: </strong>In receivership, for sale<br><strong>Owner: </strong>Brookfield Asset Management<br><strong>Last mortgage: </strong>$280M CMBS debt originated by German American Capital Corp., 2013<br><strong>Appraised value at loan issuance: </strong>$410M, 2013 ($292 psf)<br><strong>Last sale price: </strong>$306M, 2018 ($220 psf)<br><strong>Occupancy: </strong>59% leased<br><strong>Latest appraisal: </strong>$195M, 2022 ($139 psf)<br><strong>Year built: </strong>1912</p>" +
  "<canvas id='175_West_Jackson'></canvas>";

let divChapter7 =
  "<h3>141 West Jackson (Board of Trade building)</h3>" +
  "<p><strong>Status: </strong>Lender-owned via deed in lieu of foreclosure<br><strong>Owner: </strong>Apollo Global Management, following surrender by JV of Glenstar and Oaktree Capital Management<br><strong>Last senior mortgage: </strong>$198M, Apollo Global, 2020 ($168M balance at time of January transfer)<br><strong>Mezzanine debt: </strong>$58M, CIM Group, 2020 ($49M balance at time of January transfer)<br><strong>Occupancy: </strong>85% leased<br><strong>Last sale price: </strong>$152M, 2012 ($109 psf)<br><strong>Year built: </strong>1930" +
  "<canvas id='141_West_Jackson'></canvas>";

let divChapter8 =
  "<h3>111 West Jackson</h3>" +
  "<p><strong>Status: </strong>Borrower in danger of imminent default<br><strong>Owner: </strong>Melohn Group<br><strong>Current mortgage: </strong>$105M CMBS debt originated by Nataxis, 2017, matures Dec. 2027<br><strong>Occupancy: </strong>65% leased<br><strong>Last sale price: </strong>$135M, 2013 ($235 psf)<br><strong>Year built: </strong>1962" +
  "<canvas id='111_West_Jackson'></canvas>";

let divChapter9 = 
  "<h3>55 East Jackson</h3>" +
  "<p><strong>Status: </strong>Leasehold owner in default of ground lease<br><strong>Leasehold owner: </strong>Firenze Group<br><strong>Current leasehold mortgage: </strong>$44M CMBS debt originated by Ready Capital, 2019<br><strong>Ground lease debt: </strong>None<br><strong>Ground landlord: </strong>Marc Realty<br><strong>Occupancy: </strong><br>47% leasedLast sale price: $64M for leasehold only, 2019<br><strong>Year built: </strong>1961</p>" +
  "<canvas id='55_East_Jackson'></canvas>";

  function createChart() {
    var ctx = document.getElementById('600_West_Jackson').getContext('2d');
    var chart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Sold', 'Current mortgage', 'Last sale price', 'Last mortgage'],
            datasets: [{
                label: legend,
                data: [10.8, 7.8, 23.5, 20.5],
                backgroundColor: [
                    'rgba(255, 99, 132, 0.2)',
                    'rgba(54, 162, 235, 0.2)',
                    'rgba(255, 206, 86, 0.2)',
                    'rgba(75, 192, 192, 0.2)'
                ],
                borderColor: [
                    'rgba(255, 99, 132, 1)',
                    'rgba(54, 162, 235, 1)',
                    'rgba(255, 206, 86, 1)',
                    'rgba(75, 192, 192, 1)'
                ],
                borderWidth: 1
            }]
        },
        options: {
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
    var ctx = document.getElementById('300_South_Riverside_Plaza').getContext('2d');
    var chart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Leasehold mortgage', 'Ground lease debt', 'Last sale price (land only)'],
            datasets: [{
                label: legend,
                data: [175, 167, 220],
                backgroundColor: [
                    'rgba(255, 99, 132, 0.2)',
                    'rgba(54, 162, 235, 0.2)',
                    'rgba(255, 206, 86, 0.2)'
                ],
                borderColor: [
                    'rgba(255, 99, 132, 1)',
                    'rgba(54, 162, 235, 1)',
                    'rgba(255, 206, 86, 1)'
                ],
                borderWidth: 1
            }]
        },
        options: {
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
    var ctx = document.getElementById('311_South_Wacker').getContext('2d');
    var chart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Current first mortgage', 'Risk of Loss', 'Last sale price','Renovations'],
            datasets: [{
                label: legend,
                data: [215, 90, 302, 38],
                backgroundColor: [
                    'rgba(255, 99, 132, 0.2)',
                    'rgba(54, 162, 235, 0.2)',
                    'rgba(255, 206, 86, 0.2)',
                    'rgba(75, 192, 192, 0.2)'
                ],
                borderColor: [
                    'rgba(255, 99, 132, 1)',
                    'rgba(54, 162, 235, 1)',
                    'rgba(255, 206, 86, 1)',
                    'rgba(75, 192, 192, 1)'
                ],
                borderWidth: 1
            }]
        },
        options: {
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
    var ctx = document.getElementById('216_West_Jackson').getContext('2d');
    var chart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Current mortgage (in default)','Last sale price','Latest appraisal'],
            datasets: [{
                label: legend,
                data: [16.5, 22.3, 7],
                backgroundColor: [
                    'rgba(255, 99, 132, 0.2)',
                    'rgba(54, 162, 235, 0.2)',
                    'rgba(255, 206, 86, 0.2)'
                ],
                borderColor: [
                    'rgba(255, 99, 132, 1)',
                    'rgba(54, 162, 235, 1)',
                    'rgba(255, 206, 86, 1)'
                ],
                borderWidth: 1
            }]
        },
        options: {
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
    var ctx = document.getElementById('209_West_Jackson').getContext('2d');
    var chart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['CMBS Debt resolved via deed in lieu','Last sale price'],
            datasets: [{
                label: legend,
                data: [25, 23.3],
                backgroundColor: [
                  'rgba(255, 99, 132, 0.2)',
                  'rgba(54, 162, 235, 0.2)'
              ],
              borderColor: [
                  'rgba(255, 99, 132, 1)',
                  'rgba(54, 162, 235, 1)'
              ],
                borderWidth: 1
            }]
        },
        options: {
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
    var ctx = document.getElementById('175_West_Jackson').getContext('2d');
    var chart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Appraised value at loan issuance','Last sale price','Last appraisal'],
            datasets: [{
                label: legend,
                data: [410, 306, 195],
                backgroundColor: [
                  'rgba(255, 99, 132, 0.2)',
                  'rgba(54, 162, 235, 0.2)',
                  'rgba(255, 206, 86, 0.2)'
              ],
              borderColor: [
                  'rgba(255, 99, 132, 1)',
                  'rgba(54, 162, 235, 1)',
                  'rgba(255, 206, 86, 1)'
              ],
                borderWidth: 1
            }]
        },
        options: {
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
    var ctx = document.getElementById('141_West_Jackson').getContext('2d');
    var chart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Last senior mortgage','Mortgage balance at time of January transfer','Mezzanine debt','Balance at time of January transfer','Amount of previous debt package borrower paid before deed-in-lieu'],
            datasets: [{
                label: legend,
                data: [198, 168, 58, 49, 39],
                backgroundColor: [
                  'rgba(255, 99, 132, 0.2)',
                  'rgba(54, 162, 235, 0.2)',
                  'rgba(255, 206, 86, 0.2)',
                  'rgba(75, 192, 192, 0.2)',
                  'rgba(255, 99, 132, 0.2)'
              ],
              borderColor: [
                  'rgba(255, 99, 132, 1)',
                  'rgba(54, 162, 235, 1)',
                  'rgba(255, 206, 86, 1)',
                  'rgba(75, 192, 192, 1)',
                  'rgba(255, 99, 132, 1)'
              ],
                borderWidth: 1
            }]
        },
        options: {
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
    var ctx = document.getElementById('111_West_Jackson').getContext('2d');
    var chart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Current mortgage','Last sale price'],
            datasets: [{
                label: legend,
                data: [105, 135],
                backgroundColor: [
                    'rgba(255, 99, 132, 0.2)',
                    'rgba(54, 162, 235, 0.2)'
                ],
                borderColor: [
                    'rgba(255, 99, 132, 1)',
                    'rgba(54, 162, 235, 1)'
                ],
                borderWidth: 1
            }]
        },
        options: {
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
    var ctx = document.getElementById('55_East_Jackson').getContext('2d');
    var chart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Current leasehold mortgage', 'Last sale price'],
            datasets: [{
                label: legend,
                data: [44, 64],
                backgroundColor: [
                  'rgba(255, 99, 132, 0.2)',
                  'rgba(54, 162, 235, 0.2)'
              ],
              borderColor: [
                  'rgba(255, 99, 132, 1)',
                  'rgba(54, 162, 235, 1)'
              ],
              borderWidth: 1
          }]
        },
        options: {
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
  }


var config = {
  style: "mapbox://styles/trddata/clkbkxt1n000h01qk5hk20f9j",
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
        center: [-87.64285710391677,41.87825679461387],
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
      id: "600 West Jackson",
      alignment: "right",
      hidden: false,
      title: "",
      image: "",
      description: "",
      chapterDiv: divChapter1,
      location: {
        center: [
          -87.64285710391677,41.87825679461387
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
      id: "300 South Riverside Plaza", 
      alignment: "right",
      hidden: false,
      title: "",
      image: "",
      description: "",
      chapterDiv: divChapter2,
      location: {
        center: [
          -87.6386509327527, 41.87745301758834
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
      id: "311 South Wacker", 
      alignment: "right",
      hidden: false,
      title: "",
      image: "",
      description: "",
      chapterDiv: divChapter3,
      location: {
        center: [
          -87.6358341039168, 41.87746610600508
      ],
        zoom: 16.57,
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
    {
      id: "216 West Jackson", 
      alignment: "right",
      hidden: false,
      title: "",
      image: "",
      description: "",
      chapterDiv: divChapter4,
      location: {
        center: [
          -87.6345354327526, 41.87844060637044
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
      id: "209 West Jackson", 
      alignment: "right",
      hidden: false,
      title: "",
      image: "",
      description: "",
      chapterDiv: divChapter5,
      location: {
        center: [
          -87.63415273275267, 41.8778660410773
      ],
        zoom: 18,
        zoomSmall: 16,
        pitch: 34.5,
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
      id: "175 West Jackson", 
      alignment: "right",
      hidden: false,
      title: "",
      image: "",
      description: "",
      chapterDiv: divChapter6,
      location: {
        center: [
          -87.63321063275266, 41.87784860614844
      ],
        zoom: 17.27,
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
          duration: 300,
        },
      ],
      onChapterExit: [
        {
          layer: "overallMap",
          opacity: .5,
          duration: 1000,
        },
      ],
    },
    {
      id: "141 West Jackson (Board of Trade building)", 
      alignment: "right",
      hidden: false,
      title: "",
      image: "",
      description: "",
      chapterDiv: divChapter7,
      location: {
        center: [
          -87.63241173275266, 41.87801498289714
      ],
        zoom: 17.27,
        zoomSmall: 15,
        pitch: 34.5,
        bearing: .74,
      },
      mapAnimation: "flyTo",
      rotateAnimation: false,
      callback: "",
      onChapterEnter: [
        {
          layer: "overallMap",
          opacity: 1,
          duration: 1000,
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
      id: "111 West Jackson", 
      alignment: "right",
      hidden: false,
      title: "",
      image: "",
      description: "",
      chapterDiv: divChapter8,
      location: {
        center: [
          -87.63123527508087, 41.877800394499864
      ],
        zoom: 17.27,
        zoomSmall: 15,
        pitch: 34.5,
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
      id: "55 East Jackson", 
      alignment: "right",
      hidden: false,
      title: "",
      image: "",
      description: "",
      chapterDiv: divChapter9,
      location: {
        center: [
          -87.62546450391677, 41.877994894548436
      ],
        zoom: 16.27,
        zoomSmall: 15,
        pitch: 34.5,
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