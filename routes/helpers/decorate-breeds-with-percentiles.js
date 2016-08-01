function getPercentile(value, all) {
  if (!all.length) {
    return null;
  }

  let n = 1;
  let sum = 0;
  let count = 0;
  for (let x in all) {
    if (value === all[x]) {
      sum += n;
      count++;
    }

    n++;
  }

  let percentile = ((sum / count) - 1) / (all.length - 1);
  return percentile;
}

module.exports = function decorateBreedsWithPercentiles(breeds) {

  /*
  get percentiles for height, weight and lifeSpan, max, min and avg
  */
  let allHeights = [];
  let allWeights = [];
  let allLifeSpans = [];

  breeds.forEach(function (breed) {
    if (breed.height) {
      if (breed.height.result) {
        allHeights.push(breed.height.result.max);
        allHeights.push(breed.height.result.avg);
        allHeights.push(breed.height.result.min);
      }
    }

    if (breed.weight) {
      if (breed.weight.result) {
        allWeights.push(breed.weight.result.max);
        allWeights.push(breed.weight.result.avg);
        allWeights.push(breed.weight.result.min);
      }
    }

    if (breed.lifeSpan) {
      if (breed.lifeSpan.result) {
        allLifeSpans.push(breed.lifeSpan.result.max);
        allLifeSpans.push(breed.lifeSpan.result.avg);
        allLifeSpans.push(breed.lifeSpan.result.min);
      }
    }

  });

  allHeights.sort(function (a, b) {return a - b;});

  allWeights.sort(function (a, b) {return a - b;});

  allLifeSpans.sort(function (a, b) {return a - b;});

  breeds.forEach(function (breed, index) {
    if (breed.height) {
      if (breed.height.result) {
        breeds[index].height.percentile = {};
        breeds[index].height.percentile.max = getPercentile(breed.height.result.max, allHeights);
        breeds[index].height.percentile.avg = getPercentile(breed.height.result.avg, allHeights);
        breeds[index].height.percentile.min = getPercentile(breed.height.result.min, allHeights);
      }
    }

    if (breed.weight) {
      if (breed.weight.result) {
        breeds[index].weight.percentile = {};
        breeds[index].weight.percentile.max = getPercentile(breed.weight.result.max, allWeights);
        breeds[index].weight.percentile.avg = getPercentile(breed.weight.result.avg, allWeights);
        breeds[index].weight.percentile.min = getPercentile(breed.weight.result.min, allWeights);
      }
    }

    if (breed.lifeSpan) {
      if (breed.lifeSpan.result) {
        breeds[index].lifeSpan.percentile = {};
        breeds[index].lifeSpan.percentile.max = getPercentile(breed.lifeSpan.result.max, allLifeSpans);
        breeds[index].lifeSpan.percentile.avg = getPercentile(breed.lifeSpan.result.avg, allLifeSpans);
        breeds[index].lifeSpan.percentile.min = getPercentile(breed.lifeSpan.result.min, allLifeSpans);
      }
    }
  });

  return breeds;
};
