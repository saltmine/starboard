/*global window, document, alert, Image, Math, Array, XDomainRequest */
(function(window, document) {
  "use strict";

  var body = document.body;
  var ceil = Math.ceil;
  var concat = Array.prototype.concat;
  var indexOf = String.prototype.indexOf;
  var trim = String.prototype.trim;

  // Is the bookmarklet grid active
  var isLive = false;

  // Container for page imgs
  var pageImgs = {};

  var thumb_wh = 180;
  // Image size thresholds
  var img_min_w = 100;
  var img_min_h = 100;
  var ratio_threshold = 0.25;
  var blacklist = [
    'sprite',
    'spacer'
  ];
  var blacklist_len = 0;

  // Don't include images from these domains
  var domain_blacklist = [
    //'g-ecx.images-amazon.com'
    'doubleclick.net'
  ];
  var domain_blacklist_len = 0;

  var script_host = '//keep.com';
  var script_host_unsecure = 'http://keep.com';
  var cssRules = "#kpmrk_blocker{position:absolute;top:0;right:0;bottom:0;left:0;width:100%;border:0;background:transparent;z-index:1000000000}#kpmrk_bg{position:absolute;top:0;right:0;bottom:0;left:0;width:100%;background-color:#fff;opacity:.95;z-index:1000000001}#kpmrk{position:absolute;top:0;left:0;height:100%;width:100%;z-index:1000000002;font-family:'Helvetica Neue',Arial,Helvetica,sans-serif;font-weight:normal;color:#111}#kpmrk a{font-weight:normal;color:#111;text-transform:none}#kpmrk #kpmrk_grid{position:absolute;top:40px;left:0;z-index:1;overflow:hidden;opacity:0}#kpmrk #kpmrk_grid.kpmrk_active{opacity:1;-webkit-transition:opacity 500ms ease-out .5s;-moz-transition:opacity 500ms ease-out .5s;-ms-transition:opacity 500ms ease-out .5s;-o-transition:opacity 500ms ease-out .5s;transition:opacity 500ms ease-out .5s}#kpmrk .kpmrk_itm_lnk{display:block;position:relative;float:left;width:200px;height:200px;border-width:0 1px 1px 0;border-style:solid;border-color:#fff;background:transparent;cursor:pointer;text-align:center;font-weight:normal;color:#111}#kpmrk .kpmrk_img{position:absolute;top:10px;left:10px;width:180px;height:180px;overflow:hidden;background:#fff;z-index:-1;opacity:1;filter:alpha(opacity=100);-webkit-transition:opacity 400ms ease-out;-moz-transition:opacity 400ms ease-out;-ms-transition:opacity 400ms ease-out;transition:opacity 400ms ease-out}#kpmrk .kpmrk_itm_lnk:hover .kpmrk_img{opacity:.5;filter:alpha(opacity=50);-webkit-transition:none;-moz-transition:none;-ms-transition:none;transition:none}#kpmrk .kpmrk_img img{display:block}#kpmrk .kp_overlay{display:none;position:absolute;left:0;width:100%;top:0;height:100%;text-align:center;z-index:1}#kpmrk .kpmrk_itm_lnk:hover .kp_overlay{display:block}#kpmrk .kp_overlay .kpmrk_btn{width:90px;padding:8px;margin-top:85px}#kpmrk .kpmrk_itm_lnk .kp_size{display:block;width:65px;text-align:center;position:absolute;bottom:-1px;left:68px;padding:5px;font-size:10px;background-color:#f0eeea;border-width:2px 2px 0 2px;border-style:solid;border-color:#fff;text-decoration:none;color:#333;box-shadow:inset 0 3px 2px rgba(0,0,0,0.1);white-space:nowrap}#kpmrk #kpmrk_bar{position:fixed;display:block;height:40px;width:100%;z-index:9;background-color:#f7f6e8;float:none}#kpmrk #kpmrk_header{display:block;margin:0;padding:5px 0 0 10px;color:#4d4d4d;font-size:18px;line-height:28px;font-weight:bold;text-align:left;float:none}#kpmrk #kpmrk_close{padding:6px 12px;margin:7px 15px 0 0;float:right}#kpmrk .kpmrk_btn{text-decoration:none;display:inline-block;*display:inline;*zoom:1;padding:2px 6px;font-size:9px;line-height:14px;letter-spacing:3px;color:#fff;text-align:center;vertical-align:middle;background-color:#4d4d4d;border-radius:3px;cursor:pointer;*margin-left:.3em;text-transform:uppercase}#kpmrk .kpmrk_btn:hover{color:#fff;text-decoration:none;background-color:#000}#kpmrk_hold{visibility:hidden;position:absolute;top:0;left:0;height:10px;width:10px;overflow:hidden}";


  // Elems
  var grid_blocker = false;
  var grid_bg = false;
  var grid = false;
  var grid_ul = false;

  // Most likely price
  var price = '';
  var pricesRE = /\$\s?[\d][\d\,\.]*/;
  var priceStripRE = /[^\d\.]/g;

  var SCORE_MAX_PRICE = 0.1;
  var SCORE_PRICE_TO_CONTAINER_LENGTH = 0.5;
  var SCORE_FONT_SIZE = 0.8;
  var SCORE_FONT_WEIGHT = 0.2;
  var SCORE_POSITION = 0.7;
  var SCORE_HAS_PRICE_MICRODATA = 0.9;

  var NUM_RELEVANT_ITEM_THRESHOLD = 3;

  /**
   * Simple reduce to compensate for sites overriding Array.prototype.reduce.
   * @param {Array} arr
   * @param {Function} callback
   * @param initial value
   * @return reduced val
   */
  function reduce(arr, callback, initial) {
    var len = arr.length;
    var n = 0;
    var val = initial;

    for (; n < len; n++) {
      val = callback(val, arr[n], n);
    }

    return val;
  }

  /**
   * Make a dom element and assign any included properties.
   * @param {String} element type
   * @param {Object} properties
   * @return {Element} dom el
   */
  function makeEl(type, props) {
    var el = document.createElement(type);
    var p;

    for (p in props) {
      if (el.hasOwnProperty(p) && typeof el[p] === 'string') {
        el[p] = props[p];
      } else {
        el.setAttribute(p, props[p]);
      }
    }
    return el;
  }


  /**
   * Shortcut to create a text node under an existing element.
   * @param {Element} el
   * @param {String} text
   * @return {Element} the modified element
   */
  function text(node, txt) {
    node.appendChild(document.createTextNode(txt));
    return node;
  }

  /**
   * Track an action server-side.
   * @param {String} subject
   * @param {Object} data
   */
  var track = function(subject, data) {
    //#ifdef tracking
    var reqData = 'subject=' + encodeURIComponent(subject);
    var k;
    var xhr = new XMLHttpRequest();

    if ("withCredentials" in xhr) {
      xhr.open('POST', script_host + '/service/1.0/event/track', true);
      xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');

    } else if (typeof XDomainRequest !== "undefined") {
      xhr = new XDomainRequest();
      xhr.open('POST', script_host + '/service/1.0/event/track');

    } else {
      return;
    }

    if (!data) {
      data = {};
    }
    data.browser = window.navigator.userAgent;
    data.url = window.location.href;

    for (k in data) {
      if (data.hasOwnProperty(k)) {
        reqData += '&data[' + encodeURIComponent(k) + ']=' +
            encodeURIComponent(JSON.stringify(data[k]));
      }
    }

    xhr.send(reqData);
    //#end
  };

  var k = window._k_ = {
    init: function() {
      var host;
      var prices;

      if (true === isLive) {
        return;
      }

      blacklist_len = blacklist.length;
      domain_blacklist_len = domain_blacklist.length;

      k.loadCSS();

      track('keepmark:loaded');

      host = window.location.host;
      if (
        indexOf.call(host, 'keep.com') !== -1 &&
        indexOf.call(host, 'blog.keep.com') !== 0
      ) {
        alert('You have successfully installed the keepmark. You can now Keep products from shopping sites across the web.');
        return;
      }

      // Create our grid and hide it
      k.createStructure();

      // Attach our product selection
      grid_ul.addEventListener('click', k.onImgSelected, true);

      document.getElementById('kpmrk_close')
          .addEventListener('click', k.grid_hide, false);

      k.findImages();
      prices = k.findPrice();
      if (prices) {
        price = prices.price;
      }
    },


    /**
     * Load CSS
     */
    loadCSS: function() {
      var cssEl = makeEl('style', {
        type: 'text/css'
      });

      text(cssEl, cssRules);
      body.appendChild(cssEl);
    },


    /**
     * Get the absolute url of an image.
     * @param {String} url of image
     * @return {String} absolute url of image
     */
    absUrlForImage: function(url) {
      var tmpImg;

      url = url
        .replace(/^\s+/, '')
        .replace(/\s+$/, '');

      // is the image absolute?
      if (/^http(s?):/.test(url)) {
        return url;
      }

      // Creating an image will convert any relative path to absolute
      tmpImg = new Image();
      tmpImg.src = url;
      url = tmpImg.src;

      return url;
    },


    /**
     * Create the grid structure.
     */
    createStructure: function() {
      var fragment = document.createDocumentFragment();
      var kpmrkBarEl;
      var tmpEl;

      grid_blocker = makeEl('iframe', {
        id: 'kpmrk_blocker',
        width: '100%',
        height: '100%',
        transparent: 'transparent'
      });

      grid_bg = makeEl('div', { id: 'kpmrk_bg' });
      grid = makeEl('div', { id: 'kpmrk' });

      kpmrkBarEl = makeEl('div', { id: 'kpmrk_bar' });

      tmpEl = makeEl('a', {
        id: 'kpmrk_close',
        class: 'kpmrk_btn'
      });
      text(tmpEl, "Close");
      kpmrkBarEl.appendChild(tmpEl);

      tmpEl = makeEl('div', {
        id: 'kpmrk_header'
      });
      text(tmpEl, "Please select a product to Keep");
      kpmrkBarEl.appendChild(tmpEl);

      grid.appendChild(kpmrkBarEl);

      grid_ul = makeEl('div', { id: 'kpmrk_grid' });
      grid.appendChild(grid_ul);
      grid_bg.style.cssText = 'height:' + document.height + 'px';
      fragment.appendChild(grid_blocker);
      fragment.appendChild(grid_bg);
      fragment.appendChild(grid);
      body.appendChild(fragment);

      track('keepmark:draw_grid');

      k.grid_show();
    },

    /**
     * Show the grid and scroll to the top of the page.
     */
    grid_show: function() {
      isLive = true;

      window.addEventListener('keyup', k.onKeyHandler, false);

      // if the site hasn't overwritten scroll() with a custom method, jump to
      // the top.
      if (!window.hasOwnProperty('scroll')) {
        window.scroll(0, 0);
      }
    },

    /**
     * Key handlers
     * @param {Object} Event
     */
    onKeyHandler: function(ev) {
      // Esc key closes bookmarklet
      if (ev.which === 27) {
        k.grid_hide();
      }
    },

    /**
     * Hide the grid
     */
    grid_hide: function() {
      document.getElementById('kpmrk_close')
          .removeEventListener('click', k.grid_hide, false);
      grid_ul.removeEventListener('click', k.onImgSelected, true);
      window.removeEventListener('keyup', k.onKeyHandler, false);

      body.removeChild(grid);
      body.removeChild(grid_bg);
      body.removeChild(grid_blocker);

      isLive = false;
    },


    /**
     * Add an image url to the grid, looking up size information in prodImgs.
     * @param {String} url
     * @param {Boolean} compareWidth
     */
    addImgToGrid: function(url, compareWidth) {
      var img = pageImgs[url];
      var ratio = img.width/img.height;
      var thumbWidth, thumbHeight, marginStr;
      var children;
      var len;
      var n;
      var childUrl;

      if (img.width > img.height) {
        thumbHeight = thumb_wh;
        thumbWidth = ceil(thumbHeight * ratio);
        marginStr = 'margin-left:-'+ceil((thumbWidth - thumb_wh)/2)+'px';
      } else {
        thumbWidth = thumb_wh;
        thumbHeight = ceil(thumbWidth / ratio);
        marginStr = 'margin-top:-'+ceil((thumbHeight - thumb_wh)/2)+'px';
      }

      var productEl = makeEl('a', {
        class: "kpmrk_itm_lnk"
      });
      var imgContEl = makeEl('span', {
        class: "kpmrk_img"
      });
      var imgEl = makeEl('img', {
        src: url,
        width: thumbWidth,
        height: thumbHeight
      });
      imgEl.style.cssText = marginStr;
      imgContEl.appendChild(imgEl);
      productEl.appendChild(imgContEl);

      var overlayEl = makeEl('span', {
        class: "kp_overlay"
      });
      var lnkEl = makeEl('span', {
        class: "kpmrk_btn"
      });
      text(lnkEl, "Keep It");
      overlayEl.appendChild(lnkEl);
      productEl.appendChild(overlayEl);

      var sizeEl = makeEl('span', {
        class: "kp_size"
      });
      text(sizeEl, img.width + ' x ' + img.height);
      productEl.appendChild(sizeEl);

      if (!compareWidth || !grid_ul.children.length) {
        grid_ul.appendChild(productEl);

        if (indexOf.call(grid_ul.className, 'kpmrk_active') === -1) {
          grid_ul.className += ' kpmrk_active';
        }
        return;
      }

      children = grid_ul.children;

      for (n = 0, len = children.length; n < len; n++) {
        childUrl = children[n].querySelector('img').src;
        if (img.width > pageImgs[childUrl].width) {
          grid_ul.insertBefore(productEl, children[n]);
        }
      }
    },


    /**
     * Grab all loaded images and sort since we know dimensions
     * @returns {Array}
     */
    getLoadedImages: function() {
      var els = document.images;
      var n;
      var el;
      var url;
      var meta;
      var imgs = [];

      n = els.length;
      while (--n >= 0) {
        el = els[n];
        // loaded urls are already absolute. no need to convert
        url = el.src;

        if (
          !url ||
          k.isURLBlacklisted(url)
        ) {
          continue;
        }
        if (pageImgs[url]){
          // Check to see if the existing image is loaded and
          // the new image has dimensions, if so, continue to next
          if (pageImgs[url].width || !el.width) {
            continue;
          }
        }

        meta = {
          src: url,
          width: el.naturalWidth || el.width,
          height: el.naturalHeight || el.height
        };
        pageImgs[url] = meta;

        if (k.isValidDimensions(meta.width, meta.height)) {
          imgs.push(meta);
        }
      }

      return imgs;
    },


    /**
     * Grab all Open Graph Images.
     * @returns {Array}
     */
    getOGImages: function() {
      var imgs = [];
      var og_images;
      var url;
      var n;
      var meta;

      og_images = document.querySelectorAll('meta[property="og:image"]');

      n = og_images.length;
      while (--n >= 0) {
        url = og_images[n].getAttribute('content');
        url = k.absUrlForImage(url);

        if (
          !url ||
          k.isURLBlacklisted(url)
        ) {
          continue;
        }

        if (pageImgs[url]) {
          pageImgs[url].og = true;
          continue;
        }

        meta = {
          src: url,
          width: 0,
          height: 0,
          og: true
        };
        pageImgs[url] = meta;
        imgs.push(meta);
      }

      return imgs;
    },


    /**
     * Grab anything image-like i.e. css-backgrounds, json imgs, etc.
     * @returns {Array}
     */
    getRawImages: function() {
      var imgs_raw;
      var imgs = [];
      var url;
      var n;
      var meta;

      // Check the page for css backgrounds, json imgs, etc
      imgs_raw = body.innerHTML.match(/([\w\d\-\/\:\.]*\.(jpg|jpeg|png|gif))/ig) || [];
      n = imgs_raw.length;
      while (--n >= 0) {
        url = imgs_raw[n];
        url = k.absUrlForImage(url);

        if (
          !url ||
          pageImgs[url] ||
          k.isURLBlacklisted(url)
        ) {
          continue;
        }

        meta = {
          src: url,
          width: 0,
          height: 0
        };
        pageImgs[url] = meta;
        imgs.push(meta);
      }

      return imgs;
    },


    /**
     * Find all usable images on the page and either add to our grid if
     * dimensions are known or load image to determine dimensions and
     * then add to grid.
     */
    findImages: function() {
      var n;
      var imgs;
      var img;
      var tmpImg;

      pageImgs = {};

      imgs = concat.call([],
        k.getLoadedImages(),
        k.getOGImages(),
        k.getRawImages()
      );

      if (!imgs.length) {
        k.grid_hide();
        track('keepmark:images_loaded', {
          'num_images': 0
        });
        alert('Sorry, the Keepmark could not find any images to Keep on this page.');
        return;
      }

      imgs.sort(function(a, b) {
        return a.width - b.width;
      });

      n = imgs.length;
      while (--n >= 0) {
        img = imgs[n];

        if (img.width) {
          // If width is defined, we've already loaded the image and can add
          // right to the grid
          k.addImgToGrid(img.src);

        } else {
          // Create a temporary image to get the dimensions before adding to
          // the grid.
          tmpImg = new Image();
          tmpImg.onload = k.onImgLoaded;
          tmpImg.src = img.src;
        }
      }
    },


    /**
     * Image loaded callback. If dimensions are valid, add to the grid.
     */
    onImgLoaded: function() {
      var img = pageImgs[this.src];

      img.width = this.naturalWidth || this.width;
      img.height = this.naturalHeight || this.height;

      if (k.isValidDimensions(img.width, img.height)) {
        k.addImgToGrid(img.src, true);
      }
    },


    /**
     * Find the most likely price on the page. Criteria include:
     * -looks like USD
     * -is visible on page
     * We sort first by font-size of each element and descending price.
     * @returns {Object} object with most likely price.
     */
    findPrice: function() {
      var pricesRaw = [];
      var els = document.querySelectorAll('*');
      var n = els.length;
      var priceObj;

      while (--n >= 0) {
        priceObj = k.validatePrice(els[n]);
        if (priceObj) {
          pricesRaw.push(priceObj);
        }
      }

      if (!pricesRaw.length) {
        return;
      }

      pricesRaw = k.removeRelated(pricesRaw);
      pricesRaw = k.scorePriceEls(pricesRaw);

      pricesRaw.sort(function(a, b) {
        if (a.score < b.score) {
          return 1;
        } else if (a.score > b.score) {
          return -1;
        }
        return 0;
      });

      return pricesRaw[0];
    },

    /**
     * Validate the price contained within a node, returning a price obj if
     * valid, false if not.
     * @param {Element} el containing price
     * @returns {Object|Boolean} price object on valid, false if not
     */
    validatePrice: function(el) {
      var matches;
      var foundPrice;
      var bounds;
      var styles;
      var price = 0;
      var n;

      matches = el.textContent.match(pricesRE);
      if (!matches) {
        return;
      }
      foundPrice = matches[0];

      price = parseFloat(foundPrice.replace(priceStripRE,''));
      if (!price) {
        return false;
      }

      // Scan the children of this node. If the found price is contained within
      // a node, prefer that over this mention.
      n = el.children.length;
      while (--n >= 0) {
        if (indexOf.call(el.children[n].textContent, foundPrice) !== -1) {
          return false;
        }
      }

      // If inlined node, grab from parent
      // TODO: should we traverse up until we find a valid ClientRect or is
      // there danger of hitting body and throwing of positional scores?
      bounds = el.getBoundingClientRect();
      if (!bounds.width || !bounds.height) {
        bounds = el.parentElement.getBoundingClientRect();
      }
      styles = window.getComputedStyle(el);

      // Don't include if not visible
      if (!(
          bounds.bottom || bounds.top || bounds.left || bounds.right ||
          bounds.height || bounds.width
      )) {
        return false;
      }

      // Don't include original price for sale-items if styled with
      // strikethrough.
      if (styles.getPropertyValue('text-decoration') === 'line-through') {
        return false;
      }

      return {
        el: el,
        price: foundPrice,
        priceF: price,
        size: parseFloat(styles.getPropertyValue('font-size')),
        styles: styles,
        bounds: {
          top: parseInt(bounds.top, 10),
          bottom: parseInt(bounds.bottom, 10),
          left: parseInt(bounds.left, 10),
          right: parseInt(bounds.right, 10),
          height: parseInt(bounds.height, 10),
          width: parseInt(bounds.width, 10),
        },
        scores: {},
        score: 1
      };
    },

    scorePriceEls: function(els) {
      var n;
      var o;
      var docHeight = document.body.clientHeight;
      var maxPrice = reduce(els, function(maxPrice, o) {
        return o.priceF > maxPrice ? o.priceF : maxPrice;
      }, 0);
      var maxFontSize = reduce(els, function(maxFontSize, o) {
        return o.size > maxFontSize ? o.size : maxFontSize;
      }, 0);

      n = els.length;
      while (--n >= 0) {
        o = els[n];

        // Proximity to the top of the document
        o.scores.position = (docHeight - o.bounds.top) / docHeight * SCORE_POSITION;

        // Proportion of price length to element contents length
        o.scores.price_to_container_length = o.price.length / trim.call(o.el.textContent).length * SCORE_PRICE_TO_CONTAINER_LENGTH;

        // Highest price on the page
        o.scores.max_price = o.priceF / maxPrice * SCORE_MAX_PRICE;

        // Has microdata price attribute
        if (
          o.el.getAttribute('itemprop') === 'price' ||
          o.el.innerHTML.match(/itemprop=.?price/i)
        ) {
          o.scores.has_price_microdata = SCORE_HAS_PRICE_MICRODATA;
        } else {
          o.scores.has_price_microdata = 0;
        }

        // Font size
        o.scores.font_size = o.size / maxFontSize * SCORE_FONT_SIZE;

        // Font weight
        if (o.styles.fontWeight === 'bold') {
          o.scores.font_weight = SCORE_FONT_WEIGHT;
        } else {
          o.scores.font_weight = 0;
        }

        o.score = (
          o.scores.position +
          o.scores.price_to_container_length +
          o.scores.max_price +
          o.scores.has_price_microdata +
          o.scores.font_size +
          o.scores.font_weight
        ) / 6;
      }

      return els;
    },

    /**
     * Filter out similarly positioned prices, under the presumption that
     * they're "related" items.
     * @param {Array} price objs
     * @returns {Array} price objs
     */
    removeRelated: function(objs) {
      var groupByX = [];
      var groupByY = [];
      var n;
      var o;

      n = objs.length;
      while (--n >= 0) {
        o = objs[n];
        if (!groupByX[o.bounds.left]) {
          groupByX[o.bounds.left] = 1;
        } else {
          groupByX[o.bounds.left] += 1;
        }

        if (!groupByY[o.bounds.top]) {
          groupByY[o.bounds.top] = 1;
        } else {
          groupByY[o.bounds.top] += 1;
        }
      }

      objs = k.filterRelatedGroup(objs, groupByX, 'left');
      objs = k.filterRelatedGroup(objs, groupByY, 'top');

      return objs;
    },

    /**
     * Filter a group of price objs, removing sets of prices set on
     * a specific dimension if they pass a threshold.
     * @param {Array} price objects
     * @param {Array} counted groups of bounded price objs
     * @param {String} the dimension to use for the check
     * @returns {Array} filtered price objects
     */
    filterRelatedGroup: function(objs, groupedCol, posType) {
      var pos;
      var n;
      var posInt;

      for (pos in groupedCol) {
        if (
          groupedCol.hasOwnProperty(pos) &&
          groupedCol[pos] <= NUM_RELEVANT_ITEM_THRESHOLD
        ) {
          continue;
        }
        n = objs.length;
        posInt = parseInt(pos, 10);
        while (--n >= 0) {
          if (objs[n].bounds[posType] === posInt) {
            objs.splice(n, 1);
          }
        }
      }

      return objs;
    },

    /**
     * Is either the image domain or url blacklisted.
     * @param {String} url
     * @returns {Boolean} True if image is blacklisted
     */
    isURLBlacklisted: function(url) {
      var len;
      var img_name;

      len = domain_blacklist_len;
      while (--len >= 0) {
        if (indexOf.call(url, domain_blacklist[len]) !== -1) {
          return true;
        }
      }

      // Check if image name is blacklisted
      img_name = url.split('/').pop().toLowerCase();
      len = blacklist_len;
      while (--len >= 0) {
        if (indexOf.call(img_name, blacklist[len]) !== -1) {
          return true;
        }
      }

      return false;
    },


    /**
     * Do an image's width, height and w/h ratios exceed our thresholds.
     * @param {Number} width
     * @param {Number} height
     * @returns {Boolean} validity
     */
    isValidDimensions: function(width, height) {
      var ratio;

      // Check for minimum dimension thresholds
      if (width < img_min_w || height < img_min_h) {
        return false;
      }

      // Check for ratio
      if (width < height) {
        ratio = width / height;
      } else {
        ratio = height / width;
      }

      if (ratio < ratio_threshold) {
        return false;
      }

      return true;
    },


    /**
     * Event handler for a product being selected
     * @param {Object} click event
     */
    onImgSelected: function(ev) {
      var target = ev.target;

      while (target.nodeName !== 'A') {
        target = target.parentNode;
      }

      k.create_popup(target.querySelector('img').src);

      k.grid_hide();

      return false;
    },


    /**
     * Open a new window with our page url, selected image, title and price
     * @param {url}
     */
    create_popup: function(url) {
      var title = document.title;
      var productStr;
      var canonicalLinkEl = document.querySelector("link[rel='canonical']");
      var originUrl;
      var og_title = document.querySelector('meta[property="og:title"]');

      if (og_title) {
        title = og_title.getAttribute('content') || title;
      }

      productStr = 'origin_url=' + encodeURIComponent(window.location.href) +
        '&image_url=' + encodeURIComponent(url) +
        '&title=' + encodeURIComponent(title) +
        '&price=' + encodeURIComponent(price);

      if (
        canonicalLinkEl &&
        canonicalLinkEl.hasOwnProperty('href') &&
        // Throw away if obviously the url contains spaces, it's not a good
        // candidate.
        indexOf.call(canonicalLinkEl.href, ' ') === -1
      ) {
        productStr += '&canonical_url=' + encodeURIComponent(canonicalLinkEl.href);
      }
      console.log(window.screen.height, window.screen.width)
      var height = (window.screen.height / 2) - (390 / 2);
      var width = (window.screen.width / 2) - (640 / 2);
      window.open(
        script_host_unsecure + '/keepmark/?' + productStr,
        'KeepMark',
        'status=0,directories=0,location=0,resizable=0,menubar=0,scrollbars=0,width=640,height=390,toolbar=0,top='+ height+', left='+ width
      );
    }
  };

  //#ifdef init
  k.init();
  //#end

  return k;

}(window, document));

