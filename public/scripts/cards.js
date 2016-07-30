function resizePlaceholder(card) {
  let imgHeight = card.find('.img').height();
  let topHeight = card.find('.card-top').height();
  card.find('.card-bottom .placeholder').height(imgHeight - topHeight);
}

function fits(card) {
  let outHeight = card.find('.content').first().height();
  let inHeight = card.find('.content-inner').first().height();
  return outHeight > inHeight;
}

function revealSentances(card) {
  let adding = true;
  let n = 0;
  while (adding) {
    n++;
    adding = false;
    let hidden = null;
    let added = 0;
    let removed = 0;
    let more = 0;

    hidden = card.find('.summary .sentance.hide').first();
    if (hidden.text().trim().length > 0) {
      added++;
      hidden.removeClass('hide');
      if (!fits(card)) {
        hidden.addClass('hide');
        removed++;
      } else {
        more++;
      }
    }

    hidden = card.find('.temperment .sentance.hide').first();
    if (hidden.text().trim().length > 0) {
      added++;
      hidden.removeClass('hide');
      if (!fits(card)) {
        hidden.addClass('hide');
        removed++;
      } else {
        more++;
      }
    }

    if (added > 0) {
      if (added > removed) {
        if (more > 0) {
          adding = true;
        }
      }
    }
  }
}

$(function () {
  let cardBacks = $('.card--back');
  $.each(cardBacks, function (key, value) {
    let card = $(value);
    resizePlaceholder(card);
    revealSentances(card);
  });

  console.log(cardBacks);
  console.log('ready!');
});
