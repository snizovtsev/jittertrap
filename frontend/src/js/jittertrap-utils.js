/* count must be bytes, samplePeriod is microseconds */
var byteCountToKbpsRate = function(count) {
  'use strict';
  var rate = count / samplePeriod * 8000.0;
  return rate;
};

var packetDeltaToRate = function(count) {
  'use strict';
  return count * (1000000.0 / samplePeriod);
};

var updateStats = function (series) {
  'use strict';

  if (! series.filteredData || series.filteredData.length === 0) return;

  var sortedData = series.filteredData.slice(0);
  sortedData.sort(function(a,b) {return (a.y - b.y);});

  var maxY = sortedData[sortedData.length-1].y;
  var minY = sortedData[0].y;
  var median = sortedData[Math.floor(sortedData.length / 2.0)].y;
  var mean = 0;
  var sum = 0;
  for (var i = sortedData.length-1; i >=0; i--) {
    sum += sortedData[i].y;
  }
  mean = sum / sortedData.length;

  if (series.basicStats[0]) {
    series.basicStats[0].y = minY;
    series.basicStats[1].y = median;
    series.basicStats[2].y = mean;
    series.basicStats[3].y = maxY;
  } else {
    series.basicStats.push({x:1, y:minY, label:"Min"});
    series.basicStats.push({x:2, y:median, label:"Median"});
    series.basicStats.push({x:3, y:mean, label:"Mean"});
    series.basicStats.push({x:4, y:maxY, label:"Max"});
  }
};

var updateHistogram = function(series) {
  var binCnt = 25;
  var normBins = new Float32Array(binCnt);

  var sortedData = series.data.slice(0);
  sortedData.sort();

  var maxY = sortedData[sortedData.length-1];
  var minY = sortedData[0];
  var range = (maxY - minY) * 1.1;

  /* bins must use integer indexes, so we have to normalise the
    * data and then convert it back before display.
    * [0,1) falls into bin[0] */
  var i = 0;
  var j = 0;

  /* initialise the bins */
  for (; i < binCnt; i++) {
    normBins[i] = 0;
  }
  series.histData.length = 0;

  /* bin the normalized data */
  for (j = 0; j < series.data.size; j++) {
    var normY = (series.data.get(j) - minY) / range * binCnt;
    normBins[Math.round(normY)]++;
  }

  /* convert to logarithmic scale */
  for (i = 0; i < normBins.length; i++) {
    if (normBins[i] > 0) normBins[i] = Math.log(normBins[i]);
  }

  /* write the histogram x,y data */
  for (i = 0; i < binCnt; i++) {
    var xVal = Math.round(i * (maxY / binCnt));
    xVal += Math.round(minY);  /* shift x to match original y range */
    series.histData.push({x: xVal, y: normBins[i], label: xVal});
  }

};

var updateFilteredSeries = function (series) {

  /* FIXME: float vs integer is important here! */
  var decimationFactor = Math.floor(chartingPeriod / (samplePeriod / 1000.0));
  var fseriesLength = Math.floor(series.data.size / decimationFactor);

  // the downsampled data has to be scaled.
  var scale = 1/chartingPeriod;

  // how many filtered data points have been collected already?
  var filteredDataCount = series.filteredData.length;

  // if there isn't enough data for one filtered sample, return.
  if (fseriesLength === 0) {
    return;
  }

  // if the series is complete, expire the first value.
  if (filteredDataCount == fseriesLength) {
    series.filteredData.shift();
    filteredDataCount--;
  }

  // all the X values will be updated, but save the Y values.
  var filteredY = new Float32Array(fseriesLength);
  for (var i = filteredDataCount - 1; i >= 0; i--) {
    filteredY[i] = series.filteredData[i].y;
  }

  // now, discard all previous values, because all the X values will change.
  series.filteredData.length = 0;

  // calculate any/all missing Y values from raw data
  for (i = filteredDataCount; i < fseriesLength; i++) {
    filteredY[i] = 0.0;
    for (var j = 0; j < decimationFactor; j++) {
      var idx = i * decimationFactor + j;
      if (idx >= series.data.size) {
        break;
      }
      filteredY[i] += series.data.get(idx);
    }

    // scale the value to the correct range.
    filteredY[i] *= scale;
  }

  // finally, update the filteredData
  for (i = 0; i < fseriesLength; i++) {
    series.filteredData.push({x: i * chartingPeriod, y: filteredY[i]});
  }

};

var updateSeries = function (series, xVal, yVal, selectedSeries) {
  series.data.push(yVal);

  /* do expensive operations once per filtered sample/chartingPeriod. */
  if ((xVal % chartingPeriod === 0) && (series == selectedSeries)) {
    updateStats(series);
    updateHistogram(series);
    updateFilteredSeries(series);
  }
};