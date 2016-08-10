var log = console.log;
function resizePlaceholder(card) {
  var imgHeight = card.find('.img').height();
  var topHeight = card.find('.card-top').height();
  card.find('.card-bottom .placeholder').height(imgHeight - topHeight);
}

function fits(card) {
  var outHeight = card.find('.content').first().height();
  var inHeight = card.find('.content-inner').first().height();
  return outHeight > inHeight;
}

function revealSentences(card) {
  var adding = true;
  var n = 0;
  while (adding) {
    n++;
    adding = false;
    var hidden = null;
    var added = 0;
    var removed = 0;
    var more = 0;

    hidden = card.find('.summary .sentence.hide').first();
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

    hidden = card.find('.temperment .sentence.hide').first();
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

  window.callPhantom('takeShot');
}

function getSections(card) {
  var domSections = card.find('.paragraphs').first().find('.section');
  var sections = [];
  domSections.each(function (index) {
    var section = {
      dom: domSections[index],
      available: true,
      visibleLines: 0,
      lines: [],
    };
    var domLines = $(section.dom).find('.sentence');
    domLines.each(function (lineIndex) {
      var line = {
        dom: domLines[lineIndex],
        visible: false,
        avaliable: true,
      };
      section.lines.push(line);
    });

    sections.push(section);
  });

  return sections;
}

function revealSectionSentences(card) {
  var sections = getSections(card);

  var working = true;
  while (working) {
    working = false;
    activeSections = 0;
    sections.forEach(function (section) {
      if (section.available && (activeSections < 2)) {
        section.active = true;
        activeSections++;
        $(section.dom).removeClass('hide');
        if (section.lines.length > 0) {
          var line = section.lines.shift();
          $(line.dom).removeClass('hide');
          section.visibleLines++;
          if (!fits(card)) {
            $(line.dom).addClass('hide');
            section.visibleLines--;
            section.available = false;
            section.active = false;
            activeSections--;
          }
        } else {
          section.available = false;
          section.active = false;
          activeSections--;
        }

        if (section.visibleLines === 0) {
          $(section.dom).addClass('hide');
        }
      }
    });

    if (activeSections > 0) {
      working = true;
    }

  }

  console.log(sections);
}

function startUp() {
  // $('body').css('background-color', 'red');
  var cardBacks = $('.card--back');
  $.each(cardBacks, function (key, value) {
    var card = $(value);
    resizePlaceholder(card);
    // revealSentences(card);
    revealSectionSentences(card);
  });

  console.log('ready!');
}

$(function () {
  // $(window).load(function () {
  startUp();
});
