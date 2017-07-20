d3.selection.prototype.moveToFront = function() {
  return this.each(function(){
    this.parentNode.appendChild(this);
  });
};

(function() {

  var dispatch = d3.dispatch("load", "priceChange", "dateChange", "cityChange", "hoverCity", "unHoverCity", "adjustedValChange");

  var formatYear = d3.time.format("'%y"),
      format = d3.time.format("%m/%d/%y"),
      formatToMonth = d3.time.format("%B %Y"),
      formatPercent = d3.format(".1%"),
      formatVal = d3.format(".1f"),
      formatMonAbb = d3.time.format("%b. %Y"),
      formatMonAbb2 = d3.time.format("%b"),
      formatMonthOnly = d3.time.format("%b"),
      formatYearOnly = d3.time.format("%Y"),
      formatPercentChange = d3.format("+%"),
      formatChangeInWords = function (val) {
        var change =  100 - formatNumberWords(val);
        var str = change > 0 ? " percent less" : " percent more";
        if (change < 1 && change > -1 ) {
          return "about the same";
        };
        return (Math.abs(change) + str);
      },
      formatAxes = function(d) {
        var adj = d - 100;
        if (adj == 0) { return "Starting price"; }
        if (adj < 0) { return Math.abs(adj) + "% less"; }
        if (adj > 0) { return Math.abs(adj) + "% more"; }
      },
      formatNumberWords = d3.format("0f"),
      formatPercentChange2 = function(d) { return d / 100; },
      formatFullYear = d3.time.format("%Y"),
      nytMonths = {
        "Jan": "Jan.", "Feb": "Feb.", "Mar": "March", "Apr": "April", "May": "May", "Jun": "June",
        "Jul": "July", "Aug": "Aug.", "Sep": "Sept", "Oct": "Oct.", "Nov": "Nov.", "Dec": "Dec."
      };

  var defaultCity = "SPCS20R",
      currentCity,
      hoverCity,
      currentDateIndex,
      defaultDateIndex,
      currentPriceTier = "val";

  var cityNameByKey = {};

  var startWidth = innerWidth > 970 ? 950 : (innerWidth - 25);

  console.log("startWidth", startWidth);

  var margin = {top: 20, right: 10, bottom: 1, left: 0},
      width = startWidth - margin.left - margin.right,
      height = 500 - margin.top - margin.bottom;

  var maxDistanceFromLine = 30;

  var indexFromMouseX, x; // global because shared by slider and chart

  var nested; // main data

  queue()
      .defer(d3.csv, "./data/lookup2.csv")
      .defer(d3.csv, "./data/case-shiller-tiered2.csv")
      .await(dataLoaded);

  function dataLoaded(err, lookup, data) {


    console.log(lookup);
        console.log(data);

    data.forEach(function(d) {
      d.date = new Date(+d.year, +d.month -1, 1 )
      d.val = +d.val;
      d.high = +d.high;
      d.low = +d.low;
      d.mid = +d.mid;
    });

    lookup.forEach(function(d) {
      cityNameByKey[d.code] = d.city;
    });

    nested = d3.nest()
      .key(function(d) { return d.citycode; })
      .entries(data);

    defaultDateIndex = nested[0].values.length - 1 - 10 * 12;

    nested.forEach(function(city) {
      city.updatedMonth = city.values[nested[1].values.length-1].date;
      city.mostRecentValue = city.values[nested[1].values.length-1].val;
      city.maxVal = d3.max(city.values, function(d) { return d.val;});
      city.peakidx = city.values.map(function(d) { return d.val}).indexOf(city.maxVal);
      city.peakMonth = city.values.map(function(d) { return d.date})[city.peakidx];
      city.yearAgoDate = city.values[nested[1].values.length-13].date;
      city.yearAgoVal = city.values[nested[1].values.length-13].val;
      city.yearOnYearChange = (city.mostRecentValue - city.yearAgoVal) / city.yearAgoVal;
      city.changeFromPeak = (city.mostRecentValue - city.maxVal)/(city.maxVal);
      city.changeSinceBeginning = (city.mostRecentValue - city.values[0].val)/city.values[0].val;
      city.proper = cityNameByKey[city.key];
    });

    nested.sort(function(a,b) {
      return b.yearOnYearChange - a.yearOnYearChange;
    });

    indexFromMouseX = d3.scale.linear()
        .domain([0, width])
        .rangeRound([1, nested[1].values.length - 1])
        .clamp(true);

    x = d3.time.scale()
        .domain(d3.extent(nested[0].values, function(d) { return d.date; }))
        .range([0, width]);

    // Data events

    dispatch.on("dateChange.data", function(dateIndex) {
      currentDateIndex = dateIndex;
      nested.forEach(function(d) {
        d.values.forEach(function(j) {
          j.adjustedVal = 100 * (j[currentPriceTier] / d.values[currentDateIndex][currentPriceTier]);
        })
      });
      dispatch.adjustedValChange(nested);
    });

    dispatch.on("priceChange.data", function(priceTier) {
      // dispatch.adjustedValChange(nested);
    });

    dispatch.on("cityChange.data", function(cityKey) {
      currentCity = cityKey;
    });

    // Initialize

    dispatch.load(nested);
    dispatch.cityChange(defaultCity);
    dispatch.dateChange(0);

    d3.transition()
        .duration(1000)
        .ease("out")
        .tween("intro", function() {
          return function(t) {
            dispatch.dateChange(Math.round(t * defaultDateIndex))
          };
        });





  }


  //
  // City menu
  //
  dispatch.on("load.cityMenu", function(nested) {
    var data = nested.map(function(d) {
      return [(d.key == "SPCS20R" ? "a major city" : cityNameByKey[d.key]), d.key];
    }).sort();

    var menu = d3.select('.g-selector[data-key="city"]').append("select")
        .on("change", function(d) {
          dispatch.cityChange(this.value);
        });

    menu.selectAll("option")
        .data(data)
      .enter().append("option")
        .text(function(d) { return d[0]; })
        .attr("value", function(d) { return d[1]; });

    dispatch.on("cityChange.cityMenu", function(cityKey) {
      menu.property("value", cityKey);
    });

  });


  //
  // Date menu
  //
  dispatch.on("load.dateMenu", function(nested) {
    var data = nested[0].values.map(function(d, i) { return [formatMonAbb(d.date), i]; });

    var menu = d3.select(".g-selector[data-key='date']").append("select")
        .on("change", function(d) {
          dispatch.dateChange(this.value);
        });

      menu.selectAll("option")
        .data(data)
      .enter().append("option")
        .text(function(d) { return d[0]; })
        .attr("value", function(d) { return d[1]; });

    dispatch.on("dateChange.dateMenu", function(dateIndex) {
      menu.property("value", currentDateIndex);

    })
  });


  //
  // Price menu
  //
  // [["an average priced", "val"], ["a low priced", "low"], ["a medium priced", "mid"], ["a high priced", "high"]]
  // function selectPrice(priceKey) {
  //   if (currentPriceTier !== priceKey) {
  //     d3.select('.g-selector[data-key="price"] select').property("value", priceKey);
  //     currentPriceTier = priceKey;
  //     adjustData();
  //   }
  // }


  //
  // Slider
  //
  dispatch.on("load.dateSlider", function(nested) {
    var slider = d3.select(".g-chart").append("div")
        .attr("class", "g-slider")
        .style("width", width + "px")
        .style("margin-left", margin.left + "px");

    slider.append("div")
        .attr("class", "g-slider-tray")

    var sliderFill = slider.append("div")
        .attr("class", "g-slider-fill")

    var sliderHandle = slider.append("div")
        .attr("class", "g-slider-handle");

      sliderHandle.append("img")
        .attr("class", "g-slider-handle-icon")
        .attr("src", "https://static01.nyt.com/newsgraphics/2013/05/28/case-shiller/0182d2945ab676936a78237fa1d37875676cde2e/handle@2x.png");

    slider.call(d3.behavior.drag()
        .on("dragstart", function() {
          dispatch.dateChange(indexFromMouseX(d3.mouse(slider.node())[0]));
          d3.event.sourceEvent.preventDefault();
        })
        .on("drag", function() {
          var index = indexFromMouseX(d3.mouse(slider.node())[0]);
          if (currentDateIndex !== index) {
            currentDateIndex = index;
            dispatch.dateChange(index);
          }
        }));

    var currentMonth = slider.append("div")
        .classed("g-current-month", true);

    var mostRecentMonth = slider.append("div")
        .classed("g-most-recent-month", true)
        .html("...to <b>" + "June 2014" + "</b>");

    dispatch.on("dateChange.dateSlider", function(dateIndex) {
        var thisDate = nested[0].values[dateIndex].date,
            xPos = x(thisDate),
            newPos = Math.min(Math.max(xPos - 160, 0), width - 320);

        currentMonth
            .style("left",  newPos + "px")
            .html(function(d) {  return "Price changes from <b>" + nytMonths[formatMonAbb2(thisDate)] + " " +  formatYearOnly(thisDate) +  "</b>..." });

        sliderFill.style("width",  (width - x(thisDate)) + "px" );

        sliderHandle.style("left", xPos + "px")
    });
  });

  d3.select(window)
      .on("resize", resized);

  function resized() {


    if (innerWidth<=768) {
      d3.select(".g-yoy-chg").attr("colspan",1);
      d3.select(".g-peak-month-td").attr("colspan",1);
      d3.select(".g-change-since-selected").attr("colspan",1);
    }

    if (innerWidth>768) {
     d3.select(".g-yoy-chg").attr("colspan",2);
     d3.select(".g-peak-month-td").attr("colspan",2);
     d3.select(".g-change-since-selected").attr("colspan",2);

    };

  }

  resized();

  //
  // Chart
  //
  dispatch.on("load.chart", function(nested) {

    var y = d3.scale.log()
        .domain([35, 300])
        .range([height, 0]);

    var line = d3.svg.line()
        .x(function(d) { return x(d.date); })
        .y(function(d) { return y(d.adjustedVal); })
        .defined(function(d) { return !isNaN(d.adjustedVal); });

    var xAxis = d3.svg.axis()
        .scale(x)
        .orient("top")
        .ticks(d3.time.years)
        .tickSize(4)
        .tickPadding(2)
        .tickFormat(formatYear);

    var yAxis = d3.svg.axis()
        .scale(y)
        .orient("left")
        .ticks(7)
        .tickValues([35, 50, 75, 100, 150, 200, 250])
        .tickSize(-width - margin.left - margin.right)
        .tickFormat(formatAxes);

    var svg = d3.select(".g-chart").append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .attr("class", "g-svg")
      .append("g")
        .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

    svg.append("rect")
        .attr("class", "background")
        .attr("width", width)
        .attr("height", height);

    svg.append("g")
        .attr("class", "x axis")
        .attr("transform", "translate(0," + 5 + ")")
        .call(xAxis)
      .selectAll("g")
        .classed("minor", function(d, i) { return d.getFullYear() % 1; })
        .filter(".minor")
      .select("line")
        .attr("y2", 2);

        d3.selectAll(".x.axis text").attr("dy", 20)

    var linecontainer = svg.append("g")
        .classed("g-linecontainer", true);

    var screeny = svg.append("rect")
        .classed("g-screen", true)
        .attr("width", 0)
        .attr("height", height)
        .attr("x", 0 - margin.left);

    var yAxisMarker = svg.append("g")
        .attr("class", "y axis")
        .attr("transform", "translate(" + (0) + ",0)")
        .call(yAxis)
      .selectAll("g")
      .classed("minor", true)
        .classed("g-baseline", function(d) { return d == 100 })
      .select("text")
        .attr("x", 30)
        .attr("y", -5)
        .attr("dy", null);

    var lines = linecontainer.selectAll("path")
        .data(nested)
      .enter().append("path")
        .attr("class", (function(d) { return ( "g-city-line " + d.key)}) )
        .classed("g-highlight-line", function(d,i) { return d.key == currentCity});

    var hoverbar = svg.append("rect")
        .classed("g-hover-bar", true)
        .attr("width", 2)
        .attr("height", height + 2)
        .attr("x", 0 - margin.left)
        .attr("y", -2);

    var focus = svg.append("g")
        .attr("class", "focus")
        .attr("transform", "translate(" + x(nested[0].values[0].date) + ", " + y(100) + ")")

    focus.append("circle")
        .attr("r", 5)

    focus.append("text")
        .attr("x", 9)
        .attr("dy", ".35em");

    var endpoint = svg.append("g")
        .attr("class", "g-endpoint")
        .attr("transform", "translate(" + x(nested[0].values[nested[0].values.length-1].date) + ", " + y(100) + ")")

    endpoint.append("circle")
        .attr("r", 5);

    var endpointLabel = endpoint.append("text")
        .classed("g-end-label g-selected-city-endpoint-label", true)
        .attr("y", -30)
        .attr("x", - 0)
        .text("U.S. 20-city index")

    endpoint.append("text")
        .classed("g-end-label g-selected-city-endpoint-value", true)
        .attr("y", -10)
        .attr("x", - 0)
        .text("+12%");

        // d3.select(window)
        //     .on("resize", resized);

        // function resized() {
        //   width = innerWidth - 40 - margin.left - margin.right;

        //   var dispatch = d3.dispatch("load", "priceChange", "dateChange", "cityChange", "hoverCity", "unHoverCity", "adjustedValChange");


        //   // console.log("dvg", svg);

        //   // console.log("innerWidth", innerWidth);
        //   svg.attr("width", width + margin.left + margin.right);
        //        x.range([0, width]);



        // }

    // Dispatches

    dispatch.on("dateChange.chart", function(dateIndex) {
      var thisDate = nested[0].values[currentDateIndex].date,
          xPos = x(thisDate),
          newPos = xPos < 100 ? 60 : (xPos - 40);

      focus.attr("transform", "translate(" + (xPos - 2) + "," + y(100) + ")");

      d3.selectAll(".y.axis .tick.minor text")
        .attr("transform", "translate(" + newPos + ",0)")

      d3.select(".g-date-compare")
          .text(function(d) { return ("Since " + nytMonths[formatMonthOnly(thisDate)] + " " + formatYearOnly(thisDate))})

      d3.select(".g-screen").attr("width", xPos + 10 );

      d3.select(".g-hover-bar").attr("x", xPos - 2 );

    });

    dispatch.on("adjustedValChange.chart", function(nested) {
      lines.attr("d", function(d) { return line(d.values); } );
      updateLabel();
    });

    dispatch.on("cityChange.chart", function(cityKey) {
      lines.classed("g-highlight-line", function(d) { return d.key == cityKey; });
      d3.select("." + cityKey).moveToFront();
      endpointLabel.text(cityNameByKey[cityKey]);
      updateLabel();

    });

    dispatch.on("hoverCity.chart", function(cityKey) {
      lines.classed("g-hover-line", function(d) { return d.key == cityKey; });
    });

    dispatch.on("unHoverCity.chart", function(cityKey) {
      lines.classed("g-hover-line", false);
    });

    // Mouse events

    svg.on("mousemove", function() {
          // TODO make this fire less often
          var closest = getClosestCity(d3.mouse(svg.node()));
          if (closest[1] < maxDistanceFromLine) {
            dispatch.hoverCity(closest[0]);
            updateTooltip(closest);
            svg.style("cursor", "pointer")
          } else {
            dispatch.unHoverCity();
            hideTooltip();
            svg.style("cursor", "inherit")
          }
        })
        .on("mouseout", function() {
          dispatch.unHoverCity();
          hideTooltip();
        })
        .on("click", function(d) {
          var closest = getClosestCity(d3.mouse(svg.node()));
          if (closest[1] < maxDistanceFromLine) dispatch.cityChange(closest[0])
          else dispatch.cityChange(defaultCity)
        });

    function getClosestCity(m) {
      var dateIndex = indexFromMouseX(m[0]),
          pct = y.invert(m[1]);

      var closestDifference = Infinity,
          closestCityIndex = -1,
          currentDifference;

      nested.forEach(function(d, i) {
        currentDifference = Math.abs(pct - d.values[dateIndex].adjustedVal);
        if (currentDifference < closestDifference) {
          closestDifference = currentDifference;
          closestCityIndex = i;
        }
      });

      return [nested[closestCityIndex].key, closestDifference];
    }

    function updateTooltip(closest) {
      var m = d3.mouse(svg.node()),
          cityKey = closest[0];
      d3.select(".g-tooltip")
          .classed("g-hovering-tooltip", true)
          .style("left", m[0] + "px")
          .style("top", m[1] + 70 + "px")
          .text(cityNameByKey[cityKey]);
    }

    function hideTooltip() {
      d3.select(".g-tooltip")
          .classed("g-hovering-tooltip", false)
    }

    function updateLabel() {
      var obj = nested.filter(function(d) { return d.key == currentCity; })[0];
      var lastVal = obj.values[obj.values.length-1].adjustedVal;
      d3.select(".g-answer").text(formatChangeInWords(lastVal));
      d3.select(".g-selected-city-endpoint-value").text(formatChangeInWords(lastVal))
      d3.select(".g-endpoint").attr("transform", "translate(" + x(obj.values[obj.values.length - 1].date) + ","+ y(lastVal)+")" );
    }

  });

  //
  // Table
  //
  dispatch.on("load.table", function(nested) {

    var barScale = d3.scale.linear()
        .range([0,75])
        .domain([0,75]);

    var rows = d3.select(".g-table").selectAll(".table-row")
        .data(nested)
      .enter()
        .append("tr")
        .attr("class", function(d) { return "g-table-row " + d.key + "-row"; })
        .classed("g-selected-row", function(d) { return d.key == "SPCSIND20"});

    var cityNames = rows.append("td")
        .text(function(d) { return d.proper; })
        .classed("g-proper-city", true);

    var yearlyChange = rows.append("td")
        .classed("g-num-td", true)
        .text(function(d) { return formatPercentChange(d.yearOnYearChange); });

    var yearlyChangeBarTd = rows.append("td")
        .classed("g-bar-td", true);

    var yearChangeBarContainer = yearlyChangeBarTd.append("div")
        .classed("g-bar-container", true);

    var changeBar = yearChangeBarContainer.append("div")
        .classed("g-yoy-bar", true)
        .style("width", function(d) {
          var chg = 100 * d.yearOnYearChange;
          return Math.abs(barScale(chg)).toString() + "px";
        })
        .style("left", function(d) {
          var chg = 100 * d.yearOnYearChange;
          if (chg<0) {
            var nudge = Math.abs(barScale(chg));
            return (barScale.domain()[1] - nudge).toString() + "px";
          }
          else {
            return barScale.domain()[1].toString() + "px";
          }
        });

    var zeroMarker3 = yearChangeBarContainer.append("div")
        .classed("g-zeromarker", true)
        .style("left", barScale.domain()[1] + "px");

    var peakMonthTd = rows.append("td")
        .classed("g-num-td", true)
        .text(function(d) {
          return formatPercentChange(d.changeFromPeak);
        });

    var peakMonthBarTd = rows.append("td")
        .classed("g-bar-td", true);

    var peakMonthBarContainer = peakMonthBarTd.append("div")
        .classed("g-bar-container", true);

    var changeBar = peakMonthBarContainer.append("div")
        .classed("g-yoy-bar", true)
        .style("width", function(d) {
           var chg = 100 * d.changeFromPeak;
           return Math.abs(barScale(chg)).toString() + "px";
        })
        .style("left", function(d) {
            var chg = 100 * d.changeFromPeak;
          if (chg < 0) {
            var nudge = Math.abs(barScale(chg));
            return (barScale.domain()[1] - nudge).toString() + "px";
          }
          else {
            return barScale.domain()[1].toString() + "px";
          }
        });

    var zeroMarker2 = peakMonthBarContainer.append("div")
        .classed("g-zeromarker", true)
        .style("left", barScale.domain()[1] + "px");

    var changeSinceSelectedTd = rows.append("td")
        .classed("g-change-since-selected-td g-num-td", true);

    var changeSelectedBarTD = rows.append("td")
        .classed("g-live-change-bar-td", true);

    var liveBarContainer = changeSelectedBarTD.append("div")
        .classed("g-live-bar-container", true);

    var liveChangeBar = liveBarContainer.append("div")
        .classed("g-live-bar", true);

    var zeroMarker = liveBarContainer.append("div")
        .classed("g-zeromarker", true)
        .style("left", barScale.domain()[1] + "px");

    rows.on("click", function(d) {
          dispatch.cityChange(d.key);
        })
        .on("mouseover", function(d) {
          dispatch.hoverCity(d.key);
        })
        .on("mouseout", function(d) {
          dispatch.unHoverCity(d.key);
        });

    // Dispatches

    dispatch.on("hoverCity.table", function(cityKey) {
      rows.classed("g-hover-row", function(d) { return d.key == cityKey; });
    });

    dispatch.on("unHoverCity.table", function(cityKey) {
      d3.selectAll(".g-hover-row").classed("g-hover-row", false);
    });

    dispatch.on("cityChange.table", function(cityKey) {
      rows.classed("g-selected-row", function(d) { return d.key == cityKey; });
    });

    dispatch.on("dateChange.table", function(dateIndex) {
      changeSinceSelectedTd
          .text(function(d) {
            var current = d.values[d.values.length-1].val,
                compareVal = d.values[currentDateIndex].val,
                chg = (current - compareVal ) / compareVal;
            return formatPercentChange(chg);
          });

      var thisCityObj = nested.filter(function(d) { return d.key == currentCity; })[0];

      d3.selectAll(".g-live-bar")
          .style("width", function(d) {
              var current = d.values[d.values.length-1].val
              var compareVal = d.values[currentDateIndex].val;
              var chg = 100 * (current - compareVal ) / compareVal;
              return Math.abs(barScale(chg)).toString() + "px";
          })
          .style("left", function(d) {
            var current = d.values[d.values.length-1].val
            var compareVal = d.values[currentDateIndex].val;
            var chg = 100 * (current - compareVal ) / compareVal;

            if (chg < 0) {
              var nudge = Math.abs(barScale(chg));
              return (barScale.domain()[1] - nudge).toString() + "px";
              // what fraction of the width in pixels is this?
              var nudge = starterBarWidth * Math.abs(chg)/100;
              return (starterBarWidth - nudge).toString() + "px";
            }
            else {
              return barScale.domain()[1].toString() + "px";
            }
         });

    });



  });

})()
