/* Copyright 2002-2015 MarkLogic Corporation.  All Rights Reserved. */

/*jslint node: true */
/* global $ */
/* global CodeMirror */
/* global React */
/* global document */
/* global window */
/* global LOG */
'use strict';

var breadcrumbNode = null;
var functionPageBucketId = null;
var isUserGuide = null;
var previousFilterText = '';
var tocSectionLinkSelector = null;
var tocSelect = null;

// account for hidden content when scolling
var tocPageHeaderHeightPX = 71; // in CSS for #content
var tocHiddenExtraPX = 120;
var tocHeaderHeightPX = 165; // in CSS for .scrollable_section

$(function() {
  // When the DOM is ready, load the TOC into the TOC div.
  // Then finish with toc_init.
  $('#apidoc_toc').load($("#toc_url").val(), null, toc_init);

  colorizeExamples();

  // Don't use pjax on pdf, zip files, and printer-friendly links
  var selector = "#page_content .pjax_enabled" +
      " a:not(a[href$='.pdf'],a[href$='.zip'],a[target='_blank'])";
  $(selector).pjax({
    container: '#page_content',
    timeout: 4000,
    success: function() {
      // Update view when the pjax call originated from a link in the body
      LOG.debug("pjax_enabled A fired ok", this);
      // The tocSectionLinkSelector may have changed.
      toc_init_globals();
      // The TOC filter may need updating.
      tocFilterUpdate();
      updateTocForSelection(); } });

  $("#api_sub .pjax_enabled a:not(.external)").pjax({
    container: '#page_content',
    timeout: 4000,
    success: function() {
      // Update view when a TOC link was clicked
      LOG.debug("pjax_enabled B fired ok"); } });

  // Ensure that non-fragment TOC links highlight appropriate TOC links.
  $(document).on('pjax:end', function(event, options) {
    var target = $(event.relatedTarget);
    //LOG.debug("pjax:end", event, options, target);
    if (target.parents("#api_sub").length) {
      LOG.debug("Calling showInTOC via pjax:end handler.", target[0]);
      showInTOC(target); }});

  breadcrumbNode = $("#breadcrumbDynamic");
  if (!breadcrumbNode.length) LOG.warn("No breadcrumb!");

  toc_init_globals();
});

function toc_init_globals() {
  LOG.debug("toc_init_globals");

  // Initialize values from page.xsl content.
  functionPageBucketId = $("#functionPageBucketId");
  if (!functionPageBucketId.length) LOG.warn(
    "No functionPageBucketId!");
  functionPageBucketId = functionPageBucketId.val();

  isUserGuide = $("#isUserGuide");
  if (!isUserGuide.length) LOG.warn(
    "No isUserGuide!");
  isUserGuide = isUserGuide.val() === "true";

  tocSectionLinkSelector = $("#tocSectionLinkSelector");
  if (!tocSectionLinkSelector.length) LOG.warn(
    "No tocSectionLinkSelector!");
  tocSectionLinkSelector = tocSectionLinkSelector.val();
}

function toc_init() {
  LOG.debug("toc_init");

  // This widget comes with the toc root via ajax, so init it here.
  var treeGlobal = $('#treeglobal');
  if (!treeGlobal.length) LOG.warn("No treeglobal!");
  treeGlobal.show();
  treeGlobal.click(function(e) {
    var n = treeGlobal.children("span");
    var label = n.children("span");
    var isExpand = label.text().trim() === "expand";
    // expand or collaps all
    var tree = $(".apidoc_tree:visible");
    if (isExpand) {
      label.text("collapse");
      expandAll(tree);
    } else {
      label.text("expand");
      collapseAll(tree);
    }
  });

  // Set up tree view select widget.
  var tocPartsDir = $("#tocPartsDir").text();
  tocSelect = $("#toc_select");
  if (!tocSelect) LOG.warn("No tocSelect!");

  var tocTrees = $(".treeview");
  if (!tocTrees) LOG.warn("No tocTrees!");
  // Be careful to init each tree individually, and only once!
  tocTrees.each(function(index, n) {
    $(n).treeview({
      prerendered: true,
      url: tocPartsDir }); });

  // Set up the select widget
  tocSelect.change(function(e) {
    LOG.debug('TOC select option changed');
    // Hide the old TOC tree.
    $(".apidoc_tree:visible").hide();
    // Show the corresponding TOC tree.
    var n = tocSelect.children("option").filter(":selected");
    if (n.length === 0) LOG.warn("tocSelect nothing selected!", n);
    if (n.length != 1) {
      LOG.warn("tocSelect multiple selected!", n);
      // Continue with the first one.
      n = n.first();
    }

    var id = n.val();
    LOG.debug("TOC select option changed to", n.val());
    var tree = $('#' + id);
    tree.show();

    tocFilterUpdate();
  });

  // Set up the filter
  var filterDelay = 750;
  $("#config-filter").keyup(function(e) {
    // clear any existing idle timer
    clearTimeout($.data(this, 'timer'));
    var filter = $(this);
    var currentFilterText = filter.val();
    LOG.debug("config-filter not idle",
              new Date(), currentFilterText);
    // delay any work until idle
    $.data(this, 'timer', setTimeout(function() {
      LOG.debug("config-filter idle",
                new Date(), currentFilterText);

      // TODO what about a confirmation alert?
      if (e.which == 13) // Enter key pressed
        window.location = "/do-do-search?api=1" +
        "&v=" + $("input[name = 'v']").val() +
        "&q=" + currentFilterText;

      var closeButton = $("#config-filter-close-button");
      if (currentFilterText === "") closeButton.hide();
      else closeButton.show();

      setTimeout(function() {
        if (previousFilterText !== currentFilterText) {
          //LOG.debug("toc filter event", currentFilterText);
          previousFilterText = currentFilterText;
          // The current TOC tree root should be visible.
          filterConfigDetails(currentFilterText,
                              ".apidoc_tree:visible"); } },
                 350); },
                                     filterDelay));
  });

  $("#config-filter-close-button").click(function() {
    LOG.debug("config-filter-close-button");
    $(this).hide();
    // simulate keyup
    $("#config-filter").val("").trigger('keyup').blur();
  });

  // default text, style, etc.
  formatFilterBoxes($(".config-filter"));

  $('#splitter')
    .attr({'unselectable': 'on'})
    .css({
      "z-index": 100,
      cursor: "e-resize",
      position: "absolute",
      "user-select": "none",
      "-webkit-user-select": "none",
      "-khtml-user-select": "none",
      "-moz-user-select": "none"
    })
    .mousedown(splitterMouseDown);

  // If this was a deep link, load and scroll.
  updateTocForSelection();
}

// This logic is essentially duplicated from the treeview plugin...bad, I know
function toggleSubTree(li, oldState, newState, oldLastState, newLastState) {
  if (!li.children().is("ul")) return;

  li.removeClass(oldState).addClass(newState);
  if (li.is("." + oldLastState)) li.removeClass(oldLastState)
    .addClass(newLastState);

  li.children("div").removeClass(oldState + "-hitarea")
    .addClass(newState + "-hitarea");

  if (li.is("." + oldLastState + "-hitarea")) li.children("div")
    .removeClass(oldLastState + "-hitarea")
    .addClass(newLastState + "-hitarea");

  li.children("ul").css("display",
                        (newState == "collapsible" ? "block" : "none"));
}

function expandSubTree(li) {
  toggleSubTree(li, "expandable", "collapsible",
                "lastExpandable", "lastCollapsible");
}

function collapseSubTree(li) {
  toggleSubTree(li, "collapsible", "expandable",
                "lastCollapsible", "lastExpandable");
}

/* These functions implement the expand/collapse buttons */
function shallowExpandAll(ul) {
  ul.children("li").each(function(index) {
    loadTocSection(index, this);
    expandSubTree($(this));
  });
}

function shallowCollapseAll(ul) {
  ul.children("li").each(function(index) {
    collapseSubTree($(this));
  });
}

function expandAll(ul) {
  shallowExpandAll(ul);
  if (ul.children("li").children().is("ul"))
    ul.children("li").children("ul").each(function() {
      expandAll($(this));
    });
}

function collapseAll(ul) {
  shallowCollapseAll(ul);
  if (ul.children("li").children().is("ul"))
    ul.children("li").children("ul").each(function() {
      collapseAll($(this));
    });
}

function filterConfigDetails(filterText, treeSelector) {
  LOG.debug("filterConfigDetails", filterText, treeSelector);
  var tocRoot = $(treeSelector);
  if (filterText) loadAllSubSections(tocRoot);

  if (tocRoot.hasClass("fullyLoaded")) searchTOC(filterText, tocRoot);
  else waitToSearch(filterText, tocRoot);

  if (filterText) expandSubTree(tocRoot.children("li"));
}

var waitToSearch = function(text, tocRoot) {
  // Repeatedly check for the absence of the "placeholder" class
  // Once they're all gone, run the text search and cancel the timeout
  var placeholders = tocRoot.find(".placeholder");
  if (placeholders.size() === 0) {
    tocRoot.addClass("fullyLoaded");
    searchTOC(text, tocRoot);
    clearTimeout(waitToSearch);
  }
  else setTimeout(function(){ waitToSearch(text, tocRoot); },
                  350);
};

function searchTOC(filter, tocRoot) {
  tocRoot.find("li").each(function() {
    $(this).removeClass("hide-detail");
    $(this).find(">a >.function_count").show();
    if (filter !== '') {
      if (hasText($(this),filter)) {
        // Expand the TOC sub-tree
        expandSubTree($(this));
        $(this).find(">a >.function_count").hide();
      } else {
        $(this).addClass("hide-detail");
      }
    }
  });
  // re-orient the TOC after done searching
  if (filter === '') scrollTOC();
}

function loadAllSubSections(tocRoot) {
  //LOG.debug('loadAllSubSections', tocRoot);
  if (tocRoot.hasClass("startedLoading")) return;

  tocRoot.find(".hasChildren").each(loadTocSection);
  tocRoot.addClass("startedLoading");
}

// We may ignore index, but it's necessary as part of the signature expected by .each()
function loadTocSection(index, tocSection) {
  var $tocSection = $(tocSection);
  LOG.debug("loadTocSection", index, $tocSection.length,
            $tocSection.hasClass("hasChildren"));
  if (!$tocSection.hasClass("hasChildren")) {
    LOG.debug("loadTocSection: no children");
    return;
  }

  $tocSection.find(".hitarea").trigger("click");
}

// Called only from updateTocForSelection
function waitToShowInTOC(tocSection, sleepMillis) {
  LOG.debug("waitToShowInTOC", tocSection[0].id, sleepMillis);
  if (!sleepMillis) sleepMillis = 125;

  // Repeatedly check to see if the TOC section has finished loading
  // Once it has, highlight the current page
  if (! tocSection.hasClass("loaded")) {
    LOG.debug("waitToShowInTOC still waiting for",
              tocSection[0].id, sleepMillis);
    // back off and retry
    setTimeout(function(){
      waitToShowInTOC(tocSection, 2 * sleepMillis); },
               sleepMillis);
    return;
  }

  LOG.debug("waitToShowInTOC loaded", tocSection);

  clearTimeout(waitToShowInTOC);

  // Do not include query string. Do not include fragment.
  var locationHref = window.location.protocol +
      '//' + window.location.host + window.location.pathname;
  locationHref = locationHref.toLowerCase();
  //LOG.debug("waitToShowInTOC", "locationHref=" + locationHref);
  var stripChapterFragment = isUserGuide && locationHref.indexOf("#") == -1;
  var stripMessage = isUserGuide && locationHref.indexOf('/messages/') != -1;

  // TODO needs special handling for /7.0/fn:abs vs /fn:abs ?

  //LOG.debug("waitToShowInTOC", "stripMessage=" + stripMessage,
  //            "locationHref=" + locationHref);
  if (stripMessage) locationHref = locationHref.replace(
      /\/messages\/[a-z]+-[a-z]+\/[a-z]+-[a-z]+$/,
    '/guide/messages');

  //LOG.debug("waitToShowInTOC", "locationHref=" + locationHref);
  // The TOC locations are a little inconsistent,
  // so look for the href with and without a version prefix.
  var locationHrefNoVersion = locationHref.replace(
      /\/(\d+\.\d+)\//,
    '/');
  if (locationHref == locationHrefNoVersion) locationHrefNoVersion = null;

  LOG.debug("waitToShowInTOC filtering for",
            locationHref, locationHrefNoVersion);
  var current = tocSection.find("a").filter(function() {
    // TODO can we stop this after the first match?
    var thisHref = this.href.toLowerCase();
    var hrefToCompare = stripChapterFragment ?
        thisHref.replace(/#chapter/,"") :
        thisHref;
    var result = hrefToCompare == locationHref ||
        (locationHrefNoVersion &&
         hrefToCompare == locationHrefNoVersion);
    //LOG.debug("filtering", thisHref, hrefToCompare, locationHref, result);
    return result;
  });

  // E.g., when hitting the Back button and reaching "All functions"
  $("#api_sub a.selected").removeClass("selected");

  LOG.debug("waitToShowInTOC found", current.length);
  if (current.length) showInTOC(current);

  // Also show the currentPage link (possibly distinct from guide fragment link)
  $("#api_sub a.currentPage").removeClass("currentPage");
  $("#api_sub a[href='" + window.location.pathname + "']")
    .addClass("currentPage");

  // Fallback in case a bad fragment ID was requested
  if ($("#api_sub a.selected").length === 0) {
    LOG.debug("waitToShowInTOC: no selection. Calling showInTOC as fallback.");
    showInTOC($("#api_sub a.currentPage"));
  }
}

// Called via (edited) pjax module on popstate
function updateTocForUrlFragment(pathname, hash) {
  LOG.debug('updateTocForUrlFragment', pathname, hash, isUserGuide);

  // Only use the fragment part to user guide sections.
  // Otherwise use the pathname alone, for functions etc.
  var effective_hash;
  if (!isUserGuide) effective_hash = "";
  else if (hash === "") effective_hash = "#chapter";
  else effective_hash = hash;

  // IE doesn't include the "/" at the beginning of the pathname...
  var fullLink = (pathname.indexOf("/") === 0 ? pathname :
                  "/" + pathname) + effective_hash;

  LOG.debug("updateTocForUrlFragment fullLink", fullLink);
  showInTOC($("#api_sub a[href='" + fullLink + "']"));
}

// Expands and loads (if necessary) the part of the TOC containing the given link
// Also highlights the given link
// Called whenever TOC selection changes.
function showInTOC(a) {
  LOG.debug("showInTOC", 'link', a.length, 'parent', a.parent().length);
  $("#api_sub a.selected").removeClass("selected");
  // e.g., arriving via back button
  $("#api_sub a.currentPage").removeClass("currentPage");

  if (a.length === 0) {
    // This is harmless.
    LOG.debug("showInTOC: no link");
    return;
  }
  // This should not happen, but control the damage.
  if (a.length > 1) {
    LOG.debug("showInTOC: multiple links, using first", a);
    a = a.slice(0, 1);
  }

  // If there is a different TOC section visible, hide it.
  var treeVisible = $(".apidoc_tree:visible");
  var treeForA = a.parents(".apidoc_tree");
  LOG.debug("showInTOC",
            "visible", treeVisible.attr('id'),
            "a", treeForA.attr('id'));
  if (treeForA.length === 1 &&
      treeForA.attr('id') != treeVisible.attr('id')) {
    treeVisible.hide();
    // Update the selector to match.
    var options = tocSelect.children("option");
    //LOG.debug(options.filter(":selected"));
    options.filter(":selected").removeAttr('selected');
    var id = treeForA.attr('id');
    var selector = "[value='" + id + "']";
    //LOG.debug(options.filter(selector));
    options.filter(selector).attr('selected', 'true');
  }

  // Climb up to the section level.
  var li = a.parent().parent().parent();
  updateBreadcrumb(li);

  var items = a.addClass("selected").parents("ul, li").add(
    a.nextAll("ul")).show();

  // If this is a TOC section that needs loading, then load it
  // e.g., when PJAX is enabled and the user clicks the link
  loadTocSection(0, a.parent());

  items.each(function(index) { expandSubTree($(this)); });

  scrollTOC();
}

function breadcrumbChrome() {
  // Must create a new text node for each call.
  return document.createTextNode(' > ');
}

function breadcrumbBuilder(results, n) {
  var stage;
  var text;
  var links = n.children('a');
  if (links.length) {
    // Link to appropriate level.
    stage = $('<a>').attr('href', links.attr('href'));
    text = links.contents()[0];
  } else {
    // Display only, not linkable.
    stage = $('<span>');
    text = n.children("span").contents()[0];
  }
  //LOG.debug('breadcrumbBuilder', stage, text);
  // Halt recursion if we did not find anything.
  if (!text) {
    LOG.debug('breadcrumbBuilder: no text found', results.length);
    return results;
  }

  text = text.data.replace(/[:\.]$/, '').replace(/\s+\(\d+\)/, "");
  //LOG.debug('breadcrumbBuilder', n[0], text);
  stage.text(text);
  results = results.concat(stage[0]).concat(breadcrumbChrome());
  //LOG.debug('breadcrumbBuilder', text, results.length);

  // Climb the tree to the next li, if there is one.
  // The immediate parent should be a ul.
  var parent = n.parent().parent().filter("li");
  if (!parent.length) {
    //LOG.debug('breadcrumbBuilder: no parent found', results.length);
    // This must be the top. Add a label for it and halt.
    return results.concat(
      document.createTextNode(
        tocSelect.children("option:selected").text()))
      .concat(breadcrumbChrome());
  }

  // recurse
  return breadcrumbBuilder(results, parent);
}

function updateBreadcrumb(n)
{
  //LOG.debug('updating breadcrumb', n.length ? n[0] : null);
  breadcrumbNode.empty();
  var breadcrumb = breadcrumbBuilder([], n).reverse();
  //LOG.debug('updating breadcrumb', breadcrumb);
  if (!breadcrumb || !breadcrumb.length) return;
  breadcrumbNode.append(breadcrumb);
}

// Called at init and whenever TOC selection changes.
function updateTocForSelection() {
  LOG.debug("updateTocForSelection",
            "functionPageBucketId", functionPageBucketId,
            "tocSectionLinkSelector", tocSectionLinkSelector);

  if (!tocSectionLinkSelector) {
    LOG.debug('no tocSectionLinkSelector!');
    return;
  }

  LOG.debug("updateTocForSelection tocSectionLinkSelector",
            tocSectionLinkSelector);
  var tocSectionLink = $(tocSectionLinkSelector);
  var tocSection = tocSectionLink.parent();
  if (0 === tocSection.length) {
    LOG.warn("updateTocForSelection",
             functionPageBucketId, tocSectionLinkSelector,
             "nothing selected!");
    return;
  }
  if (1 != tocSection.length) {
    LOG.warn("updateTocForSelection",
             functionPageBucketId, tocSectionLinkSelector,
             "multiple selected!", tocSection);
    // Continue with the first one.
    tocSection = tocSection.first();
  }

  updateBreadcrumb(tocSection);

  LOG.debug("updateTocForSelection loading to", tocSection);
  loadTocSection(0, tocSection);
  waitToShowInTOC(tocSection);
}

// Called from pjax event handlers
function tocUpdateFromPageContent() {
  LOG.debug("tocUpdateFromPageContent");
  updateTocForSelection();
}

function hasText(item,text) {
  var fieldTxt = item.text().toLowerCase();
  return (fieldTxt.indexOf(text.toLowerCase()) !== -1);
}

function addHighlightToText(element,filter) {
  removeHighlightToText(element);
  element.find('a').each(function(){
    var elemHTML = $(this).html();
    elemHTML = elemHTML.replace(new RegExp(filter, 'g'),'<span class="toc_highlight">' + filter + '</span>');
    $(this).html(elemHTML);
  });

}

function removeHighlightToText(element) {
  var elemHTML = element.html();
  element.find('.toc_highlight').each(function() {
    var pureText = $(this).text();
    elemHTML = elemHTML.replace(new RegExp('<span class="toc_highlight">' + pureText + '</span>', 'g'),pureText);
    element.html(elemHTML);
  });
}

// called from hacked pjax script
function scrollContent(container, target) {
  var scrollTo = target.offset().top - tocPageHeaderHeightPX;
  container.scrollTop(scrollTo);
}

function scrollTOC() {
  //LOG.debug("scrollTOC");
  var scrollTo = $('#api_sub a.selected').filter(':visible');
  LOG.debug("scrollTOC scrollTo", scrollTo.length);
  scrollTo.each(function() {
    var scrollableContainer = $(this).parents('.scrollable_section');
    //LOG.debug("scrollTOC", scrollableContainer);
    var container = $(this).parents('.treeview'),
        currentTop = container.scrollTop(),
        scrollTarget = currentTop + $(this).offset().top,
        scrollTargetAdjusted = scrollTarget - tocHeaderHeightPX - tocHiddenExtraPX,
        minimumSpaceAtBottom = 10,
        minimumSpaceAtTop = 10;

    var marginTop = currentTop + tocHeaderHeightPX + minimumSpaceAtTop;
    var marginBottom = currentTop + (
      container.height() - minimumSpaceAtBottom) ;
    container.animate({scrollTop: scrollTargetAdjusted}, 500);
  });
}


function colorizeExamples() {
  $('#main div.example pre').each(function(i, me) {
    var editor = new CodeMirror(CodeMirror.replace(this), {
      path: "/js/CodeMirror-0.94/js/",
      parserfile: ["../contrib/xquery/js/tokenizexquery.js",
                   "../contrib/xquery/js/parsexquery.js"],
      height: "dynamic",
      stylesheet: "/js/CodeMirror-0.94/contrib/xquery/css/xqcolors.css",
      readOnly: true,
      lineNumbers: false,
      content: $(this).text()
    });
  });
}

function formatFilterBoxes(filterBoxes) {
  var defaultFilterMsg = "Type to filter TOC...";
  filterBoxes.each(function() {
    // set the default message
    $(this).defaultvalue(defaultFilterMsg);
    // set the style
    if ($(this).val() == defaultFilterMsg) { $(this).addClass("default"); }
  });

  // set and remove the style based on user interaction
  filterBoxes.focus(function() {$(this).removeClass("default");} );
  filterBoxes.blur(function() {
    if ($(this).val() == defaultFilterMsg ||
        $(this).val() === "")
      $(this).addClass("default");
  });
}

function splitterMouseUp(evt) {
  //LOG.debug("Splitter Mouse up: " + evt.pageX + " " + evt.pageY);
  $('#splitter').data("moving", false);
  $(document).off('mouseup', null, splitterMouseUp);
  $(document).off('mousemove', null, splitterMouseMove);

  $('#page_content').css("-webkit-user-select", "text");
  $('#toc_content').css("-webkit-user-select", "text");
  $('#content').css("-webkit-user-select", "text");
}

function splitterMouseMove(evt) {
  //LOG.debug("Splitter Mouse move: " + evt.pageX + " " + evt.pageY);
  var splitter = $('#splitter');
  if (splitter.data("moving")) {
    var m = 0 - splitter.data('start-page_content');
    var d = Math.max(m, splitter.data("start-x") - evt.pageX);
    var w = splitter.data("start-toc_content") - d;
    var init_w = 258; // TBD unhardcode

    if (w < init_w) {
      d -= init_w - w;
      w = init_w;
    }

    //LOG.debug("Splitter Mouse move: " + d);
    $('#toc_content').css({'width': w + "px"});
    $('#page_content').css({'padding-right':
                            (splitter.data("start-page_content") + d) +
                            "px"});
    splitter.css({'left':
                  (splitter.data("start-splitter") - d) +
                  "px"});
  }
}

function splitterMouseDown(evt) {
  //LOG.debug("Splitter Mouse down: " + evt.pageX + " " + evt.pageY);
  var splitter = $('#splitter');
  splitter.data("start-x", evt.pageX);
  splitter.data("start-toc_content", parseInt($('#toc_content').css('width'), 10));
  splitter.data("start-page_content",
                parseInt($('#page_content').css('padding-right'), 10));
  splitter.data("start-splitter",
                parseInt(splitter.css('left'), 10));
  splitter.data("moving", true);

  $(document).on('mouseup', null, splitterMouseUp);
  $(document).on('mousemove', null, splitterMouseMove);

  $('#toc_content').css("-webkit-user-select", "none");
  $('#page_content').css("-webkit-user-select", "none");
  $('#content').css("-webkit-user-select", "none");
}

function tocFilterUpdate()
{
  //LOG.debug("tocFilterUpdate", previousFilterText);

  // Is the filter set or clear?
  // Must set previousFilterText *after* testing.
  if (previousFilterText) {
    previousFilterText = null;
    $("#config-filter").trigger('keyup');
    return;
  }

  // Setting previous to null acts like a poison value,
  // forcing the filter to update.
  previousFilterText = null;
  $("#config-filter-close-button").trigger('click');
}

// toc_filter.js
