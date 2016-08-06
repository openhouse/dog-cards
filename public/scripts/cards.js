let { log } = console;
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

function revealSentences(card) {
  let adding = true;
  let n = 0;
  while (adding) {
    n++;
    adding = false;
    let hidden = null;
    let added = 0;
    let removed = 0;
    let more = 0;

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
}

function getSections(card) {
  let domSections = card.find('.paragraphs').first().find('.section');
  let sections = [];
  domSections.each(function (index) {
    let section = {
      dom: domSections[index],
      available: true,
      visibleLines: 0,
      lines: [],
    };
    let domLines = $(section.dom).find('.sentence');
    domLines.each(function (lineIndex) {
      let line = {
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
  let sections = getSections(card);

  let working = true;
  while (working) {
    working = false;
    activeSections = 0;
    sections.forEach(function (section) {
      if (section.available && (activeSections < 2)) {
        section.active = true;
        activeSections++;
        $(section.dom).removeClass('hide');
        if (section.lines.length > 0) {
          let line = section.lines.shift();
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

$(function () {
  let cardBacks = $('.card--back');
  $.each(cardBacks, function (key, value) {
    let card = $(value);
    resizePlaceholder(card);
    // revealSentences(card);
    revealSectionSentences(card);
  });

  console.log('ready!');
});
